'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import toast from '@/utils/toast';
import EventForm from '@/components/panel/EventForm';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import type { EventFormValues } from '@/utils/event-edit';

export default function CrearEventoPage() {
  const router = useRouter();

  const createEvent = async (event: EventFormValues) => {
    try {
      const response = await apiFetch('/events', {
        method: 'POST',
        body: JSON.stringify({ ...event, status: 'PUBLISHED' }),
      });
      if (response.ok) {
        toast.success('Evento creado exitosamente.');
        router.push('/panel?tab=events');
        return;
      }
      toast.error(
        getApiErrorMessage(await response.json(), 'Error al crear el evento'),
        { duration: 5000 },
      );
    } catch {
      toast.error('Error de conexión');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-0 pt-8 md:pt-12 pb-24">
      <Link
        href="/panel?tab=events"
        className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors mb-6 font-medium"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a mis eventos
      </Link>

      <h1 className="font-outfit text-3xl font-bold mb-8">
        Crear Nuevo Evento
      </h1>

      <EventForm
        mode="create"
        rules={{ phase: 'NOT_STARTED' }}
        onSubmit={createEvent}
      />
    </div>
  );
}
