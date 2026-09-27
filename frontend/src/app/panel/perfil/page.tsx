'use client';

import { User as UserIcon, Mail, ShieldCheck } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function PerfilPage() {
  const { user } = useCurrentUser();

  if (!user)
    return <div className="p-8 text-neutral-400">Cargando perfil...</div>;

  return (
    <div className="max-w-4xl mx-auto pt-8 pb-24 md:py-8 px-4 md:px-8">
      <div className="mb-8">
        <h1 className="font-outfit text-4xl font-bold text-white mb-2">
          Mi Perfil
        </h1>
        <p className="text-neutral-400">Gestiona tu información personal.</p>
      </div>

      <div className="bg-neutral-900 border border-white/5 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-5xl border-4 border-neutral-900 shadow-xl relative z-10 shrink-0">
          {user.name.charAt(0)}
        </div>

        <div className="relative z-10 flex-1 w-full space-y-4">
          <div>
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-2 mb-1">
              <UserIcon className="w-3 h-3" /> Nombre Completo
            </label>
            <div className="text-xl font-medium text-white">{user.name}</div>
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-2 mb-1">
              <Mail className="w-3 h-3" /> Correo Electrónico
            </label>
            <div className="text-lg text-neutral-300">{user.email}</div>
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-2 mb-1">
              <ShieldCheck className="w-3 h-3" /> Tipo de Cuenta
            </label>
            <div className="inline-block px-3 py-1 bg-white/10 text-white text-sm rounded-lg font-medium border border-white/5">
              {user.role === 'ORGANIZER'
                ? 'Organizador de Eventos'
                : 'Usuario Estandar'}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center text-sm text-neutral-500">
        Próximamente podrás editar todos tus datos desde aquí.
      </div>
    </div>
  );
}
