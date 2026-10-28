import { CURRENT_LEGAL_VERSIONS } from '../../src/legal/legal-documents';

// What the sign-up form sends once its box is ticked.
export const ACCEPTED_LEGAL = {
  termsVersion: CURRENT_LEGAL_VERSIONS.TERMS,
  privacyVersion: CURRENT_LEGAL_VERSIONS.PRIVACY,
};

export const ACCEPTED_ORGANIZER_LEGAL = {
  ...ACCEPTED_LEGAL,
  organizerTermsVersion: CURRENT_LEGAL_VERSIONS.ORGANIZER_TERMS,
};
