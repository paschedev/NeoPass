import type { StaffOverview } from '@/components/panel/types';
import type { MyStaff } from '@/components/staff/types';

// Datos inventados para la demo de la landing: el staff de una productora y
// el panel de Lucía, una de sus RPPs, que también vende para otra. Las
// fechas se arman desde hoy, así la demo nunca muestra eventos pasados.

function daysFrom(now: Date, days: number, hour: number): string {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

// Lucía vende 87 entradas de $15.000 con el 10 %; ya le pagaron $60.000.
const LUCIA_TECHNO = {
  commissionType: 'PERCENTAGE',
  commissionValue: 10,
  ticketsSold: 87,
  totalEarned: 130500,
  totalPaid: 60000,
  balance: 70500,
  freeTickets: { limit: 10, sent: 4 },
};

export function organizerDemo(now: Date): StaffOverview {
  return {
    totals: {
      owed: 184500,
      paid: 105000,
      earned: 289500,
      promotersOwed: 2,
      eventsOwed: 1,
      activeStaff: 6,
      pendingInvitations: 1,
    },
    events: [
      {
        id: 'demo-noche-de-techno',
        title: 'Noche de Techno',
        status: 'PUBLISHED',
        startDate: daysFrom(now, 5, 23),
        endDate: daysFrom(now, 6, 6),
        deletedAt: null,
        phase: 'NOT_STARTED',
        owed: 184500,
        promoters: [
          {
            id: 'demo-lucia',
            status: 'ACCEPTED',
            name: 'Lucía Fernández',
            email: 'lucia@example.com',
            ...LUCIA_TECHNO,
            owedAcrossEvents: { amount: 70500, events: 1 },
            payments: [
              {
                amount: 60000,
                note: 'Transferencia',
                createdAt: daysFrom(now, -3, 18),
              },
            ],
          },
          {
            id: 'demo-martin',
            status: 'ACCEPTED',
            name: 'Martín Gómez',
            email: 'martin@example.com',
            commissionType: 'FIXED',
            commissionValue: 1500,
            ticketsSold: 76,
            totalEarned: 114000,
            totalPaid: 0,
            balance: 114000,
            owedAcrossEvents: { amount: 114000, events: 1 },
            payments: [],
            freeTickets: null,
          },
        ],
        scanners: [
          {
            id: 'demo-sofia',
            status: 'ACCEPTED',
            name: 'Sofía Ruiz',
            email: 'sofia@example.com',
          },
        ],
        managers: [
          {
            id: 'demo-diego',
            status: 'ACCEPTED',
            name: 'Diego Pérez',
            email: 'diego@example.com',
          },
        ],
      },
      {
        id: 'demo-fiesta-de-primavera',
        title: 'Fiesta de Primavera',
        status: 'PUBLISHED',
        startDate: daysFrom(now, 12, 22),
        endDate: daysFrom(now, 13, 5),
        deletedAt: null,
        phase: 'NOT_STARTED',
        owed: 0,
        promoters: [
          {
            id: 'demo-camila',
            status: 'ACCEPTED',
            name: 'Camila Torres',
            email: 'camila@example.com',
            commissionType: 'PERCENTAGE',
            commissionValue: 8,
            ticketsSold: 45,
            totalEarned: 45000,
            totalPaid: 45000,
            balance: 0,
            owedAcrossEvents: { amount: 0, events: 0 },
            payments: [
              {
                amount: 45000,
                note: 'Efectivo',
                createdAt: daysFrom(now, -1, 20),
              },
            ],
            freeTickets: null,
          },
        ],
        scanners: [
          {
            id: 'demo-tomas',
            status: 'PENDING',
            name: 'Tomás Díaz',
            email: 'tomas@example.com',
          },
        ],
        managers: [],
      },
    ],
  };
}

export function promoterDemo(now: Date): MyStaff {
  const venue = {
    latitude: null,
    longitude: null,
    venuePlaceId: null,
    status: 'PUBLISHED',
    deletedAt: null,
    phase: 'NOT_STARTED' as const,
    coOrganizer: null,
  };
  return {
    promoterTotals: {
      totalEarned: 197700,
      totalPaid: 110000,
      owed: 87700,
      ticketsSold: 143,
    },
    invitations: [],
    events: [
      {
        ...venue,
        id: 'demo-noche-de-techno',
        title: 'Noche de Techno',
        startDate: daysFrom(now, 5, 23),
        endDate: daysFrom(now, 6, 6),
        venueName: 'Club Central',
        venueAddress: 'Av. Corrientes 1234',
        venueCity: 'CABA',
        organizerName: 'Productora Sur',
        owed: 70500,
        roles: ['PROMOTER'],
        promoter: { staffId: 'demo-lucia', ...LUCIA_TECHNO },
      },
      {
        ...venue,
        id: 'demo-sunset-en-la-terraza',
        title: 'Sunset en la Terraza',
        startDate: daysFrom(now, 9, 18),
        endDate: daysFrom(now, 9, 23),
        venueName: 'Terraza Norte',
        venueAddress: 'Av. del Libertador 5000',
        venueCity: 'Vicente López',
        organizerName: 'Eventos Norte',
        owed: 17200,
        roles: ['PROMOTER', 'SCANNER'],
        promoter: {
          staffId: 'demo-lucia-sunset',
          commissionType: 'FIXED',
          commissionValue: 1200,
          ticketsSold: 56,
          totalEarned: 67200,
          totalPaid: 50000,
          balance: 17200,
          freeTickets: null,
        },
      },
    ],
  };
}
