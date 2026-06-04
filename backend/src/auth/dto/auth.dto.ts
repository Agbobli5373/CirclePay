import { createZodDto } from 'nestjs-zod'
import {
  requestOtpSchema,
  verifyOtpSchema,
  setPinSchema,
  loginSchema,
  updateProfileSchema,
} from '@circlepay/shared'

export class RequestOtpDto extends createZodDto(requestOtpSchema) {}
export class VerifyOtpDto extends createZodDto(verifyOtpSchema) {}
export class SetPinDto extends createZodDto(setPinSchema) {}
export class LoginDto extends createZodDto(loginSchema) {}
export class UpdateProfileDto extends createZodDto(updateProfileSchema) {}
