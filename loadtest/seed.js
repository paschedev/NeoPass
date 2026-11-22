// Carga los datos sintéticos de la prueba de carga en la base de prueba (una
// base vacía en una rama de Neon, con las migraciones ya aplicadas por el
// backend de prueba). Se puede correr de nuevo: lo que ya existe no se toca,
// salvo el horario del evento de la puerta, que vuelve a empezar en 30 min.
//
// Git Bash, desde la raíz del repo, con Node 24 (importa el cifrado del
// backend en TypeScript):
//   DATABASE_URL='<conexión directa a la base de prueba>' \
//   MERCADOPAGO_TOKEN_KEY='<la del entorno de prueba>' node loadtest/seed.js
//
// Se niega a seguir si la base tiene usuarios que no son de carga: así nunca
// escribe en producción por un error de conexión.
import { createRequire } from 'node:module';
import { MercadoPagoTokenCipher } from '../backend/src/payments/mercadopago-token-cipher.ts';
import {
  buyerEmail,
  LAYOUT,
  loadId,
  organizerEmail,
  organizerOfEvent,
  qrCode,
  scannerEmail,
} from './lib/ids.js';

const LOAD_EMAIL_DOMAIN = '@carga.neopass.test';
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const CHUNK = 5000;

for (const name of ['DATABASE_URL', 'MERCADOPAGO_TOKEN_KEY']) {
  if (!process.env[name]) {
    console.error(`Falta ${name}`);
    process.exit(1);
  }
}

const require = createRequire(new URL('../backend/package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const cipher = new MercadoPagoTokenCipher(process.env.MERCADOPAGO_TOKEN_KEY);
const now = Date.now();

const range = (count, from = 1) => Array.from({ length: count }, (_, i) => from + i);

async function assertLoadTestDatabase() {
  const foreign = await prisma.user.count({
    where: { NOT: { email: { endsWith: LOAD_EMAIL_DOMAIN } } },
  });
  if (foreign > 0) {
    throw new Error(
      `La base tiene ${foreign} usuarios que no son de carga: no parece la base de prueba. No se cargó nada.`,
    );
  }
}

async function createInChunks(model, rows) {
  let created = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const result = await prisma[model].createMany({
      data: rows.slice(i, i + CHUNK),
      skipDuplicates: true,
    });
    created += result.count;
  }
  return created;
}

const DESCRIPTION =
  'Fiesta de prueba para medir la capacidad de NeoPass. ' +
  'Line-up de toda la noche, barra abierta hasta las 3, guardarropa y ' +
  'estacionamiento. Mayores de 18 con DNI. La organización se reserva el ' +
  'derecho de admisión. No se permite el ingreso con bebidas ni objetos ' +
  'cortantes. Las entradas se validan con el QR en la puerta: llevalo en el ' +
  'teléfono con el brillo al máximo. Ante cualquier duda, escribinos por ' +
  'Instagram. '.repeat(2);

function event(n, startDate, hours) {
  return {
    id: loadId('event', n),
    title: `Fiesta de carga ${n}`,
    description: DESCRIPTION,
    startDate: new Date(startDate),
    endDate: new Date(startDate + hours * HOUR_MS),
    status: 'PUBLISHED',
    organizerId: loadId('organizer', organizerOfEvent(n)),
    venueName: 'Club de carga',
    venueAddress: 'Av. Siempre Viva 742',
    venueCity: 'Córdoba',
    venueCapacity: 2000,
    latitude: -31.4201,
    longitude: -64.1888,
    imageUrl: 'https://res.cloudinary.com/carga/image/upload/v1/flyer.jpg',
  };
}

function ticketType(n, eventNumber, name, price, stock) {
  return {
    id: loadId('ticketType', n),
    eventId: loadId('event', eventNumber),
    batchId: loadId('batch', eventNumber),
    name,
    price,
    stock,
  };
}

async function main() {
  await assertLoadTestDatabase();
  const user = (id, email, name, role, extra = {}) => ({
    id,
    email,
    name,
    role,
    passwordHash: 'carga-sin-login',
    emailVerifiedAt: new Date(now),
    ...extra,
  });

  const users = [
    ...range(LAYOUT.organizers).map((n) =>
      user(loadId('organizer', n), organizerEmail(n), `Organizador de carga ${n}`, 'ORGANIZER', {
        mercadoPagoAccessToken: cipher.encrypt(`TEST-carga-org-${n}`),
        mercadoPagoUserId: String(9_000_000 + n),
        mercadoPagoPublicKey: 'TEST-carga-public-key',
        mercadoPagoTokenExpiresAt: new Date(now + 150 * DAY_MS),
      }),
    ),
    ...range(LAYOUT.buyers).map((n) =>
      user(loadId('buyer', n), buyerEmail(n), `Comprador ${n}`, 'CUSTOMER'),
    ),
    ...range(LAYOUT.scanners).map((n) =>
      user(loadId('scanner', n), scannerEmail(n), `Escáner ${n}`, 'CUSTOMER'),
    ),
  ];
  console.log(`Usuarios nuevos: ${await createInChunks('user', users)}`);

  const doorStart = now + 30 * 60 * 1000;
  const events = [
    ...range(LAYOUT.events).map((n) => event(n, now + (7 + n) * DAY_MS, 6)),
    event(LAYOUT.doorEvent, doorStart, 10),
  ];
  console.log(`Eventos nuevos: ${await createInChunks('event', events)}`);
  await prisma.event.update({
    where: { id: loadId('event', LAYOUT.doorEvent) },
    data: { startDate: new Date(doorStart), endDate: new Date(doorStart + 10 * HOUR_MS) },
  });

  const eventNumbers = [...range(LAYOUT.events), LAYOUT.doorEvent];
  await createInChunks(
    'ticketBatch',
    eventNumbers.map((n) => ({
      id: loadId('batch', n),
      eventId: loadId('event', n),
      name: 'Preventa',
      isVisible: true,
    })),
  );

  const plenty = 1_000_000;
  const types = [
    ...range(LAYOUT.events).flatMap((n) => [
      ticketType(n, n, 'General', 10000, plenty),
      ticketType(LAYOUT.vipOffset + n, n, 'VIP', 25000, plenty),
    ]),
    ...LAYOUT.selloutTypes.map((n, i) =>
      ticketType(n, 1, `Agotable ${i + 1}`, 10000, LAYOUT.selloutStock),
    ),
    ticketType(LAYOUT.doorEvent, LAYOUT.doorEvent, 'General', 10000, plenty),
  ];
  console.log(`Tipos de entrada nuevos: ${await createInChunks('ticketType', types)}`);

  await createInChunks(
    'eventStaff',
    range(LAYOUT.scanners).map((n) => ({
      id: loadId('staff', n),
      eventId: loadId('event', LAYOUT.doorEvent),
      userId: loadId('scanner', n),
      role: 'SCANNER',
      status: 'ACCEPTED',
    })),
  );

  const tickets = range(LAYOUT.doorTickets).map((n) => ({
    qrCode: qrCode(n),
    ticketTypeId: loadId('ticketType', LAYOUT.doorEvent),
    userId: loadId('buyer', ((n - 1) % LAYOUT.buyers) + 1),
  }));
  console.log(`Entradas de la puerta nuevas: ${await createInChunks('ticket', tickets)}`);
  console.log(
    `Listo. La puerta abre ya y el evento termina ${new Date(doorStart + 10 * HOUR_MS).toISOString()}.`,
  );
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
