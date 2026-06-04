import { z } from 'zod'

/**
 * Contribution payload schema — shared between the Nest backend (createZodDto)
 * and the Next.js pay flow. Money is computed server-side from SusuDetail; the
 * client only identifies the fund and (when prompted) supplies the SMS OTP.
 */
export const initiateContributionSchema = z.object({
  fundId: z.string().min(1),
  /** Supplied on the second call when Moolre returned otp_required (TP14). */
  otpcode: z
    .string()
    .regex(/^\d{4,8}$/, 'Enter the code from the SMS')
    .optional(),
})

export type InitiateContributionInput = z.infer<typeof initiateContributionSchema>

/** Contribution lifecycle state surfaced to the client. */
export type ContributionState = 'otp_required' | 'initiated' | 'settled' | 'failed'
