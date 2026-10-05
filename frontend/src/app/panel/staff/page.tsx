'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MyStaffEvents from '@/components/staff/MyStaffEvents';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getHomePath } from '@/utils/navigation';
import { canSeeStaffPanel } from '@/utils/roles';

// Staff: los eventos donde trabajás como RPP, scanner o co-organizador. Reemplaza al
// Panel RPP; el detalle de ventas de cada evento sigue en /panel/rpp/:id.
export default function StaffPage() {
  const router = useRouter();
  const { user, ready } = useCurrentUser();
  const allowed = canSeeStaffPanel(user);

  useEffect(() => {
    if (ready && user && !allowed) router.replace(getHomePath(user));
  }, [ready, user, allowed, router]);

  if (!allowed) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 pt-8 pb-24 md:pb-12">
      <div className="mb-8">
        <h1 className="font-outfit text-4xl font-bold text-white mb-2">
          Tus eventos como staff
        </h1>
        <p className="text-neutral-400">
          Dónde trabajás como RPP, scanner o co-organizador.
        </p>
      </div>
      <MyStaffEvents />
    </div>
  );
}
