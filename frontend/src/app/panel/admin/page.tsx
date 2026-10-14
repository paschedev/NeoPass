'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, Ticket } from 'lucide-react';
import AdminEvents from '@/components/admin/AdminEvents';
import AdminTickets from '@/components/admin/AdminTickets';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { adminPanelUrl, type AdminTab } from '@/utils/admin-panel';
import { isAdmin } from '@/utils/roles';

const TABS = [
  { id: 'eventos', label: 'Eventos', icon: Calendar },
  { id: 'tickets', label: 'Tickets', icon: Ticket },
] as const;

// La pestaña y la búsqueda salen de la URL, así el botón de atrás vuelve a
// la anterior.
function AdminSections() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab: AdminTab =
    searchParams.get('tab') === 'tickets' ? 'tickets' : 'eventos';
  const search = searchParams.get('q') ?? '';
  const onSearch = (q: string) =>
    router.push(adminPanelUrl(tab, q), { scroll: false });

  return (
    <>
      <nav
        aria-label="Secciones de administración"
        className="flex w-full bg-white/[0.02] border border-white/5 p-1 rounded-2xl mb-8"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <Link
            key={id}
            href={adminPanelUrl(id, '')}
            aria-current={tab === id ? 'page' : undefined}
            className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl flex-1 text-sm font-medium transition-all ${
              tab === id
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-neutral-500 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {tab === 'tickets' ? (
        <AdminTickets search={search} onSearch={onSearch} />
      ) : (
        <AdminEvents search={search} onSearch={onSearch} />
      )}
    </>
  );
}

// Panel de NeoPass, solo para la cuenta ADMIN. Ocultarlo es solo UX: el
// backend le responde 403 a cualquier otra cuenta.
export default function AdminPage() {
  const { user, ready } = useCurrentUser();
  if (!ready) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 pt-8 md:pt-12 pb-24 md:pb-12">
      <h1 className="font-outfit text-3xl font-bold mb-8">Administración</h1>
      {isAdmin(user) ? (
        <Suspense fallback={null}>
          <AdminSections />
        </Suspense>
      ) : (
        <p className="text-neutral-400">No tenés acceso a esta sección.</p>
      )}
    </div>
  );
}
