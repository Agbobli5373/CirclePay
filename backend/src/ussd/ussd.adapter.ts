/** Canonical USSD request after normalizing a provider's inbound body. */
export interface UssdRequest {
  sessionId: string
  phone: string
  /** The latest text the user entered for the current prompt. */
  input: string
}

/** What the engine produces; the adapter encodes it for the gateway wire. */
export interface UssdReply {
  continue: boolean
  text: string
}

/**
 * Raw inbound body. Gateways differ (Moolre USSD, Hubtel, Africa's Talking), so this
 * lists the common field aliases. The secret-guarded controller treats the gateway as
 * semi-trusted, so we parse defensively (never 400 a live USSD session) instead of
 * schema-rejecting.
 */
export interface UssdInboundBody {
  sessionId?: string
  sessionID?: string
  sessionid?: string
  phone?: string
  phoneNumber?: string
  msisdn?: string
  text?: string
  input?: string
}

/**
 * Normalize an inbound body → canonical request. Convention: `input` is the latest
 * entry. For gateways that send the full accumulated, '*'-joined text (e.g. Africa's
 * Talking), we take the last segment. This is the ONE provider-specific seam — extend
 * it here for the chosen gateway at cutover; the menu engine never changes.
 */
export function parseInbound(body: UssdInboundBody): UssdRequest {
  const sessionId = body.sessionId ?? body.sessionID ?? body.sessionid ?? ''
  const phone = body.phone ?? body.phoneNumber ?? body.msisdn ?? ''
  const text = body.text ?? ''
  const input = body.input ?? lastSegment(text)
  return { sessionId, phone, input }
}

function lastSegment(text: string): string {
  if (!text) return ''
  const parts = text.split('*')
  return parts[parts.length - 1] ?? ''
}

/** Encode a reply for the gateway: `CON ` keeps the session open, `END ` closes it. */
export function formatReply(reply: UssdReply): string {
  return `${reply.continue ? 'CON' : 'END'} ${reply.text}`
}
