import { Module } from '@nestjs/common'
import { FundraisersController } from './fundraisers.controller'
import { PublicFundraisersController } from './public.controller'
import { FundraisersService } from './fundraisers.service'

/**
 * EM — Medical / emergency fundraising. Create + public donate + ops verify + verified payout.
 * Depends only on INFRA modules (Prisma, Moolre, Ledger, Outbox, Notifications) + common auth —
 * never on other feature modules (funds / contributions / payouts).
 */
@Module({
  controllers: [FundraisersController, PublicFundraisersController],
  providers: [FundraisersService],
})
export class FundraisersModule {}
