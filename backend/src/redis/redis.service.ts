import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'

/**
 * Thin wrapper around ioredis. The home for all ephemeral auth state
 * (OTP, rate-limit, lockout, refresh-sessions) — everything TTL-based.
 * Durable data stays in Postgres.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name)
  private client!: Redis

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6380'
    this.client = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 3 })
    this.client.on('error', (err) => this.logger.error(`Redis error: ${err.message}`))
    this.client.on('connect', () => this.logger.log(`Redis connected → ${url}`))
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit()
  }

  get raw(): Redis {
    return this.client
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key)
  }

  /** Set with TTL (seconds). */
  async setEx(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds)
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length) await this.client.del(...keys)
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1
  }

  /** Increment a counter and (on first hit) set its TTL. Returns the new count. */
  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    const count = await this.client.incr(key)
    if (count === 1) await this.client.expire(key, ttlSeconds)
    return count
  }

  /** Delete all keys matching a glob pattern (used for logout-all). Uses SCAN to avoid blocking. */
  async delByPattern(pattern: string): Promise<void> {
    const stream = this.client.scanStream({ match: pattern, count: 100 })
    const pipeline = this.client.pipeline()
    let found = false
    for await (const keys of stream as AsyncIterable<string[]>) {
      for (const key of keys) {
        pipeline.del(key)
        found = true
      }
    }
    if (found) await pipeline.exec()
  }
}
