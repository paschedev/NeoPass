import { Prisma, StaffRole, StaffStatus } from '@prisma/client';
import { buildMyStaff } from './my-staff';

const now = new Date('2026-10-10T20:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

let nextId = 0;

// Evento que empieza dentro de `startsInDays` días (negativo = ya empezó) y
// dura seis horas.
function event(id: string, startsInDays: number, status = 'PUBLISHED') {
  const startDate = new Date(now.getTime() + startsInDays * DAY_MS);
  return {
    id,
    title: `Evento ${id}`,
    status,
    startDate,
    endDate: new Date(startDate.getTime() + 6 * HOUR_MS),
    venueName: 'Niceto Club',
    venueAddress: 'Av. Cnel. Niceto Vega 5510',
    venueCity: 'CABA',
    latitude: -34.5866,
    longitude: -58.4381,
    venuePlaceId: 'place-1',
    organizer: { name: 'Organizadora' },
  };
}

function assignment(
  ev: ReturnType<typeof event>,
  role: StaffRole,
  {
    status = 'ACCEPTED',
    earned = '0',
    paid = '0',
  }: { status?: StaffStatus; earned?: string; paid?: string } = {},
) {
  nextId += 1;
  const promoter = role === 'PROMOTER';
  return {
    id: `staff-${nextId}`,
    role,
    status,
    commissionType: promoter ? ('PERCENTAGE' as const) : null,
    commissionValue: promoter ? new Prisma.Decimal('12.5') : null,
    totalEarned: new Prisma.Decimal(earned),
    totalPaid: new Prisma.Decimal(paid),
    event: ev,
  };
}

describe('buildMyStaff', () => {
  it('junta los roles de cada evento y trae los datos del evento', () => {
    const fiesta = event('fiesta', 3);
    const scanner = assignment(fiesta, 'SCANNER');
    const rpp = assignment(fiesta, 'PROMOTER', { earned: '300', paid: '100' });

    const mine = buildMyStaff([scanner, rpp], new Map([[rpp.id, 4]]), now);

    expect(mine.events).toEqual([
      {
        id: 'fiesta',
        title: 'Evento fiesta',
        status: 'PUBLISHED',
        startDate: fiesta.startDate,
        endDate: fiesta.endDate,
        phase: 'NOT_STARTED',
        venueName: 'Niceto Club',
        venueAddress: 'Av. Cnel. Niceto Vega 5510',
        venueCity: 'CABA',
        latitude: -34.5866,
        longitude: -58.4381,
        venuePlaceId: 'place-1',
        organizerName: 'Organizadora',
        owed: 200,
        roles: ['PROMOTER', 'SCANNER'],
        promoter: {
          staffId: rpp.id,
          commissionType: 'PERCENTAGE',
          commissionValue: 12.5,
          ticketsSold: 4,
          totalEarned: 300,
          totalPaid: 100,
          balance: 200,
        },
      },
    ]);
  });

  it('suma lo ganado, lo cobrado, lo que le deben y las vendidas como RPP, al centavo', () => {
    const a = assignment(event('a', 3), 'PROMOTER', {
      earned: '1500.15',
      paid: '0.10',
    });
    const b = assignment(event('b', 5), 'PROMOTER', {
      earned: '1500.15',
      paid: '0.20',
    });

    const mine = buildMyStaff(
      [a, b, assignment(event('c', 7), 'SCANNER')],
      new Map([
        [a.id, 2],
        [b.id, 3],
      ]),
      now,
    );

    expect(mine.promoterTotals).toEqual({
      totalEarned: 3000.3,
      totalPaid: 0.3,
      owed: 3000,
      ticketsSold: 5,
    });
  });

  it('un pago de más en un evento no achica lo que le deben en otro', () => {
    const mine = buildMyStaff(
      [
        assignment(event('a', 3), 'PROMOTER', { earned: '100', paid: '150' }),
        assignment(event('b', 5), 'PROMOTER', { earned: '80' }),
      ],
      new Map(),
      now,
    );

    expect(
      mine.events.map((ev) => [ev.id, ev.owed, ev.promoter?.balance]),
    ).toEqual([
      ['a', 0, -50],
      ['b', 80, 80],
    ]);
    expect(mine.promoterTotals).toMatchObject({ owed: 80 });
  });

  it('sin roles de RPP no hay totales de RPP', () => {
    const mine = buildMyStaff(
      [
        assignment(event('a', 3), 'SCANNER'),
        assignment(event('b', 4), 'MANAGER'),
      ],
      new Map(),
      now,
    );

    expect(mine.promoterTotals).toBeNull();
    expect(mine.events.map((ev) => [ev.roles, ev.promoter])).toEqual([
      [['SCANNER'], null],
      [['MANAGER'], null],
    ]);
  });

  it('ordena los eventos: en curso, próximos (el más cercano primero) y terminados (el más reciente primero)', () => {
    const mine = buildMyStaff(
      [
        assignment(event('terminado-viejo', -20), 'SCANNER'),
        assignment(event('proximo-lejano', 10), 'SCANNER'),
        assignment(event('en-curso', -0.1), 'SCANNER'),
        assignment(event('terminado-reciente', -2), 'SCANNER'),
        assignment(event('proximo-cercano', 1), 'SCANNER'),
      ],
      new Map(),
      now,
    );

    expect(mine.events.map((ev) => [ev.id, ev.phase])).toEqual([
      ['en-curso', 'IN_PROGRESS'],
      ['proximo-cercano', 'NOT_STARTED'],
      ['proximo-lejano', 'NOT_STARTED'],
      ['terminado-reciente', 'CLOSED'],
      ['terminado-viejo', 'CLOSED'],
    ]);
  });

  it('las invitaciones pendientes van aparte, solo de eventos que no terminaron y la más cercana primero', () => {
    const lejana = assignment(event('lejana', 9), 'PROMOTER', {
      status: 'PENDING',
    });
    const cercana = assignment(event('cercana', 2), 'SCANNER', {
      status: 'PENDING',
    });

    const mine = buildMyStaff(
      [
        lejana,
        assignment(event('vieja', -5), 'SCANNER', { status: 'PENDING' }),
        assignment(event('cancelada', 4, 'CANCELLED'), 'SCANNER', {
          status: 'PENDING',
        }),
        cercana,
      ],
      new Map(),
      now,
    );

    expect(mine.events).toEqual([]);
    expect(mine.invitations).toEqual([
      {
        id: cercana.id,
        role: 'SCANNER',
        commissionType: null,
        commissionValue: null,
        event: {
          id: 'cercana',
          title: 'Evento cercana',
          startDate: cercana.event.startDate,
          organizerName: 'Organizadora',
        },
      },
      expect.objectContaining({
        id: lejana.id,
        role: 'PROMOTER',
        commissionType: 'PERCENTAGE',
        commissionValue: 12.5,
      }),
    ]);
  });
});
