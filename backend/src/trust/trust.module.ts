import { Module } from '@nestjs/common'
import { TrustController } from './trust.controller'
import { TrustService } from './trust.service'
import { TrustScheduler } from './trust.scheduler'

/**
 * Trust & default lifecycle (E6): the scheduled sweep that locks defaulters
 * platform-wide, plus the ops appeal/unlock. INFRA-only deps; isolated from other features.
 */
@Module({
  controllers: [TrustController],
  providers: [TrustService, TrustScheduler],
})
export class TrustModule {}
