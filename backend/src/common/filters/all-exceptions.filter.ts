import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Request, Response } from 'express'

/**
 * Maps every error to the CirclePay API error envelope:
 *   { error: { code: string, message: string } }
 * (See circlepay-stack/references/backend-conventions.md.)
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()
    const req = ctx.getRequest<Request>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let code = 'INTERNAL'
    let message = 'Something went wrong'

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const body = exception.getResponse()
      code = this.codeForStatus(status)
      if (typeof body === 'string') {
        message = body
      } else if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>
        // Allow handlers to throw { code, message }; otherwise use Nest's message.
        if (typeof b.code === 'string') code = b.code
        if (typeof b.message === 'string') message = b.message
        else if (Array.isArray(b.message)) message = (b.message as string[]).join(', ')
      }
    }

    if (status >= 500) {
      this.logger.error(`${req.method} ${req.url} -> ${status} ${code}`, exception as Error)
    }

    res.status(status).json({ error: { code, message } })
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case 400:
        return 'VALIDATION'
      case 401:
        return 'UNAUTHORIZED'
      case 403:
        return 'FORBIDDEN'
      case 404:
        return 'NOT_FOUND'
      case 409:
        return 'CONFLICT'
      case 423:
        return 'LOCKED'
      case 429:
        return 'RATE_LIMITED'
      default:
        return status >= 500 ? 'INTERNAL' : 'ERROR'
    }
  }
}
