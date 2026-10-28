import LegalPage from '@/components/legal/LegalPage';
import { PRIVACY_TEXT } from '@/components/legal/privacy-text';

export default function PrivacidadPage() {
  return <LegalPage document="PRIVACY" text={PRIVACY_TEXT} />;
}
