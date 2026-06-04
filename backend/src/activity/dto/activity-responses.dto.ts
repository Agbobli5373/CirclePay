import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/** One entry in the user's activity feed. */
export class ActivityItemDto {
  @ApiProperty({ example: 'cmsact...id' })
  id!: string

  @ApiProperty({ example: 'contribution', enum: ['contribution', 'payout', 'donation', 'joined'] })
  type!: string

  @ApiProperty({ example: 'Contribution received' })
  title!: string

  @ApiProperty({ example: 'Cycle 1' })
  detail!: string

  @ApiPropertyOptional({ example: 50000, nullable: true, description: 'Pesewas.' })
  amount!: number | null

  @ApiPropertyOptional({ example: 'in', enum: ['in', 'out'], nullable: true })
  direction!: string | null

  @ApiPropertyOptional({ example: 'c:fundId:1:userId', nullable: true })
  reference!: string | null

  @ApiProperty({ example: '2026-06-04T09:41:12.000Z' })
  createdAt!: Date
}
