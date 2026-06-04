import { Global, Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { OutboxService } from './outbox.service'
import { OutboxDispatcher } from './outbox.dispatcher'
import { LockService } from './lock.service'

@Global()
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [OutboxService, OutboxDispatcher, LockService],
  exports: [OutboxService, OutboxDispatcher, LockService],
})
export class OutboxModule {}
