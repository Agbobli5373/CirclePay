import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Liveness check' })
  @ApiOkResponse({ description: 'Service is up.' })
  check(): { status: string; service: string; ts: string } {
    return { status: 'ok', service: 'circlepay-api', ts: new Date().toISOString() }
  }
}
