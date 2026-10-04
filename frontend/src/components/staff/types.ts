import type { EventPhase } from '@/utils/event-edit';

export type StaffRoleName = 'PROMOTER' | 'SCANNER' | 'MANAGER';

export interface MyPromoterRole {
  staffId: string;
  commissionType: string | null;
  commissionValue: number | null;
  ticketsSold: number;
  totalEarned: number;
  totalPaid: number;
  // Negativo si le pagaron de más (una devolución bajó lo que ganó).
  balance: number;
}

export interface MyStaffEvent {
  id: string;
  title: string;
  status: string;
  startDate: string;
  endDate: string;
  phase: EventPhase;
  venueName: string | null;
  venueAddress: string | null;
  venueCity: string | null;
  latitude: number | null;
  longitude: number | null;
  venuePlaceId: string | null;
  organizerName: string;
  // Lo que le deben como RPP en este evento.
  owed: number;
  roles: StaffRoleName[];
  promoter: MyPromoterRole | null;
}

export interface MyStaffInvitation {
  id: string;
  role: StaffRoleName;
  commissionType: string | null;
  commissionValue: number | null;
  event: { id: string; title: string; startDate: string; organizerName: string };
}

// Respuesta de GET /events/staff/me.
export interface MyStaff {
  promoterTotals: {
    totalEarned: number;
    totalPaid: number;
    owed: number;
    ticketsSold: number;
  } | null;
  invitations: MyStaffInvitation[];
  events: MyStaffEvent[];
}
