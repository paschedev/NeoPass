'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, X, Trash2, CheckCircle2, CheckCheck } from 'lucide-react';
import toast from '@/utils/toast';
import { useNotificationFeed } from '@/hooks/useNotificationFeed';
import { useStaffInvitation } from '@/hooks/useStaffInvitation';
import { NoticeIcon } from '@/components/notifications/NoticeIcon';
import { NoticeLink } from '@/components/notifications/NoticeLink';
import { noticeTime, pendingInvitationStaffId } from '@/utils/notifications';

const PAGE_SIZE = 20;

export default function NotificacionesPage() {
  const [showOnlyRequests, setShowOnlyRequests] = useState(false);
  const feed = useNotificationFeed({
    limit: PAGE_SIZE,
    onlyRequests: showOnlyRequests,
  });
  const { reload } = feed;
  const { processingIds, respond } = useStaffInvitation();

  useEffect(() => {
    void reload();
  }, [reload]);

  const markAsRead = async (id: string) => {
    if (!(await feed.markAsRead(id))) {
      toast.error('Error al actualizar notificación');
    }
  };

  const markAllAsRead = async () => {
    if (await feed.markAllAsRead()) {
      toast.success('Todas marcadas como leídas');
    } else {
      toast.error('Error al actualizar');
    }
  };

  const deleteNotification = async (id: string) => {
    if (!(await feed.remove(id))) toast.error('Error al eliminar');
  };

  const handleRequest = async (
    id: string,
    action: 'accept' | 'reject',
    eventStaffId: string,
  ) => {
    const outcome = await respond(eventStaffId, action, id);
    if (outcome === 'done') {
      toast.success(
        `Invitación ${action === 'accept' ? 'aceptada' : 'rechazada'}`,
      );
      feed.markAnswered(id, action === 'accept' ? 'ACCEPTED' : 'REJECTED');
    } else if (outcome === 'already-processed') {
      await feed.reload();
    }
  };

  const isEmpty = feed.items.length === 0 && !feed.loading && !feed.failed;

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
              role="switch"
              aria-checked={showOnlyRequests}
              aria-label="Solo solicitudes"
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
              Solo solicitudes
            </span>
          </div>

          {feed.unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center justify-center w-10 h-10 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 rounded-xl transition-colors border border-indigo-500/20 shrink-0"
              title="Marcar todas como leídas"
              aria-label="Marcar todas como leídas"
            >
              <CheckCheck className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4 relative">
        <AnimatePresence mode="popLayout">
          {feed.items.map((n) => {
            const invitedStaffId = pendingInvitationStaffId(n);
            return (
              <motion.div
                key={n.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{
                  opacity: 0,
                  scale: 0.95,
                  transition: { duration: 0.2 },
                }}
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
                  <NoticeIcon type={n.type} />

                  <div className="flex-1 min-w-0">
                    <NoticeLink
                      notice={n}
                      onOpen={() => void feed.markAsRead(n.id)}
                    >
                      <h3
                        className={`font-semibold ${n.isRead ? 'text-neutral-300' : 'text-white'}`}
                      >
                        {n.title}
                      </h3>
                      <p className="text-sm text-neutral-400 mt-1">
                        {n.message}
                      </p>
                    </NoticeLink>

                    {invitedStaffId && (
                      <InviteActions
                        disabled={processingIds.has(invitedStaffId)}
                        onAnswer={(action) =>
                          handleRequest(n.id, action, invitedStaffId)
                        }
                      />
                    )}

                    {n.type === 'STAFF_INVITE' &&
                      n.metadata?.status !== 'PENDING' && (
                        <InviteStatusBadge
                          status={n.metadata?.status}
                          className="sm:hidden w-fit mt-3"
                        />
                      )}

                    <span className="text-xs text-neutral-500 mt-3 block">
                      {noticeTime(n).toLocaleString()}
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
                          aria-label="Marcar como leída"
                          className="p-2 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-xl transition-colors"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(n.id)}
                        title="Eliminar"
                        aria-label="Eliminar"
                        className="p-2 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors md:opacity-0 md:group-hover:opacity-100"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {feed.hasMore && (
          <button
            onClick={() => void feed.loadMore()}
            disabled={feed.loading}
            className="w-full py-3 rounded-2xl border border-white/10 bg-white/[0.02] text-sm font-medium text-neutral-300 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50"
          >
            Cargar más
          </button>
        )}

        {feed.failed && (
          <div className="w-full text-center py-10 bg-white/[0.01] border border-white/5 rounded-3xl">
            <p className="text-neutral-400 font-medium mb-4">
              No pudimos cargar tus avisos.
            </p>
            <button
              onClick={() => void feed.reload()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              Reintentar
            </button>
          </div>
        )}

        <AnimatePresence>
          {isEmpty && (
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

function InviteActions({
  disabled,
  onAnswer,
}: {
  disabled: boolean;
  onAnswer: (action: 'accept' | 'reject') => void;
}) {
  return (
    <div className="flex gap-2 mt-4 w-full sm:w-auto">
      <button
        disabled={disabled}
        onClick={() => onAnswer('accept')}
        className="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
      >
        <Check className="w-4 h-4" /> Aceptar
      </button>
      <button
        disabled={disabled}
        onClick={() => onAnswer('reject')}
        className="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-white/5 hover:bg-white/10 text-neutral-300 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
      >
        <X className="w-4 h-4" /> Rechazar
      </button>
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
