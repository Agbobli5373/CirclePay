import { Logger } from '@nestjs/common'
import {
  MoolreClientLike,
  CollectInput,
  CollectResult,
  TransferInput,
  SmsInput,
  MoolreResponse,
  TransferData,
  StatusData,
  BalanceData,
} from './moolre.client'

export interface MockMoolreConfig {
  /** Base URL of THIS API incl. global prefix, e.g. http://127.0.0.1:4001/api */
  callbackBaseUrl: string
  /** Must match MOOLRE_WEBHOOK_SECRET so the self-callback passes the receiver's guard. */
  webhookSecret: string
  /** Delay before the simulated settlement webhook fires (ms). */
  settleDelayMs: number
}

/**
 * DEV-ONLY fake Moolre client. Behaves like the real API for the happy path and, on a
 * successful collect/transfer, calls our OWN webhook back after a short delay — so money
 * settles through the exact production pipeline (webhook → isSettled re-confirm → outbox →
 * handler → ledger). No network to Moolre, no real money. Never used in production
 * (MoolreService guards on NODE_ENV).
 */
export class MockMoolreClient implements MoolreClientLike {
  private readonly logger = new Logger('MoolreMock')
  private readonly settled = new Set<string>()

  constructor(private readonly cfg: MockMoolreConfig) {}

  private resp<T>(code: string, data: T, status: number | string = 1): MoolreResponse<T> {
    return { status, code, message: null, data, go: null }
  }

  private txid(): string {
    return `MOCK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  /** Fire the settlement webhook to ourselves, the way Moolre would (async, best-effort). */
  private scheduleWebhook(externalref: string, transactionid: string, txtype: number): void {
    const url = `${this.cfg.callbackBaseUrl}/webhooks/moolre/${this.cfg.webhookSecret}`
    const body = JSON.stringify({
      status: 1,
      code: 'P01',
      data: { externalref, transactionid, txstatus: 1, txtype },
    })
    const fire = async () => {
      try {
        await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
        this.logger.log(`Settled (mock webhook) → ${externalref}`)
      } catch (err) {
        this.logger.warn(`Mock webhook POST failed for ${externalref}: ${(err as Error).message}`)
      }
    }
    const t = setTimeout(() => void fire(), this.cfg.settleDelayMs)
    if (typeof t.unref === 'function') t.unref() // don't keep the event loop alive in tests
  }

  async collect(input: CollectInput): Promise<CollectResult> {
    // First call (no otpcode) → ask for an OTP, exactly like a live collection. Any code passes.
    if (!input.otpcode) {
      return {
        otpRequired: true,
        raw: this.resp('TP14', 'all', 1),
      }
    }
    const transactionid = this.txid()
    this.settled.add(input.externalref)
    this.scheduleWebhook(input.externalref, transactionid, 1)
    return { otpRequired: false, raw: this.resp('TR099', { transactionid }) }
  }

  async transfer(input: TransferInput): Promise<MoolreResponse<TransferData>> {
    const transactionid = this.txid()
    this.settled.add(input.externalref)
    this.scheduleWebhook(input.externalref, transactionid, 2)
    return this.resp<TransferData>('OBGH01', {
      txstatus: 1,
      receiver: input.receiver,
      transactionid,
      externalref: input.externalref,
      amount: input.amount,
    })
  }

  async getStatus(id: string): Promise<MoolreResponse<StatusData>> {
    return this.resp<StatusData>('SS01', {
      txstatus: this.settled.has(id) ? 1 : 0,
      externalref: id,
      transactionid: this.txid(),
    })
  }

  async isSettled(externalref: string): Promise<boolean> {
    return this.settled.has(externalref)
  }

  async getBalance(): Promise<MoolreResponse<BalanceData>> {
    // Large balance so the payout balance-guard always passes in dev.
    return this.resp<BalanceData>('SW01', { balance: 1_000_000_00, accountname: 'CirclePay Mock' })
  }

  async listTransactions(): Promise<MoolreResponse<unknown>> {
    return this.resp<unknown>('SS01', [])
  }

  async sendSms(_input: SmsInput): Promise<MoolreResponse<null>> {
    return this.resp<null>('SMS01', null)
  }
}
