import request from 'supertest';
import { authHeader } from './utils/auth';
import { createUser } from './utils/factories';
import { mockTurnstile } from './utils/network';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

describe('Presets de entradas', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  it('un organizador nuevo recibe General y VIP sin precio, como los muestra la UI', async () => {
    mockTurnstile(true);

    await request(t.app.getHttpServer())
      .post('/auth/register')
      .send({
        firstName: 'Pro',
        lastName: 'Ductora',
        email: 'productora@neopass.test',
        password: 'Password123',
        role: 'ORGANIZER',
        phone: '+541123456789',
        captchaToken: 'captcha-de-prueba',
      })
      .expect(201);

    const presets = await t.prisma.ticketPreset.findMany({
      orderBy: { name: 'asc' },
    });
    expect(presets.map((p) => [p.name, Number(p.price)])).toEqual([
      ['General', 0],
      ['VIP', 0],
    ]);
  });

  it('listar los presets no crea ninguno por su cuenta', async () => {
    const organizer = await createUser(t.prisma, { role: 'ORGANIZER' });

    const res = await request(t.app.getHttpServer())
      .get('/presets')
      .set('Authorization', authHeader(t.app, organizer))
      .expect(200);

    expect(res.body).toEqual([]);
    expect(await t.prisma.ticketPreset.count()).toBe(0);
  });

  describe('guardar una plantilla', () => {
    const INVALID = [
      ['sin nombre', { name: '' }, 'El nombre de la plantilla es obligatorio'],
      [
        'con el nombre en blanco',
        { name: '   ' },
        'El nombre de la plantilla es obligatorio',
      ],
      [
        'con un nombre de más de 20 caracteres',
        { name: 'x'.repeat(21) },
        'El nombre de la plantilla puede tener hasta 20 caracteres',
      ],
      [
        'con un precio de más de $99.999.999,99',
        { price: 100_000_000 },
        'El precio máximo es $99.999.999,99',
      ],
    ] as const;

    it('el nombre se guarda sin espacios al principio ni al final', async () => {
      const organizer = await createUser(t.prisma, { role: 'ORGANIZER' });

      await request(t.app.getHttpServer())
        .post('/presets')
        .set('Authorization', authHeader(t.app, organizer))
        .send({ name: '  Campo  ', price: 0 })
        .expect(201);

      const preset = await t.prisma.ticketPreset.findFirstOrThrow();
      expect(preset.name).toBe('Campo');
    });

    it.each(INVALID)('no se crea %s', async (_case, invalid, message) => {
      const organizer = await createUser(t.prisma, { role: 'ORGANIZER' });

      const res = await request(t.app.getHttpServer())
        .post('/presets')
        .set('Authorization', authHeader(t.app, organizer))
        .send({ name: 'Campo', price: 0, ...invalid })
        .expect(400);

      expect((res.body as { message: string[] }).message).toEqual([message]);
      expect(await t.prisma.ticketPreset.count()).toBe(0);
    });

    it.each(INVALID)('no se edita %s', async (_case, invalid, message) => {
      const organizer = await createUser(t.prisma, { role: 'ORGANIZER' });
      const preset = await t.prisma.ticketPreset.create({
        data: { organizerId: organizer.id, name: 'Campo', price: 0 },
      });

      const res = await request(t.app.getHttpServer())
        .put(`/presets/${preset.id}`)
        .set('Authorization', authHeader(t.app, organizer))
        .send({ name: 'Campo', price: 0, ...invalid })
        .expect(400);

      expect((res.body as { message: string[] }).message).toEqual([message]);
      expect(
        await t.prisma.ticketPreset.findUniqueOrThrow({
          where: { id: preset.id },
        }),
      ).toEqual(preset);
    });
  });
});
