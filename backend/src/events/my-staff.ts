import {
  CommissionType,
  EventPermission,
  Prisma,
  StaffRole,
  StaffStatus,
} from '@prisma/client';
import { compareByPhase, getEventPhase } from './event-phase';
import {
  organizerDisplayName,
  type OrganizerForName,
} from '../common/organizer-name';
import {
  coOrganizerSendsFreeTickets,
  promoterFreeTickets,
} from './promoter-free-tickets';

type MyAssignment = {
  id: string;
  role: StaffRole;
  status: StaffStatus;
  commissionType: CommissionType | null;
  commissionValue: Prisma.Decimal | null;
  totalEarned: Prisma.Decimal;
  totalPaid: Prisma.Decimal;
  // Only co-organizers (MANAGER) have them.
  permissions: EventPermission[];
  freeTicketLimit: number | null;
  event: {
    id: string;
    title: string;
    status: string;
    startDate: Date;
    endDate: Date;
    deletedAt: Date | null;
    venueName: string | null;
    venueAddress: string | null;
    venueCity: string | null;
    latitude: number | null;
    longitude: number | null;
    venuePlaceId: string | null;
    organizer: OrganizerForName;
  };
};

const ZERO = new Prisma.Decimal(0);

const ROLE_ORDER: Record<StaffRole, number> = {
  PROMOTER: 0,
  SCANNER: 1,
  MANAGER: 2,
};

const sum = (amounts: Prisma.Decimal[]) => Prisma.Decimal.sum(ZERO, ...amounts);

// What is still owed to the promoter; an overpayment is not a negative debt.
const owedTo = (promoter: MyAssignment) =>
  Prisma.Decimal.max(ZERO, promoter.totalEarned.minus(promoter.totalPaid));

// Where a person works as staff: their accepted roles grouped by event and
// ordered by phase (compareByPhase), what they earned as a promoter, and the
// invitations still to answer for events that are not over.
export function buildMyStaff(
  assignments: MyAssignment[],
  soldByPromoter: Map<string, number>,
  now: Date,
  freeTicketsSent = new Map<string, number>(),
) {
  const accepted = assignments.filter((a) => a.status === 'ACCEPTED');
  const promoters = accepted.filter((a) => a.role === 'PROMOTER');

  const byEvent = new Map<string, MyAssignment[]>();
  for (const assignment of accepted) {
    const roles = byEvent.get(assignment.event.id) ?? [];
    byEvent.set(assignment.event.id, [...roles, assignment]);
  }

  const events = [...byEvent.values()]
    .map((roles) => {
      const { organizer, ...event } = roles[0].event;
      const promoter = roles.find((role) => role.role === 'PROMOTER');
      const coOrganizer = roles.find((role) => role.role === 'MANAGER');
      return {
        ...event,
        phase: getEventPhase(event, now),
        organizerName: organizerDisplayName(organizer),
        owed: promoter ? owedTo(promoter).toNumber() : 0,
        roles: roles
          .map((role) => role.role)
          .sort((a, b) => ROLE_ORDER[a] - ROLE_ORDER[b]),
        coOrganizer: coOrganizer
          ? {
              permissions: coOrganizer.permissions,
              freeTicketLimit: coOrganizer.freeTicketLimit,
            }
          : null,
        promoter: promoter
          ? {
              staffId: promoter.id,
              commissionType: promoter.commissionType,
              commissionValue: promoter.commissionValue?.toNumber() ?? null,
              ticketsSold: soldByPromoter.get(promoter.id) ?? 0,
              totalEarned: promoter.totalEarned.toNumber(),
              totalPaid: promoter.totalPaid.toNumber(),
              balance: promoter.totalEarned
                .minus(promoter.totalPaid)
                .toNumber(),
              // As a co-organizer with free tickets, that rule applies instead.
              freeTickets: coOrganizerSendsFreeTickets(coOrganizer)
                ? null
                : promoterFreeTickets(promoter, freeTicketsSent),
            }
          : null,
      };
    })
    .sort(compareByPhase);

  const invitations = assignments
    .filter(
      (a) => a.status === 'PENDING' && getEventPhase(a.event, now) !== 'CLOSED',
    )
    .sort((a, b) => a.event.startDate.getTime() - b.event.startDate.getTime())
    .map(
      ({
        id,
        role,
        commissionType,
        commissionValue,
        permissions,
        freeTicketLimit,
        event,
      }) => ({
        id,
        role,
        commissionType,
        commissionValue: commissionValue?.toNumber() ?? null,
        permissions,
        freeTicketLimit,
        event: {
          id: event.id,
          title: event.title,
          startDate: event.startDate,
          organizerName: organizerDisplayName(event.organizer),
        },
      }),
    );

  return {
    promoterTotals:
      promoters.length === 0
        ? null
        : {
            totalEarned: sum(promoters.map((p) => p.totalEarned)).toNumber(),
            totalPaid: sum(promoters.map((p) => p.totalPaid)).toNumber(),
            owed: sum(promoters.map(owedTo)).toNumber(),
            ticketsSold: promoters.reduce(
              (total, p) => total + (soldByPromoter.get(p.id) ?? 0),
              0,
            ),
          },
    invitations,
    events,
  };
}
