import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './prisma/prisma.module'
import { MoolreModule } from './moolre/moolre.module'
import { LedgerModule } from './ledger/ledger.module'
import { OutboxModule } from './outbox/outbox.module'
import { WebhooksModule } from './webhooks/webhooks.module'
import { HealthModule } from './health/health.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    PrismaModule,
    MoolreModule,
    LedgerModule,
    OutboxModule,
    WebhooksModule,
    HealthModule,
  ],
})
export class AppModule {}
