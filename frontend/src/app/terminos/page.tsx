import LegalPage from '@/components/legal/LegalPage';
import { TERMS_TEXT } from '@/components/legal/terms-text';

export default function TerminosPage() {
  return <LegalPage document="TERMS" text={TERMS_TEXT} />;
}
