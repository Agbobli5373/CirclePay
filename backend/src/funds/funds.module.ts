import { Module } from '@nestjs/common'
import { FundsController } from './funds.controller'
import { FundsService } from './funds.service'

/**
 * Susu funds & membership (E3). Depends only on INFRA modules (Prisma, Notifications)
 * + the common auth primitives — never on other feature modules.
 */
@Module({
  controllers: [FundsController],
  providers: [FundsService],
})
export class FundsModule {}
