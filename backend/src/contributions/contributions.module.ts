import { Module } from '@nestjs/common'
import { ContributionsController } from './contributions.controller'
import { ContributionsService } from './contributions.service'
import { ContributionSettlementService } from './contributions.settlement'

/**
 * Contributions (E4): MoMo collection (with OTP, idempotent) + async settlement
 * (ledger + member state + SMS receipt). Depends only on INFRA modules
 * (Prisma, Moolre, Ledger, Notifications, Outbox) + common auth — never on other
 * feature modules.
 */
@Module({
  controllers: [ContributionsController],
  providers: [ContributionsService, ContributionSettlementService],
  exports: [ContributionsService], // consumed by the USSD channel (edge module)
})
export class ContributionsModule {}
