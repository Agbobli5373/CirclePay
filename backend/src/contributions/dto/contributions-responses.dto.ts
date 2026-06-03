import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/** Result of POST /contributions. Status code: 202 (initiated) or 200 (otp_required / settled). */
export class InitiateContributionResultDto {
  @ApiProperty({
    example: 'otp_required',
    enum: ['otp_required', 'initiated', 'settled', 'failed'],
    description:
      "'otp_required' → re-POST with { otpcode } (same Idempotency-Key); 'initiated' → poll the status endpoint until settled.",
  })
  state!: string

  @ApiProperty({ example: 'c:cmsfundid:1:cmsuserid' })
  externalref!: string

  @ApiProperty({ example: 50000, description: 'Pot contribution, pesewas.' })
  amount!: number

  @ApiProperty({ example: 0, description: 'Platform fee, pesewas.' })
  fee!: number

  @ApiProperty({ example: 50000, description: 'Total debited from the payer (amount + fee), pesewas.' })
  total!: number

  @ApiProperty({ example: 1 })
  cycle!: number

  @ApiProperty({ example: 'cmsfundid' })
  fundId!: string
}

/** GET /contributions/:externalref — for the pay flow to poll until settled. */
export class ContributionStatusDto {
  @ApiProperty({ example: 'c:cmsfundid:1:cmsuserid' })
  externalref!: string

  @ApiProperty({ example: 'cmsfundid' })
  fundId!: string

  @ApiPropertyOptional({ example: 1, nullable: true })
  cycle!: number | null

  @ApiProperty({ example: 50000 })
  amount!: number

  @ApiProperty({ example: 0 })
  fee!: number

  @ApiProperty({ example: 50000 })
  total!: number

  @ApiProperty({ example: 'settled', enum: ['initiated', 'settled', 'failed'] })
  status!: string

  @ApiPropertyOptional({ example: 'MOOLRE-TX-123', nullable: true })
  transactionId!: string | null

  @ApiPropertyOptional({ example: '2026-06-03T19:45:00.000Z', nullable: true })
  settledAt!: Date | null
}
