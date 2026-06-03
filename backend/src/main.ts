import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { ZodValidationPipe } from 'nestjs-zod'
import cookieParser from 'cookie-parser'
import { AppModule } from './app.module'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false })

  app.setGlobalPrefix('api')
  app.use(cookieParser())
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  })

  // Global validation via Zod (nestjs-zod). Handlers using createZodDto() are validated;
  // others pass through. No class-validator dependency.
  app.useGlobalPipes(new ZodValidationPipe())
  app.useGlobalFilters(new AllExceptionsFilter())

  // OpenAPI / Swagger — UI at /docs, raw spec at /docs-json.
  // NOTE: nestjs-zod 4.x's patchNestJsSwagger() is incompatible with @nestjs/swagger 11
  // (it imports a removed subpath). Routes are documented; rich Zod request-schema
  // generation is a follow-up (upgrade nestjs-zod → 5.x).
  const swaggerConfig = new DocumentBuilder()
    .setTitle('CirclePay API')
    .setDescription(
      'CirclePay backend — digital Susu + medical fundraising on Moolre. ' +
        'See the circlepay-domain / circlepay-stack / moolre-integration skills for design.',
    )
    .setVersion('0.1.0')
    .addCookieAuth('access_token', { type: 'apiKey', in: 'cookie', name: 'access_token' })
    .build()
  const document = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs-json' })

  const port = Number(process.env.PORT ?? 4000)
  await app.listen(port)
  // eslint-disable-next-line no-console
  console.log(`CirclePay API listening on http://localhost:${port}/api`)
  // eslint-disable-next-line no-console
  console.log(`Swagger docs at http://localhost:${port}/docs`)
}

void bootstrap()
