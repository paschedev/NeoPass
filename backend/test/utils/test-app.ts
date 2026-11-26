import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import type Redis from 'ioredis';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/configure-app';
import { MailProcessor } from '../../src/mail/mail.processor';
import { OrdersProcessor } from '../../src/orders/orders.processor';
import { PaymentsProcessor } from '../../src/payments/payments.processor';
import { SearchIndexingProcessor } from '../../src/search-indexing/search-indexing.processor';
import { SEARCH_INDEXING_QUEUE } from '../../src/search-indexing/search-indexing.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { RedisService } from '../../src/redis/redis.service';
import { emptyTestRedis } from './test-redis';

type QueueMock = { add: jest.Mock };

export interface TestApp {
  app: INestApplication<App>;
  prisma: PrismaService;
  // The app's own connection to the test Redis.
  redis: Redis;
  queues: {
    mail: QueueMock;
    orders: QueueMock;
    payments: QueueMock;
    searchIndexing: QueueMock;
  };
  close: () => Promise<void>;
}

// App completa configurada como en main.ts, con los bordes simulados: las colas
// no usan Redis, los processors no levantan Workers (se prueban llamando a
// process()) y los crons quedan frenados para que no escriban en la base en
// medio de un test. El límite de pedidos, los clicks de RRPP y los turnos de
// los crons usan el Redis de prueba, que arranca vacío en cada app.
export async function createTestApp(): Promise<TestApp> {
  const queues = {
    mail: { add: jest.fn() },
    orders: { add: jest.fn() },
    payments: { add: jest.fn() },
    searchIndexing: { add: jest.fn() },
  };

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(getQueueToken('mail'))
    .useValue(queues.mail)
    .overrideProvider(getQueueToken('orders'))
    .useValue(queues.orders)
    .overrideProvider(getQueueToken('payments'))
    .useValue(queues.payments)
    .overrideProvider(getQueueToken(SEARCH_INDEXING_QUEUE))
    .useValue(queues.searchIndexing)
    .overrideProvider(MailProcessor)
    .useValue({})
    .overrideProvider(OrdersProcessor)
    .useValue({})
    .overrideProvider(PaymentsProcessor)
    .useValue({})
    .overrideProvider(SearchIndexingProcessor)
    .useValue({})
    .compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  for (const job of moduleRef.get(SchedulerRegistry).getCronJobs().values()) {
    await job.stop();
  }

  const redis = app.get(RedisService).client;
  await emptyTestRedis(redis);

  const prisma = app.get(PrismaService);
  return {
    app,
    prisma,
    redis,
    queues,
    close: async () => {
      await app.close();
      await prisma.$disconnect();
    },
  };
}
