// Who organizes, as buyers, staff and people receiving free tickets read it:
// the producer's name when the organizer set one, otherwise the account's.
export const ORGANIZER_NAME_SELECT = {
  name: true,
  organizerProfile: { select: { companyName: true } },
} as const;

export type OrganizerForName = {
  name: string;
  organizerProfile?: { companyName: string | null } | null;
};

export function organizerDisplayName({
  name,
  organizerProfile,
}: OrganizerForName) {
  return organizerProfile?.companyName?.trim() || name;
}
