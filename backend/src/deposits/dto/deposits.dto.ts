import { createZodDto } from 'nestjs-zod'
import { initiateDepositSchema } from '@circlepay/shared'

export class InitiateDepositDto extends createZodDto(initiateDepositSchema) {}
