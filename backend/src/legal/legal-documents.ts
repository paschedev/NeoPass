import { LegalDocument } from '@prisma/client';

// The version in force of each legal text; frontend/src/utils/legal.ts shows
// the same ones. A substantive change is a new version that new accounts
// accept; existing accounts were taken as accepting version 1. Version 2 of
// the organizer terms (Mercado Pago's fee split in halves) didn't ask the
// existing organizers to accept it again.
export const CURRENT_LEGAL_VERSIONS: Record<LegalDocument, number> = {
  TERMS: 1,
  PRIVACY: 1,
  ORGANIZER_TERMS: 2,
};

// What each account accepts when it signs up: an organizer also buys.
export function legalDocumentsFor(role: string): LegalDocument[] {
  return role === 'ORGANIZER'
    ? ['TERMS', 'PRIVACY', 'ORGANIZER_TERMS']
    : ['TERMS', 'PRIVACY'];
}
