import LegalPage from '@/components/legal/LegalPage';
import { ORGANIZER_TERMS_TEXT } from '@/components/legal/organizer-terms-text';

export default function TerminosOrganizadoresPage() {
  return <LegalPage document="ORGANIZER_TERMS" text={ORGANIZER_TERMS_TEXT} />;
}
