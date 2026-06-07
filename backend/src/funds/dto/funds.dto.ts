import { createZodDto } from 'nestjs-zod'
import { createSusuFundSchema, inviteMembersSchema, setMemberCountSchema, reorderPayoutSchema } from '@circlepay/shared'

export class CreateFundDto extends createZodDto(createSusuFundSchema) {}
export class InviteMembersDto extends createZodDto(inviteMembersSchema) {}
export class SetMemberCountDto extends createZodDto(setMemberCountSchema) {}
export class ReorderPayoutDto extends createZodDto(reorderPayoutSchema) {}
