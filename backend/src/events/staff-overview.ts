import { CommissionType, Prisma, StaffRole, StaffStatus } from '@prisma/client';
import { compareByPhase, getEventPhase } from './event-phase';
import { toPaymentRecord } from './promoter-payment-record';

type OverviewMember = {
  id: string;
  userId: string;
  role: StaffRole;
  status: StaffStatus;
  commissionType: CommissionType | null;
  commissionValue: Prisma.Decimal | null;
  totalEarned: Prisma.Decimal;
  totalPaid: Prisma.Decimal;
  user: { name: string; email: string };
  payments: { amount: Prisma.Decimal; note: string | null; createdAt: Date }[];
};

type OverviewEvent = {
  id: string;
  title: string;
  status: string;
  startDate: Date;
  endDate: Date;
  staff: OverviewMember[];
};

type PersonDebt = { amount: Prisma.Decimal; events: number };

const ZERO = new Prisma.Decimal(0);

const STATUS_ORDER: Record<StaffStatus, number> = {
  ACCEPTED: 0,
  PENDING: 1,
  REJECTED: 2,
};

const sum = (amounts: Prisma.Decimal[]) => Prisma.Decimal.sum(ZERO, ...amounts);

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, 'es');

// What is still owed to a promoter. An overpayment (a refund lowered what they
// earned after they were paid) is not a negative debt: it doesn't lower what
// is owed to the others.
const owedTo = (member: OverviewMember) =>
  Prisma.Decimal.max(ZERO, member.totalEarned.minus(member.totalPaid));

const isPromoter = (member: OverviewMember) => member.role === 'PROMOTER';

function toPerson({ id, status, user }: OverviewMember) {
  return { id, status, name: user.name, email: user.email };
}

function sortPeople<T extends { status: StaffStatus; name: string }>(
  people: T[],
  compareAccepted: (a: T, b: T) => number = () => 0,
) {
  return people.sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      (a.status === 'ACCEPTED' ? compareAccepted(a, b) : 0) ||
      byName(a, b),
  );
}

// What each person is owed across all the organizer's events, so a promoter's
// card can say it when they are owed in more than one.
function debtByPerson(members: OverviewMember[]) {
  const debts = new Map<string, PersonDebt>();
  for (const member of members.filter(isPromoter)) {
    const owed = owedTo(member);
    if (owed.isZero()) continue;
    const current = debts.get(member.userId) ?? { amount: ZERO, events: 0 };
    debts.set(member.userId, {
      amount: current.amount.add(owed),
      events: current.events + 1,
    });
  }
  return debts;
}

// The organizer's staff grouped by event, with what is owed to each promoter,
// to each event and in total, ordered by phase (compareByPhase).
export function buildStaffOverview(
  events: OverviewEvent[],
  soldByPromoter: Map<string, number>,
  now: Date,
) {
  const members = events.flatMap((event) => event.staff);
  const debts = debtByPerson(members);

  const groups = events
    .map(({ staff, ...event }) => {
      const promoters = staff.filter(isPromoter);
      return {
        ...event,
        phase: getEventPhase(event, now),
        owed: sum(promoters.map(owedTo)),
        staff,
        promoters: sortPeople(
          promoters.map((member) => {
            const debt = debts.get(member.userId);
            return {
              ...toPerson(member),
              commissionType: member.commissionType,
              commissionValue: member.commissionValue?.toNumber() ?? null,
              ticketsSold: soldByPromoter.get(member.id) ?? 0,
              totalEarned: member.totalEarned.toNumber(),
              totalPaid: member.totalPaid.toNumber(),
              balance: member.totalEarned.minus(member.totalPaid).toNumber(),
              owedAcrossEvents: {
                amount: debt?.amount.toNumber() ?? 0,
                events: debt?.events ?? 0,
              },
              payments: member.payments.map(toPaymentRecord),
            };
          }),
          (a, b) => b.ticketsSold - a.ticketsSold,
        ),
        scanners: sortPeople(
          staff.filter((m) => m.role === 'SCANNER').map(toPerson),
        ),
        managers: sortPeople(
          staff.filter((m) => m.role === 'MANAGER').map(toPerson),
        ),
      };
    })
    .sort(compareByPhase);

  // Who works and who still has to answer counts only events not over yet.
  const openStaff = groups
    .filter((group) => group.phase !== 'CLOSED')
    .flatMap((group) => group.staff);
  const promoters = members.filter(isPromoter);

  return {
    totals: {
      owed: sum(promoters.map(owedTo)).toNumber(),
      paid: sum(promoters.map((member) => member.totalPaid)).toNumber(),
      earned: sum(promoters.map((member) => member.totalEarned)).toNumber(),
      promotersOwed: debts.size,
      eventsOwed: groups.filter((group) => !group.owed.isZero()).length,
      activeStaff: new Set(
        openStaff
          .filter((member) => member.status === 'ACCEPTED')
          .map((member) => member.userId),
      ).size,
      pendingInvitations: openStaff.filter(
        (member) => member.status === 'PENDING',
      ).length,
    },
    events: groups.map(({ staff: _staff, owed, ...group }) => ({
      ...group,
      owed: owed.toNumber(),
    })),
  };
}
