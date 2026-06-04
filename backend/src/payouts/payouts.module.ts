import { Module } from '@nestjs/common'
import { PayoutsService } from './payouts.service'

/**
 * Payouts & cycle engine (E5): disburse the funded pot to the cycle recipient,
 * settle to the ledger, advance the cycle / complete the fund. Event-driven via the
 * outbox; INFRA-only deps — never imports another feature module.
 */
@Module({
  providers: [PayoutsService],
})
export class PayoutsModule {}
