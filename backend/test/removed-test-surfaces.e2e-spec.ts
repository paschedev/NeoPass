import request from 'supertest';
import { authHeader } from './utils/auth';
import { createOrganizerWithEvent, createUser } from './utils/factories';
import { mockTurnstile } from './utils/network';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

// Atajos de desarrollo que llegaron a producción: ya no existen.
describe('Superficies de prueba cerradas', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  it('no se puede pagar una orden sin pasar por Mercado Pago', async () => {
    const { ticketType } = await createOrganizerWithEvent(t.prisma);
    const buyer = await createUser(t.prisma);
    mockTurnstile(true);

    await request(t.app.getHttpServer())
      .post('/orders/dev-bypass')
      .set('Authorization', authHeader(t.app, buyer))
      .send({
        captchaToken: 'captcha-de-prueba',
        items: [{ ticketTypeId: ticketType.id, quantity: 1 }],
      })
      .expect(404);

    expect(await t.prisma.order.count()).toBe(0);
    expect(await t.prisma.ticket.count()).toBe(0);
  });

  it('un organizador no puede vincular Mercado Pago cargando un token a mano', async () => {
    const organizer = await createUser(t.prisma, { role: 'ORGANIZER' });

    await request(t.app.getHttpServer())
      .post('/payments/oauth/manual')
      .set('Authorization', authHeader(t.app, organizer))
      .send({ token: 'APP_USR-token-inventado' })
      .expect(404);

    const saved = await t.prisma.user.findUniqueOrThrow({
      where: { id: organizer.id },
    });
    expect(saved.mercadoPagoAccessToken).toBeNull();
  });

  it('un organizador no puede emitir entradas de cortesía', async () => {
    const { organizer, event, ticketType } = await createOrganizerWithEvent(
      t.prisma,
    );
    const guest = await createUser(t.prisma);

    await request(t.app.getHttpServer())
      .post('/tickets/guest-list')
      .set('Authorization', authHeader(t.app, organizer))
      .send({
        eventId: event.id,
        email: guest.email,
        ticketTypeId: ticketType.id,
      })
      .expect(404);

    expect(await t.prisma.ticket.count()).toBe(0);
    expect(t.queues.mail.add).not.toHaveBeenCalled();
  });
});
