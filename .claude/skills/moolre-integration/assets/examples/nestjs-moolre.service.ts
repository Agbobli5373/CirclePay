/**
 * Nest.js — wrap the same framework-agnostic client as a provider + controller.
 * (Pair with the `nestjs-expert` skill for module wiring & testing.)
 *
 * moolre.service.ts
 */
import { Injectable, BadRequestException } from '@nestjs/common'
import { MoolreClient, MoolreError, CollectionChannel } from '../lib/moolre' // copy moolre-client.ts here

@Injectable()
export class MoolreService {
  private readonly client = MoolreClient.fromEnv()

  async collectContribution(input: {
    channel: CollectionChannel
    payer: string
    amount: string
    externalref: string
    otpcode?: string
  }) {
    try {
      const { otpRequired } = await this.client.collect(input)
      return otpRequired ? { state: 'otp_required' as const } : { state: 'initiated' as const }
    } catch (e) {
      if (e instanceof MoolreError) throw new BadRequestException({ code: e.code, message: e.message })
      throw e
    }
  }

  confirmSettled(externalref: string) {
    return this.client.isSettled(externalref)
  }
}

/**
 * moolre.controller.ts
 *
 * import { Body, Controller, Post } from '@nestjs/common'
 *
 * @Controller('contributions')
 * export class MoolreController {
 *   constructor(private readonly moolre: MoolreService) {}
 *
 *   @Post()
 *   collect(@Body() dto: { channel: CollectionChannel; payer: string; amount: string; externalref: string; otpcode?: string }) {
 *     return this.moolre.collectContribution(dto)
 *   }
 * }
 *
 * Register MoolreService/MoolreController in your module's providers/controllers.
 * Keep MOOLRE_* in ConfigModule env; never expose keys to the client app.
 */
