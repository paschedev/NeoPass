import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Express } from 'express';
import helmet from 'helmet';

// Configuración HTTP compartida entre main.ts y los tests e2e,
// para que los tests corran contra la misma app que producción.
export function configureApp(app: INestApplication) {
  // Railway puts one proxy in front of the app: without this, req.ip is the
  // proxy's address and every client shares the same rate limit.
  const server = app.getHttpAdapter().getInstance() as Express;
  server.set('trust proxy', 1);
  app.use(helmet());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  const frontendUrl = app.get(ConfigService).getOrThrow<string>('FRONTEND_URL');
  app.enableCors({
    origin: [
      frontendUrl,
      'https://neopass.com',
      'https://www.neopass.com',
      'https://ventipass.com',
      'https://www.ventipass.com',
      'https://venti-pass.vercel.app',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
}
