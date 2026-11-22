'use client';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import MercadoPagoSection from '@/components/settings/MercadoPagoSection';
import PresetsLinkSection from '@/components/settings/PresetsLinkSection';

// Pestaña "Ajustes" del panel del organizador: la misma lista que
// Configuración, con las filas que tocan a quien organiza.
export default function SettingsTab() {
  const { user } = useCurrentUser();

  return (
    <section aria-labelledby="ajustes-organizador">
      <h2
        id="ajustes-organizador"
        className="font-outfit text-2xl font-bold text-white"
      >
        Ajustes del organizador
      </h2>
      <p className="mt-1 mb-6 text-sm text-neutral-400">
        La cuenta donde cobrás y tus plantillas de entradas.
      </p>

      <div className="bg-white/[0.02] border border-white/10 rounded-2xl divide-y divide-white/10">
        <MercadoPagoSection linked={!!user?.hasLinkedMp} />
        <PresetsLinkSection />
      </div>
    </section>
  );
}
