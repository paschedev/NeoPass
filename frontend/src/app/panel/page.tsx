'use client';

import {
  Activity,
  Calendar as CalendarIcon,
  Link2,
  Users,
  Settings,
  Plus,
} from 'lucide-react';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardTab from '@/components/panel/DashboardTab';
import EventsTab from '@/components/panel/EventsTab';
import InviteStaffModal from '@/components/panel/InviteStaffModal';
import MercadoPagoModal from '@/components/panel/MercadoPagoModal';
import SettingsTab from '@/components/panel/SettingsTab';
import StaffTab from '@/components/panel/StaffTab';
import type {
  DashboardStats,
  OrganizerEvent,
  StaffMember,
} from '@/components/panel/types';
import { apiFetch } from '@/utils/api';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { isOrganizer as hasOrganizerRole } from '@/utils/roles';

function OrganizerDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(
    searchParams.get('tab') || 'dashboard',
  );
  const [showMpModal, setShowMpModal] = useState(false);

  const [stats, setStats] = useState<DashboardStats>({
    totalEvents: 0,
    totalTicketsSold: 0,
    totalRevenue: 0,
    activeEvents: 0,
    chartData: [],
    recentTransactions: [],
  });
  const { user, refresh } = useCurrentUser();
  const isOrganizer = hasOrganizerRole(user);
  const hasLinkedMp = !!user?.hasLinkedMp;

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [myEvents, setMyEvents] = useState<OrganizerEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [myStaff, setMyStaff] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  useEffect(() => {
    if (!isOrganizer) {
      router.replace('/panel/tickets');
      return;
    }

    const loadStats = async () => {
      try {
        const res = await apiFetch('/events/organizer/stats');
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        } else {
          console.error(
            'Error fetching stats: API returned status',
            res.status,
          );
        }
      } catch (err) {
        console.error('Error fetching stats:', err);
      }
    };
    loadStats();

    if (searchParams.get('mp_success') === 'true') {
      toast.success('Cuenta de Mercado Pago vinculada con éxito');
      refresh();
      window.history.replaceState(null, '', '/panel');
    } else if (searchParams.get('mp_error') === 'true') {
      toast.error('Hubo un error al vincular la cuenta de Mercado Pago');
      window.history.replaceState(null, '', '/panel');
    }
  }, [isOrganizer, refresh, router, searchParams]);

  const fetchEvents = async () => {
    setLoadingEvents(true);
    setFetchError(false);
    try {
      const res = await apiFetch('/events/organizer/me');
      if (res.ok) {
        setMyEvents(await res.json());
      } else {
        setFetchError(true);
      }
    } catch (e) {
      console.error(e);
      setFetchError(true);
    } finally {
      setLoadingEvents(false);
    }
  };

  const fetchStaff = async () => {
    setLoadingStaff(true);
    try {
      const res = await apiFetch('/events/organizer/staff');
      if (res.ok) setMyStaff(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStaff(false);
    }
  };

  useEffect(() => {
    if (isOrganizer) {
      fetchEvents();
      fetchStaff();
    }
  }, [isOrganizer]);

  const handleCreateEventClick = () => {
    if (!hasLinkedMp) {
      toast.error(
        'Debes vincular tu cuenta de Mercado Pago primero para poder cobrar las entradas.',
      );
      setShowMpModal(true);
      return;
    }
    router.push('/panel/eventos/nuevo');
  };

  if (!isOrganizer) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 pt-8 pb-24 md:pb-8">
      {/* Header & Title */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="font-outfit text-4xl font-bold text-white mb-2">
            Panel Organizador
          </h1>
          <p className="text-neutral-400">
            Gestiona tus eventos, lotes de entradas y comisiones a RPPs.
          </p>
        </div>
        <button
          onClick={handleCreateEventClick}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-full font-medium transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20 active:scale-95"
        >
          <Plus className="w-5 h-5" /> Crear Evento
        </button>
      </div>

      {/* Mercado Pago Alert */}
      <AnimatePresence>
        {!hasLinkedMp && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-500/30 rounded-3xl p-6 mb-8 flex flex-col sm:flex-row items-center justify-between gap-6 backdrop-blur-sm relative overflow-hidden"
          >
            <div className="hidden md:block absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[64px] pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-xl font-bold mb-1 text-white flex items-center gap-2">
                <Link2 className="w-5 h-5 text-indigo-400" /> Vincular Mercado
                Pago
              </h2>
              <p className="text-sm text-indigo-200/80">
                Requerido para activar el sistema Marketplace y recibir cobros
                directamente en tu cuenta (CBU/CVU).
              </p>
            </div>
            <button
              onClick={() => setShowMpModal(true)}
              className="relative z-10 bg-white text-indigo-950 px-6 py-3 rounded-full font-semibold transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
            >
              Configurar ahora
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs Navigation */}
      <div className="flex w-full bg-white/[0.02] border border-white/5 p-1 rounded-2xl mb-8">
        {[
          {
            id: 'dashboard',
            label: 'Resumen',
            icon: <Activity className="w-5 h-5 md:w-4 md:h-4 shrink-0" />,
          },
          {
            id: 'events',
            label: 'Mis Eventos',
            icon: <CalendarIcon className="w-5 h-5 md:w-4 md:h-4 shrink-0" />,
          },
          {
            id: 'staff',
            label: 'Staff & RPPs',
            icon: <Users className="w-5 h-5 md:w-4 md:h-4 shrink-0" />,
          },
          {
            id: 'settings',
            label: 'Ajustes',
            icon: <Settings className="w-5 h-5 md:w-4 md:h-4 shrink-0" />,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-1 md:px-6 py-3 rounded-xl flex-1 transition-all ${
              activeTab === tab.id
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-neutral-500 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.icon}
            <span
              className={`text-[10px] leading-tight md:text-sm font-medium ${tab.id === 'settings' ? 'hidden md:block' : 'block'}`}
            >
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* Tab Content: Dashboard */}
      {activeTab === 'dashboard' && <DashboardTab stats={stats} />}

      {activeTab === 'staff' && (
        <StaffTab
          staff={myStaff}
          loading={loadingStaff}
          onInvite={() => setShowInviteModal(true)}
        />
      )}

      {activeTab === 'events' && (
        <EventsTab
          events={myEvents}
          loading={loadingEvents}
          error={fetchError}
          onRetry={fetchEvents}
        />
      )}

      {activeTab === 'settings' && <SettingsTab />}

      <MercadoPagoModal
        open={showMpModal}
        onClose={() => setShowMpModal(false)}
      />
      <InviteStaffModal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        events={myEvents}
        onInvited={fetchStaff}
      />
    </div>
  );
}

export default function OrganizerDashboard() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen text-white">
          Cargando...
        </div>
      }
    >
      <OrganizerDashboardContent />
    </Suspense>
  );
}
