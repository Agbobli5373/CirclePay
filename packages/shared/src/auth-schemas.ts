import { z } from 'zod'

/**
 * Auth payload schemas — shared between the Nest backend (createZodDto) and the
 * Next.js frontend (form validation), so request shapes never drift.
 */

// Ghana phone: +233 followed by 9 digits (local form 0XXXXXXXXX is normalised client-side).
export const phoneSchema = z
  .string()
  .regex(/^\+233\d{9}$/, 'Enter a valid Ghana number (+233XXXXXXXXX)')

export const networkSchema = z.enum(['MTN', 'Telecel', 'AirtelTigo'])
export const languageSchema = z.enum(['en', 'tw', 'ga'])

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
})

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
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

export type RequestOtpInput = z.infer<typeof requestOtpSchema>
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>
export type SetPinInput = z.infer<typeof setPinSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type ChangePinInput = z.infer<typeof changePinSchema>
