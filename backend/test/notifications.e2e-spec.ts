import { NotificationType, User } from '@prisma/client';
import request from 'supertest';
import { authHeader } from './utils/auth';
import { createUser } from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

type FeedItem = { id: string; title: string; type: string; isRead: boolean };
type Feed = {
  items: FeedItem[];
  nextCursor: string | null;
  unreadCount: number;
};

describe('Notificaciones', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  // Avisos "Aviso 1" (el más viejo) a "Aviso n" (el más nuevo), un minuto entre cada uno.
  async function notify(
    user: User,
    count: number,
    {
      type = 'SYSTEM',
      isRead = false,
    }: { type?: NotificationType; isRead?: boolean } = {},
  ) {
    const start = Date.now() - count * 60_000;
    for (let i = 1; i <= count; i++) {
      const at = new Date(start + i * 60_000);
      await t.prisma.notification.create({
        data: {
          userId: user.id,
          type,
          isRead,
          title: `Aviso ${i}`,
          message: 'Texto del aviso',
          createdAt: at,
          activityAt: at,
        },
      });
    }
  }

  function feed(user: User, query = '') {
    return request(t.app.getHttpServer())
      .get(`/notifications/feed${query}`)
      .set('Authorization', authHeader(t.app, user));
  }

  const titles = (body: Feed) => body.items.map((item) => item.title);

  describe('lista paginada', () => {
    it('la primera página trae los 20 avisos más recientes y el cursor de la siguiente', async () => {
      const user = await createUser(t.prisma);
      await notify(user, 25);

      const res = await feed(user).expect(200);
      const body = res.body as Feed;

      expect(titles(body)).toEqual(
        Array.from({ length: 20 }, (_, i) => `Aviso ${25 - i}`),
      );
      expect(body.nextCursor).toEqual(expect.any(String));
    });

    it('la página siguiente trae el resto y ya no hay otra', async () => {
      const user = await createUser(t.prisma);
      await notify(user, 25);
      const first = (await feed(user).expect(200)).body as Feed;

      const res = await feed(user, `?cursor=${first.nextCursor}`).expect(200);
      const body = res.body as Feed;

      expect(titles(body)).toEqual([
        'Aviso 5',
        'Aviso 4',
        'Aviso 3',
        'Aviso 2',
        'Aviso 1',
      ]);
      expect(body.nextCursor).toBeNull();
    });

    it('respeta la cantidad pedida', async () => {
      const user = await createUser(t.prisma);
      await notify(user, 5);

      const res = await feed(user, '?limit=3').expect(200);

      expect(titles(res.body as Feed)).toEqual([
        'Aviso 5',
        'Aviso 4',
        'Aviso 3',
      ]);
    });

    it('cuenta los avisos sin leer de la persona, también los de otras páginas', async () => {
      const user = await createUser(t.prisma);
      await notify(user, 3, { isRead: true });
      await notify(user, 4);
      const other = await createUser(t.prisma);
      await notify(other, 2);

      const res = await feed(user, '?limit=2').expect(200);

      expect((res.body as Feed).unreadCount).toBe(4);
    });

    it('no muestra avisos de otra persona', async () => {
      const user = await createUser(t.prisma);
      const other = await createUser(t.prisma);
      await notify(other, 2);

      const res = await feed(user).expect(200);

      expect(res.body).toEqual({ items: [], nextCursor: null, unreadCount: 0 });
    });

    it('un cursor que es un aviso de otra persona responde 400', async () => {
      const user = await createUser(t.prisma);
      await notify(user, 2);
      const other = await createUser(t.prisma);
      await notify(other, 1);
      const foreign = await t.prisma.notification.findFirstOrThrow({
        where: { userId: other.id },
      });

      const res = await feed(user, `?cursor=${foreign.id}`).expect(400);

      expect((res.body as { message: string }).message).toBe(
        'No pudimos seguir cargando los avisos. Recargá la página.',
      );
    });

    it.each(['0', '51', '2.5', 'muchos'])(
      'una cantidad por página de "%s" responde 400',
      async (limit) => {
        const user = await createUser(t.prisma);

        await feed(user, `?limit=${limit}`).expect(400);
      },
    );

    it('un cursor que no es un ID responde 400', async () => {
      const user = await createUser(t.prisma);

      await feed(user, '?cursor=no-es-un-id').expect(400);
    });

    it('"solo solicitudes" trae solo las invitaciones', async () => {
      const user = await createUser(t.prisma);
      await notify(user, 2);
      await notify(user, 1, { type: 'STAFF_INVITE' });

      const res = await feed(user, '?onlyRequests=true').expect(200);

      expect((res.body as Feed).items).toEqual([
        expect.objectContaining({ type: 'STAFF_INVITE' }),
      ]);
    });

    it('sin sesión responde 401', async () => {
      await request(t.app.getHttpServer())
        .get('/notifications/feed')
        .expect(401);
    });
  });

  it('la lista completa de antes trae como mucho los 50 avisos más recientes', async () => {
    const user = await createUser(t.prisma);
    await notify(user, 55);

    const res = await request(t.app.getHttpServer())
      .get('/notifications')
      .set('Authorization', authHeader(t.app, user))
      .expect(200);
    const items = res.body as FeedItem[];

    expect(items).toHaveLength(50);
    expect(items[0].title).toBe('Aviso 55');
  });
});
