import { createZodDto } from 'nestjs-zod'
import { createMedicalFundSchema, donateSchema, verifyPayeeSchema } from '@circlepay/shared'

export class CreateMedicalFundDto extends createZodDto(createMedicalFundSchema) {}
export class DonateDto extends createZodDto(donateSchema) {}
export class VerifyPayeeDto extends createZodDto(verifyPayeeSchema) {}
