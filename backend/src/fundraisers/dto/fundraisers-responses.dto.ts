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
