import type { Metadata } from 'next';
import LegalPage from '@/components/legal/LegalPage';
import { TERMS_TEXT } from '@/components/legal/terms-text';
import { LEGAL_DOCUMENTS } from '@/utils/legal';

export const metadata: Metadata = {
  title: LEGAL_DOCUMENTS.TERMS.title,
};

export default function TerminosPage() {
  return <LegalPage document="TERMS" text={TERMS_TEXT} />;
}
