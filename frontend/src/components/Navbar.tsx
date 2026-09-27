'use client';

import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import {
  Bell,
  LogOut,
  LayoutDashboard,
  User as UserIcon,
  HelpCircle,
  CheckCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useStaffInvitation } from '@/hooks/useStaffInvitation';

export default function Navbar() {
  const { user, logout } = useCurrentUser();
  const isLoggedIn = !!user;
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const pathname = usePathname();

  const [notifications, setNotifications] = useState<any[]>([]);
  const { processingIds, respond } = useStaffInvitation();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setShowNotifications(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node))
        setShowProfile(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isLoggedIn) fetchNotifications();
    // Cerrar modales al cambiar de ruta
    setShowProfile(false);
    setShowNotifications(false);
  }, [pathname, isLoggedIn]);

  const fetchNotifications = async () => {
    try {
      const { apiFetch } = await import('@/utils/api');
      const res = await apiFetch('/notifications');
      if (res.ok) {
        setNotifications(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch notifications');
    }
  };

  const handleStaffAction = async (
    eventStaffId: string,
    action: 'accept' | 'reject',
    notificationId: string,
  ) => {
    const outcome = await respond(notificationId, eventStaffId, action);
    if (outcome !== 'failed') {
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const { apiFetch } = await import('@/utils/api');
      await apiFetch('/notifications/read-all', { method: 'PUT' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (e) {
      console.error(e);
    }
  };

  const unreadNotifs = notifications.filter((n) => !n.isRead);
  const readNotifs = notifications.filter((n) => n.isRead);
  const displayNotifs = [...unreadNotifs];
  if (displayNotifs.length < 3) {
    displayNotifs.push(...readNotifs.slice(0, 3 - displayNotifs.length));
  }
  const finalDisplayNotifs = displayNotifs.slice(0, 3);

  return (
    <header className="fixed top-0 z-[100] w-full border-b border-white/5 bg-black/40 backdrop-blur-xl">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center">
          <Link
            href="/"
            className="hidden md:block font-outfit text-2xl font-black tracking-tighter text-white hover:opacity-80 transition-opacity"
          >
            Neo<span className="text-indigo-500">Pass</span>
          </Link>
          <div className="md:hidden font-outfit text-2xl font-black tracking-tighter text-white select-none">
            Neo<span className="text-indigo-500">Pass</span>
          </div>
        </div>

        <nav className="flex gap-4 items-center">
          <Link
            href="/eventos"
            className="hidden md:block text-sm font-medium text-neutral-400 hover:text-white transition-colors"
          >
            Descubrir Eventos
          </Link>
          {user && (
            <Link
              href="/panel"
              className="hidden md:block text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20"
            >
              Mi Panel
            </Link>
          )}
          <div className="hidden md:block w-px h-4 bg-white/10 mx-2" />

          {user ? (
            <div className="flex items-center gap-4 md:gap-6">
              {/* Notifications Bell */}
              {!pathname.includes('/panel/notificaciones') && (
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative p-2 text-neutral-400 hover:text-white transition-colors rounded-full hover:bg-white/5"
                  >
                    <Bell className="w-5 h-5" />
                    {notifications.filter((n) => !n.isRead).length > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-pink-500 rounded-full animate-pulse" />
                    )}
                  </button>

                  <AnimatePresence>
                    {showNotifications && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute -right-12 sm:right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden origin-top-right z-50"
                      >
                        <div className="p-4 border-b border-white/5 flex flex-col gap-3 bg-white/[0.02]">
                          <div className="flex justify-between items-center w-full">
                            <h3 className="font-semibold text-sm">
                              Notificaciones
                            </h3>
                            <div className="flex items-center gap-2">
                              {unreadNotifs.length > 0 && (
                                <span className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                                  {unreadNotifs.length} nuevas
                                </span>
                              )}
                              {notifications.length > 0 &&
                                unreadNotifs.length > 0 && (
                                  <button
                                    onClick={handleMarkAllAsRead}
                                    className="text-neutral-400 hover:text-white transition-colors"
                                    title="Marcar todas como leídas"
                                  >
                                    <CheckCheck className="w-4 h-4" />
                                  </button>
                                )}
                            </div>
                          </div>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto overscroll-contain">
                          {finalDisplayNotifs.length === 0 ? (
                            <div className="p-6 text-center text-sm text-neutral-500">
                              No tienes notificaciones.
                            </div>
                          ) : (
                            finalDisplayNotifs.map((n) => {
                              const isInvite =
                                n.type === 'STAFF_INVITE' &&
                                n.metadata?.eventStaffId &&
                                n.metadata?.status === 'PENDING';
                              return (
                                <div
                                  key={n.id}
                                  className={`p-4 border-b border-white/5 hover:bg-white/5 transition-colors group relative ${!n.isRead ? 'bg-indigo-500/[0.03]' : ''}`}
                                >
                                  {!n.isRead && (
                                    <div className="absolute left-2 top-5 w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]"></div>
                                  )}
                                  <div
                                    className={`${!n.isRead ? 'pl-3' : 'pl-0'}`}
                                  >
                                    <h4
                                      className={`text-sm text-white mb-1 ${!n.isRead ? 'font-bold' : 'font-normal'}`}
                                    >
                                      {n.title}
                                    </h4>
                                    <p
                                      className={`text-sm group-hover:text-white transition-colors ${!n.isRead ? 'text-neutral-200' : 'text-neutral-400'}`}
                                    >
                                      {n.message}
                                    </p>

                                    {isInvite && (
                                      <div className="flex gap-2 mt-3">
                                        <button
                                          onClick={() =>
                                            handleStaffAction(
                                              n.metadata.eventStaffId,
                                              'accept',
                                              n.id,
                                            )
                                          }
                                          disabled={processingIds.has(n.id)}
                                          className="flex-1 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-xs font-semibold py-1.5 rounded-md transition-colors"
                                        >
                                          Aceptar
                                        </button>
                                        <button
                                          onClick={() =>
                                            handleStaffAction(
                                              n.metadata.eventStaffId,
                                              'reject',
                                              n.id,
                                            )
                                          }
                                          disabled={processingIds.has(n.id)}
                                          className="flex-1 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white text-xs font-semibold py-1.5 rounded-md transition-colors"
                                        >
                                          Rechazar
                                        </button>
                                      </div>
                                    )}

                                    <div className="flex items-center justify-between mt-2">
                                      <span className="text-xs text-neutral-500">
                                        {new Date(
                                          n.createdAt,
                                        ).toLocaleDateString()}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                        <Link
                          href="/panel/notificaciones"
                          className="block w-full p-3 text-center text-xs text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          Ver todas
                        </Link>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Profile Dropdown */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setShowProfile(!showProfile)}
                  className="flex items-center gap-3 pl-1 pr-1 md:pl-2 py-1 rounded-full hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
                >
                  <span className="hidden md:block text-sm font-medium text-neutral-200">
                    {user.name.split(' ')[0]}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-xs shadow-inner border border-white/20">
                    {user.name.charAt(0)}
                  </div>
                </button>

                <AnimatePresence>
                  {showProfile && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-44 md:w-56 bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden origin-top-right p-1 z-50"
                    >
                      <div className="px-3 py-2 md:py-3 border-b border-white/5 mb-1">
                        <p className="text-sm font-medium text-white">
                          {user.name}
                        </p>
                        <p className="text-xs text-neutral-500 truncate">
                          {user.email}
                        </p>
                      </div>

                      <Link
                        href="/panel"
                        className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                      >
                        <LayoutDashboard className="w-4 h-4" /> Mi Panel
                      </Link>
                      <Link
                        href="/panel/perfil"
                        className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                      >
                        <UserIcon className="w-4 h-4" /> Perfil
                      </Link>

                      <div className="h-px w-full bg-white/5 my-1" />

                      <a
                        href="mailto:paschedev@gmail.com"
                        className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors w-full text-left"
                      >
                        <HelpCircle className="w-4 h-4" /> Soporte
                      </a>

                      <button
                        onClick={logout}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors w-full text-left"
                      >
                        <LogOut className="w-4 h-4" /> Cerrar sesión
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 md:gap-4">
              <Link
                href="/login"
                className="text-sm font-medium text-neutral-300 hover:text-white px-2 py-2 transition-colors"
              >
                Ingresar
              </Link>
              <Link
                href="/registro"
                className="text-sm font-medium bg-white text-black px-4 md:px-5 py-2 rounded-full hover:bg-neutral-200 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-white/10"
              >
                <span className="md:hidden">Registro</span>
                <span className="hidden md:inline">Crear cuenta</span>
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
