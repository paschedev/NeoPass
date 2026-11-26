import type { Metadata } from 'next';
import LegalPage from '@/components/legal/LegalPage';
import { ORGANIZER_TERMS_TEXT } from '@/components/legal/organizer-terms-text';
import { LEGAL_DOCUMENTS } from '@/utils/legal';

export const metadata: Metadata = {
  title: LEGAL_DOCUMENTS.ORGANIZER_TERMS.title,
};

export default function TerminosOrganizadoresPage() {
  return <LegalPage document="ORGANIZER_TERMS" text={ORGANIZER_TERMS_TEXT} />;
}
