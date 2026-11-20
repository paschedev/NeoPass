'use client';

import { CheckCircle2, Link2 } from 'lucide-react';
import toast from '@/utils/toast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { isGoogleEnabled } from '@/utils/google-sign-in';
import ConnectGoogle from '@/components/auth/ConnectGoogle';

// "Cuenta de Google" en Configuración. Sin Google configurado no aparece.
export default function GoogleSection() {
  const { user } = useCurrentUser();
  if (!isGoogleEnabled() || !user) return null;

  return (
    <section className="p-6 md:p-8">
      <div className="flex items-center gap-4 mb-6">
        <Link2
          aria-hidden="true"
          className="w-5 h-5 shrink-0 text-neutral-400"
        />
        <div>
          <h2 className="text-lg font-bold text-white">Cuenta de Google</h2>
          <p className="text-neutral-400 text-sm">
            {user.hasGoogle
              ? 'Entrás con el botón Continuar con Google'
              : `Conectá la cuenta de Google de ${user.email} para entrar con un toque`}
          </p>
        </div>
      </div>

      {user.hasGoogle ? (
        <p className="flex items-center gap-2 text-sm text-emerald-400">
          <CheckCircle2 className="w-4 h-4" /> Conectada
        </p>
      ) : (
        <div className="max-w-sm">
          <ConnectGoogle
            onConnected={() => toast.success('Conectaste tu cuenta de Google')}
          />
        </div>
      )}
    </section>
  );
}
