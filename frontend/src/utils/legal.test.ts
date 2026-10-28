import { describe, expect, it } from 'vitest';
import { acceptedLegalVersions, legalDocumentsFor } from './legal';

describe('legalDocumentsFor', () => {
  it('quien compra acepta los Términos de uso y la Política de privacidad', () => {
    expect(legalDocumentsFor(false)).toEqual(['TERMS', 'PRIVACY']);
  });

  it('quien organiza acepta además los Términos para organizadores', () => {
    expect(legalDocumentsFor(true)).toEqual([
      'TERMS',
      'ORGANIZER_TERMS',
      'PRIVACY',
    ]);
  });
});

describe('acceptedLegalVersions', () => {
  it('quien compra manda las versiones de los términos y la privacidad', () => {
    expect(acceptedLegalVersions(false)).toEqual({
      termsVersion: 1,
      privacyVersion: 1,
    });
  });

  it('quien organiza manda también la de los términos para organizadores', () => {
    expect(acceptedLegalVersions(true)).toEqual({
      termsVersion: 1,
      privacyVersion: 1,
      organizerTermsVersion: 1,
    });
  });
});
