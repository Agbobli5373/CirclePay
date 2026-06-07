import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/** Generic `{ ok: true }` (+ devCode in non-prod for request-otp). */
export class OkResponseDto {
  @ApiProperty({ example: true })
  ok!: boolean

  @ApiPropertyOptional({
    example: '123456',
    description: 'Only returned in non-production to make the flow testable without live SMS.',
  })
  devCode?: string
}

/** verify-otp result: whether the phone maps to an existing account. */
export class VerifyOtpResponseDto {
  @ApiProperty({
    example: false,
    description: 'true → session issued (returning user); false → reg-token issued, call set-pin.',
  })
  registered!: boolean

  @ApiPropertyOptional({
    example: true,
    description: 'Only for purpose=reset: true → reset-token issued, call reset-pin (no session yet).',
  })
  reset?: boolean
}

class TrustSummaryDto {
  @ApiProperty({ example: 'new_', enum: ['new_', 'building', 'good', 'excellent', 'locked'] })
  standing!: string

  @ApiProperty({ example: 100, description: 'On-time contribution rate (0–100).' })
  onTimeRate!: number

  @ApiProperty({ example: 0, description: 'Number of Susu funds completed.' })
  fundsCompleted!: number
}

/** Current authenticated user (GET /auth/me). */
export class MeResponseDto {
  @ApiProperty({ example: 'cmpyf...id' })
  id!: string

  @ApiProperty({ example: '+233241234567' })
  phone!: string

  @ApiPropertyOptional({ example: 'Ama Asante', nullable: true })
  name!: string | null

  @ApiProperty({ example: 'MTN', enum: ['MTN', 'Telecel', 'AirtelTigo'] })
  network!: string

  @ApiProperty({ example: 'en', enum: ['en', 'tw', 'ga'] })
  language!: string

  @ApiProperty({ example: false })
  isOpsAdmin!: boolean

  @ApiPropertyOptional({ type: TrustSummaryDto, nullable: true })
  trust!: TrustSummaryDto | null
}
