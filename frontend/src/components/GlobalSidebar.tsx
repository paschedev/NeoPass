'use client';

import {
  Ticket,
  Settings,
  LogOut,
  ChevronLeft,
  CalendarRange,
  Globe,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { canSeeRppPanel, isOrganizer } from '@/utils/roles';

export default function GlobalSidebar() {
  const pathname = usePathname();
  const { user, ready, logout } = useCurrentUser();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  if (!ready) return null;

  const isLoggedIn = !!user;

  const NavItem = ({
    href,
    icon: Icon,
    label,
    show,
  }: {
    href: string;
    icon: any;
    label: string;
    show: boolean;
  }) => {
    if (!show) return null;
    const isActive = pathname === href;
    return (
      <Link
        href={href}
        title={!isSidebarOpen ? label : undefined}
        className={`flex items-center gap-3 px-3 py-3 rounded-xl font-medium transition-colors overflow-hidden whitespace-nowrap ${
          isActive
            ? 'bg-indigo-500/10 text-indigo-400'
            : 'text-neutral-400 hover:text-white hover:bg-white/5'
        }`}
      >
        <Icon className="w-6 h-6 shrink-0" />
        <span
          className={`transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'}`}
        >
          {label}
        </span>
      </Link>
    );
  };

  return (
    <>
      <aside
        className={`border-r border-white/10 bg-black/50 backdrop-blur-xl transition-all duration-300 ease-in-out relative z-50 h-[calc(100vh-4rem)] sticky top-16 hidden md:flex flex-col ${
          isSidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-4 top-6 w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center z-50 text-white hover:bg-indigo-500 hover:scale-110 transition-all cursor-pointer shadow-lg shadow-black/50 hidden md:flex"
        >
          <ChevronLeft
            className={`w-5 h-5 transition-transform ${!isSidebarOpen && 'rotate-180'}`}
          />
        </button>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto overflow-x-hidden">
          <div
            className={`text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4 mt-2 px-2 transition-opacity whitespace-nowrap overflow-hidden ${isSidebarOpen ? 'opacity-100' : 'opacity-0 select-none'}`}
          >
            Navegación
          </div>

          <NavItem
            href="/eventos"
            icon={Globe}
            label="Eventos Públicos"
            show={true}
          />

          {isLoggedIn ? (
            <>
              <NavItem
                href="/panel"
                icon={CalendarRange}
                label="Organización"
                show={isOrganizer(user)}
              />
              <NavItem
                href="/panel/rpp"
                icon={Users}
                label="Panel RPP"
                show={canSeeRppPanel(user)}
              />
              <NavItem
                href="/panel/tickets"
                icon={Ticket}
                label="Tickets"
                show={true}
              />
              <NavItem
                href="/panel/configuracion"
                icon={Settings}
                label="Configuración"
                show={true}
              />
            </>
          ) : (
            <>
              <div
                className={`mt-8 mb-4 border-t border-white/10 pt-4 px-2 transition-opacity whitespace-nowrap overflow-hidden ${isSidebarOpen ? 'opacity-100' : 'opacity-0 select-none'}`}
              >
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Cuenta
                </span>
              </div>
              <NavItem
                href="/login"
                icon={LogOut}
                label="Iniciar Sesión"
                show={true}
              />
              <NavItem
                href="/registro"
                icon={Users}
                label="Registrarse"
                show={true}
              />
            </>
          )}
        </nav>

        {isLoggedIn && (
          <div className="p-4 border-t border-white/10">
            <button
              onClick={() => setShowLogoutConfirm(true)}
              title={!isSidebarOpen ? 'Cerrar sesión' : undefined}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-neutral-400 hover:text-red-400 hover:bg-red-500/10 font-medium transition-colors overflow-hidden whitespace-nowrap cursor-pointer"
            >
              <LogOut className="w-6 h-6 shrink-0" />
              <span
                className={`transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 select-none'}`}
              >
                Cerrar sesión
              </span>
            </button>
          </div>
        )}
      </aside>

      <Modal
        open={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        labelledBy="logout-title"
        className="bg-neutral-900 border border-white/10 p-8 rounded-3xl w-full max-w-sm shadow-2xl"
      >
        <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <LogOut className="w-8 h-8" />
        </div>
        <h2 id="logout-title" className="text-xl font-bold text-center mb-2">
          ¿Cerrar sesión?
        </h2>
        <p className="text-sm text-neutral-400 text-center mb-8">
          Vas a tener que ingresar de nuevo para ver tus tickets y tu panel.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setShowLogoutConfirm(false)}
            className="flex-1 px-4 py-3 rounded-xl font-medium text-neutral-400 hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={logout}
            className="flex-1 bg-red-600 hover:bg-red-500 text-white px-4 py-3 rounded-xl font-medium transition-all active:scale-95"
          >
            Sí, cerrar sesión
          </button>
        </div>
      </Modal>
    </>
  );
}
