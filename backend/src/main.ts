import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  // Con SIGTERM (deploy de Railway) cierra Prisma y los workers de BullMQ.
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
}
bootstrap();
