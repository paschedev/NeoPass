'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, ready } = useCurrentUser();

  useEffect(() => {
    if (ready && !user) router.replace('/login');
  }, [ready, user, router]);

  if (!user) {
    return (
      <div className="h-full bg-neutral-950 flex items-center justify-center text-white">
        Verificando accesos...
      </div>
    );
  }

  return <>{children}</>;
}
