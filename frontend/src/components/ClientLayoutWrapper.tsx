'use client';

import { usePathname } from 'next/navigation';
import GlobalSidebar from './GlobalSidebar';
import { showsAppNav } from '@/utils/navigation';

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
