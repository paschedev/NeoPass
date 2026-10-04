import type { ReactNode } from 'react';

const INVITATION_CHIPS: Record<string, { label: string; className: string }> =
  {
    PENDING: { label: 'Pendiente', className: 'bg-amber-500/15 text-amber-300' },
    REJECTED: { label: 'Rechazó', className: 'bg-red-500/15 text-red-300' },
  };

// Etiqueta de una invitación sin aceptar; un integrante activo no la lleva.
export function InvitationChip({ status }: { status: string }) {
  const chip = INVITATION_CHIPS[status];
  if (!chip) return null;
  return (
    <span
      className={`shrink-0 px-2 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase ${chip.className}`}
    >
      {chip.label}
    </span>
  );
}

// Avatar, nombre y email de alguien del staff, con algo opcional a la derecha.
export default function StaffIdentity({
  name,
  email,
  aside,
}: {
  name: string;
  email: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div
        aria-hidden="true"
        className="w-9 h-9 rounded-full shrink-0 bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-sm text-white"
      >
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-white text-sm truncate">{name}</p>
        <p className="text-xs text-neutral-400 truncate">{email}</p>
      </div>
      {aside}
    </div>
  );
}
