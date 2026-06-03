import { createZodDto } from 'nestjs-zod'
import { createSusuFundSchema, inviteMembersSchema } from '@circlepay/shared'

export class CreateFundDto extends createZodDto(createSusuFundSchema) {}
export class InviteMembersDto extends createZodDto(inviteMembersSchema) {}
