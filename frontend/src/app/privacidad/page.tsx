import type { Metadata } from 'next';
import LegalPage from '@/components/legal/LegalPage';
import { PRIVACY_TEXT } from '@/components/legal/privacy-text';
import { LEGAL_DOCUMENTS } from '@/utils/legal';

export const metadata: Metadata = {
  title: LEGAL_DOCUMENTS.PRIVACY.title,
};

export default function PrivacidadPage() {
  return <LegalPage document="PRIVACY" text={PRIVACY_TEXT} />;
}
