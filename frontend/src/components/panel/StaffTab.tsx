'use client';

import { motion } from 'framer-motion';
import { UserPlus, Users } from 'lucide-react';
import type { StaffMember } from './types';

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  ACCEPTED: {
    label: 'ACTIVO',
    className: 'bg-emerald-500/20 text-emerald-300',
  },
  PENDING: { label: 'PENDIENTE', className: 'bg-amber-500/20 text-amber-300' },
  REJECTED: { label: 'RECHAZADO', className: 'bg-red-500/20 text-red-300' },
};

// Pestaña "Staff & RPPs" del panel del organizador.
export default function StaffTab({
  staff,
  loading,
  onInvite,
}: {
  staff: StaffMember[];
  loading: boolean;
  onInvite: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="bg-neutral-900 border border-white/5 rounded-3xl p-8 shadow-2xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="font-outfit text-2xl font-bold">
              Gestión de Staff y RPPs
            </h2>
            <p className="text-sm text-neutral-400">
              Invita Scanners y Promotores a tus eventos.
            </p>
          </div>
          <button
            onClick={onInvite}
            className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" /> Enviar Invitación
          </button>
        </div>

        <div className="w-full">
          {loading ? (
            <div className="text-center py-12 text-neutral-500">
              Cargando staff...
            </div>
          ) : staff.length === 0 ? (
            <div className="text-center py-12 bg-white/[0.02] rounded-2xl border border-white/5 border-dashed">
              <Users className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-neutral-400 mb-2">
                No tienes staff asignado
              </h3>
              <p className="text-sm text-neutral-500">
                Haz click en &quot;Enviar Invitación&quot; para agregar Scanners
                o Promotores a tus eventos.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {staff.map((member) => {
                const status =
                  STATUS_STYLES[member.status] ?? STATUS_STYLES.REJECTED;
                return (
                  <div
                    key={member.id}
                    className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-4 gap-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-full shrink-0 bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-sm text-white">
                          {member.user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-white text-sm truncate">
                            {member.user.name}
                          </h4>
                          <p className="text-xs text-neutral-400 truncate">
                            {member.user.email}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 px-2 py-1 rounded-md text-[10px] font-bold tracking-wider ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-neutral-500">Rol</span>
                        <span className="font-semibold text-indigo-300">
                          {member.role}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm items-center gap-2">
                        <span className="text-neutral-500">Evento</span>
                        <span className="text-white truncate">
                          {member.event.title}
                        </span>
                      </div>
                      {member.role === 'PROMOTER' && (
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-500">Comisión</span>
                          <span className="text-emerald-400 font-medium">
                            {member.commissionType === 'PERCENTAGE'
                              ? `${member.commissionValue}%`
                              : `$${member.commissionValue}`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
