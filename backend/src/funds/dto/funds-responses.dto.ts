import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/** Summary card for a Susu fund (Home / Funds list). Money is integer pesewas. */
export class FundSummaryDto {
  @ApiProperty({ example: 'cmsfund...id' })
  id!: string

  @ApiProperty({ example: 'Kumasi Traders Circle' })
  name!: string

  @ApiProperty({ example: 'Susu', enum: ['Susu', 'Medical', 'Education', 'Business'] })
  type!: string

  @ApiProperty({ example: 'active', enum: ['active', 'completed', 'cancelled'] })
  status!: string

  @ApiProperty({ example: 50000, description: 'Per-cycle contribution, pesewas.' })
  contribution!: number

  @ApiProperty({ example: 'monthly', enum: ['weekly', 'monthly'] })
  frequency!: string

  @ApiProperty({ example: 6 })
  memberCount!: number

  @ApiProperty({ example: 1 })
  currentCycle!: number

  @ApiProperty({ example: 6, description: '== memberCount' })
  totalCycles!: number

  @ApiProperty({ example: 17, description: 'Progress through the rotation, 0–100.' })
  progressPercent!: number

  @ApiProperty({ example: 300000, description: 'Pot each cycle = contribution × members, pesewas.' })
  potPesewas!: number

  @ApiPropertyOptional({
    example: 3,
    nullable: true,
    description: "The cycle in which the requesting member is paid (1-based), or null if unknown.",
  })
  myNextPayoutCycle!: number | null
}

/** A member row in fund detail. */
export class MemberDto {
  @ApiProperty({ example: 'cmsuser...id' })
  userId!: string

  @ApiPropertyOptional({ example: 'Ama Asante', nullable: true })
  name!: string | null

  @ApiProperty({ example: 'admin', enum: ['member', 'admin'] })
  role!: string

  @ApiProperty({ example: 'active', enum: ['active', 'grace', 'defaulted', 'left', 'completed'] })
  fundStatus!: string

  @ApiProperty({ example: 'pending', enum: ['paid', 'pending', 'overdue'], description: 'Current-cycle payment status.' })
  status!: string

  @ApiProperty({ example: false })
  depositPaid!: boolean

  @ApiProperty({ example: 'good', enum: ['new_', 'building', 'good', 'excellent', 'locked'] })
  trustStanding!: string

  @ApiProperty({ example: 1, description: 'Position in the payout order (1-based).' })
  payoutPosition!: number
}

/** Full fund detail (members + payout order + this-cycle progress). */
export class FundDetailDto extends FundSummaryDto {
  @ApiProperty({ type: [MemberDto] })
  members!: MemberDto[]

  @ApiProperty({
    type: [String],
    example: ['cmsuserA', 'cmsuserB', 'cmsuserC'],
    description: 'Ordered userIds — who gets paid in which cycle (per payoutRule).',
  })
  payoutOrder!: string[]

  @ApiProperty({ example: 0, description: 'Members who have funded the current cycle.' })
  thisCycleFundedCount!: number

  @ApiProperty({ example: 'rotating', enum: ['rotating', 'random', 'trust_ordered'] })
  payoutRule!: string

  @ApiProperty({ example: true, description: 'Whether the Susu has started (filled → order locked).' })
  started!: boolean

  @ApiPropertyOptional({ example: 'cmsuserA', nullable: true, description: "Recipient of the current cycle's pot." })
  currentPayeeUserId!: string | null

  @ApiProperty({
    example: 'none',
    enum: ['none', 'initiated', 'settled', 'failed'],
    description: "Payout status for the current cycle (p:{fundId}:{currentCycle}).",
  })
  currentCyclePayoutStatus!: string

  @ApiProperty({ example: 1, description: 'Pending invites not yet accepted (awaiting members).' })
  pendingInviteCount!: number
}

/** Result of inviting members. */
export class InviteResultDto {
  @ApiProperty({ example: 2, description: 'How many invites were created + SMS attempted.' })
  invited!: number
}

/** A single invite row (admin invite manager). */
export class InviteDto {
  @ApiProperty({ example: 'cmsinviteid' })
  id!: string

  @ApiProperty({ example: '+233240000002' })
  phone!: string

  @ApiProperty({ example: 'pending', enum: ['pending', 'accepted', 'expired', 'declined'] })
  status!: string

  @ApiProperty({ example: 'http://localhost:3000/join/abc123', description: 'Shareable join link for this invitee.' })
  joinUrl!: string

  @ApiProperty({ example: '2026-06-04T14:00:00.000Z' })
  createdAt!: Date
}

/** An invite addressed to the current user — shown in their in-app "Invitations" inbox. */
export class MyInviteDto {
  @ApiProperty({ example: 'cmsinviteid' })
  id!: string

  @ApiProperty({ example: 'abc123', description: 'Accept by POST /funds/join/:token.' })
  token!: string

  @ApiProperty({ example: 'cmsfundid' })
  fundId!: string

  @ApiProperty({ example: 'Kumasi Traders Circle' })
  fundName!: string

  @ApiProperty({ example: 50000, description: 'Per-cycle contribution, pesewas.' })
  contribution!: number

  @ApiProperty({ example: 'monthly', enum: ['weekly', 'monthly'] })
  frequency!: string

  @ApiProperty({ example: 6 })
  memberCount!: number

  @ApiProperty({ example: 2, description: 'Open seats remaining before the Susu starts.' })
  seatsLeft!: number

  @ApiProperty({ example: 'rotating', enum: ['rotating', 'random', 'trust_ordered'] })
  payoutRule!: string

  @ApiProperty({ example: 'Ama Asante', description: 'Who created the circle / invited you.' })
  inviterName!: string

  @ApiProperty({ example: '2026-06-04T14:00:00.000Z' })
  createdAt!: Date
}

/** Result of joining a fund. */
export class JoinResultDto {
  @ApiProperty({
    example: 'active',
    enum: ['active', 'pending_deposit'],
    description: "'pending_deposit' → a deposit collection is required before the seat activates (E4).",
  })
  status!: string

  @ApiPropertyOptional({ example: 20000, description: 'Required deposit, pesewas (when pending_deposit).' })
  depositAmount?: number

  @ApiPropertyOptional({ example: 'cmsfundid', description: 'The fund joined (returned by accept-invite).' })
  fundId?: string
}
