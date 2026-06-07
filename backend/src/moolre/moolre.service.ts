import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  MoolreClient,
  MoolreClientLike,
  MoolreConfig,
  MoolreError,
  CollectInput,
  CollectResult,
  TransferInput,
  SmsInput,
} from './moolre.client'
import { MockMoolreClient, type MockScenario } from './moolre.mock'

/**
 * Wraps the framework-agnostic MoolreClient as a Nest provider.
 * The ONLY place Moolre API calls are made — all other modules inject this service.
 *
 * Sandbox: MOOLRE_BASE_URL=https://sandbox.moolre.com (keys not required).
 * Live:    MOOLRE_BASE_URL=https://api.moolre.com    (keys required).
 */
@Injectable()
export class MoolreService implements OnModuleInit {
  private readonly logger = new Logger(MoolreService.name)
  private client!: MoolreClientLike

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    // DEV-ONLY mock — simulates Moolre (incl. self-firing the settlement webhook).
    // Hard-guarded off in production regardless of the flag.
    const mockEnabled =
      this.config.get<string>('MOOLRE_MOCK_ENABLED') === 'true' &&
      process.env.NODE_ENV !== 'production'
    if (mockEnabled) {
      const port = this.config.get<string>('PORT') ?? '4000'
      const callbackBaseUrl =
        this.config.get<string>('MOOLRE_MOCK_CALLBACK_BASE') ?? `http://127.0.0.1:${port}/api`
      const settleDelayMs = Number(this.config.get<string>('MOOLRE_MOCK_SETTLE_MS') ?? 2500)
      const scenario = this.config.get<string>('MOOLRE_MOCK_SCENARIO') as MockScenario | undefined
      this.client = new MockMoolreClient({
        callbackBaseUrl,
        webhookSecret: this.config.get<string>('MOOLRE_WEBHOOK_SECRET') ?? '',
        settleDelayMs,
        scenario,
      })
      this.logger.warn(
        `Moolre client ready → MOCK (dev only; self-settles in ${settleDelayMs}ms via ${callbackBaseUrl}` +
          `${scenario && scenario !== 'happy' ? `; scenario=${scenario}` : ''})`,
      )
      return
    }

    const baseUrl =
      this.config.get<string>('MOOLRE_BASE_URL') ?? 'https://sandbox.moolre.com'
    const apiUser = this.config.get<string>('MOOLRE_API_USER')
    const accountNumber = this.config.get<string>('MOOLRE_ACCOUNT_NUMBER')

    // Warn but don't crash — allows the app to boot without Moolre creds for
    // local development. Any actual API call will fail with a clear error.
    if (!apiUser || !accountNumber) {
      this.logger.warn(
        'MOOLRE_API_USER or MOOLRE_ACCOUNT_NUMBER not set — ' +
          'Moolre calls will fail until credentials are configured.',
      )
    }

    const cfg: MoolreConfig = {
      baseUrl,
      apiUser: apiUser ?? '',
      accountNumber: accountNumber ?? '',
      apiKey: this.config.get<string>('MOOLRE_API_KEY'),
      vasKey: this.config.get<string>('MOOLRE_VASKEY'),
      timeoutMs: Number(this.config.get<string>('MOOLRE_TIMEOUT_MS') ?? 15000),
    }
    this.client = new MoolreClient(cfg)
    this.logger.log(`Moolre client ready → ${cfg.baseUrl}`)
  }

  /** Collect (debit) from a MoMo wallet. Handles the TP14 OTP step. */
  async collect(input: CollectInput): Promise<CollectResult> {
    return this.client.collect(input)
  }

  /** Disburse (pay out) to a wallet or bank account. */
  async transfer(input: TransferInput) {
    return this.client.transfer(input)
  }

  /** Check whether a transaction has fully settled by externalref. */
  async isSettled(externalref: string): Promise<boolean> {
    return this.client.isSettled(externalref)
  }

  /** Raw status — returns the full response (use when you need txstatus/amounts). */
  async getStatus(id: string, idtype: '1' | '2' = '1') {
    return this.client.getStatus(id, idtype)
  }

  /** Account balance (used to guard payouts). */
  async getBalance() {
    return this.client.getBalance()
  }

  /** Transaction history for reconciliation / activity feed. */
  async listTransactions(opts: {
    startdate?: string
    enddate?: string
    limit?: number
    status?: number
  } = {}) {
    return this.client.listTransactions(opts)
  }

  /** Send SMS (receipts, OTP, alerts). Requires MOOLRE_VASKEY + approved Sender ID. */
  async sendSms(input: SmsInput) {
    return this.client.sendSms(input)
  }

  /** Re-export the error class so other modules can catch it typed. */
  static readonly Error = MoolreError
}
