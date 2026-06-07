import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { FundsModule } from '../funds/funds.module'
import { ContributionsModule } from '../contributions/contributions.module'
import { UssdController } from './ussd.controller'
import { UssdService } from './ussd.service'

/**
 * USSD channel (E10) — feature-phone parity. An EDGE/channel module (like webhooks):
 * it composes several feature services (auth + funds), so it is intentionally kept OUT
 * of the architecture-test FEATURES isolation list. Dependencies are one-way — nothing
 * depends on ussd. It composes auth + funds + contributions for the menu actions.
 */
@Module({
  imports: [AuthModule, FundsModule, ContributionsModule],
  controllers: [UssdController],
  providers: [UssdService],
})
export class UssdModule {}
