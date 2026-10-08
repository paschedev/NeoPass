'use client';

import AdminEvents from '@/components/admin/AdminEvents';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { isAdmin } from '@/utils/roles';

// Panel de NeoPass, solo para la cuenta ADMIN. Ocultarlo es solo UX: el
// backend le responde 403 a cualquier otra cuenta.
export default function AdminPage() {
  const { user, ready } = useCurrentUser();
  if (!ready) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 pt-8 md:pt-12 pb-24 md:pb-12">
      <h1 className="font-outfit text-3xl font-bold mb-8">Administración</h1>
      {isAdmin(user) ? (
        <AdminEvents />
      ) : (
        <p className="text-neutral-400">No tenés acceso a esta sección.</p>
      )}
    </div>
  );
}
