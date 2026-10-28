// Los textos legales vigentes. La versión es la misma que exige el backend
// (backend/src/legal/legal-documents.ts): un cambio de fondo en un texto es
// una versión nueva que todos vuelven a aceptar.
export const LEGAL_DOCUMENTS = {
  TERMS: {
    title: 'Términos de uso',
    article: 'los',
    href: '/terminos',
    version: 1,
    since: '28 de octubre de 2026',
  },
  PRIVACY: {
    title: 'Política de privacidad',
    article: 'la',
    href: '/privacidad',
    version: 1,
    since: '28 de octubre de 2026',
  },
  ORGANIZER_TERMS: {
    title: 'Términos para organizadores',
    article: 'los',
    href: '/terminos/organizadores',
    version: 1,
    since: '28 de octubre de 2026',
  },
} as const;

// Las leyendas que la Disposición 10/2008 pide en todo formulario que junta
// datos personales, con su redacción exacta.
export const DATA_PROTECTION_NOTICES = [
  'El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley Nº 25.326.',
  'La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley Nº 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.',
];

export type LegalDocumentKey = keyof typeof LEGAL_DOCUMENTS;

// Lo que acepta quien se registra: quien organiza también compra.
export function legalDocumentsFor(isOrganizer: boolean): LegalDocumentKey[] {
  return isOrganizer
    ? ['TERMS', 'ORGANIZER_TERMS', 'PRIVACY']
    : ['TERMS', 'PRIVACY'];
}

// Las versiones aceptadas, como las pide el registro.
export function acceptedLegalVersions(isOrganizer: boolean) {
  return {
    termsVersion: LEGAL_DOCUMENTS.TERMS.version,
    privacyVersion: LEGAL_DOCUMENTS.PRIVACY.version,
    ...(isOrganizer && {
      organizerTermsVersion: LEGAL_DOCUMENTS.ORGANIZER_TERMS.version,
    }),
  };
}
