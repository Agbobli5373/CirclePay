import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MoolreService } from '../moolre/moolre.service'

/**
 * Outbound notifications (SMS now; WhatsApp/push later). Wraps MoolreService.sendSms.
 * Reused by E4 for contribution receipts and E5/E6 for payout/reminder alerts.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(
    private readonly moolre: MoolreService,
    private readonly config: ConfigService,
  ) {}

  private get senderId(): string {
    return this.config.get<string>('MOOLRE_SMS_SENDER_ID') ?? 'CirclePay'
  }

  /** Send a one-time code by SMS. Localised text could be added per `lang`. */
  async sendOtp(phone: string, code: string, _lang = 'en'): Promise<void> {
    const message = `Your CirclePay code is ${code}. It expires in 5 minutes. Never share it — CirclePay will never ask for it.`
    try {
      await this.moolre.sendSms({
        senderId: this.senderId,
        messages: [{ recipient: phone, message, ref: `otp:${phone}` }],
      })
    } catch (err) {
      // Don't leak whether the number exists; log server-side only.
      this.logger.warn(`OTP SMS send failed for a recipient: ${(err as Error).message}`)
    }
  }

  /** Generic transactional SMS (receipts, alerts). */
  async sendSms(recipient: string, message: string, ref?: string): Promise<void> {
    await this.moolre.sendSms({
      senderId: this.senderId,
      messages: [{ recipient, message, ref }],
    })
  }
}
