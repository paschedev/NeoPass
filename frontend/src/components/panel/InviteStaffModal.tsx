'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Search, UserPlus, X } from 'lucide-react';
import CustomSelect from '@/components/CustomSelect';
import Modal from '@/components/ui/Modal';
import { useUserSearch, type UserSearchResult } from '@/hooks/useUserSearch';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import {
  MAX_INVITEES,
  buildInvitationPayload,
  normalizeCommission,
  sanitizeCommissionInput,
  validateInvitation,
  type CommissionType,
  type InviteRole,
} from '@/utils/staff-invitation';

// Invita a varios usuarios a un evento como scanner o RPP.
export default function InviteStaffModal({
  open,
  onClose,
  events,
  onInvited,
}: {
  open: boolean;
  onClose: () => void;
  events: { id: string; title: string }[];
  onInvited: () => void;
}) {
  const [eventId, setEventId] = useState('');
  const [role, setRole] = useState<InviteRole>('SCANNER');
  const [commissionType, setCommissionType] =
    useState<CommissionType>('PERCENTAGE');
  const [commissionValue, setCommissionValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<UserSearchResult[]>([]);
  const [sending, setSending] = useState(false);
  const searchResults = useUserSearch(searchTerm);

  const handleSend = async () => {
    const error = validateInvitation({
      eventId,
      userCount: selectedUsers.length,
      role,
      commissionType,
      commissionValue,
    });
    if (error) return toast.error(error);

    setSending(true);
    let sent = 0;
    for (const user of selectedUsers) {
      try {
        const res = await apiFetch(`/events/${eventId}/staff`, {
          method: 'POST',
          body: JSON.stringify(
            buildInvitationPayload(
              user.id,
              role,
              commissionType,
              commissionValue,
            ),
          ),
        });
        if (res.ok) {
          sent++;
        } else {
          toast.error(
            getApiErrorMessage(
              await res.json().catch(() => null),
              `No se pudo invitar a ${user.name}`,
            ),
          );
        }
      } catch {
        toast.error(`Error de red al invitar a ${user.name}`);
      }
    }
    setSending(false);

    if (sent > 0) {
      toast.success(`Se enviaron ${sent} invitaciones correctamente`);
      onInvited();
    }
    setSelectedUsers([]);
    setRole('SCANNER');
    setCommissionValue('');
    setSearchTerm('');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="invite-staff-title"
      className="bg-neutral-900 border border-white/10 p-6 md:p-8 rounded-3xl w-full max-w-lg relative shadow-2xl overflow-y-auto overscroll-contain max-h-[90vh]"
    >
      <button
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute top-6 right-6 text-neutral-500 hover:text-white transition-colors bg-white/5 p-2 rounded-full hover:bg-white/10"
      >
        <X className="w-5 h-5" />
      </button>

      <h2
        id="invite-staff-title"
        className="text-2xl font-bold mb-6 flex items-center gap-2"
      >
        <UserPlus className="w-6 h-6 text-indigo-400" />
        Invitar Staff / RPP
      </h2>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-neutral-400 mb-2">
            1. Seleccionar Evento
          </label>
          <CustomSelect
            value={eventId}
            onChange={setEventId}
            options={events.map((event) => ({
              value: event.id,
              label: event.title,
            }))}
            placeholder="Elegir un evento..."
          />
        </div>

        <div className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-4">
          <label className="block text-sm font-medium text-neutral-400">
            2. Rol y Configuración (Para todos los invitados)
          </label>

          <div className="flex bg-black/40 rounded-lg p-1">
            {(['SCANNER', 'RPP'] as const).map((option) => (
              <button
                key={option}
                onClick={() => setRole(option)}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${role === option ? 'bg-indigo-600 text-white shadow-sm' : 'text-neutral-400 hover:text-white'}`}
              >
                {option}
              </button>
            ))}
          </div>

          {role === 'RPP' && (
            <div className="flex items-center gap-3">
              <div className="flex bg-black/40 rounded-lg p-1 w-1/3">
                {(
                  [
                    ['PERCENTAGE', '%'],
                    ['FIXED', '$'],
                  ] as const
                ).map(([type, label]) => (
                  <button
                    key={type}
                    onClick={() => setCommissionType(type)}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${commissionType === type ? 'bg-white/10 text-white' : 'text-neutral-500'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  inputMode="decimal"
                  value={commissionValue}
                  onChange={(e) => {
                    const next = sanitizeCommissionInput(
                      e.target.value,
                      commissionType,
                    );
                    if (next !== null) setCommissionValue(next);
                  }}
                  onBlur={() =>
                    setCommissionValue(
                      normalizeCommission(commissionValue, commissionType),
                    )
                  }
                  placeholder={
                    commissionType === 'PERCENTAGE' ? 'Ej: 15.0' : 'Ej: 1500'
                  }
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-400 mb-2">
            3. Buscar y agregar usuarios (Máx {MAX_INVITEES})
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o email..."
              disabled={selectedUsers.length >= MAX_INVITEES}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
            />

            {searchResults.length > 0 && (
              <div className="absolute bottom-full mb-2 left-0 right-0 bg-neutral-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-10 max-h-48 overflow-y-auto overscroll-contain">
                {searchResults.map((user) => {
                  const isSelected = selectedUsers.some(
                    (selected) => selected.id === user.id,
                  );
                  return (
                    <button
                      key={user.id}
                      disabled={isSelected}
                      onClick={() => {
                        setSelectedUsers([...selectedUsers, user]);
                        setSearchTerm('');
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed transition-colors border-b border-white/5 last:border-0"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0 uppercase">
                          {user.name.charAt(0)}
                        </div>
                        <div className="min-w-0 text-left">
                          <div className="text-white font-medium text-sm truncate">
                            {user.name}
                          </div>
                          <div className="text-neutral-400 text-xs truncate">
                            {user.email}
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-emerald-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {selectedUsers.length > 0 && (
          <div className="bg-black/30 rounded-xl border border-white/5 p-2 space-y-1 max-h-48 overflow-y-auto overscroll-contain">
            {selectedUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between bg-white/5 rounded-lg p-2 px-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-xs">
                    {user.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white leading-tight">
                      {user.name}
                    </div>
                    <div className="text-xs text-neutral-400">{user.email}</div>
                  </div>
                </div>
                <button
                  onClick={() =>
                    setSelectedUsers(
                      selectedUsers.filter(
                        (selected) => selected.id !== user.id,
                      ),
                    )
                  }
                  aria-label={`Quitar a ${user.name}`}
                  className="text-neutral-500 hover:text-red-400 p-1 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl font-medium text-neutral-400 hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={sending || selectedUsers.length === 0 || !eventId}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50"
          >
            {sending ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
