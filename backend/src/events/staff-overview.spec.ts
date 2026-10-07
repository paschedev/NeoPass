import { Prisma, StaffRole, StaffStatus } from '@prisma/client';
import { buildStaffOverview } from './staff-overview';

const now = new Date('2026-10-10T20:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

let nextId = 0;

type Payment = { amount: Prisma.Decimal; note: string | null; createdAt: Date };

function member(
  userId: string,
  name: string,
  {
    role = 'PROMOTER',
    status = 'ACCEPTED',
    earned = '0',
    paid = '0',
  }: {
    role?: StaffRole;
    status?: StaffStatus;
    earned?: string;
    paid?: string;
  } = {},
) {
  nextId += 1;
  return {
    id: `staff-${nextId}`,
    userId,
    role,
    status,
    commissionType: role === 'PROMOTER' ? ('PERCENTAGE' as const) : null,
    commissionValue: role === 'PROMOTER' ? new Prisma.Decimal(10) : null,
    totalEarned: new Prisma.Decimal(earned),
    totalPaid: new Prisma.Decimal(paid),
    user: { name, email: `${userId}@neopass.test` },
    payments: [] as Payment[],
  };
}

const scanner = (
  userId: string,
  name: string,
  status: StaffStatus = 'ACCEPTED',
) => member(userId, name, { role: 'SCANNER', status });

// Evento que empieza dentro de `startsInDays` días (negativo = ya empezó) y
// dura seis horas.
function event(
  id: string,
  startsInDays: number,
  staff: ReturnType<typeof member>[] = [],
  status = 'PUBLISHED',
) {
  const startDate = new Date(now.getTime() + startsInDays * DAY_MS);
  return {
    id,
    title: `Evento ${id}`,
    status,
    startDate,
    endDate: new Date(startDate.getTime() + 6 * HOUR_MS),
    deletedAt: null,
    staff,
  };
}

const ids = (list: { id: string }[]) => list.map((item) => item.id);

describe('buildStaffOverview', () => {
  it('suma lo que se le debe a cada RPP, a cada evento y en total, al centavo', () => {
    const ana = member('ana', 'Ana', { earned: '200.10', paid: '100' });
    const beto = member('beto', 'Beto', { earned: '0.20' });
    const otherEvent = member('caro', 'Caro', { earned: '0.10' });

    const overview = buildStaffOverview(
      [event('a', 3, [ana, beto]), event('b', 5, [otherEvent])],
      new Map(),
      now,
    );

    expect(overview.events[0].promoters).toEqual([
      expect.objectContaining({
        name: 'Ana',
        totalEarned: 200.1,
        totalPaid: 100,
        balance: 100.1,
      }),
      expect.objectContaining({ name: 'Beto', balance: 0.2 }),
    ]);
    expect(overview.events.map((group) => group.owed)).toEqual([100.3, 0.1]);
    expect(overview.totals).toMatchObject({
      owed: 100.4,
      paid: 100,
      earned: 200.4,
      promotersOwed: 3,
      eventsOwed: 2,
    });
  });

  it('un RPP pagado de más (una devolución bajó lo ganado) no achica la deuda con los demás', () => {
    const overpaid = member('ana', 'Ana', { earned: '100', paid: '150' });
    const owed = member('beto', 'Beto', { earned: '80' });

    const overview = buildStaffOverview(
      [event('a', 3, [overpaid, owed])],
      new Map(),
      now,
    );

    expect(overview.events[0].promoters[0]).toMatchObject({
      name: 'Ana',
      balance: -50,
    });
    expect(overview.events[0].owed).toBe(80);
    expect(overview.totals).toMatchObject({ owed: 80, promotersOwed: 1 });
  });

  it('cada RPP trae lo que se le debe entre todos los eventos del organizador', () => {
    const overview = buildStaffOverview(
      [
        event('a', 3, [member('ana', 'Ana', { earned: '100' })]),
        event('b', 5, [member('ana', 'Ana', { earned: '50', paid: '20' })]),
        event('c', -10, [member('ana', 'Ana', { earned: '70', paid: '70' })]),
        event('d', 8, [member('beto', 'Beto', { earned: '10' })]),
      ],
      new Map(),
      now,
    );

    const ana = overview.events.flatMap((group) =>
      group.promoters.filter((promoter) => promoter.name === 'Ana'),
    );
    expect(ana.map((promoter) => promoter.owedAcrossEvents)).toEqual([
      { amount: 130, events: 2 },
      { amount: 130, events: 2 },
      { amount: 130, events: 2 },
    ]);
    expect(overview.events[2].promoters[0].owedAcrossEvents).toEqual({
      amount: 10,
      events: 1,
    });
  });

  it('las entradas vendidas de cada RPP salen de lo que vendió con órdenes pagadas', () => {
    const ana = member('ana', 'Ana');
    const beto = member('beto', 'Beto');

    const overview = buildStaffOverview(
      [event('a', 3, [ana, beto])],
      new Map([[ana.id, 7]]),
      now,
    );

    expect(
      overview.events[0].promoters.map((promoter) => promoter.ticketsSold),
    ).toEqual([7, 0]);
  });

  it('ordena los eventos: en curso, próximos (el más cercano primero) y terminados (el más reciente primero)', () => {
    const overview = buildStaffOverview(
      [
        event('terminado-viejo', -20),
        event('proximo-lejano', 10),
        event('en-curso', -0.1),
        event('terminado-reciente', -2),
        event('proximo-cercano', 1),
        event('cancelado', 4, [], 'CANCELLED'),
      ],
      new Map(),
      now,
    );

    expect(ids(overview.events)).toEqual([
      'en-curso',
      'proximo-cercano',
      'proximo-lejano',
      'cancelado',
      'terminado-reciente',
      'terminado-viejo',
    ]);
    expect(overview.events.map((group) => group.phase)).toEqual([
      'IN_PROGRESS',
      'NOT_STARTED',
      'NOT_STARTED',
      'CLOSED',
      'CLOSED',
      'CLOSED',
    ]);
  });

  it('ordena el staff: RPPs aceptados por vendidas, después pendientes y rechazados; scanners y encargados por nombre', () => {
    const pocas = member('u1', 'Zoe');
    const muchas = member('u2', 'Yamila');
    const empate = member('u3', 'Abril');
    const pendiente = member('u4', 'Bruno', { status: 'PENDING' });
    const rechazado = member('u5', 'Ariel', { status: 'REJECTED' });
    const scanners = [
      scanner('u6', 'Valentín'),
      scanner('u7', 'Camila', 'REJECTED'),
      scanner('u8', 'Ángel'),
      scanner('u9', 'Bauti', 'PENDING'),
    ];
    const encargado = member('u10', 'Mora', { role: 'MANAGER' });

    const overview = buildStaffOverview(
      [
        event('a', 3, [
          rechazado,
          pocas,
          pendiente,
          muchas,
          empate,
          ...scanners,
          encargado,
        ]),
      ],
      new Map([
        [pocas.id, 2],
        [muchas.id, 9],
        [empate.id, 2],
      ]),
      now,
    );

    const [group] = overview.events;
    expect(group.promoters.map((promoter) => promoter.name)).toEqual([
      'Yamila',
      'Abril',
      'Zoe',
      'Bruno',
      'Ariel',
    ]);
    expect(group.scanners.map((person) => person.name)).toEqual([
      'Ángel',
      'Valentín',
      'Bauti',
      'Camila',
    ]);
    expect(group.managers).toEqual([
      {
        id: encargado.id,
        status: 'ACCEPTED',
        name: 'Mora',
        email: 'u10@neopass.test',
      },
    ]);
  });

  it('el staff activo y las invitaciones sin responder cuentan solo eventos que no terminaron', () => {
    const overview = buildStaffOverview(
      [
        event('proximo', 3, [
          member('ana', 'Ana'),
          scanner('beto', 'Beto'),
          scanner('caro', 'Caro', 'PENDING'),
        ]),
        event('en-curso', -0.1, [scanner('ana', 'Ana')]),
        event('terminado', -5, [
          scanner('dani', 'Dani'),
          scanner('eli', 'Eli', 'PENDING'),
        ]),
      ],
      new Map(),
      now,
    );

    expect(overview.totals).toMatchObject({
      activeStaff: 2,
      pendingInvitations: 1,
    });
  });

  it('un evento sin RPPs no debe nada y muestra los datos de su staff', () => {
    const overview = buildStaffOverview(
      [event('a', 3, [scanner('ana', 'Ana')]), event('b', 4)],
      new Map(),
      now,
    );

    expect(overview.events[0]).toMatchObject({
      id: 'a',
      title: 'Evento a',
      status: 'PUBLISHED',
      owed: 0,
      promoters: [],
      scanners: [
        expect.objectContaining({ name: 'Ana', email: 'ana@neopass.test' }),
      ],
    });
    expect(overview.events[1]).toMatchObject({
      owed: 0,
      promoters: [],
      scanners: [],
      managers: [],
    });
    expect(overview.totals).toMatchObject({
      owed: 0,
      paid: 0,
      earned: 0,
      promotersOwed: 0,
      eventsOwed: 0,
    });
  });

  it('devuelve la comisión pactada y el historial de pagos como números', () => {
    const ana = {
      ...member('ana', 'Ana', { earned: '300', paid: '150.5' }),
      payments: [
        {
          amount: new Prisma.Decimal('150.50'),
          note: 'Transferencia',
          createdAt: new Date('2026-10-05T12:00:00.000Z'),
        },
      ],
    };

    const overview = buildStaffOverview([event('a', 3, [ana])], new Map(), now);

    expect(overview.events[0].promoters[0]).toMatchObject({
      id: ana.id,
      status: 'ACCEPTED',
      email: 'ana@neopass.test',
      commissionType: 'PERCENTAGE',
      commissionValue: 10,
      payments: [
        {
          amount: 150.5,
          note: 'Transferencia',
          createdAt: new Date('2026-10-05T12:00:00.000Z'),
        },
      ],
    });
  });
});
