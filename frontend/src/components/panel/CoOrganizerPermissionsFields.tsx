'use client';

import { useId } from 'react';
import {
  PERMISSION_OPTIONS,
  togglePermission,
  type EventPermission,
} from '@/utils/co-organizers';

// Qué puede hacer un co-organizador, al invitarlo o al cambiarle los permisos.
// Escanear lo puede hacer siempre.
export default function CoOrganizerPermissionsFields({
  permissions,
  onPermissionsChange,
  freeTicketLimit,
  onFreeTicketLimitChange,
}: {
  permissions: EventPermission[];
  onPermissionsChange: (permissions: EventPermission[]) => void;
  freeTicketLimit: string;
  onFreeTicketLimitChange: (limit: string) => void;
}) {
  const limitId = useId();

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm text-neutral-400 mb-2">
        Siempre puede escanear. Además:
      </legend>
      {PERMISSION_OPTIONS.map((option) => (
        <label
          key={option.value}
          className="flex items-start gap-3 cursor-pointer"
        >
          <input
            type="checkbox"
            checked={permissions.includes(option.value)}
            onChange={() =>
              onPermissionsChange(togglePermission(permissions, option.value))
            }
            className="mt-1 w-4 h-4 accent-indigo-500"
          />
          <span>
            <span className="block text-sm font-medium text-white">
              {option.label}
            </span>
            <span className="block text-xs text-neutral-500">
              {option.description}
            </span>
          </span>
        </label>
      ))}
      {permissions.includes('SEND_FREE_TICKETS') && (
        <div className="pl-7">
          <label
            htmlFor={limitId}
            className="block text-xs font-medium text-neutral-400 mb-1"
          >
            Tope de QR free (opcional)
          </label>
          <input
            id={limitId}
            type="text"
            inputMode="numeric"
            value={freeTicketLimit}
            onChange={(e) => onFreeTicketLimitChange(e.target.value)}
            placeholder="Sin tope"
            className="w-32 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      )}
    </fieldset>
  );
}
