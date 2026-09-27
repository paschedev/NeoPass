import request from 'supertest';
import { MailService } from '../src/mail/mail.service';
import { mercadoPagoMock } from './mocks/mercadopago';
import { resendMock } from './mocks/resend';
import { authHeader } from './utils/auth';
import {
  createOrder,
  createOrganizerWithEvent,
  createTicket,
  createUser,
} from './utils/factories';
import { mockTurnstile } from './utils/network';
import { createTestApp, TestApp } from './utils/test-app';
import { assertTestDatabaseName, resetDb } from './utils/test-database';

describe('Base de tests e2e', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  it('un usuario autenticado con el helper de JWT accede a su perfil', async () => {
    const user = await createUser(t.prisma);

    const res = await request(t.app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', authHeader(t.app, user))
      .expect(200);

    expect(res.body).toMatchObject({ id: user.id, email: user.email });
  });

  it('sin token, un endpoint protegido responde 401', async () => {
    await request(t.app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('resetDb deja la base vacía', async () => {
    await createOrganizerWithEvent(t.prisma);

    await resetDb(t.prisma);

    expect(await t.prisma.user.count()).toBe(0);
    expect(await t.prisma.event.count()).toBe(0);
  });

  it('los helpers que borran datos se niegan a correr fuera de una base *_test', () => {
    expect(() => assertTestDatabaseName('entrypass')).toThrow();
    expect(() => assertTestDatabaseName('neopass_test')).not.toThrow();
  });

  it('la base de test rechaza reservar más entradas que el stock, como producción', async () => {
    const { ticketType } = await createOrganizerWithEvent(t.prisma, {
      stock: 1,
    });

    await expect(
      t.prisma.ticketType.update({
        where: { id: ticketType.id },
        data: { reserved: 2 },
      }),
    ).rejects.toThrow('check_stock_limits');
  });

  it('las factories mueven el stock como el flujo real: la orden pendiente reserva y la pagada vende', async () => {
    const { ticketType } = await createOrganizerWithEvent(t.prisma, {
      stock: 10,
    });
    const buyer = await createUser(t.prisma);

    await createOrder(t.prisma, { user: buyer, ticketType, quantity: 2 });
    const paid = await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      quantity: 3,
      status: 'PAID',
    });
    await createTicket(t.prisma, { order: paid, ticketType });

    expect(
      await t.prisma.ticketType.findUniqueOrThrow({
        where: { id: ticketType.id },
      }),
    ).toMatchObject({ reserved: 2, sold: 3 });
    expect(
      await t.prisma.ticket.count({
        where: { orderId: paid.id, userId: buyer.id },
      }),
    ).toBe(1);
  });

  it('una compra valida el captcha, crea la preferencia y encola la expiración contra los servicios simulados', async () => {
    const { organizer, ticketType } = await createOrganizerWithEvent(t.prisma);
    const buyer = await createUser(t.prisma);
    mockTurnstile(true);
    mercadoPagoMock.preferenceCreate.mockResolvedValueOnce({
      init_point: 'https://mercadopago.test/checkout',
    });

    const res = await request(t.app.getHttpServer())
      .post('/orders/checkout')
      .set('Authorization', authHeader(t.app, buyer))
      .send({
        captchaToken: 'captcha-de-prueba',
        items: [{ ticketTypeId: ticketType.id, quantity: 2 }],
      })
      .expect(201);
    const body = res.body as { orderId: string; checkoutUrl: string };

    expect(body.checkoutUrl).toBe('https://mercadopago.test/checkout');
    expect(fetch).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.anything(),
    );
    expect(mercadoPagoMock.preferenceCreate).toHaveBeenCalledWith(
      expect.anything(),
      organizer.mercadoPagoAccessToken,
    );
    expect(t.queues.orders.add).toHaveBeenCalledWith(
      'expire-order',
      { orderId: body.orderId },
      expect.anything(),
    );
    expect(
      await t.prisma.ticketType.findUniqueOrThrow({
        where: { id: ticketType.id },
      }),
    ).toMatchObject({ reserved: 2 });
  });

  it('el mail de recuperación de contraseña sale por el Resend simulado', async () => {
    await t.app
      .get(MailService)
      .sendPasswordResetEmail(
        'ana@neopass.test',
        'Ana',
        'https://app.neopass.test/reset',
      );

    expect(resendMock.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'ana@neopass.test' }),
    );
  });

  it('una llamada de red que el test no simula falla', async () => {
    await expect(fetch('https://example.com')).rejects.toThrow(
      'Unmocked network call',
    );
  });
});
