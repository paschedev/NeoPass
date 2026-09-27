import { EventStatus, TicketStatus } from '@prisma/client';
import request from 'supertest';
import { authHeader } from './utils/auth';
import {
  createOrder,
  createOrganizerWithEvent,
  createTicket,
  createUser,
} from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

describe('Transferencia de entradas', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  async function ownedTicket({
    eventStatus = 'PUBLISHED',
    ticketStatus = 'VALID',
  }: { eventStatus?: EventStatus; ticketStatus?: TicketStatus } = {}) {
    const { organizer, event, ticketType } = await createOrganizerWithEvent(
      t.prisma,
    );
    await t.prisma.event.update({
      where: { id: event.id },
      data: { status: eventStatus },
    });
    const owner = await createUser(t.prisma);
    const order = await createOrder(t.prisma, {
      user: owner,
      ticketType,
      status: 'PAID',
    });
    const ticket = await t.prisma.ticket.update({
      where: { id: (await createTicket(t.prisma, { order, ticketType })).id },
      data: { status: ticketStatus },
    });
    const recipient = await createUser(t.prisma, { name: 'Destinataria' });
    return { organizer, owner, ticket, recipient };
  }

  function transfer(
    user: Parameters<typeof authHeader>[1],
    ticketId: string,
    targetUserId: string,
  ) {
    return request(t.app.getHttpServer())
      .post(`/tickets/${ticketId}/transfer`)
      .set('Authorization', authHeader(t.app, user))
      .send({ targetUserId });
  }

  it('al transferir, la entrada cambia de dueño y el QR viejo deja de servir', async () => {
    const { organizer, owner, ticket, recipient } = await ownedTicket();

    await transfer(owner, ticket.id, recipient.id).expect(201);

    const saved = await t.prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    expect(saved.userId).toBe(recipient.id);
    expect(saved.qrCode).not.toBe(ticket.qrCode);

    const oldQr = await request(t.app.getHttpServer())
      .post('/tickets/check-in')
      .set('Authorization', authHeader(t.app, organizer))
      .send({ qrCode: ticket.qrCode })
      .expect(201);
    expect((oldQr.body as { status: string }).status).toBe('INVALID');
  });

  it('el destinatario recibe un aviso', async () => {
    const { owner, ticket, recipient } = await ownedTicket();

    await transfer(owner, ticket.id, recipient.id).expect(201);

    expect(
      await t.prisma.notification.count({ where: { userId: recipient.id } }),
    ).toBe(1);
  });

  it.each(['FINISHED', 'CANCELLED'] as const)(
    'no se puede transferir una entrada de un evento %s',
    async (eventStatus) => {
      const { owner, ticket, recipient } = await ownedTicket({ eventStatus });

      await transfer(owner, ticket.id, recipient.id).expect(400);

      const saved = await t.prisma.ticket.findUniqueOrThrow({
        where: { id: ticket.id },
      });
      expect(saved.userId).toBe(owner.id);
      expect(saved.qrCode).toBe(ticket.qrCode);
    },
  );

  it('no se puede transferir una entrada ya usada', async () => {
    const { owner, ticket, recipient } = await ownedTicket({
      ticketStatus: 'USED',
    });

    await transfer(owner, ticket.id, recipient.id).expect(400);
  });

  it('no se puede transferir una entrada ajena', async () => {
    const { ticket, recipient } = await ownedTicket();
    const stranger = await createUser(t.prisma);

    await transfer(stranger, ticket.id, recipient.id).expect(400);

    const saved = await t.prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    expect(saved.userId).not.toBe(recipient.id);
  });
});
