import { Logger } from '@nestjs/common'
import {
  MoolreClientLike,
  MoolreError,
  CollectInput,
  CollectResult,
  TransferInput,
  SmsInput,
  MoolreResponse,
  TransferData,
  StatusData,
  BalanceData,
} from './moolre.client'

/**
 * Fault scenarios the mock can simulate (set MOOLRE_MOCK_SCENARIO). 'happy' is the default and
 * settles cleanly; the others exercise the app's error / retry / timeout paths that real Moolre
 * eventually triggers but the happy path never does.
 */
export type MockScenario =
  | 'happy'
  | 'collect_fail' // collection declined after OTP (non-TR099) → PAYMENT_FAILED
  | 'otp_invalid' // collection keeps demanding an OTP (wrong code) → never initiates
  | 'tp13' // duplicate externalref on collect → service resolves via isSettled() instead of double-charging
  | 'transfer_fail' // payout declined (non-OBGH01)
  | 'never_settle' // collect/transfer accepted, but the settlement webhook never arrives
  | 'late_settle' // settlement webhook fires only after a long delay (exercises the poll timeout)

const SCENARIOS: MockScenario[] = ['happy', 'collect_fail', 'otp_invalid', 'tp13', 'transfer_fail', 'never_settle', 'late_settle']
const LATE_SETTLE_MS = 90_000 // > the pay-screen poll cap, so the "taking longer…" timeout fires

export interface MockMoolreConfig {
  /** Base URL of THIS API incl. global prefix, e.g. http://127.0.0.1:4001/api */
  callbackBaseUrl: string
  /** Must match MOOLRE_WEBHOOK_SECRET so the self-callback passes the receiver's guard. */
  webhookSecret: string
  /** Delay before the simulated settlement webhook fires (ms). */
  settleDelayMs: number
  /** Fault scenario to simulate (default 'happy'). */
  scenario?: MockScenario
}

/**
 * DEV-ONLY fake Moolre client. On the happy path it behaves like the real API and calls our OWN
 * webhook back after a short delay — so money settles through the exact production pipeline
 * (webhook → isSettled re-confirm → outbox → handler → ledger). With a `scenario` it simulates
 * declines / duplicates / bad OTP / lost or late callbacks so the failure handling can be
 * exercised without live Moolre. Never used in production (MoolreService guards on NODE_ENV).
 */
export class MockMoolreClient implements MoolreClientLike {
  private readonly logger = new Logger('MoolreMock')
  private readonly settled = new Set<string>()
  private readonly scenario: MockScenario

  constructor(private readonly cfg: MockMoolreConfig) {
    const s = cfg.scenario ?? 'happy'
    this.scenario = SCENARIOS.includes(s) ? s : 'happy'
    if (this.scenario !== 'happy') this.logger.warn(`Mock fault scenario active: ${this.scenario}`)
  }

  private resp<T>(code: string, data: T, status: number | string = 1): MoolreResponse<T> {
    return { status, code, message: null, data, go: null }
  }

  private txid(): string {
    return `MOCK-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  /** Throw a typed MoolreError, exactly like the real client does on a non-success code. */
  private fail(code: string, message: string): never {
    throw new MoolreError(`${message} (mock)`, code, this.resp(code, null, 0))
  }

  /** Settle this externalref + fire the settlement webhook to ourselves (unless never_settle). */
  private settleAsync(externalref: string, transactionid: string, txtype: number): void {
    if (this.scenario === 'never_settle') return // accepted, but settlement never confirms
    this.settled.add(externalref)
    const delay = this.scenario === 'late_settle' ? LATE_SETTLE_MS : this.cfg.settleDelayMs
    const url = `${this.cfg.callbackBaseUrl}/webhooks/moolre/${this.cfg.webhookSecret}`
    const body = JSON.stringify({
      status: 1,
      code: 'P01',
      message: 'Transaction Successful',
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
    const t = setTimeout(() => void fire(), delay)
    if (typeof t.unref === 'function') t.unref() // don't keep the event loop alive in tests
  }

  async collect(input: CollectInput): Promise<CollectResult> {
    // First call (no otpcode) → ask for an OTP, exactly like a live collection. Any code passes
    // on the happy path; otp_invalid keeps re-prompting (simulating a wrong/expired code).
    if (this.scenario === 'otp_invalid' || !input.otpcode) {
      return { otpRequired: true, raw: this.resp('TP14', 'all', 1) }
    }
    if (this.scenario === 'collect_fail') this.fail('TF01', 'Collection declined')
    if (this.scenario === 'tp13') {
      // Duplicate externalref: pretend the original already settled, then surface TP13 so the
      // service resolves via isSettled() rather than double-charging.
      this.settled.add(input.externalref)
      this.fail('TP13', 'externalref already used')
    }
    const transactionid = this.txid()
    this.settleAsync(input.externalref, transactionid, 1)
    return { otpRequired: false, raw: this.resp('TR099', { transactionid }) }
  }

  async transfer(input: TransferInput): Promise<MoolreResponse<TransferData>> {
    if (this.scenario === 'transfer_fail') this.fail('OBGH99', 'Transfer declined')
    const transactionid = this.txid()
    this.settleAsync(input.externalref, transactionid, 2)
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
