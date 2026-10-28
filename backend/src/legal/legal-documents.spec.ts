import { legalDocumentsFor } from './legal-documents';

describe('legalDocumentsFor', () => {
  it('un cliente acepta los Términos de uso y la Política de privacidad', () => {
    expect(legalDocumentsFor('CUSTOMER')).toEqual(['TERMS', 'PRIVACY']);
  });

  it('un organizador acepta además los Términos para organizadores', () => {
    expect(legalDocumentsFor('ORGANIZER')).toEqual([
      'TERMS',
      'PRIVACY',
      'ORGANIZER_TERMS',
    ]);
  });
});
