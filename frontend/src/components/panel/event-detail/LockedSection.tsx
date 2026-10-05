import { Lock } from 'lucide-react';
import {
  permissionDeniedMessage,
  type EventPermission,
} from '@/utils/co-organizers';

// Una sección del detalle que el co-organizador no tiene permitida: se ve que
// existe, sin sus datos (ni siquiera se piden).
export default function LockedSection({
  title,
  permission,
}: {
  title: string;
  permission: EventPermission;
}) {
  return (
    <section aria-label={title} className="space-y-3">
      <h2 className="text-xl font-bold text-neutral-500">{title}</h2>
      <p className="flex items-center gap-2 text-sm text-neutral-500 bg-white/[0.03] border border-white/5 rounded-2xl px-4 py-3">
        <Lock className="w-4 h-4 shrink-0" />
        {permissionDeniedMessage(permission)}. Si lo necesitás, pedíselo a
        quien organiza el evento.
      </p>
    </section>
  );
}
