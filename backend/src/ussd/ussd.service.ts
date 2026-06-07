import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { RedisService } from '../redis/redis.service'
import { AuthService } from '../auth/auth.service'
import { FundsService } from '../funds/funds.service'
import { ContributionsService } from '../contributions/contributions.service'
import type { InitiateContributionDto } from '../contributions/dto/contributions.dto'
import { UssdSession, UssdSessionStore } from './ussd.session'
import type { UssdReply, UssdRequest } from './ussd.adapter'

const con = (text: string): UssdReply => ({ continue: true, text })
const end = (text: string): UssdReply => ({ continue: false, text })

const MAX_PIN_TRIES = 3
const LIST_LIMIT = 8

/** Pesewas → "GHS 50.00" for menu display. */
function cedis(pesewas: number): string {
  return `GHS ${(pesewas / 100).toFixed(2)}`
}

/** Format a (possibly unknown) pesewas value from a service response. */
function money(pesewas: unknown): string {
  return typeof pesewas === 'number' ? cedis(pesewas) : 'the amount'
}

/** Pull the app's error `code` out of a Nest HttpException response, if present. */
function errorCode(e: unknown): string | undefined {
  if (e instanceof HttpException) {
    const r = e.getResponse()
    if (r && typeof r === 'object' && 'code' in r) return (r as { code?: string }).code
  }
  return undefined
}

const STANDING_LABEL: Record<string, string> = {
  new_: 'New',
  new: 'New',
  building: 'Building',
  good: 'Good',
  excellent: 'Excellent',
  locked: 'Locked',
}

/** The shared PIN lockout surfaces as HTTP 423 LOCKED (see AuthService.verifyPhonePin). */
function isLocked(e: unknown): boolean {
  return e instanceof HttpException && e.getStatus() === HttpStatus.LOCKED
}

/**
 * USSD menu engine (E10) — a provider-agnostic state machine for the *714# channel.
 *
 * USSD is stateless from the gateway's side: it POSTs one request per keypress and we
 * reply CON (keep the session open) / END (close it). We hold per-session state in
 * Redis and call the SAME domain services the web app uses (auth PIN, funds reads,
 * contributions), so a USSD action runs through the identical pipeline — no duplicate
 * business logic and no money credited from USSD input (settlement stays webhook-driven).
 */
@Injectable()
export class UssdService {
  private readonly logger = new Logger(UssdService.name)
  private readonly sessions: UssdSessionStore

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly auth: AuthService,
    private readonly funds: FundsService,
    private readonly contributions: ContributionsService,
  ) {
    const ttl = Number(this.config.get<string>('USSD_SESSION_TTL_SECONDS') ?? 120)
    this.sessions = new UssdSessionStore(redis, ttl)
  }

  async handle(req: UssdRequest): Promise<UssdReply> {
    if (!req.sessionId || !req.phone) return end('Service unavailable. Please try again.')

    const session = await this.sessions.load(req.sessionId)
    // First request of a new session → authenticate with the PIN.
    if (!session) {
      await this.sessions.save(req.sessionId, { step: 'pin', pinTries: 0 })
      return con('Welcome to CirclePay\nEnter your PIN:')
    }

    const reply = await this.route(req, session)
    // Any END terminates the session → reap its Redis state (the TTL is the backstop).
    if (!reply.continue) await this.sessions.clear(req.sessionId).catch(() => undefined)
    return reply
  }

  private async route(req: UssdRequest, session: UssdSession): Promise<UssdReply> {
    try {
      switch (session.step) {
        case 'pin':
          return await this.handlePin(req, session)
        case 'main':
          return await this.handleMain(req, session)
        case 'susu_list':
          return await this.handleSusuList(req, session)
        case 'susu_detail':
          return await this.handleSusuDetail(req, session)
        case 'pay_pick':
          return await this.handlePayPick(req, session)
        case 'pay_otp':
          return await this.handlePayOtp(req, session)
        case 'join_list':
          return await this.handleJoinList(req, session)
        case 'standing':
          return await this.toMain(req, session) // any key returns to the main menu
        default:
          return end('Session expired. Please dial again.')
      }
    } catch (e) {
      this.logger.error(`USSD handler error: ${(e as Error).message}`)
      return end('Something went wrong. Please try again.')
    }
  }

  private mainMenu(): string {
    return 'CirclePay\n1. My Susus\n2. Pay contribution\n3. My standing\n4. Join a Susu'
  }

  private async toMain(req: UssdRequest, session: UssdSession): Promise<UssdReply> {
    await this.sessions.save(req.sessionId, { step: 'main', userId: session.userId })
    return con(this.mainMenu())
  }

  // ---------- auth ----------

  private async handlePin(req: UssdRequest, session: UssdSession): Promise<UssdReply> {
    try {
      const user = await this.auth.verifyPhonePin(req.phone, req.input.trim())
      await this.sessions.save(req.sessionId, { step: 'main', userId: user.id })
      return con(this.mainMenu())
    } catch (e) {
      if (isLocked(e)) {
        return end('Too many attempts. Please try again later.')
      }
      const tries = (session.pinTries ?? 0) + 1
      if (tries >= MAX_PIN_TRIES) {
        return end('Incorrect PIN. Please dial again.')
      }
      await this.sessions.save(req.sessionId, { step: 'pin', pinTries: tries })
      return con(`Incorrect PIN (${tries}/${MAX_PIN_TRIES}). Enter your PIN:`)
    }
  }

  // ---------- main menu ----------

  private async handleMain(req: UssdRequest, session: UssdSession): Promise<UssdReply> {
    switch (req.input.trim()) {
      case '1':
        return this.showSusuList(req, session)
      case '2':
        return this.showPayList(req, session)
      case '3':
        return this.showStanding(req, session)
      case '4':
        return this.showJoinList(req, session)
      default:
        return con(`Invalid choice.\n${this.mainMenu()}`)
    }
  }

  // ---------- My Susus (read) ----------

  private renderList(list: { id: string; name: string }[]): string {
    const lines = list.map((f, i) => `${i + 1}. ${f.name}`)
    return `My Susus:\n${lines.join('\n')}\n0. Back`
  }

  private async showSusuList(req: UssdRequest, session: UssdSession): Promise<UssdReply> {
    const funds = await this.funds.list(session.userId!, 'mine')
    if (!funds.length) {
      return end('You are not in any Susu yet. Create or join one in the CirclePay app.')
    }
    const list = funds.slice(0, LIST_LIMIT).map((f) => ({ id: f.id, name: f.name }))
    await this.sessions.save(req.sessionId, { ...session, step: 'susu_list', list })
    return con(this.renderList(list))
  }

  private async handleSusuList(req: UssdRequest, session: UssdSession): Promise<UssdReply> {
    const choice = req.input.trim()
    if (choice === '0') return this.toMain(req, session)
    const item = session.list?.[Number(choice) - 1]
    if (!item) return con('Invalid choice. Reply with the number, or 0 to go back.')
    return this.showSusuDetail(req, session, item.id)
  }

  private async showSusuDetail(req: UssdRequest, session: UssdSession, fundId: string): Promise<UssdReply> {
    const d = await this.funds.detail(session.userId!, fundId)
    const payeeName = d.currentPayeeUserId
      ? (d.members.find((m) => m.userId === d.currentPayeeUserId)?.name ?? 'a member')
      : null
    const lines = [
      d.name,
      `Cycle ${d.currentCycle}/${d.totalCycles}`,
      `Pay ${cedis(d.contribution)} ${d.frequency}`,
      d.started ? `This cycle pays: ${payeeName ?? '—'}` : 'Not started yet',
      d.myNextPayoutCycle ? `Your turn: cycle ${d.myNextPayoutCycle}` : 'Your turn: not set',
      '0. Back',
    ]
    await this.sessions.save(req.sessionId, { ...session, step: 'susu_detail', fundId })
    return con(lines.join('\n'))
  }

  private async handleSusuDetail(req: UssdRequest, session: UssdSession): Promise<UssdReply> {
    if (req.input.trim() === '0' && session.list?.length) {
      await this.sessions.save(req.sessionId, { ...session, step: 'susu_list' })
      return con(this.renderList(session.list))
    }
    return this.toMain(req, session)
  }

  // ---------- Pay a contribution (reuses ContributionsService → Moolre collect) ----------

  private async showPayList(req: UssdRequest, session: UssdSession): Promise<UssdReply> {
    const funds = await this.funds.list(session.userId!, 'mine')
    if (!funds.length) return end('You are not in any Susu yet.')
    const list = funds.slice(0, LIST_LIMIT).map((f) => ({ id: f.id, name: f.name }))
    await this.sessions.save(req.sessionId, { ...session, step: 'pay_pick', list })
    const lines = list.map((f, i) => `${i + 1}. ${f.name}`)
    return con(`Pay which Susu?\n${lines.join('\n')}\n0. Back`)
  }

  private async handlePayPick(req: UssdRequest, session: UssdSession): Promise<UssdReply> {
    const choice = req.input.trim()
    if (choice === '0') return this.toMain(req, session)
    const item = session.list?.[Number(choice) - 1]
    if (!item) return con('Invalid choice. Reply with the number, or 0 to go back.')
    // One idempotency key per (session, fund), reused on the OTP resubmit so the two
    // calls are one logical request (entering the OTP is the user's confirmation).
    const payKey = `ussd-${req.sessionId}-${item.id}`
    try {
      const { body } = await this.contributions.initiate(
        session.userId!,
        { fundId: item.id } as InitiateContributionDto,
        payKey,
        { sessionid: req.sessionId },
      )
      return this.afterInitiate(req, session, body, item.id, payKey)
    } catch (e) {
      return this.payError(e)
    }
  }

  private async handlePayOtp(req: UssdRequest, session: UssdSession): Promise<UssdReply> {
    const otpcode = req.input.trim()
    if (otpcode === '0') return this.toMain(req, session)
    const payKey = session.payKey ?? `ussd-${req.sessionId}-${session.fundId}`
    try {
      const { body } = await this.contributions.initiate(
        session.userId!,
        { fundId: session.fundId!, otpcode } as InitiateContributionDto,
        payKey,
        { sessionid: req.sessionId },
      )
      if ((body.state as string) === 'otp_required') {
        return con('That code was not accepted. Enter the OTP again, or 0 to cancel:')
      }
      return this.payDone(body)
    } catch (e) {
      return this.payError(e)
    }
  }

  /** After the first initiate: ask for the OTP (mock/real TP14) or finish (live no-OTP path). */
  private async afterInitiate(
    req: UssdRequest,
    session: UssdSession,
    body: Record<string, unknown>,
    fundId: string,
    payKey: string,
  ): Promise<UssdReply> {
    if ((body.state as string) === 'otp_required') {
      await this.sessions.save(req.sessionId, { ...session, step: 'pay_otp', fundId, payKey })
      return con(`Pay ${money(body.total)}. Enter the OTP sent to your phone to confirm:`)
    }
    return this.payDone(body)
  }

  private payDone(body: Record<string, unknown>): UssdReply {
    if ((body.state as string) === 'settled') return end('You have already paid this cycle.')
    return end(`Payment of ${money(body.total)} started. Approve the prompt on your phone; an SMS receipt will follow.`)
  }

  private payError(e: unknown): UssdReply {
    const code = errorCode(e)
    if (code === 'FUND_NOT_STARTED') return end('This Susu has not started yet.')
    if (code === 'NOT_MEMBER') return end('You are not an active member of this Susu.')
    if (code === 'FUND_INACTIVE') return end('This Susu is not open.')
    return end('Payment could not be started. Please try again later.')
  }

  // ---------- Join a Susu (reuses myInvites / acceptInvite) ----------

  private async showJoinList(req: UssdRequest, session: UssdSession): Promise<UssdReply> {
    const invites = await this.funds.myInvites(session.userId!)
    if (!invites.length) return end('You have no pending invites.')
    const list = invites.slice(0, LIST_LIMIT).map((i) => ({ id: i.token, name: i.fundName }))
    await this.sessions.save(req.sessionId, { ...session, step: 'join_list', list })
    const lines = list.map((f, i) => `${i + 1}. ${f.name}`)
    return con(`Join which Susu?\n${lines.join('\n')}\n0. Back`)
  }

  private async handleJoinList(req: UssdRequest, session: UssdSession): Promise<UssdReply> {
    const choice = req.input.trim()
    if (choice === '0') return this.toMain(req, session)
    const item = session.list?.[Number(choice) - 1]
    if (!item) return con('Invalid choice. Reply with the number, or 0 to go back.')
    try {
      // item.id holds the invite token (acceptInvite verifies it belongs to this number).
      const res = await this.funds.acceptInvite(session.userId!, item.id)
      if (res.status === 'pending_deposit') {
        return end(`Joined ${item.name}! Pay ${money(res.depositAmount)} in the CirclePay app to activate your seat.`)
      }
      return end(`Joined ${item.name}! You're in the Susu.`)
    } catch (e) {
      return this.joinError(e)
    }
  }

  private joinError(e: unknown): UssdReply {
    const code = errorCode(e)
    if (code === 'INVITE_PHONE_MISMATCH') return end('That invite was sent to a different number.')
    if (code === 'FUND_FULL') return end('That Susu is already full.')
    if (code === 'ALREADY_MEMBER') return end('You are already in that Susu.')
    if (code === 'TRUST_LOCKED') return end('Your account is locked from joining Susus.')
    return end('Could not join. The invite may have expired.')
  }

  // ---------- My standing (read) ----------

  private async showStanding(req: UssdRequest, session: UssdSession): Promise<UssdReply> {
    const me = await this.auth.me({ id: session.userId!, isOpsAdmin: false })
    const t = me.trust
    const text = t
      ? `Your standing: ${STANDING_LABEL[t.standing] ?? t.standing}\nOn-time: ${t.onTimeRate}%\nSusus completed: ${t.fundsCompleted}`
      : 'No trust record yet. Join a Susu to start building trust.'
    await this.sessions.save(req.sessionId, { ...session, step: 'standing' })
    return con(`${text}\n0. Back`)
  }
}
