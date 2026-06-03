import { createZodDto } from 'nestjs-zod'
import { initiateContributionSchema } from '@circlepay/shared'

export class InitiateContributionDto extends createZodDto(initiateContributionSchema) {}
