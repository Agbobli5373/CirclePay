import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { MoolreService } from '../moolre/moolre.service'
import { MoolreError } from '../moolre/moolre.client'
import type { InitiateDepositDto } from './dto/deposits.dto'

const ENDPOINT = 'POST /deposits'

/** MoMo collection channel per network. */
function channelFor(network: string): '13' | '6' | '7' {
  if (network === 'Telecel') return '6'
  if (network === 'AirtelTigo') return '7'
  return '13' // MTN
}
function toMoolrePayer(phone: string): string {
  return phone.replace(/^\+/, '')
}
function amountString(pesewas: number): string {
  return (pesewas / 100).toFixed(2)
}

export interface InitiateResult {
  statusCode: number
  body: Record<string, unknown>
}

/**
 * Deposit collection (Phase 2 / E4 deposit leg) — a member pays their Susu security
 * deposit via Moolre collection (with OTP), request-idempotent (Idempotency-Key) and
 * externalref-deduped (`d:{fundId}:{userId}`). Settlement is async (DepositSettlementService);
 * the canonical "paid" flag is Member.depositPaid, so no separate Deposit row is needed.
 */
@Injectable()
export class DepositsService {
  private readonly logger = new Logger(DepositsService.name)

  constructor(
    private readonly db: PrismaService,
    private readonly moolre: MoolreService,
  ) {}

  async initiate(
    userId: string,
    dto: InitiateDepositDto,
    idempotencyKey: string | undefined,
  ): Promise<InitiateResult> {
    if (!idempotencyKey) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'An Idempotency-Key header is required' })
    }
    const prior = await this.db.idempotencyKey.findUnique({ where: { key: idempotencyKey } })
    if (prior) return { statusCode: prior.statusCode, body: prior.response as Record<string, unknown> }

    const user = await this.db.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' })

    const member = await this.db.member.findUnique({ where: { fundId_userId: { fundId: dto.fundId, userId } } })
    if (!member) throw new ForbiddenException({ code: 'NOT_MEMBER', message: 'You are not a member of this fund' })

    const fund = await this.db.fund.findUnique({ where: { id: dto.fundId }, include: { susu: true } })
    if (!fund || !fund.susu) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Fund not found' })
    if (!fund.susu.requiresDeposit || fund.susu.depositAmount <= 0) {
      throw new ConflictException({ code: 'NO_DEPOSIT_REQUIRED', message: 'This fund does not require a deposit' })
    }
    if (fund.status !== 'active') {
      throw new ConflictException({ code: 'FUND_INACTIVE', message: 'This fund is not open' })
    }

    const amount = fund.susu.depositAmount
    const externalref = `d:${dto.fundId}:${userId}`
    const body = { externalref, amount, fundId: dto.fundId }

    if (member.depositPaid) {
      return this.store(idempotencyKey, userId, 200, { state: 'settled', ...body })
    }

    try {
      const result = await this.moolre.collect({
        channel: channelFor(user.network),
        payer: toMoolrePayer(user.phone),
        amount: amountString(amount),
        externalref,
        otpcode: dto.otpcode,
      })

      if (result.otpRequired) {
        // Non-terminal: don't store idempotency so the client can resubmit with otpcode.
        return { statusCode: 200, body: { state: 'otp_required', ...body } }
      }
      return this.store(idempotencyKey, userId, 202, { state: 'initiated', ...body })
    } catch (e) {
      // Duplicate externalref (TP13) — resolve the real state instead of double-charging.
      if (e instanceof MoolreError && e.code === 'TP13') {
        const settled = await this.moolre.isSettled(externalref).catch(() => false)
        return this.store(idempotencyKey, userId, 202, { state: settled ? 'settled' : 'initiated', ...body })
      }
      const code = e instanceof MoolreError ? e.code : 'PAYMENT_FAILED'
      this.logger.warn(`Deposit collection failed for ${externalref}: ${code}`)
      throw new HttpException({ code: 'PAYMENT_FAILED', message: `Collection failed (${code})` }, HttpStatus.BAD_GATEWAY)
    }
  }

  private async store(
    key: string,
    userId: string,
    statusCode: number,
    body: Record<string, unknown>,
  ): Promise<InitiateResult> {
    try {
      await this.db.idempotencyKey.create({
        data: { key, userId, endpoint: ENDPOINT, statusCode, response: body as Prisma.InputJsonValue },
      })
    } catch {
      // Concurrent double-tap stored it first — unique violation is fine.
    }
    return { statusCode, body }
  }

  /** Status for the deposit pay flow to poll until settled. Owner-only. */
  async getOne(userId: string, externalref: string) {
    const parts = externalref.split(':')
    if (parts[0] !== 'd' || parts.length !== 3) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Deposit not found' })
    }
    const [, fundId, owner] = parts
    if (owner !== userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not your deposit' })
    const member = await this.db.member.findUnique({ where: { fundId_userId: { fundId, userId } } })
    if (!member) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Deposit not found' })
    const fund = await this.db.fund.findUnique({ where: { id: fundId }, include: { susu: true } })
    return {
      externalref,
      fundId,
      amount: fund?.susu?.depositAmount ?? 0,
      status: member.depositPaid ? 'settled' : 'initiated',
      depositPaid: member.depositPaid,
    }
  }
}
