import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiOkResponse, ApiNotFoundResponse } from '@nestjs/swagger'
import { FundraisersService } from './fundraisers.service'
import { DonateDto } from './dto/fundraisers.dto'
import { PublicFundraiserDto, DonateResultDto, DonationStatusDto } from './dto/fundraisers-responses.dto'

/**
 * Public, UNAUTHENTICATED fundraiser endpoints — the shareable page + anonymous donations.
 * No JwtAuthGuard here by design (anyone with the link can view + give).
 */
@ApiTags('public')
@Controller('public')
export class PublicFundraisersController {
  constructor(private readonly fundraisers: FundraisersService) {}

  @Get('fundraisers/:slug')
  @ApiOperation({ summary: 'Public view of a medical fundraiser (no auth)' })
  @ApiOkResponse({ type: PublicFundraiserDto })
  @ApiNotFoundResponse({ description: 'NOT_FOUND' })
  view(@Param('slug') slug: string) {
    return this.fundraisers.getPublic(slug)
  }

  @Post('fundraisers/:slug/contribute')
  @ApiOperation({ summary: 'Donate to a medical fundraiser (MoMo collection + OTP)' })
  @ApiOkResponse({ type: DonateResultDto })
  @ApiNotFoundResponse({ description: 'NOT_FOUND' })
  donate(@Param('slug') slug: string, @Body() dto: DonateDto) {
    return this.fundraisers.donate(slug, dto)
  }

  @Get('fundraisers/:slug/donations/:donationId')
  @ApiOperation({ summary: 'Poll a donation status (for the donate flow)' })
  @ApiOkResponse({ type: DonationStatusDto })
  @ApiNotFoundResponse({ description: 'NOT_FOUND' })
  donationStatus(@Param('slug') slug: string, @Param('donationId') donationId: string) {
    return this.fundraisers.donationStatus(slug, donationId)
  }
}
