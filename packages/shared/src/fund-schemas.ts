import { z } from 'zod'
import { phoneSchema } from './auth-schemas'

/**
 * Fund payload schemas — shared between the Nest backend (createZodDto) and the
 * Next.js frontend (create-fund / invite forms), so request shapes never drift.
 * All money is integer pesewas (GHS x 100).
 */

export const frequencySchema = z.enum(['weekly', 'monthly'])
export const susuPayoutRuleSchema = z.enum(['rotating', 'random', 'trust_ordered'])

/** Create a Susu fund. memberCount drives totalCycles (one cycle per member). */
export const createSusuFundSchema = z
  .object({
    type: z.literal('Susu'),
    name: z.string().trim().min(1, 'Name is required').max(80),
    /** Per-cycle contribution, integer pesewas > 0. */
    contribution: z.number().int().positive('Contribution must be greater than 0'),
    frequency: frequencySchema,
    /** 2..50 members; equals totalCycles. */
    memberCount: z.number().int().min(2, 'A Susu needs at least 2 members').max(50, 'Max 50 members'),
    startDate: z.coerce.date(),
    payoutRule: susuPayoutRuleSchema.default('rotating'),
    requiresDeposit: z.boolean().default(false),
    /** Integer pesewas >= 0; required > 0 when requiresDeposit. */
    depositAmount: z.number().int().min(0).default(0),
  })
  .refine((d) => !d.requiresDeposit || d.depositAmount > 0, {
    message: 'depositAmount must be greater than 0 when a deposit is required',
    path: ['depositAmount'],
  })

/** Invite members to a Susu by MoMo number (capped at remaining seats server-side). */
export const inviteMembersSchema = z.object({
  phones: z.array(phoneSchema).min(1, 'Add at least one number').max(50),
})

export type CreateSusuFundInput = z.infer<typeof createSusuFundSchema>
export type InviteMembersInput = z.infer<typeof inviteMembersSchema>
