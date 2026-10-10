import * as bcrypt from 'bcrypt';
import { v2 as cloudinary } from 'cloudinary';
import request from 'supertest';
import { authHeader } from './utils/auth';
import { createUser } from './utils/factories';
import { mockTurnstile } from './utils/network';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

type User = Parameters<typeof authHeader>[1];
type Profile = {
  name: string;
  avatarUrl: string | null;
  companyName: string | null;
};

const PASSWORD = 'clave-segura-123';
// The test Cloudinary account (CLOUDINARY_URL in test-env.ts).
const CLOUD = 'https://res.cloudinary.com/test-cloud/image/upload';

const messageOf = (res: { body: unknown }) =>
  (res.body as { message: string | string[] }).message;

describe('Perfil editable', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  const http = () => request(t.app.getHttpServer());

  function update(user: User | null, body: object) {
    const req = http().patch('/auth/me');
    return (
      user ? req.set('Authorization', authHeader(t.app, user)) : req
    ).send(body);
  }

  async function organizer(companyName: string | null = null) {
    const user = await createUser(t.prisma, {
      role: 'ORGANIZER',
      name: 'Agustín Zannantonio',
      organizerProfile: { create: { phone: '+541123456789', companyName } },
    });
    return user;
  }

  describe('nombre y apellido', () => {
    it('se cambia sin espacios de más', async () => {
      const user = await createUser(t.prisma, { name: 'Ana Pérez' });

      const res = await update(user, { name: '  Ana   María  Pérez ' }).expect(
        200,
      );

      expect((res.body as Profile).name).toBe('Ana María Pérez');
      const saved = await t.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(saved.name).toBe('Ana María Pérez');
    });

    it('no puede quedar vacío ni pasar los 60 caracteres', async () => {
      const user = await createUser(t.prisma, { name: 'Ana Pérez' });

      const empty = await update(user, { name: '   ' }).expect(400);
      const long = await update(user, { name: 'A'.repeat(61) }).expect(400);

      expect(messageOf(empty)).toEqual(['Escribí tu nombre y apellido']);
      expect(messageOf(long)).toEqual([
        'El nombre y apellido puede tener hasta 60 caracteres',
      ]);
    });
  });

  describe('productora', () => {
    it('un organizador la agrega, la cambia o la quita', async () => {
      const user = await organizer();

      const added = await update(user, {
        companyName: '  Productora Sur ',
      }).expect(200);
      expect((added.body as Profile).companyName).toBe('Productora Sur');

      const removed = await update(user, { companyName: '' }).expect(200);
      expect((removed.body as Profile).companyName).toBeNull();
      const profile = await t.prisma.organizerProfile.findUniqueOrThrow({
        where: { userId: user.id },
      });
      expect(profile.companyName).toBeNull();
    });

    it('quien no es organizador no tiene productora', async () => {
      const user = await createUser(t.prisma);

      const res = await update(user, { companyName: 'Productora Sur' }).expect(
        403,
      );

      expect(messageOf(res)).toBe('Solo los organizadores tienen productora');
    });

    it('puede tener hasta 50 caracteres', async () => {
      const user = await organizer();

      const res = await update(user, { companyName: 'P'.repeat(51) }).expect(
        400,
      );

      expect(messageOf(res)).toEqual([
        'El nombre de la productora puede tener hasta 50 caracteres',
      ]);
    });
  });

  it('nadie usa "NeoPass" en su nombre ni en el de su productora, salvo la cuenta ADMIN', async () => {
    const user = await organizer();
    const admin = await createUser(t.prisma, {
      role: 'ADMIN',
      organizerProfile: { create: { phone: '+541123456789' } },
    });

    const company = await update(user, {
      companyName: 'Neo Pass Soporte',
    }).expect(400);
    const name = await update(user, { name: 'Equipo NeoPass' }).expect(400);
    await update(admin, { companyName: 'NeoPass' }).expect(200);

    expect(messageOf(company)).toBe('El nombre no puede incluir "NeoPass"');
    expect(messageOf(name)).toBe('El nombre no puede incluir "NeoPass"');
  });

  describe('foto', () => {
    it('solo se acepta la que se subió desde NeoPass para esa cuenta', async () => {
      const user = await createUser(t.prisma);
      const other = await createUser(t.prisma);
      const own = `${CLOUD}/v1728000000/avatars/${user.id}.jpg`;

      const res = await update(user, { avatarUrl: own }).expect(200);
      expect((res.body as Profile).avatarUrl).toBe(own);

      for (const avatarUrl of [
        `${CLOUD}/v1728000000/avatars/${other.id}.jpg`,
        `https://evil.test/avatars/${user.id}.jpg`,
        `https://res.cloudinary.com/otra-cuenta/image/upload/avatars/${user.id}.jpg`,
        `http://res.cloudinary.com/test-cloud/image/upload/avatars/${user.id}.jpg`,
      ]) {
        const rejected = await update(user, { avatarUrl }).expect(400);
        expect(messageOf(rejected)).toBe('Subí la foto desde NeoPass');
      }
    });

    it('se puede quitar', async () => {
      const user = await createUser(t.prisma, {
        avatarUrl: `${CLOUD}/v1/avatars/placeholder.jpg`,
      });

      const res = await update(user, { avatarUrl: null }).expect(200);

      expect((res.body as Profile).avatarUrl).toBeNull();
    });

    it('la firma para subirla apunta a la carpeta de esa cuenta y reemplaza la anterior', async () => {
      const user = await createUser(t.prisma);

      const res = await http()
        .get('/media/avatar-presign')
        .set('Authorization', authHeader(t.app, user))
        .expect(200);

      const sign = res.body as {
        timestamp: number;
        signature: string;
        publicId: string;
        overwrite: boolean;
      };
      expect(sign.publicId).toBe(`avatars/${user.id}`);
      expect(sign.overwrite).toBe(true);
      expect(sign.signature).toBe(
        cloudinary.utils.api_sign_request(
          {
            timestamp: sign.timestamp,
            public_id: sign.publicId,
            overwrite: true,
          },
          'test_api_secret',
        ),
      );
    });
  });

  it('el perfil y el login traen la foto y la productora', async () => {
    const avatarUrl = `${CLOUD}/v1/avatars/x.jpg`;
    const user = await createUser(t.prisma, {
      role: 'ORGANIZER',
      email: 'orga@neopass.test',
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      avatarUrl,
      organizerProfile: {
        create: { phone: '+541123456789', companyName: 'Productora Sur' },
      },
    });

    const me = await http()
      .get('/auth/me')
      .set('Authorization', authHeader(t.app, user))
      .expect(200);
    mockTurnstile(true);
    const login = await http()
      .post('/auth/login')
      .send({
        email: 'orga@neopass.test',
        password: PASSWORD,
        captchaToken: 'captcha-de-prueba',
      })
      .expect(201);

    expect(me.body).toMatchObject({
      avatarUrl,
      companyName: 'Productora Sur',
    });
    expect((login.body as { user: Profile }).user).toMatchObject({
      avatarUrl,
      companyName: 'Productora Sur',
    });
  });

  it('sin sesión no se edita nada ni se pide la firma', async () => {
    await update(null, { name: 'Ana' }).expect(401);
    await http().get('/media/avatar-presign').expect(401);
  });
});
