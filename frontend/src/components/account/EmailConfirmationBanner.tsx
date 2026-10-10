'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MailWarning } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';

// Aviso del panel mientras el correo de la cuenta no esté confirmado. Nada se
// bloquea sin confirmar: solo invita a hacerlo desde Configuración.
export default function EmailConfirmationBanner() {
  const { user, refresh } = useCurrentUser();
  const pathname = usePathname();
  // Las sesiones guardadas antes de que existiera la confirmación no lo
  // saben: se trae el perfil una vez.
  const unknown = !!user && user.emailVerified === undefined;

  useEffect(() => {
    if (unknown) void refresh();
  }, [unknown, refresh]);

  if (user?.emailVerified !== false || pathname === '/panel/configuracion') {
    return null;
  }

  return (
    <div
      role="status"
      className="mx-4 md:mx-8 mt-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
    >
      <MailWarning className="hidden sm:block w-5 h-5 shrink-0 text-amber-400" />
      <p className="flex-1">
        Confirmá tu correo para asegurarte de recibir tus entradas y poder
        recuperar tu cuenta.
      </p>
      <Link
        href="/panel/configuracion#correo"
        className="self-start sm:self-auto rounded-xl bg-amber-500/20 px-4 py-2 font-medium text-amber-100 hover:bg-amber-500/30 transition-colors"
      >
        Confirmar
      </Link>
    </div>
  );
}
