'use client';

import { usePathname } from 'next/navigation';
import GlobalSidebar from './GlobalSidebar';
import toast from 'react-hot-toast';
import { showsAppNav } from '@/utils/navigation';

// Evitar múltiples popups iguales o spam de popups aplicando un ID global
if (typeof window !== 'undefined') {
  const originalError = toast.error;
  toast.error = (msg: any, opts?: any) =>
    originalError(msg, {
      id: typeof msg === 'string' ? msg : 'global-error',
      ...opts,
    });

  const originalSuccess = toast.success;
  toast.success = (msg: any, opts?: any) =>
    originalSuccess(msg, {
      id: typeof msg === 'string' ? msg : 'global-success',
      ...opts,
    });
}

export default function ClientLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (!showsAppNav(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] pt-16 bg-neutral-950 text-neutral-50 relative">
      <GlobalSidebar />
      <div className="flex-1 flex flex-col relative w-full">
        <main className="flex-1 relative w-full">{children}</main>
      </div>
    </div>
  );
}
