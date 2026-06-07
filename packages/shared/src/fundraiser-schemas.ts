import { z } from 'zod'
import { phoneSchema, networkSchema } from './auth-schemas'

/**
 * Medical / emergency fundraising (EM) payload schemas — shared between the Nest
 * backend (createZodDto) and the Next.js create + public-donate flows. Money is
 * integer pesewas. Payout routes: the two hospital routes require ops verification
 * before release; `individual_cash` (a person's MoMo — a family member or the
 * organizer) is released by the organizer without ops verification.
 */
export const medicalPayoutRouteSchema = z.enum(['hospital_momo', 'hospital_bank', 'individual_cash'])

export const createMedicalFundSchema = z
  .object({
    type: z.literal('Medical'),
    name: z.string().trim().min(1, 'Name is required').max(80),
    /** Fundraising goal, integer pesewas > 0. */
    goal: z.number().int().positive('Goal must be greater than 0'),
    beneficiary: z.string().trim().min(1, 'Beneficiary is required').max(80),
    story: z.string().trim().min(1, 'Tell the story').max(2000),
    hospital: z.string().trim().max(120).optional(),
    payoutRoute: medicalPayoutRouteSchema,
    payee: z.object({
      name: z.string().trim().min(1, 'Payee name is required').max(80),
      momo: phoneSchema.optional(),
      network: networkSchema.optional(),
      bank: z.string().trim().max(120).optional(),
    }),
    deadline: z.coerce.date().optional(),
    shareable: z.boolean().default(true),
  })
  .refine((d) => d.payoutRoute !== 'hospital_momo' || !!d.payee.momo, {
    message: 'A payee MoMo number is required for the hospital MoMo route',
    path: ['payee', 'momo'],
  })
  .refine((d) => d.payoutRoute !== 'hospital_bank' || !!d.payee.bank, {
    message: 'A payee bank account is required for the hospital bank route',
    path: ['payee', 'bank'],
  })
  .refine((d) => d.payoutRoute !== 'individual_cash' || !!d.payee.momo, {
    message: 'A MoMo number is required to send to a person',
    path: ['payee', 'momo'],
  })
  .refine((d) => d.payoutRoute !== 'individual_cash' || !!d.payee.network, {
    message: "Select the payee's MoMo network",
    path: ['payee', 'network'],
  })

/** A public donation to a medical fund. donationId (client uuid) keeps the externalref stable across the OTP retry. */
export const donateSchema = z.object({
  donationId: z.string().min(1).max(64),
  phone: phoneSchema,
  network: networkSchema,
  /** Donation amount, integer pesewas > 0. */
  amount: z.number().int().positive('Amount must be greater than 0'),
  displayName: z.string().trim().max(80).optional(),
  anonymous: z.boolean().default(false),
  otpcode: z.string().regex(/^\d{4,8}$/, 'Enter the code from the SMS').optional(),
})

/** Ops adjudication of a fundraiser payee. */
export const verifyPayeeSchema = z.object({
  decision: z.enum(['verified', 'rejected']),
  note: z.string().trim().max(300).optional(),
})

/** Organizer invites family/friends to contribute (SMS with the public donate link). */
export const inviteContributorsSchema = z.object({
  phones: z.array(phoneSchema).min(1, 'Add at least one number').max(20, 'Up to 20 at a time'),
})

/** Organizer sends a thank-you SMS to all settled contributors. */
export const thankContributorsSchema = z.object({
  note: z.string().trim().max(160, 'Keep it short for SMS').optional(),
})

export type CreateMedicalFundInput = z.infer<typeof createMedicalFundSchema>
export type DonateInput = z.infer<typeof donateSchema>
export type VerifyPayeeInput = z.infer<typeof verifyPayeeSchema>
export type InviteContributorsInput = z.infer<typeof inviteContributorsSchema>
export type ThankContributorsInput = z.infer<typeof thankContributorsSchema>
