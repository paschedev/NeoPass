'use client';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { isOrganizer } from '@/utils/roles';
import EmailSection from '@/components/settings/EmailSection';
import PasswordSection from '@/components/settings/PasswordSection';
import MercadoPagoSection from '@/components/settings/MercadoPagoSection';
import PresetsLinkSection from '@/components/settings/PresetsLinkSection';

export default function ConfiguracionPage() {
  const { user } = useCurrentUser();

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-0 pt-6 pb-24 md:py-12">
      <h1 className="font-outfit text-3xl font-bold text-white mb-8">
        Configuración
      </h1>

      <EmailSection />
      <PasswordSection />

      {isOrganizer(user) && (
        <>
          <MercadoPagoSection linked={!!user?.hasLinkedMp} />
          <PresetsLinkSection />
        </>
      )}
    </div>
  );
}
