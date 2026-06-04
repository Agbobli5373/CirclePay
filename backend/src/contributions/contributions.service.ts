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
import { ConfigService } from '@nestjs/config'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { MoolreService } from '../moolre/moolre.service'
import { MoolreError } from '../moolre/moolre.client'
import type { InitiateContributionDto } from './dto/contributions.dto'

const ENDPOINT = 'POST /contributions'

/** MoMo collection channel per network. */
function channelFor(network: string): '13' | '6' | '7' {
  if (network === 'Telecel') return '6'
  if (network === 'AirtelTigo') return '7'
  return '13' // MTN
}
/** Moolre wants the local/international number without a leading '+'. */
function toMoolrePayer(phone: string): string {
  return phone.replace(/^\+/, '')
}
/** Pesewas → GHS major-unit string, e.g. 50000 → "500.00". */
function amountString(pesewas: number): string {
  return (pesewas / 100).toFixed(2)
}

export interface InitiateResult {
  statusCode: number
  body: Record<string, unknown>
}

/**
 * E4-S1 — initiate a cycle contribution via Moolre collection (with OTP),
 * request-idempotent (Idempotency-Key header) and externalref-deduped.
 * Settlement is async (see ContributionSettlementService); nothing is marked
 * paid here.
 */
@Injectable()
export class ContributionsService {
  private readonly logger = new Logger(ContributionsService.name)

  constructor(
    private readonly db: PrismaService,
    private readonly moolre: MoolreService,
    private readonly config: ConfigService,
  ) {}

  private platformFee(amount: number): number {
    const flat = Number(this.config.get<string>('PLATFORM_FEE_FLAT') ?? 0)
    const bps = Number(this.config.get<string>('PLATFORM_FEE_BPS') ?? 0)
    return Math.max(0, Math.round(flat + (amount * bps) / 10000))
  }

  async initiate(
    userId: string,
    dto: InitiateContributionDto,
    idempotencyKey: string | undefined,
  ): Promise<InitiateResult> {
    if (!idempotencyKey) {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'An Idempotency-Key header is required',
      })
    }
    // Replay a previously stored TERMINAL response (double-tap protection).
    const prior = await this.db.idempotencyKey.findUnique({ where: { key: idempotencyKey } })
    if (prior) return { statusCode: prior.statusCode, body: prior.response as Record<string, unknown> }

    const user = await this.db.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' })

    const member = await this.db.member.findUnique({
      where: { fundId_userId: { fundId: dto.fundId, userId } },
    })
    if (!member || member.fundStatus !== 'active') {
      throw new ForbiddenException({ code: 'NOT_MEMBER', message: 'You are not an active member of this fund' })
    }

    const fund = await this.db.fund.findUnique({ where: { id: dto.fundId }, include: { susu: true } })
    if (!fund || !fund.susu) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Fund not found' })
    if (fund.status !== 'active') {
      throw new ConflictException({ code: 'FUND_INACTIVE', message: 'This fund is not open' })
    }
    if (!fund.susu.startedAt) {
      throw new ConflictException({ code: 'FUND_NOT_STARTED', message: 'This Susu has not started yet (waiting for members)' })
    }

    const cycle = fund.susu.currentCycle
    const externalref = `c:${dto.fundId}:${cycle}:${userId}`
    const amount = fund.susu.contribution
    const fee = this.platformFee(amount)
    const total = amount + fee
    const body = { externalref, amount, fee, total, cycle, fundId: dto.fundId }

    const existing = await this.db.contribution.findUnique({ where: { externalref } })
    if (existing?.status === 'settled') {
      return this.store(idempotencyKey, userId, 200, { state: 'settled', ...body })
    }

    await this.db.contribution.upsert({
      where: { externalref },
      create: { fundId: dto.fundId, userId, cycle, amount, fee, total, network: user.network, externalref, status: 'initiated' },
      update: { status: 'initiated', amount, fee, total, network: user.network },
    })

    try {
      const result = await this.moolre.collect({
        channel: channelFor(user.network),
        payer: toMoolrePayer(user.phone),
        amount: amountString(total),
        externalref,
        otpcode: dto.otpcode,
      })

      if (result.otpRequired) {
        // Non-terminal: do NOT store idempotency, so the client can resubmit with otpcode.
        return { statusCode: 200, body: { state: 'otp_required', ...body } }
      }

      const txId = (result.raw.data as { transactionid?: string | number } | null)?.transactionid
      if (txId != null) {
        await this.db.contribution.update({ where: { externalref }, data: { transactionId: String(txId) } })
      }
      return this.store(idempotencyKey, userId, 202, { state: 'initiated', ...body })
    } catch (e) {
      // Duplicate externalref (TP13) — resolve the real state instead of double-charging.
      if (e instanceof MoolreError && e.code === 'TP13') {
        const settled = await this.moolre.isSettled(externalref).catch(() => false)
        return this.store(idempotencyKey, userId, 202, { state: settled ? 'settled' : 'initiated', ...body })
      }
      await this.db.contribution.update({ where: { externalref }, data: { status: 'failed' } }).catch(() => undefined)
      const code = e instanceof MoolreError ? e.code : 'PAYMENT_FAILED'
      this.logger.warn(`Collection failed for ${externalref}: ${code}`)
      throw new HttpException({ code: 'PAYMENT_FAILED', message: `Collection failed (${code})` }, HttpStatus.BAD_GATEWAY)
    }
  }

  /** Persist + return a terminal response for idempotent replay. */
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

  /** Status for the pay flow to poll until settled. Owner-only. */
  async getOne(userId: string, externalref: string) {
    const c = await this.db.contribution.findUnique({ where: { externalref } })
    if (!c) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Contribution not found' })
    if (c.userId !== userId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not your contribution' })
    return {
      externalref: c.externalref,
      fundId: c.fundId,
      cycle: c.cycle,
      amount: c.amount,
      fee: c.fee,
      total: c.total,
      status: c.status,
      transactionId: c.transactionId,
      settledAt: c.settledAt,
    }
  }
}
