import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './prisma/prisma.module'
import { MoolreModule } from './moolre/moolre.module'
import { LedgerModule } from './ledger/ledger.module'
import { OutboxModule } from './outbox/outbox.module'
import { WebhooksModule } from './webhooks/webhooks.module'
import { RedisModule } from './redis/redis.module'
import { NotificationsModule } from './notifications/notifications.module'
import { AuthModule } from './auth/auth.module'
import { FundsModule } from './funds/funds.module'
import { ContributionsModule } from './contributions/contributions.module'
import { PayoutsModule } from './payouts/payouts.module'
import { ActivityModule } from './activity/activity.module'
import { TrustModule } from './trust/trust.module'
import { HealthModule } from './health/health.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    PrismaModule,
    RedisModule,
    MoolreModule,
    NotificationsModule,
    LedgerModule,
    OutboxModule,
    AuthModule,
    FundsModule,
    ContributionsModule,
    PayoutsModule,
    ActivityModule,
    TrustModule,
    WebhooksModule,
    HealthModule,
  ],
})
export class AppModule {}
