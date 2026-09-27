'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Check,
  X,
  Trash2,
  CheckCircle2,
  UserPlus,
  Zap,
  Lock,
  DollarSign,
  Gift,
  CheckCheck,
} from 'lucide-react';
import { apiFetch } from '@/utils/api';
import toast from 'react-hot-toast';
import { useStaffInvitation } from '@/hooks/useStaffInvitation';

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  metadata?: any;
};

export default function NotificacionesPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showOnlyRequests, setShowOnlyRequests] = useState(false);
  const { processingIds, respond } = useStaffInvitation();

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await apiFetch('/notifications');
      if (res.ok) {
        setNotifications(await res.json());
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const filteredNotifications = notifications.filter((n) =>
    showOnlyRequests ? n.type === 'STAFF_INVITE' : true,
  );

  const markAsRead = async (id: string) => {
    try {
      const res = await apiFetch(`/notifications/${id}/read`, {
        method: 'PUT',
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
        );
      }
    } catch (e) {
      toast.error('Error al actualizar notificación');
    }
  };

  const markAllAsRead = async () => {
    try {
      const res = await apiFetch(`/notifications/read-all`, { method: 'PUT' });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        toast.success('Todas marcadas como leídas');
      }
    } catch (e) {
      toast.error('Error al actualizar');
    }
  };

  const deleteNotification = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await apiFetch(`/notifications/${id}`, { method: 'DELETE' });
    } catch (e) {
      toast.error('Error al eliminar');
      fetchNotifications(); // Rollback en caso de error
    }
  };

  const handleRequest = async (
    id: string,
    action: 'accept' | 'reject',
    eventStaffId: string,
  ) => {
    const outcome = await respond(id, eventStaffId, action);
    if (outcome === 'done') {
      toast.success(
        `Invitación ${action === 'accept' ? 'aceptada' : 'rechazada'}`,
      );
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id
            ? {
                ...n,
                isRead: true,
                metadata: {
                  ...n.metadata,
                  status: action === 'accept' ? 'ACCEPTED' : 'REJECTED',
                },
              }
            : n,
        ),
      );
    } else if (outcome === 'already-processed') {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="font-outfit text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <Bell className="w-8 h-8 text-indigo-400" />
            Notificaciones
          </h1>
          <p className="text-neutral-400">
            Historial completo y solicitudes pendientes.
          </p>
        </div>

        {/* Controles: Toggle + Mark All As Read */}
        <div className="flex w-full justify-between items-center gap-4">
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-2 rounded-2xl shrink-0">
            <span
              className={`text-sm font-medium ${!showOnlyRequests ? 'text-white' : 'text-neutral-500'}`}
            >
              Todas
            </span>
            <button
              onClick={() => setShowOnlyRequests(!showOnlyRequests)}
              className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${showOnlyRequests ? 'bg-purple-600' : 'bg-neutral-600'}`}
            >
              <motion.div
                className="w-4 h-4 bg-white rounded-full shadow-md"
                animate={{ x: showOnlyRequests ? 24 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
            <span
              className={`text-sm font-medium ${showOnlyRequests ? 'text-purple-300' : 'text-neutral-500'}`}
            >
              Solo Solicitudes
            </span>
          </div>

          {notifications.some((n) => !n.isRead) && (
            <button
              onClick={markAllAsRead}
              className="flex items-center justify-center w-10 h-10 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 rounded-xl transition-colors border border-indigo-500/20 shrink-0"
              title="Marcar todas como leídas"
            >
              <CheckCheck className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4 relative">
        <AnimatePresence mode="popLayout">
          {filteredNotifications.map((n) => (
            <motion.div
              key={n.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              className={`w-full p-5 rounded-2xl border transition-colors relative overflow-hidden group ${
                n.isRead
                  ? 'bg-white/[0.02] border-white/5'
                  : 'bg-black/40 border-white/10 shadow-lg'
              }`}
            >
              {!n.isRead && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />
              )}

              <div className="flex gap-3 sm:gap-4 relative">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    n.type === 'STAFF_INVITE'
                      ? 'bg-purple-500/20 text-purple-400'
                      : n.type === 'PROMOTER_SALE'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-blue-500/20 text-blue-400'
                  }`}
                >
                  {n.type === 'STAFF_INVITE' ? (
                    <Lock className="w-5 h-5" />
                  ) : n.type === 'PROMOTER_SALE' ? (
                    <DollarSign className="w-5 h-5" />
                  ) : (
                    <Bell className="w-5 h-5" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3
                    className={`font-semibold ${n.isRead ? 'text-neutral-300' : 'text-white'}`}
                  >
                    {n.title}
                  </h3>
                  <p className="text-sm text-neutral-400 mt-1">{n.message}</p>

                  {n.type === 'STAFF_INVITE' &&
                    n.metadata?.status === 'PENDING' && (
                      <div className="flex gap-2 mt-4 w-full sm:w-auto">
                        <button
                          disabled={processingIds.has(n.id)}
                          onClick={() =>
                            handleRequest(
                              n.id,
                              'accept',
                              n.metadata.eventStaffId,
                            )
                          }
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" /> Aceptar
                        </button>
                        <button
                          disabled={processingIds.has(n.id)}
                          onClick={() =>
                            handleRequest(
                              n.id,
                              'reject',
                              n.metadata.eventStaffId,
                            )
                          }
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-neutral-300 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          <X className="w-4 h-4" /> Rechazar
                        </button>
                      </div>
                    )}

                  {n.type === 'STAFF_INVITE' &&
                    n.metadata?.status !== 'PENDING' && (
                      <InviteStatusBadge
                        status={n.metadata?.status}
                        className="sm:hidden w-fit mt-3"
                      />
                    )}

                  <span className="text-xs text-neutral-500 mt-3 block">
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                </div>

                <div className="shrink-0 flex flex-col items-end gap-2">
                  {n.type === 'STAFF_INVITE' &&
                    n.metadata?.status !== 'PENDING' && (
                      <InviteStatusBadge
                        status={n.metadata?.status}
                        className="hidden sm:block"
                      />
                    )}

                  <div className="flex items-center gap-1">
                    {!n.isRead && (
                      <button
                        onClick={() => markAsRead(n.id)}
                        title="Marcar como leída"
                        className="p-2 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-xl transition-colors"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(n.id)}
                      title="Eliminar"
                      className="p-2 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors md:opacity-0 md:group-hover:opacity-100"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {filteredNotifications.length === 0 && (
            <motion.div
              key="empty-state"
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                transition: { delay: 0.3, duration: 0.4 },
              }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              className="w-full text-center py-20 bg-white/[0.01] border border-white/5 rounded-3xl mt-4"
            >
              <Bell className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
              <p className="text-neutral-500 font-medium">
                No hay notificaciones para mostrar.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Estado de una invitación ya respondida. En mobile va dentro del contenido para
// no pisar el título; desde sm, en la columna de acciones.
function InviteStatusBadge({
  status,
  className,
}: {
  status?: string;
  className: string;
}) {
  return (
    <div
      className={`px-3 py-1 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-neutral-400 ${className}`}
    >
      {status === 'ACCEPTED' ? '✓ Aceptada' : '× Rechazada'}
    </div>
  );
}
