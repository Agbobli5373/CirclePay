import {
  Injectable,
  Logger,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  canJoinFund,
  totalCycles,
  cyclePayoutAmount,
  cycleProgressPercent,
  resolvePayoutOrder,
  type TrustStanding,
  type SusuPayoutRule,
} from '@circlepay/shared'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import type { CreateFundDto, InviteMembersDto } from './dto/funds.dto'
import type {
  FundSummaryDto,
  FundDetailDto,
  MemberDto,
  InviteResultDto,
  JoinResultDto,
} from './dto/funds-responses.dto'

/** Minimal shapes (structurally satisfied by Prisma query results). */
type SusuRow = {
  contribution: number
  frequency: string
  memberCount: number
  currentCycle: number
  totalCycles: number
  payoutRule: string
  startedAt: Date | null
  payoutOrder: unknown // Json: locked userId[]
}
type MemberRow = {
  userId: string
  role: string
  fundStatus: string
  status: string
  depositPaid: boolean
  joinedAt: Date
  user: { name: string | null; trustScore: { standing: string } | null }
}

/** Prisma's TrustStanding enum uses `new_`; the shared rules use `new`. */
function toSharedStanding(s: string | null | undefined): TrustStanding {
  if (!s || s === 'new_') return 'new'
  return s as TrustStanding
}

/** A Susu is "started" once it fills — members + payout order are then locked (E5). */
function isSusuStarted(susu: { startedAt: Date | null }): boolean {
  return !!susu.startedAt
}

/** Contribution window per cadence (ms). */
function cycleIntervalMs(frequency: string): number {
  return (frequency === 'weekly' ? 7 : 30) * 24 * 60 * 60 * 1000
}

@Injectable()
export class FundsService {
  private readonly logger = new Logger(FundsService.name)

  constructor(
    private readonly db: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  // ---------- create ----------

  async createSusu(userId: string, dto: CreateFundDto): Promise<FundSummaryDto> {
    await this.assertCanJoin(userId)
    if (dto.requiresDeposit) {
      // Deposit collection + shortfall coverage are a later phase — don't let a member dead-end.
      throw new BadRequestException({ code: 'DEPOSIT_NOT_SUPPORTED', message: 'Deposit-required Susu are coming soon' })
    }

    const fund = await this.db.$transaction(async (tx) => {
      const created = await tx.fund.create({
        data: {
          name: dto.name,
          type: 'Susu',
          createdById: userId,
          susu: {
            create: {
              contribution: dto.contribution,
              frequency: dto.frequency,
              memberCount: dto.memberCount,
              startDate: dto.startDate,
              payoutRule: dto.payoutRule,
              requiresDeposit: dto.requiresDeposit,
              depositAmount: dto.depositAmount,
              currentCycle: 1,
              totalCycles: totalCycles(dto.memberCount),
            },
          },
          members: {
            create: {
              userId,
              role: 'admin',
              fundStatus: 'active',
              status: 'pending',
              depositPaid: !dto.requiresDeposit,
            },
          },
        },
        include: this.fundInclude,
      })
      return created
    })

    return this.toSummary(fund, userId)
  }

  // ---------- invite ----------

  async invite(userId: string, fundId: string, dto: InviteMembersDto): Promise<InviteResultDto> {
    const fund = await this.db.fund.findUnique({
      where: { id: fundId },
      include: { susu: true, createdBy: { select: { name: true } } },
    })
    if (!fund || !fund.susu) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Fund not found' })

    const requester = await this.db.member.findUnique({
      where: { fundId_userId: { fundId, userId } },
    })
    if (!requester || requester.role !== 'admin') {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Only the fund admin can invite' })
    }
    if (isSusuStarted(fund.susu)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'The Susu has already started' })
    }

    const activeCount = await this.db.member.count({ where: { fundId, fundStatus: 'active' } })
    const remaining = fund.susu.memberCount - activeCount

    const unique = [...new Set(dto.phones)]
    const alreadyMembers = await this.db.user.findMany({
      where: { phone: { in: unique }, members: { some: { fundId } } },
      select: { phone: true },
    })
    const memberPhones = new Set(alreadyMembers.map((u) => u.phone))
    const candidates = unique.filter((p) => !memberPhones.has(p))

    if (candidates.length > remaining) {
      throw new BadRequestException({
        code: 'SEATS_EXCEEDED',
        message: `Only ${Math.max(0, remaining)} seat(s) remaining`,
      })
    }

    const base = this.config.get<string>('APP_BASE_URL') ?? 'http://localhost:3000'
    const inviterName = fund.createdBy?.name ?? 'A friend'

    for (const phone of candidates) {
      const invite = await this.db.invite.upsert({
        where: { fundId_phone: { fundId, phone } },
        create: { fundId, phone },
        update: { status: 'pending' },
      })
      const message =
        `${inviterName} invited you to the "${fund.name}" CirclePay Susu. ` +
        `Join: ${base}/join/${invite.token} — or dial *203#.`
      try {
        await this.notifications.sendSms(phone, message, `invite:${fundId}`)
      } catch (err) {
        // Sandbox/no-credential environments: don't fail the invite if SMS can't send.
        this.logger.warn(`Invite SMS failed for a recipient: ${(err as Error).message}`)
      }
    }

    return { invited: candidates.length }
  }

  // ---------- join ----------

  async join(userId: string, fundId: string): Promise<JoinResultDto> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      include: { trustScore: true },
    })
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' })
    if (!canJoinFund({ standing: toSharedStanding(user.trustScore?.standing) })) {
      throw new ForbiddenException({ code: 'TRUST_LOCKED', message: 'Your account is locked from joining funds' })
    }

    return this.db.$transaction(async (tx) => {
      // Serialise seat allocation on this fund (prevents oversell under concurrency).
      await tx.$queryRaw`SELECT id FROM "Fund" WHERE id = ${fundId} FOR UPDATE`

      const fund = await tx.fund.findUnique({ where: { id: fundId }, include: { susu: true } })
      if (!fund || !fund.susu) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Fund not found' })
      if (fund.status !== 'active') {
        throw new ConflictException({ code: 'FUND_INACTIVE', message: 'This fund is not open' })
      }
      if (isSusuStarted(fund.susu)) {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: 'The Susu has already started' })
      }

      const existing = await tx.member.findUnique({ where: { fundId_userId: { fundId, userId } } })
      if (existing) throw new ConflictException({ code: 'ALREADY_MEMBER', message: 'You are already a member' })

      const activeCount = await tx.member.count({ where: { fundId, fundStatus: 'active' } })
      if (activeCount >= fund.susu.memberCount) {
        throw new ConflictException({ code: 'FUND_FULL', message: 'This Susu is full' })
      }

      const requiresDeposit = fund.susu.requiresDeposit
      await tx.member.create({
        data: {
          fundId,
          userId,
          role: 'member',
          fundStatus: 'active', // reserves the seat; deposit settlement (E4) flips depositPaid
          status: 'pending',
          depositPaid: !requiresDeposit,
        },
      })
      await tx.invite.updateMany({
        where: { fundId, phone: user.phone, status: 'pending' },
        data: { status: 'accepted' },
      })

      // Fund just filled → start the Susu: lock members + payout order (incl. random shuffle).
      if (activeCount + 1 >= fund.susu.memberCount) {
        const members = await tx.member.findMany({
          where: { fundId, fundStatus: 'active' },
          include: { user: { include: { trustScore: true } } },
        })
        const order = resolvePayoutOrder(
          members.map((m) => ({
            userId: m.userId,
            standing: toSharedStanding(m.user.trustScore?.standing),
            joinedAt: m.joinedAt,
          })),
          fund.susu.payoutRule as SusuPayoutRule,
          fundId, // seed → deterministic 'random' order
        )
        await tx.susuDetail.update({
          where: { fundId },
          data: { startedAt: new Date(), payoutOrder: order },
        })
        // Set the cycle-1 contribution due date for every member (cadence-driven).
        await tx.member.updateMany({
          where: { fundId, fundStatus: 'active' },
          data: { dueAt: new Date(Date.now() + cycleIntervalMs(fund.susu.frequency)) },
        })
      }

      if (requiresDeposit) {
        // E4: initiate a Moolre collection (externalref `d:{fundId}:{userId}`); on settlement
        // post the `deposit` ledger leg and set depositPaid=true. Deferred to the Contributions epic.
        return { status: 'pending_deposit', depositAmount: fund.susu.depositAmount }
      }
      return { status: 'active' }
    })
  }

  /** Accept an invite by its token (invite-only join). Verifies the token belongs to the user's number. */
  async acceptInvite(userId: string, token: string): Promise<JoinResultDto & { fundId: string }> {
    const user = await this.db.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' })

    const invite = await this.db.invite.findUnique({ where: { token } })
    if (!invite || invite.status === 'expired') {
      throw new NotFoundException({ code: 'INVITE_INVALID', message: 'This invite link is invalid or has expired' })
    }
    if (invite.phone !== user.phone) {
      throw new ForbiddenException({
        code: 'INVITE_PHONE_MISMATCH',
        message: 'This invite was sent to a different MoMo number',
      })
    }

    const existing = await this.db.member.findUnique({
      where: { fundId_userId: { fundId: invite.fundId, userId } },
    })
    if (existing) return { status: 'active', fundId: invite.fundId } // idempotent

    const result = await this.join(userId, invite.fundId)
    return { ...result, fundId: invite.fundId }
  }

  /** DEV ONLY: backdate the caller's current-cycle due date to trigger overdue/default in a demo. */
  async devExpire(userId: string, fundId: string, mode: 'overdue' | 'default'): Promise<{ ok: true }> {
    const graceHours = Number(this.config.get<string>('GRACE_HOURS') ?? 48)
    const dueAt =
      mode === 'default'
        ? new Date(Date.now() - (graceHours + 1) * 60 * 60 * 1000)
        : new Date(Date.now() - 60 * 1000)
    const member = await this.db.member.findUnique({ where: { fundId_userId: { fundId, userId } } })
    if (!member) throw new NotFoundException({ code: 'NOT_MEMBER', message: 'Not a member of this fund' })
    await this.db.member.update({
      where: { id: member.id },
      data: { dueAt, status: 'pending', fundStatus: 'active' },
    })
    return { ok: true }
  }

  // ---------- read ----------

  async list(userId: string, scope: 'mine' | 'all'): Promise<FundSummaryDto[]> {
    const funds = await this.db.fund.findMany({
      where: {
        type: 'Susu',
        ...(scope === 'mine' ? { members: { some: { userId } } } : { status: 'active' }),
      },
      include: this.fundInclude,
      orderBy: { createdAt: 'desc' },
    })
    return funds.filter((f) => f.susu).map((f) => this.toSummary(f, userId))
  }

  async detail(userId: string, fundId: string): Promise<FundDetailDto> {
    const fund = await this.db.fund.findUnique({ where: { id: fundId }, include: this.fundInclude })
    if (!fund || !fund.susu) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Fund not found' })

    const isMember = fund.members.some((m) => m.userId === userId)
    if (!isMember) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Only members can view this Susu' })
    }

    const order = this.computePayoutOrder(fund.susu, fund.members)
    const position = new Map(order.map((uid, i) => [uid, i + 1]))
    const members: MemberDto[] = fund.members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      role: m.role,
      fundStatus: m.fundStatus,
      status: m.status,
      depositPaid: m.depositPaid,
      trustStanding: m.user.trustScore?.standing ?? 'new_',
      payoutPosition: position.get(m.userId) ?? 0,
    }))

    // Current-cycle payout state (for the live UI).
    const currentPayeeUserId = order[fund.susu.currentCycle - 1] ?? null
    const payout = await this.db.payout.findUnique({
      where: { externalref: `p:${fundId}:${fund.susu.currentCycle}` },
    })

    return {
      ...this.toSummary(fund, userId),
      members,
      payoutOrder: order,
      thisCycleFundedCount: fund.members.filter((m) => m.status === 'paid').length,
      payoutRule: fund.susu.payoutRule,
      started: isSusuStarted(fund.susu),
      currentPayeeUserId,
      currentCyclePayoutStatus: payout?.status ?? 'none',
    }
  }

  // ---------- helpers ----------

  private readonly fundInclude = {
    susu: true,
    members: { include: { user: { include: { trustScore: true } } } },
  } as const

  private async assertCanJoin(userId: string): Promise<void> {
    const trust = await this.db.trustScore.findUnique({ where: { userId } })
    if (!canJoinFund({ standing: toSharedStanding(trust?.standing) })) {
      throw new ForbiddenException({ code: 'TRUST_LOCKED', message: 'Your account is locked from joining funds' })
    }
  }

  /**
   * Ordered userIds (who is paid in which cycle). Once the Susu has started the LOCKED
   * `payoutOrder` is authoritative; before that it's computed provisionally for display.
   */
  private computePayoutOrder(susu: SusuRow, members: MemberRow[]): string[] {
    if (Array.isArray(susu.payoutOrder) && susu.payoutOrder.length > 0) {
      return susu.payoutOrder as string[]
    }
    return resolvePayoutOrder(
      members.map((m) => ({
        userId: m.userId,
        standing: toSharedStanding(m.user.trustScore?.standing),
        joinedAt: m.joinedAt,
      })),
      susu.payoutRule as SusuPayoutRule,
      // no seed → 'random' shows provisional join order until the fund starts
    )
  }

  private toSummary(
    fund: { id: string; name: string; type: string; status: string; susu: SusuRow | null; members: MemberRow[] },
    userId: string,
  ): FundSummaryDto {
    const s = fund.susu!
    const order = this.computePayoutOrder(s, fund.members)
    const idx = order.indexOf(userId)
    return {
      id: fund.id,
      name: fund.name,
      type: fund.type,
      status: fund.status,
      contribution: s.contribution,
      frequency: s.frequency,
      memberCount: s.memberCount,
      currentCycle: s.currentCycle,
      totalCycles: s.totalCycles,
      progressPercent: cycleProgressPercent(s.currentCycle, s.totalCycles),
      potPesewas: cyclePayoutAmount(s.contribution, s.memberCount),
      myNextPayoutCycle: idx >= 0 ? idx + 1 : null,
    }
  }
}
