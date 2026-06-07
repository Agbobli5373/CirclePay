import type { RedisService } from '../redis/redis.service'

/** Where a USSD session currently is in the menu tree. Phase 2 adds pay/join steps. */
export type UssdStep = 'pin' | 'main' | 'susu_list' | 'susu_detail' | 'standing'

export interface UssdSession {
  step: UssdStep
  /** Set once the PIN is verified; identifies the user for all subsequent screens. */
  userId?: string
  /** In-session failed-PIN counter (the durable lockout lives in Redis via auth). */
  pinTries?: number
  /** The numbered list currently on screen (id + display name) for the next selection. */
  list?: { id: string; name: string }[]
  /** The fund a sub-flow is acting on. */
  fundId?: string
}

/**
 * Per-session USSD state in Redis, keyed by the gateway's sessionId with a short TTL
 * (USSD sessions live ~2 min). This mirrors how the rest of the app keeps ephemeral
 * auth state (OTP, lockout) in Redis — durable data stays in Postgres.
 */
export class UssdSessionStore {
  constructor(
    private readonly redis: RedisService,
    private readonly ttlSeconds: number,
  ) {}

  private key(sessionId: string): string {
    return `ussd:sess:${sessionId}`
  }

  async load(sessionId: string): Promise<UssdSession | null> {
    const raw = await this.redis.get(this.key(sessionId))
    if (!raw) return null
    try {
      return JSON.parse(raw) as UssdSession
    } catch {
      return null
    }
  }

  async save(sessionId: string, session: UssdSession): Promise<void> {
    await this.redis.setEx(this.key(sessionId), JSON.stringify(session), this.ttlSeconds)
  }

  async clear(sessionId: string): Promise<void> {
    await this.redis.del(this.key(sessionId))
  }
}
