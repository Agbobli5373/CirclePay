/**
 * Framework-agnostic Moolre client.
 *
 * SERVER-SIDE ONLY. Never import this into client/browser code — it reads secret keys.
 * Works in any Node/edge runtime with `fetch` (Next.js route handlers, Nest.js, workers).
 *
 * Copy into your backend (e.g. Next.js `lib/moolre.ts` or a Nest.js provider).
 * Docs: https://docs.moolre.com
 */

// ----- Config -----

export interface MoolreConfig {
  baseUrl: string // https://sandbox.moolre.com | https://api.moolre.com
  apiUser: string
  apiKey?: string // private key (live); omit in sandbox
  accountNumber: string
  vasKey?: string // X-API-VASKEY — required for SMS/WhatsApp (live)
}

export function moolreConfigFromEnv(env: NodeJS.ProcessEnv = process.env): MoolreConfig {
  const baseUrl = env.MOOLRE_BASE_URL
  const apiUser = env.MOOLRE_API_USER
  const accountNumber = env.MOOLRE_ACCOUNT_NUMBER
  if (!baseUrl || !apiUser || !accountNumber) {
    throw new Error('Missing MOOLRE_BASE_URL / MOOLRE_API_USER / MOOLRE_ACCOUNT_NUMBER')
  }
  return {
    baseUrl,
    apiUser,
    accountNumber,
    apiKey: env.MOOLRE_API_KEY,
    vasKey: env.MOOLRE_VASKEY,
  }
}

// ----- Channels -----

export const CollectionChannel = { MTN: '13', Telecel: '6', AirtelTigo: '7' } as const
export const TransferChannel = { MTN: '1', Telecel: '6', AirtelTigo: '7', Bank: '2' } as const
export type CollectionChannel = (typeof CollectionChannel)[keyof typeof CollectionChannel]
export type TransferChannel = (typeof TransferChannel)[keyof typeof TransferChannel]

// ----- Response envelope -----

export interface MoolreResponse<T = unknown> {
  status: number | string
  code: string
  message: string | string[] | null
  data: T
  go: unknown
}

export interface StatusData {
  txstatus: number
  txtype?: number
  accountnumber?: string
  payer?: string
  payee?: string
  amount?: string
  value?: string
  transactionid?: string
  externalref?: string
  thirdpartyref?: string
  ts?: string
}

export interface TransferData {
  txstatus: number
  receiver: string
  transactionid: string
  externalref: string
  receivername?: string
  amount: string
  amountfee?: string
  fee?: string
}

export interface BalanceData {
  balance: number
  accountname: string
  callback?: string
}

export class MoolreError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly response: MoolreResponse,
  ) {
    super(message)
    this.name = 'MoolreError'
  }
}

export function isOk(res: MoolreResponse): boolean {
  return String(res.status) === '1'
}

// ----- Client -----

export interface CollectInput {
  channel: CollectionChannel
  payer: string
  amount: string
  externalref: string
  currency?: string // default GHS
  otpcode?: string
  sessionid?: string
  reference?: string
}

export interface TransferInput {
  channel: TransferChannel
  receiver: string
  amount: string
  externalref: string
  sublistid: string
  currency?: string
  reference?: string
}

/** Returned by `collect` so callers can drive the OTP step. */
export interface CollectResult {
  /** true when Moolre wants an SMS OTP — resubmit `collect` with the same input + `otpcode`. */
  otpRequired: boolean
  raw: MoolreResponse
}

/** One SMS in a (possibly bulk) send. */
export interface SmsMessage {
  recipient: string // phone number, e.g. "0241234567"
  message: string
  ref?: string // optional tracking reference
}

export interface SmsInput {
  /** Registered + approved Sender ID (max 11 chars), e.g. "CirclePay". */
  senderId: string
  messages: SmsMessage[]
}

export class MoolreClient {
  constructor(private readonly config: MoolreConfig) {}

  static fromEnv(env?: NodeJS.ProcessEnv): MoolreClient {
    return new MoolreClient(moolreConfigFromEnv(env))
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<MoolreResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-USER': this.config.apiUser,
    }
    if (this.config.apiKey) headers['X-API-KEY'] = this.config.apiKey

    const res = await fetch(`${this.config.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    return this.parse<T>(res)
  }

  /** SMS/WhatsApp endpoints authenticate with X-API-VASKEY only (no X-API-USER / accountnumber). */
  private async postVas<T>(path: string, body: Record<string, unknown>): Promise<MoolreResponse<T>> {
    if (!this.config.vasKey) {
      throw new MoolreError('Missing MOOLRE_VASKEY for SMS/WhatsApp', 'AIN01', {
        status: 0,
        code: 'AIN01',
        message: 'VAS key not configured',
        data: null as unknown as T,
        go: null,
      })
    }
    const res = await fetch(`${this.config.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-VASKEY': this.config.vasKey },
      body: JSON.stringify(body),
    })
    return this.parse<T>(res)
  }

  private async parse<T>(res: Response): Promise<MoolreResponse<T>> {
    try {
      return (await res.json()) as MoolreResponse<T>
    } catch {
      throw new MoolreError(`Moolre returned non-JSON (HTTP ${res.status})`, 'PARSE', {
        status: 0,
        code: 'PARSE',
        message: null,
        data: null as unknown as T,
        go: null,
      })
    }
  }

  /** Collect (debit) from a MoMo wallet. Handle `result.otpRequired` by re-calling with `otpcode`. */
  async collect(input: CollectInput): Promise<CollectResult> {
    const res = await this.post<unknown>('/open/transact/payment', {
      type: 1,
      channel: input.channel,
      currency: input.currency ?? 'GHS',
      payer: input.payer,
      amount: input.amount,
      externalref: input.externalref,
      accountnumber: this.config.accountNumber,
      ...(input.otpcode ? { otpcode: input.otpcode } : {}),
      ...(input.sessionid ? { sessionid: input.sessionid } : {}),
      ...(input.reference ? { reference: input.reference } : {}),
    })

    if (res.code === 'TP14') return { otpRequired: true, raw: res }
    if (!isOk(res) || res.code !== 'TR099') {
      throw new MoolreError(messageOf(res) ?? `Collection failed (${res.code})`, res.code, res)
    }
    return { otpRequired: false, raw: res }
  }

  /** Disburse (pay out) to a wallet or bank account. */
  async transfer(input: TransferInput): Promise<MoolreResponse<TransferData>> {
    const res = await this.post<TransferData>('/open/transact/transfer', {
      type: 1,
      channel: input.channel,
      currency: input.currency ?? 'GHS',
      amount: input.amount,
      receiver: input.receiver,
      sublistid: input.sublistid,
      externalref: input.externalref,
      accountnumber: this.config.accountNumber,
      ...(input.reference ? { reference: input.reference } : {}),
    })
    if (!isOk(res) || res.code !== 'OBGH01') {
      throw new MoolreError(messageOf(res) ?? `Transfer failed (${res.code})`, res.code, res)
    }
    return res
  }

  /** Check a transaction by your externalref (idtype 1) or Moolre transactionid (idtype 2). */
  async getStatus(id: string, idtype: '1' | '2' = '1'): Promise<MoolreResponse<StatusData>> {
    return this.post<StatusData>('/open/transact/status', {
      type: 1,
      idtype,
      id,
      accountnumber: this.config.accountNumber,
    })
  }

  /** True when the transaction has fully settled (txstatus === 1). */
  async isSettled(externalref: string): Promise<boolean> {
    const res = await this.getStatus(externalref, '1')
    return isOk(res) && res.data?.txstatus === 1
  }

  /** Account balance. */
  async getBalance(): Promise<MoolreResponse<BalanceData>> {
    return this.post<BalanceData>('/open/account/status', {
      type: 1,
      accountnumber: this.config.accountNumber,
    })
  }

  /** Transaction history for reconciliation / activity feeds. */
  async listTransactions(opts: {
    startdate?: string
    enddate?: string
    limit?: number
    status?: number
  } = {}): Promise<MoolreResponse<unknown>> {
    return this.post<unknown>('/open/account/status', {
      type: 2,
      accountnumber: this.config.accountNumber,
      ...opts,
    })
  }

  /**
   * Send one or more SMS messages (e.g. payment receipts, payout alerts).
   * Requires `MOOLRE_VASKEY` and an approved Sender ID (set up at app.moolre.com).
   * Throws on `ASMS07` (Sender ID not approved) or other non-`SMS01` codes.
   */
  async sendSms(input: SmsInput): Promise<MoolreResponse<null>> {
    const res = await this.postVas<null>('/open/sms/send', {
      type: 1,
      senderid: input.senderId,
      messages: input.messages,
    })
    if (!isOk(res) || res.code !== 'SMS01') {
      throw new MoolreError(messageOf(res) ?? `SMS send failed (${res.code})`, res.code, res)
    }
    return res
  }
}

function messageOf(res: MoolreResponse): string | undefined {
  if (Array.isArray(res.message)) return res.message.join(', ')
  return res.message ?? undefined
}
