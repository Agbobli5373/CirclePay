import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  MoolreClient,
  MoolreConfig,
  MoolreError,
  CollectInput,
  CollectResult,
  TransferInput,
  SmsInput,
} from './moolre.client'

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
  private client!: MoolreClient

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const cfg: MoolreConfig = {
      baseUrl:
        this.config.get<string>('MOOLRE_BASE_URL') ?? 'https://sandbox.moolre.com',
      apiUser: this.config.getOrThrow<string>('MOOLRE_API_USER'),
      accountNumber: this.config.getOrThrow<string>('MOOLRE_ACCOUNT_NUMBER'),
      apiKey: this.config.get<string>('MOOLRE_API_KEY'),
      vasKey: this.config.get<string>('MOOLRE_VASKEY'),
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
