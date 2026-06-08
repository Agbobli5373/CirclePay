import { createZodDto } from 'nestjs-zod'
import {
  createMedicalFundSchema,
  donateSchema,
  verifyPayeeSchema,
  inviteContributorsSchema,
  thankContributorsSchema,
  uploadReceiptSchema,
  verifyReceiptSchema,
} from '@circlepay/shared'

export class CreateMedicalFundDto extends createZodDto(createMedicalFundSchema) {}
export class DonateDto extends createZodDto(donateSchema) {}
export class VerifyPayeeDto extends createZodDto(verifyPayeeSchema) {}
export class InviteContributorsDto extends createZodDto(inviteContributorsSchema) {}
export class ThankContributorsDto extends createZodDto(thankContributorsSchema) {}
export class UploadReceiptDto extends createZodDto(uploadReceiptSchema) {}
export class VerifyReceiptDto extends createZodDto(verifyReceiptSchema) {}
