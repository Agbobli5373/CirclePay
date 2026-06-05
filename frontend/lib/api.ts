/**
 * Typed CirclePay API client (browser).
 *
 * - Always sends cookies (`credentials: 'include'`) so the httpOnly session flows.
 * - Parses the backend error envelope `{ error: { code, message } }` into ApiError.
 * - On a 401 (for non-auth calls) it transparently tries `POST /auth/refresh` once,
 *   then replays the original request.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001/api'

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

type RequestOpts = {
  method?: string
  body?: unknown
  idempotencyKey?: string
  /** internal — prevents infinite refresh loops */
  _retried?: boolean
}

// Credential/auth-control endpoints where a 401 is a real failure (don't try to refresh).
// Everything else — including /auth/me — refreshes once and retries on 401.
const NO_REFRESH = new Set([
  '/auth/request-otp',
  '/auth/verify-otp',
  '/auth/set-pin',
  '/auth/login',
  '/auth/logout',
  '/auth/refresh',
])

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    credentials: 'include',
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })

  if (res.status === 401 && !opts._retried && !NO_REFRESH.has(path.split('?')[0])) {
    // Try a single silent refresh, then replay.
    const refreshed = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
    if (refreshed.ok) return request<T>(path, { ...opts, _retried: true })
  }

  const text = await res.text()
  const data = text ? JSON.parse(text) : null

  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error
    throw new ApiError(err?.code ?? 'ERROR', err?.message ?? `Request failed (${res.status})`, res.status)
  }
  return data as T
}

// ----- Response shapes (mirror the backend DTOs) -----

export type Network = 'MTN' | 'Telecel' | 'AirtelTigo'

export interface Me {
  id: string
  phone: string
  name: string | null
  network: Network
  language: string
  isOpsAdmin: boolean
  trust: { standing: string; onTimeRate: number; fundsCompleted: number } | null
}

export interface FundSummary {
  id: string
  name: string
  type: string
  status: string
  contribution: number
  frequency: string
  memberCount: number
  currentCycle: number
  totalCycles: number
  progressPercent: number
  potPesewas: number
  myNextPayoutCycle: number | null
}

export interface MemberView {
  userId: string
  name: string | null
  role: string
  fundStatus: string
  status: string
  depositPaid: boolean
  trustStanding: string
  payoutPosition: number
}

export interface FundDetail extends FundSummary {
  members: MemberView[]
  payoutOrder: string[]
  thisCycleFundedCount: number
  payoutRule: string
  started: boolean
  currentPayeeUserId: string | null
  currentCyclePayoutStatus: string
  pendingInviteCount: number
}

export interface Invite {
  id: string
  phone: string
  status: 'pending' | 'accepted' | 'expired' | 'declined'
  joinUrl: string
  createdAt: string
}

/** A pending invite addressed to the current user (in-app "Invitations" inbox). */
export interface MyInvite {
  id: string
  token: string
  fundId: string
  fundName: string
  contribution: number
  frequency: string
  memberCount: number
  seatsLeft: number
  payoutRule: string
  inviterName: string
  createdAt: string
}

export interface ActivityItem {
  id: string
  type: 'contribution' | 'payout' | 'donation' | 'joined'
  title: string
  detail: string
  amount: number | null
  direction: 'in' | 'out' | null
  reference: string | null
  createdAt: string
}

export type ContributionState = 'otp_required' | 'initiated' | 'settled' | 'failed'
export interface ContributionResult {
  state: ContributionState
  externalref: string
  amount: number
  fee: number
  total: number
  cycle: number
  fundId: string
}
export interface ContributionStatus {
  externalref: string
  fundId: string
  cycle: number | null
  amount: number
  fee: number
  total: number
  status: 'initiated' | 'settled' | 'failed'
  transactionId: string | null
  settledAt: string | null
}

// ----- Request payloads -----

export interface CreateSusuPayload {
  type: 'Susu'
  name: string
  contribution: number // pesewas
  frequency: 'weekly' | 'monthly'
  memberCount: number
  startDate: string // ISO
  payoutRule: 'rotating' | 'random' | 'trust_ordered'
  requiresDeposit: boolean
  depositAmount: number
}

// ----- Endpoint groups -----

export const api = {
  auth: {
    requestOtp: (phone: string, network: Network) =>
      request<{ ok: true; devCode?: string }>('/auth/request-otp', { method: 'POST', body: { phone, network } }),
    verifyOtp: (phone: string, code: string) =>
      request<{ registered: boolean }>('/auth/verify-otp', { method: 'POST', body: { phone, code } }),
    setPin: (body: { pin: string; confirmPin: string; network: Network; name?: string }) =>
      request<{ ok: true }>('/auth/set-pin', { method: 'POST', body }),
    login: (phone: string, pin: string) =>
      request<{ ok: true }>('/auth/login', { method: 'POST', body: { phone, pin } }),
    logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
    me: () => request<Me>('/auth/me'),
    updateMe: (name: string) => request<Me>('/auth/me', { method: 'PATCH', body: { name } }),
  },
  funds: {
    create: (body: CreateSusuPayload) => request<FundSummary>('/funds', { method: 'POST', body }),
    list: (scope: 'mine' | 'all' = 'mine') =>
      request<FundSummary[]>(`/funds?mine=${scope === 'mine' ? 'true' : 'all'}`),
    detail: (id: string) => request<FundDetail>(`/funds/${id}`),
    invite: (id: string, phones: string[]) =>
      request<{ invited: number }>(`/funds/${id}/invites`, { method: 'POST', body: { phones } }),
    invites: (id: string) => request<Invite[]>(`/funds/${id}/invites`),
    resendInvite: (id: string, inviteId: string) =>
      request<{ ok: true }>(`/funds/${id}/invites/${inviteId}/resend`, { method: 'POST' }),
    revokeInvite: (id: string, inviteId: string) =>
      request<{ ok: true }>(`/funds/${id}/invites/${inviteId}`, { method: 'DELETE' }),
    myInvites: () => request<MyInvite[]>('/funds/invites/mine'),
    declineInvite: (inviteId: string) =>
      request<{ ok: true }>(`/funds/invites/${inviteId}/decline`, { method: 'POST' }),
    acceptInvite: (token: string) =>
      request<{ status: string; fundId?: string; depositAmount?: number }>(
        `/funds/join/${encodeURIComponent(token)}`,
        { method: 'POST' },
      ),
  },
  contributions: {
    initiate: (fundId: string, idempotencyKey: string, otpcode?: string) =>
      request<ContributionResult>('/contributions', {
        method: 'POST',
        body: otpcode ? { fundId, otpcode } : { fundId },
        idempotencyKey,
      }),
    status: (externalref: string) =>
      request<ContributionStatus>(`/contributions/${encodeURIComponent(externalref)}`),
  },
  activity: {
    list: () => request<ActivityItem[]>('/activity'),
  },
}
