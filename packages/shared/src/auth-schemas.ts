import { z } from 'zod'

/**
 * Auth payload schemas — shared between the Nest backend (createZodDto) and the
 * Next.js frontend (form validation), so request shapes never drift.
 */

/**
 * Normalize any common Ghana phone format to canonical E.164 `+233XXXXXXXXX`, or null if it
 * can't be made valid. Accepts the way people actually type it: local `0XXXXXXXXX` (drops the
 * leading 0), bare 9-digit `XXXXXXXXX`, `233…`, `+233…`; ignores spaces / dashes / brackets.
 */
export function normalizeGhPhone(raw: string): string | null {
  let d = (raw ?? '').replace(/\D/g, '')
  if (d.length > 10 && d.startsWith('233')) d = d.slice(3) // strip the country code
  if (d.length === 10 && d.startsWith('0')) d = d.slice(1) // strip the local trunk 0
  return /^\d{9}$/.test(d) ? `+233${d}` : null
}

/**
 * Reduce a typed/pasted number to its up-to-9 subscriber digits, for the `+233`-prefixed input
 * fields — strips a pasted country code and the local trunk 0 as the user types (so habitually
 * typing `024…` just works). Ghana subscriber numbers never start with 0, so this is always safe.
 */
export function toLocal9(raw: string): string {
  let d = (raw ?? '').replace(/\D/g, '')
  if (d.length > 9 && d.startsWith('233')) d = d.slice(3)
  if (d.startsWith('0')) d = d.slice(1)
  return d.slice(0, 9)
}

// Ghana phone: stored as +233 followed by 9 digits. We accept the local form people actually
// type (e.g. "024 123 4567") and normalize it before validating.
export const phoneSchema = z.preprocess(
  (v) => (typeof v === 'string' ? (normalizeGhPhone(v) ?? v.trim()) : v),
  z.string().regex(/^\+233\d{9}$/, 'Enter a valid Ghana number (e.g. 024 123 4567)'),
)

export const networkSchema = z.enum(['MTN', 'Telecel', 'AirtelTigo'])
export const languageSchema = z.enum(['en', 'tw', 'ga'])

/**
 * Why an OTP is being requested. Keyed separately in Redis so a login OTP can't
 * be replayed to reset a PIN. Defaults to 'auth' server-side when omitted.
 */
export const otpPurposeSchema = z.enum(['auth', 'reset'])

/** Trivial PINs that must be rejected. */
const TRIVIAL_PINS = new Set([
  '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
  '1234', '2345', '3456', '4567', '5678', '6789', '0123',
  '4321', '5432', '6543', '7654', '8765', '9876', '3210',
])

export const pinSchema = z
  .string()
  .regex(/^\d{4}$/, 'PIN must be exactly 4 digits')
  .refine((p) => !TRIVIAL_PINS.has(p), 'Choose a less guessable PIN')

export const requestOtpSchema = z.object({
  phone: phoneSchema,
  network: networkSchema,
  purpose: otpPurposeSchema.optional(),
})

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  purpose: otpPurposeSchema.optional(),
})

export const setPinSchema = z
  .object({
    pin: pinSchema,
    confirmPin: z.string(),
    network: networkSchema,
    language: languageSchema.optional(),
    name: z.string().trim().min(1).max(80).optional(),
  })
  .refine((d) => d.pin === d.confirmPin, {
    message: 'PINs do not match',
    path: ['confirmPin'],
  })

export const loginSchema = z.object({
  phone: phoneSchema,
  pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits'),
})

/** Editable profile fields (name for now). */
export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(80),
})

/** Change PIN while authenticated: verify the current PIN, then set a fresh one. */
export const changePinSchema = z
  .object({
    currentPin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits'),
    newPin: pinSchema,
    confirmPin: z.string(),
  })
  .refine((d) => d.newPin === d.confirmPin, { message: 'PINs do not match', path: ['confirmPin'] })
  .refine((d) => d.newPin !== d.currentPin, {
    message: 'New PIN must be different from your current one',
    path: ['newPin'],
  })

/**
 * Reset PIN after proving phone ownership via a fresh `purpose:'reset'` OTP.
 * Deliberately has no `currentPin` — the OTP is the proof of identity, and a
 * short-lived reset token (not a session) gates the call.
 */
export const resetPinSchema = z
  .object({
    newPin: pinSchema,
    confirmPin: z.string(),
  })
  .refine((d) => d.newPin === d.confirmPin, { message: 'PINs do not match', path: ['confirmPin'] })

export type OtpPurpose = z.infer<typeof otpPurposeSchema>
export type RequestOtpInput = z.infer<typeof requestOtpSchema>
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>
export type SetPinInput = z.infer<typeof setPinSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type ChangePinInput = z.infer<typeof changePinSchema>
export type ResetPinInput = z.infer<typeof resetPinSchema>
