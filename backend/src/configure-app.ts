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
  // Two hops of Railway in front of the app, measured in production on
  // 2026-11-19: the connection comes from an internal address (100.64.0.0/10)
  // and X-Forwarded-For is "client, edge node", rewritten by Railway (what the
  // client sends there is dropped). Trusting both hops makes req.ip the
  // client; with 1 it was the edge node, so everyone entering through the
  // same node shared the limits and counted as one visitor of a promoter.
  const server = app.getHttpAdapter().getInstance() as Express;
  server.set('trust proxy', 2);
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
