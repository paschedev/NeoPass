import { EventStatus } from '@prisma/client';
import request from 'supertest';
import { EventsLifecycleService } from '../src/events/events-lifecycle.service';
import { createOrganizerWithEvent, createUser } from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('Eventos públicos', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  async function eventWith({
    status = 'PUBLISHED',
    endsInDays = 7,
    title = 'Evento',
  }: { status?: EventStatus; endsInDays?: number; title?: string } = {}) {
    const created = await createOrganizerWithEvent(t.prisma);
    const endDate = new Date(Date.now() + endsInDays * DAY_MS);
    const event = await t.prisma.event.update({
      where: { id: created.event.id },
      data: {
        status,
        title,
        startDate: new Date(endDate.getTime() - 6 * 3600 * 1000),
        endDate,
      },
    });
    return { ...created, event };
  }

  function get(path: string) {
    return request(t.app.getHttpServer()).get(path);
  }

  describe('listado', () => {
    it('solo muestra eventos publicados que todavía no terminaron', async () => {
      const visible = await eventWith({ title: 'Visible' });
      await eventWith({ status: 'DRAFT', title: 'Borrador' });
      await eventWith({ status: 'CANCELLED', title: 'Cancelado' });
      await eventWith({ endsInDays: -1, title: 'Terminado' });

      const res = await get('/events').expect(200);

      const body = res.body as { items: { id: string }[]; total: number };
      expect(body.items.map((e) => e.id)).toEqual([visible.event.id]);
      expect(body.total).toBe(1);
    });

    it('no expone el stock ni las ventas', async () => {
      await eventWith();

      const res = await get('/events').expect(200);

      const json = JSON.stringify(res.body);
      expect(json).not.toContain('"stock"');
      expect(json).not.toContain('"sold"');
      expect(json).not.toContain('"reserved"');
    });

    it('se pagina', async () => {
      await eventWith({ endsInDays: 3 });
      await eventWith({ endsInDays: 4 });
      await eventWith({ endsInDays: 5 });

      const first = await get('/events?limit=2').expect(200);
      const second = await get('/events?limit=2&page=2').expect(200);

      expect((first.body as { items: unknown[] }).items).toHaveLength(2);
      expect((second.body as { items: unknown[] }).items).toHaveLength(1);
      expect((first.body as { total: number }).total).toBe(3);
    });

    it('un límite fuera de rango se rechaza', async () => {
      await get('/events?limit=1000').expect(400);
    });
  });

  describe('detalle', () => {
    it('muestra las entradas disponibles sin el stock crudo', async () => {
      const { event, ticketType } = await eventWith();
      await t.prisma.ticketType.update({
        where: { id: ticketType.id },
        data: { stock: 100, sold: 10, reserved: 5 },
      });

      const res = await get(`/events/${event.id}`).expect(200);

      const body = res.body as {
        ticketBatches: { ticketTypes: Record<string, unknown>[] }[];
      };
      const [type] = body.ticketBatches[0].ticketTypes;
      expect(type.available).toBe(85);
      expect(type).not.toHaveProperty('stock');
      expect(type).not.toHaveProperty('sold');
      expect(type).not.toHaveProperty('reserved');
    });

    it('un borrador da 404', async () => {
      const { event } = await eventWith({ status: 'DRAFT' });

      await get(`/events/${event.id}`).expect(404);
    });

    it('un evento terminado da 404', async () => {
      const { event } = await eventWith({ endsInDays: -1 });

      await get(`/events/${event.id}`).expect(404);
    });

    it('los promotores de un evento que no es público dan 404', async () => {
      const { event } = await eventWith({ status: 'DRAFT' });
      await t.prisma.eventStaff.create({
        data: {
          eventId: event.id,
          userId: (await createUser(t.prisma)).id,
          role: 'PROMOTER',
          status: 'ACCEPTED',
        },
      });

      await get(`/events/${event.id}/promoters`).expect(404);
    });
  });

  describe('fin de evento', () => {
    it('el cron pasa a finalizados los eventos publicados cuyo fin ya pasó', async () => {
      const ended = await eventWith({ endsInDays: -1 });
      const upcoming = await eventWith({ endsInDays: 2 });
      const draft = await eventWith({ status: 'DRAFT', endsInDays: -1 });

      await t.app.get(EventsLifecycleService).finishEndedEvents(new Date());

      const status = async (id: string) =>
        (await t.prisma.event.findUniqueOrThrow({ where: { id } })).status;
      expect(await status(ended.event.id)).toBe('FINISHED');
      expect(await status(upcoming.event.id)).toBe('PUBLISHED');
      expect(await status(draft.event.id)).toBe('DRAFT');
    });
  });
});
