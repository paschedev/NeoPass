import request from 'supertest';
import { mercadoPagoMock } from './mocks/mercadopago';
import { authHeader } from './utils/auth';
import { createOrganizerWithEvent, createUser } from './utils/factories';
import { mockTurnstile } from './utils/network';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

const DAY_MS = 24 * 60 * 60 * 1000;

// Temporary (DEBT-24): the release that drops the old fee column
// ("wePassFeePercentage") migrates while the previous version keeps serving,
// so that version must neither read nor write it. Remove this file together
// with the column.
describe('La app no usa la columna vieja del cargo de servicio', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(t.prisma);
    mockTurnstile(true);
    mercadoPagoMock.preferenceCreate.mockResolvedValue({
      init_point: 'https://mercadopago.test/checkout',
    });
  });

  afterAll(() => t.close());

  const http = () => request(t.app.getHttpServer());

  // Runs `use` as if the migration that drops the column had already run.
  async function withoutLegacyColumn(use: () => Promise<void>) {
    await t.prisma.$executeRawUnsafe(
      'ALTER TABLE "Event" RENAME COLUMN "wePassFeePercentage" TO "legacy_fee_hidden"',
    );
    try {
      await use();
    } finally {
      await t.prisma.$executeRawUnsafe(
        'ALTER TABLE "Event" RENAME COLUMN "legacy_fee_hidden" TO "wePassFeePercentage"',
      );
    }
  }

  it('los eventos se ven, se crean, se compran y se administran sin esa columna', async () => {
    const { organizer, event, ticketType } = await createOrganizerWithEvent(
      t.prisma,
    );
    const buyer = await createUser(t.prisma);
    const admin = await createUser(t.prisma, { role: 'ADMIN' });
    const start = new Date(Date.now() + 30 * DAY_MS);

    await withoutLegacyColumn(async () => {
      await http().get('/events').expect(200);
      await http().get(`/events/${event.id}`).expect(200);
      await http()
        .get(`/events/organizer/${event.id}`)
        .set('Authorization', authHeader(t.app, organizer))
        .expect(200);
      await http()
        .post('/events')
        .set('Authorization', authHeader(t.app, organizer))
        .send({
          title: 'Evento nuevo',
          description: 'Descripción',
          imageUrl:
            'https://res.cloudinary.com/test-cloud/image/upload/flyer.jpg',
          startDate: start.toISOString(),
          endDate: new Date(start.getTime() + 6 * 3600 * 1000).toISOString(),
          venueName: 'Club',
          venueAddress: 'Calle 123',
          status: 'PUBLISHED',
          batches: [
            {
              name: 'Preventa',
              isVisible: true,
              ticketTypes: [{ name: 'General', price: 1000, stock: 100 }],
            },
          ],
        })
        .expect(201);
      await http()
        .post('/orders/checkout')
        .set('Authorization', authHeader(t.app, buyer))
        .send({
          captchaToken: 'captcha-de-prueba',
          items: [{ ticketTypeId: ticketType.id, quantity: 1 }],
        })
        .expect(201);
      await http()
        .get('/admin/events')
        .set('Authorization', authHeader(t.app, admin))
        .expect(200);
      await http()
        .patch(`/admin/events/${event.id}/service-fee`)
        .set('Authorization', authHeader(t.app, admin))
        .send({ percentage: 8 })
        .expect(200);
    });
  });
});
