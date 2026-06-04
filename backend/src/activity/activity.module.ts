import { Module } from '@nestjs/common'
import { ActivityController } from './activity.controller'
import { ActivityService } from './activity.service'

/** Activity feed (read-only). INFRA-only deps; never imports another feature module. */
@Module({
  controllers: [ActivityController],
  providers: [ActivityService],
})
export class ActivityModule {}
