import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

/**
 * The ONLY place `@prisma/client` is imported. All other modules inject this
 * service via DI (enforced by the ts-arch architecture tests).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect()
    } catch (err) {
      // Don't crash the app at boot if the DB isn't configured yet (E0 scaffold-only).
      this.logger.warn(`Prisma could not connect on init: ${(err as Error).message}`)
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}
