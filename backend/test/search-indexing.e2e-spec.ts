import request from 'supertest';
import { authHeader } from './utils/auth';
import { createOrganizerWithEvent } from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

type User = Parameters<typeof authHeader>[1];

describe('Aviso a los buscadores cuando cambia un evento (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(t.prisma);
    t.queues.searchIndexing.add.mockClear();
  });

  afterAll(() => t.close());

  const http = () => request(t.app.getHttpServer());

  function editEvent(user: User, eventId: string, body: object) {
    return http()
      .put(`/events/${eventId}`)
      .set('Authorization', authHeader(t.app, user))
      .send(body);
  }

  type Notice = [string, { eventId: string }, object];
  const noticesFor = (eventId: string): Notice[] =>
    (t.queues.searchIndexing.add.mock.calls as Notice[]).filter(
      ([, data]) => data.eventId === eventId,
    );

  it('editar un evento publicado encola el aviso de su página', async () => {
    const { organizer, event } = await createOrganizerWithEvent(t.prisma);

    await editEvent(organizer, event.id, { title: 'Otro nombre' }).expect(200);

    expect(noticesFor(event.id)).toEqual([
      [
        'event-changed',
        { eventId: event.id },
        expect.objectContaining({ jobId: `event-${event.id}` }),
      ],
    ]);
  });

  it('editar un borrador no avisa, y publicarlo sí', async () => {
    const { organizer, event } = await createOrganizerWithEvent(t.prisma);
    await t.prisma.event.update({
      where: { id: event.id },
      data: { status: 'DRAFT' },
    });

    await editEvent(organizer, event.id, { title: 'Otro nombre' }).expect(200);
    expect(noticesFor(event.id)).toHaveLength(0);

    await editEvent(organizer, event.id, { status: 'PUBLISHED' }).expect(200);
    expect(noticesFor(event.id)).toHaveLength(1);
  });

  it('borrar un evento publicado avisa, así los buscadores sacan su página', async () => {
    const { organizer, event } = await createOrganizerWithEvent(t.prisma);

    await http()
      .delete(`/events/${event.id}`)
      .set('Authorization', authHeader(t.app, organizer))
      .send({})
      .expect(200);

    expect(noticesFor(event.id)).toHaveLength(1);
  });

  it('un pedido rechazado no avisa nada', async () => {
    const { event } = await createOrganizerWithEvent(t.prisma);
    const other = await createOrganizerWithEvent(t.prisma);

    await editEvent(other.organizer, event.id, { title: 'Ajeno' }).expect(
      (res) => expect(res.status).toBeGreaterThanOrEqual(400),
    );

    expect(noticesFor(event.id)).toHaveLength(0);
  });
});
