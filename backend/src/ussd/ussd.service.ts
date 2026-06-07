import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { RedisService } from '../redis/redis.service'
import { AuthService } from '../auth/auth.service'
import { FundsService } from '../funds/funds.service'
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
 * Redis and call the SAME domain services the web app uses (auth PIN, funds reads), so
 * a USSD action runs through the identical pipeline — no duplicate business logic.
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
        return end('Paying by USSD is coming soon. For now, pay in the CirclePay app.')
      case '3':
        return this.showStanding(req, session)
      case '4':
        return end('Joining by USSD is coming soon. For now, use the CirclePay app.')
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
