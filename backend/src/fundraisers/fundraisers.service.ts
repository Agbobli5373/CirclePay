import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { payoutPostings } from '@circlepay/shared'
import { PrismaService } from '../prisma/prisma.service'
import { MoolreService } from '../moolre/moolre.service'
import { MoolreError } from '../moolre/moolre.client'
import { LedgerService } from '../ledger/ledger.service'
import { NotificationsService } from '../notifications/notifications.service'
import { OutboxDispatcher } from '../outbox/outbox.dispatcher'
import type { CreateMedicalFundDto, DonateDto, VerifyPayeeDto } from './dto/fundraisers.dto'

/** MoMo collection channel per network. */
function collectionChannel(network: string): '13' | '6' | '7' {
  if (network === 'Telecel') return '6'
  if (network === 'AirtelTigo') return '7'
  return '13'
}
function toMoolrePayer(phone: string): string {
  return phone.replace(/^\+/, '')
}
function ghs(pesewas: number): string {
  return (pesewas / 100).toFixed(2)
}
function slugify(s: string): string {
  const base = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `${base || 'fund'}-${Math.random().toString(36).slice(2, 8)}`
}
function progress(raised: number, goal: number): number {
  return goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0
}

/**
 * EM — Medical / emergency fundraising. INFRA-only deps (never imports funds/contributions/payouts).
 * Donations reuse the Moolre collection flow; a single verified payout reuses the transfer flow.
 * Settlement runs through the outbox: `mc:` → DonationSettled, `mp:` → MedicalPayoutSettled.
 */
@Injectable()
export class FundraisersService implements OnModuleInit {
  private readonly logger = new Logger(FundraisersService.name)

  constructor(
    private readonly db: PrismaService,
    private readonly moolre: MoolreService,
    private readonly ledger: LedgerService,
    private readonly notifications: NotificationsService,
    private readonly dispatcher: OutboxDispatcher,
  ) {}

  onModuleInit(): void {
    this.dispatcher.register('DonationSettled', (p) => this.handleDonationSettled(p))
    this.dispatcher.register('MedicalPayoutSettled', (p) => this.handleMedicalPayoutSettled(p))
  }

  // ---------- EM-S1: create (organizer) ----------

  async createMedical(userId: string, dto: CreateMedicalFundDto) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const slug = slugify(dto.beneficiary)
      try {
        const fund = await this.db.fund.create({
          data: {
            name: dto.name,
            type: 'Medical',
            createdById: userId,
            fundraiser: {
              create: {
                goal: dto.goal,
                raised: 0,
                beneficiary: dto.beneficiary,
                hospital: dto.hospital,
                story: dto.story,
                deadline: dto.deadline,
                shareable: dto.shareable,
                slug,
                payoutRoute: dto.payoutRoute,
                payeeName: dto.payee.name,
                payeeMomo: dto.payee.momo,
                payeeBank: dto.payee.bank,
                verificationStatus: 'unverified',
              },
            },
          },
          include: { fundraiser: true },
        })
        return this.toDetail(fund, fund.fundraiser!, userId, [])
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue // slug clash — retry
        throw e
      }
    }
    throw new ConflictException({ code: 'SLUG_CLASH', message: 'Could not allocate a unique link, try again' })
  }

  // ---------- EM-S2: public view + donate ----------

  async getPublic(slug: string) {
    const fr = await this.db.fundraiserDetail.findUnique({
      where: { slug },
      include: {
        fund: { include: { contributors: { where: { status: 'settled' }, orderBy: { ts: 'desc' }, take: 50 } } },
      },
    })
    if (!fr) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Fundraiser not found' })
    return this.toPublic(fr, fr.fund.contributors)
  }

  async donate(slug: string, dto: DonateDto) {
    const fr = await this.db.fundraiserDetail.findUnique({ where: { slug }, include: { fund: true } })
    if (!fr) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Fundraiser not found' })
    if (fr.fund.status !== 'active') {
      throw new ConflictException({ code: 'FUND_INACTIVE', message: 'This fundraiser is closed' })
    }

    const fundId = fr.fundId
    const externalref = `mc:${fundId}:${dto.donationId}`
    const displayName = dto.anonymous ? 'Anonymous' : dto.displayName?.trim() || 'Anonymous'

    const existing = await this.db.contributor.findUnique({ where: { externalref } })
    if (existing?.status === 'settled') {
      return { state: 'settled' as const, externalref, amount: existing.amount }
    }

    await this.db.contributor.upsert({
      where: { externalref },
      create: {
        fundId,
        externalref,
        amount: dto.amount,
        displayName,
        anonymous: dto.anonymous,
        phone: dto.phone,
        network: dto.network,
        status: 'initiated',
      },
      update: { amount: dto.amount, displayName, anonymous: dto.anonymous, phone: dto.phone, network: dto.network, status: 'initiated' },
    })

    try {
      const res = await this.moolre.collect({
        channel: collectionChannel(dto.network),
        payer: toMoolrePayer(dto.phone),
        amount: ghs(dto.amount),
        externalref,
        otpcode: dto.otpcode,
      })
      if (res.otpRequired) return { state: 'otp_required' as const, externalref, amount: dto.amount }
      return { state: 'initiated' as const, externalref, amount: dto.amount }
    } catch (e) {
      if (e instanceof MoolreError && e.code === 'TP13') {
        const settled = await this.moolre.isSettled(externalref).catch(() => false)
        return { state: (settled ? 'settled' : 'initiated') as 'settled' | 'initiated', externalref, amount: dto.amount }
      }
      await this.db.contributor.update({ where: { externalref }, data: { status: 'failed' } }).catch(() => undefined)
      const code = e instanceof MoolreError ? e.code : 'PAYMENT_FAILED'
      this.logger.warn(`Donation collect failed for ${externalref}: ${code}`)
      throw new HttpException({ code: 'PAYMENT_FAILED', message: `Donation failed (${code})` }, HttpStatus.BAD_GATEWAY)
    }
  }

  /** Public donation status for the donate flow to poll. */
  async donationStatus(slug: string, donationId: string) {
    const fr = await this.db.fundraiserDetail.findUnique({ where: { slug }, select: { fundId: true } })
    if (!fr) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Fundraiser not found' })
    const c = await this.db.contributor.findUnique({ where: { externalref: `mc:${fr.fundId}:${donationId}` } })
    if (!c) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Donation not found' })
    return { status: c.status, amount: c.amount }
  }

  // ---------- EM-S3: ops verify payee ----------

  async verifyPayee(userId: string, fundId: string, dto: VerifyPayeeDto) {
    await this.assertOpsAdmin(userId)
    const fr = await this.db.fundraiserDetail.findUnique({ where: { fundId } })
    if (!fr) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Fundraiser not found' })
    await this.db.fundraiserDetail.update({ where: { fundId }, data: { verificationStatus: dto.decision } })
    return { ok: true as const, verificationStatus: dto.decision }
  }

  // ---------- EM-S4: release single verified payout (organizer) ----------

  async release(userId: string, fundId: string) {
    const fund = await this.db.fund.findUnique({ where: { id: fundId }, include: { fundraiser: true } })
    if (!fund || !fund.fundraiser) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Fundraiser not found' })
    if (fund.createdById !== userId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Only the organizer can release the payout' })
    }
    const fr = fund.fundraiser
    if (fr.verificationStatus !== 'verified') {
      throw new ConflictException({ code: 'PAYEE_UNVERIFIED', message: 'The payee must be verified before payout' })
    }
    if (fr.raised <= 0) {
      throw new BadRequestException({ code: 'NOTHING_TO_RELEASE', message: 'No funds have been raised yet' })
    }

    const externalref = `mp:${fundId}:1`
    const existing = await this.db.payoutTranche.findUnique({ where: { externalref } })
    if (existing && (existing.status === 'released' || existing.status === 'settled')) {
      return { ok: true as const, externalref, amount: existing.amount } // idempotent
    }

    const amount = fr.raised
    const tranche =
      existing ??
      (await this.db.payoutTranche.create({ data: { fundId, amount, externalref, status: 'held' } }))

    // Best-effort float guard.
    try {
      const bal = await this.moolre.getBalance()
      const available = Number(bal.data?.balance ?? 0) * 100
      if (available > 0 && available < amount) {
        this.logger.error(`HOLD medical payout ${externalref}: float ${available} < ${amount}`)
        throw new Error('INSUFFICIENT_FLOAT')
      }
    } catch (err) {
      if ((err as Error).message === 'INSUFFICIENT_FLOAT') {
        throw new ConflictException({ code: 'INSUFFICIENT_FLOAT', message: 'Float balance too low for this payout' })
      }
    }

    const bank = fr.payoutRoute === 'hospital_bank'
    const res = await this.moolre.transfer({
      channel: bank ? '2' : '1', // bank, else MoMo (MTN default — payee network isn't persisted in MVP)
      receiver: bank ? fr.payeeBank ?? '' : toMoolrePayer(fr.payeeMomo ?? ''),
      amount: ghs(amount),
      externalref,
      sublistid: process.env.MOOLRE_SUBLIST_ID ?? '',
    })
    await this.db.payoutTranche.update({ where: { externalref }, data: { status: 'released' } })
    void tranche
    void res
    this.logger.log(`Released medical payout ${externalref} → ${amount} pesewas`)
    return { ok: true as const, externalref, amount }
  }

  /** Medical fundraisers the current user organizes (created). For the Funds list + dashboard. */
  async myFundraisers(userId: string) {
    const funds = await this.db.fund.findMany({
      where: { type: 'Medical', createdById: userId },
      include: { fundraiser: true },
      orderBy: { createdAt: 'desc' },
    })
    return funds
      .filter((f) => f.fundraiser)
      .map((f) => ({
        id: f.id,
        slug: f.fundraiser!.slug,
        name: f.name,
        beneficiary: f.fundraiser!.beneficiary,
        goal: f.fundraiser!.goal,
        raised: f.fundraiser!.raised,
        progressPercent: progress(f.fundraiser!.raised, f.fundraiser!.goal),
        verificationStatus: f.fundraiser!.verificationStatus,
        status: f.status,
      }))
  }

  // ---------- in-app detail ----------

  async detail(userId: string, fundId: string) {
    const fund = await this.db.fund.findUnique({
      where: { id: fundId },
      include: {
        fundraiser: true,
        contributors: { where: { status: 'settled' }, orderBy: { ts: 'desc' }, take: 50 },
      },
    })
    if (!fund || !fund.fundraiser) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Fundraiser not found' })
    return this.toDetail(fund, fund.fundraiser, userId, fund.contributors)
  }

  // ---------- settlement handlers ----------

  private async handleDonationSettled(payload: unknown): Promise<void> {
    const p = (payload ?? {}) as { externalref?: string }
    if (typeof p.externalref !== 'string' || !p.externalref.startsWith('mc:')) return
    await this.settleDonation(p.externalref)
  }

  /** Idempotent: post ledger (moolre_float += amount; fund_pot -= amount), mark settled, bump raised, activity. */
  async settleDonation(externalref: string): Promise<void> {
    const c = await this.db.contributor.findUnique({ where: { externalref } })
    if (!c || c.status === 'failed' || c.status === 'settled') return

    const [floatAcc, potAcc] = await Promise.all([
      this.ledger.getOrCreateAccount('moolre_float'),
      this.ledger.getOrCreateAccount('fund_pot', c.fundId),
    ])
    const fund = await this.db.fund.findUnique({ where: { id: c.fundId } })
    if (!fund) return

    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Fund" WHERE id = ${c.fundId} FOR UPDATE`
      const fresh = await tx.contributor.findUnique({ where: { externalref } })
      if (!fresh || fresh.status === 'settled') return
      await this.ledger.post(
        {
          kind: 'contribution',
          externalref,
          postings: [
            { accountId: floatAcc.id, amount: c.amount },
            { accountId: potAcc.id, amount: -c.amount },
          ],
        },
        tx,
      )
      await tx.contributor.update({ where: { externalref }, data: { status: 'settled' } })
      await tx.fundraiserDetail.update({ where: { fundId: c.fundId }, data: { raised: { increment: c.amount } } })
      await tx.activityItem.create({
        data: {
          userId: fund.createdById, // the organizer sees donations to their fund
          type: 'donation',
          title: 'Donation received',
          detail: c.anonymous ? 'Anonymous donor' : c.displayName,
          amount: c.amount,
          direction: 'in_',
          reference: externalref,
        },
      })
    })
    this.logger.log(`Settled donation ${externalref}`)
  }

  private async handleMedicalPayoutSettled(payload: unknown): Promise<void> {
    const p = (payload ?? {}) as { externalref?: string }
    if (typeof p.externalref !== 'string' || !p.externalref.startsWith('mp:')) return
    await this.settleMedicalPayout(p.externalref)
  }

  /** Idempotent: post payout ledger, mark tranche settled, complete the fund, activity, SMS. */
  async settleMedicalPayout(externalref: string): Promise<void> {
    const tranche = await this.db.payoutTranche.findUnique({ where: { externalref } })
    if (!tranche || tranche.status === 'settled') return

    const [floatAcc, potAcc] = await Promise.all([
      this.ledger.getOrCreateAccount('moolre_float'),
      this.ledger.getOrCreateAccount('fund_pot', tranche.fundId),
    ])
    const postings = payoutPostings({ moolreFloatAccountId: floatAcc.id, fundPotAccountId: potAcc.id, amount: tranche.amount, moolreFee: 0 })

    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Fund" WHERE id = ${tranche.fundId} FOR UPDATE`
      const fresh = await tx.payoutTranche.findUnique({ where: { externalref } })
      if (!fresh || fresh.status === 'settled') return
      await this.ledger.post({ kind: 'payout', externalref, postings }, tx)
      await tx.payoutTranche.update({ where: { externalref }, data: { status: 'settled', releasedAt: new Date() } })
      const fund = await tx.fund.update({ where: { id: tranche.fundId }, data: { status: 'completed' } })
      await tx.activityItem.create({
        data: {
          userId: fund.createdById,
          type: 'payout',
          title: 'Hospital payout sent',
          detail: 'Funds released to the verified payee',
          amount: tranche.amount,
          direction: 'out_',
          reference: externalref,
        },
      })
    })
    this.logger.log(`Settled medical payout ${externalref}`)
    await this.sendPayoutSms(externalref)
  }

  private async sendPayoutSms(externalref: string): Promise<void> {
    const tranche = await this.db.payoutTranche.findUnique({ where: { externalref } })
    if (!tranche) return
    const fr = await this.db.fundraiserDetail.findUnique({ where: { fundId: tranche.fundId }, include: { fund: true } })
    if (!fr?.payeeMomo) return
    try {
      await this.notifications.sendSms(
        fr.payeeMomo,
        `CirclePay: GHS ${ghs(tranche.amount)} for "${fr.fund.name}" has been sent to ${fr.payeeName}. Powered by Moolre.`,
        `mpayout:${externalref}`,
      )
    } catch (err) {
      this.logger.warn(`Medical payout SMS failed for ${externalref}: ${(err as Error).message}`)
    }
  }

  // ---------- helpers ----------

  private async assertOpsAdmin(userId: string): Promise<void> {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { isOpsAdmin: true } })
    if (!user?.isOpsAdmin) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Ops admin only' })
    }
  }

  private toPublic(
    fr: { slug: string; beneficiary: string; hospital: string | null; story: string | null; goal: number; raised: number; deadline: Date | null; payoutRoute: string; verificationStatus: string; fund: { name: string } },
    contributors: Array<{ displayName: string; amount: number; ts: Date }>,
  ) {
    return {
      slug: fr.slug,
      name: fr.fund.name,
      beneficiary: fr.beneficiary,
      hospital: fr.hospital,
      story: fr.story,
      goal: fr.goal,
      raised: fr.raised,
      progressPercent: progress(fr.raised, fr.goal),
      deadline: fr.deadline,
      payoutRoute: fr.payoutRoute,
      verificationStatus: fr.verificationStatus,
      contributors: contributors.map((c) => ({ displayName: c.displayName, amount: c.amount, ts: c.ts })),
    }
  }

  private toDetail(
    fund: { id: string; name: string; status: string; createdById: string },
    fr: { slug: string; beneficiary: string; hospital: string | null; story: string | null; goal: number; raised: number; deadline: Date | null; payoutRoute: string; verificationStatus: string; payeeName: string | null },
    userId: string,
    contributors: Array<{ displayName: string; amount: number; ts: Date }>,
  ) {
    return {
      ...this.toPublic({ ...fr, fund: { name: fund.name } }, contributors),
      id: fund.id,
      status: fund.status,
      isOwner: fund.createdById === userId,
      payeeName: fr.payeeName,
    }
  }
}
