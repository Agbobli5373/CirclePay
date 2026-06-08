import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/** A settled donor row shown on the public page / in-app detail. */
export class ContributorDto {
  @ApiProperty({ example: 'Akosua F.' })
  displayName!: string

  @ApiProperty({ example: 50000, description: 'Donation amount, pesewas.' })
  amount!: number

  @ApiProperty({ example: '2026-06-06T10:00:00.000Z' })
  ts!: Date
}

/** Public view of a medical fundraiser (no auth). */
export class PublicFundraiserDto {
  @ApiProperty({ example: 'help-kofi-a1b2c3' })
  slug!: string

  @ApiProperty({ example: 'Help Kofi get surgery' })
  name!: string

  @ApiProperty({ example: 'Kofi Mensah' })
  beneficiary!: string

  @ApiPropertyOptional({ example: 'Korle Bu Teaching Hospital', nullable: true })
  hospital!: string | null

  @ApiPropertyOptional({ example: 'Kofi needs urgent heart surgery…', nullable: true })
  story!: string | null

  @ApiProperty({ example: 500000, description: 'Goal, pesewas.' })
  goal!: number

  @ApiProperty({ example: 320000, description: 'Raised so far (settled donations), pesewas.' })
  raised!: number

  @ApiProperty({ example: 64 })
  progressPercent!: number

  @ApiPropertyOptional({ example: '2026-07-01T00:00:00.000Z', nullable: true })
  deadline!: Date | null

  @ApiProperty({ example: 'hospital_bank', enum: ['hospital_momo', 'hospital_bank', 'individual_cash'] })
  payoutRoute!: string

  @ApiProperty({ example: 'verified', enum: ['unverified', 'pending', 'verified', 'rejected'] })
  verificationStatus!: string

  @ApiProperty({ type: [ContributorDto] })
  contributors!: ContributorDto[]
}

/** A payout tranche (escrow step). */
export class TrancheDto {
  @ApiProperty({ example: 'cmstrancheid' })
  id!: string

  @ApiProperty({ example: 100000, description: 'Tranche amount, pesewas.' })
  amount!: number

  @ApiProperty({ example: 'released', enum: ['held', 'released', 'settled', 'refunded'] })
  status!: string

  @ApiPropertyOptional({ example: '2026-06-08T10:00:00.000Z', nullable: true })
  releasedAt!: Date | null
}

/** A proof-of-use document attached to a tranche. */
export class ReceiptDto {
  @ApiProperty({ example: 'cmsreceiptid' })
  id!: string

  @ApiPropertyOptional({ example: 'cmstrancheid', nullable: true })
  trancheId!: string | null

  @ApiProperty({ example: 'receipt', enum: ['proforma', 'receipt'] })
  kind!: string

  @ApiProperty({ example: 'submitted', enum: ['submitted', 'verified', 'rejected'] })
  status!: string

  @ApiProperty({ example: 'https://example.com/bill.jpg', description: 'Link to the bill/receipt.' })
  docUrl!: string

  @ApiProperty({ example: '2026-06-08T10:00:00.000Z' })
  ts!: Date
}

/** In-app fundraiser detail (organizer / ops). Extends the public view with control flags. */
export class FundraiserDto extends PublicFundraiserDto {
  @ApiProperty({ example: 'cmsfundid' })
  id!: string

  @ApiProperty({ example: 'active', enum: ['active', 'completed', 'cancelled'] })
  status!: string

  @ApiProperty({ example: true, description: 'Is the requesting user the organizer (creator)?' })
  isOwner!: boolean

  @ApiProperty({ example: 'Korle Bu MoMo', description: 'Payee display name.' })
  payeeName!: string

  @ApiProperty({ example: 200000, description: 'Sum of non-refunded tranche amounts, pesewas.' })
  released!: number

  @ApiProperty({ example: 120000, description: 'How much can be released now (raised − released, capped), pesewas.' })
  releasable!: number

  @ApiProperty({ example: true, description: 'Whether 2nd+ releases are gated on a verified receipt.' })
  requiresReceipts!: boolean

  @ApiPropertyOptional({ example: 100000, nullable: true, description: 'Cap on the first release, pesewas.' })
  firstTrancheCap!: number | null

  @ApiProperty({ example: false, description: 'Can the organizer release a tranche right now?' })
  canReleaseNext!: boolean

  @ApiPropertyOptional({ example: 'receipt_required', nullable: true, enum: ['receipt_required', 'payee_unverified'] })
  nextBlockedReason!: string | null

  @ApiProperty({ type: [TrancheDto] })
  tranches!: TrancheDto[]

  @ApiProperty({ type: [ReceiptDto] })
  receipts!: ReceiptDto[]
}

/** Compact medical fundraiser card for the organizer's Funds list / dashboard. */
export class MyFundraiserDto {
  @ApiProperty({ example: 'cmsfundid' })
  id!: string

  @ApiProperty({ example: 'help-kofi-a1b2c3' })
  slug!: string

  @ApiProperty({ example: 'Help Kofi get surgery' })
  name!: string

  @ApiProperty({ example: 'Kofi Mensah' })
  beneficiary!: string

  @ApiProperty({ example: 500000 })
  goal!: number

  @ApiProperty({ example: 320000 })
  raised!: number

  @ApiProperty({ example: 64 })
  progressPercent!: number

  @ApiProperty({ example: 'verified', enum: ['unverified', 'pending', 'verified', 'rejected'] })
  verificationStatus!: string

  @ApiProperty({ example: 'active', enum: ['active', 'completed', 'cancelled'] })
  status!: string
}

/** Result of a public donation attempt. */
export class DonateResultDto {
  @ApiProperty({ example: 'otp_required', enum: ['otp_required', 'initiated', 'settled', 'failed'] })
  state!: string

  @ApiProperty({ example: 'mc:cmsfundid:9f3a…' })
  externalref!: string

  @ApiProperty({ example: 50000 })
  amount!: number
}

/** Public donation status for the donate flow to poll. */
export class DonationStatusDto {
  @ApiProperty({ example: 'settled', enum: ['initiated', 'settled', 'failed'] })
  status!: string

  @ApiProperty({ example: 50000 })
  amount!: number
}
