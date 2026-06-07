import { Module } from '@nestjs/common'
import { DepositsController } from './deposits.controller'
import { DepositsService } from './deposits.service'
import { DepositSettlementService } from './deposits.settlement'

/**
 * Deposits (Phase 2 / E4 deposit leg): MoMo collection of a Susu security deposit
 * (with OTP, idempotent) + async settlement (ledger + Member.depositPaid). Depends
 * only on INFRA modules (Prisma, Moolre, Ledger, Outbox) + common auth.
 */
@Module({
  controllers: [DepositsController],
  providers: [DepositsService, DepositSettlementService],
})
export class DepositsModule {}
