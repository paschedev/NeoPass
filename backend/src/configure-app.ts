import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import type { Express } from 'express';
import helmet from 'helmet';
import { DatabaseBusyFilter } from './common/database-busy.filter';
import { NullCharactersPipe } from './common/null-characters.pipe';
import { validationMessages } from './common/validation-messages';

// Configuración HTTP compartida entre main.ts y los tests e2e,
// para que los tests corran contra la misma app que producción.
export function configureApp(app: INestApplication) {
  // Railway puts one proxy in front of the app: without this, req.ip is the
  // proxy's address and every client shares the same rate limit.
  const server = app.getHttpAdapter().getInstance() as Express;
  server.set('trust proxy', 1);
  app.use(helmet());
  app.useGlobalPipes(
    new NullCharactersPipe(),
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: (errors) =>
        new BadRequestException(validationMessages(errors)),
    }),
  );
  app.useGlobalFilters(
    new DatabaseBusyFilter(app.get(HttpAdapterHost).httpAdapter),
  );
  const frontendUrl = app.get(ConfigService).getOrThrow<string>('FRONTEND_URL');
  app.enableCors({
    origin: [
      frontendUrl,
      'https://neopass.ar',
      'https://www.neopass.ar',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    // With a 429 the site waits what the limit says before trying again.
    exposedHeaders: ['Retry-After'],
  });
}
