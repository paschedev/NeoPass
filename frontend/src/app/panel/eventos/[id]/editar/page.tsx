'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Edit, ArrowLeft } from 'lucide-react';
import toast from '@/utils/toast';
import EventForm from '@/components/panel/EventForm';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import {
  afterEditPath,
  editPermissions,
  type EventAccess,
} from '@/utils/co-organizers';
import {
  buildEventUpdate,
  closedEventLabel,
  getEventPhase,
  type EventFormValues,
} from '@/utils/event-edit';
import {
  toEventFormInput,
  type EventDateRules,
  type EventFormInput,
  type SavedEvent,
} from '@/utils/event-form';

type OrganizerEvent = SavedEvent & { status: string; access: EventAccess };

type LoadedEvent = {
  phase: EventDateRules['phase'];
  values: EventFormInput;
  access: EventAccess;
};

// Editar un evento: quien lo organiza, o un co-organizador que ve en solo
// lectura lo que no tiene permitido cambiar.
export default function EditarEventoPage() {
  const router = useRouter();
  const { id } = useParams();

  const [fetching, setFetching] = useState(true);
  const [loaded, setLoaded] = useState<LoadedEvent | null>(null);

  useEffect(() => {
    apiFetch(`/events/organizer/${id}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        return data as OrganizerEvent;
      })
      .then((data) => {
        const phase = getEventPhase(data, new Date());
        if (phase === 'CLOSED') {
          toast.error(
            `${closedEventLabel(data)}: ya no se puede editar`,
          );
          router.replace(afterEditPath(data.access, String(id)));
          return;
        }
        setLoaded({
          phase,
          values: toEventFormInput(data),
          access: data.access,
        });
        setFetching(false);
      })
      .catch((err) => {
        console.error(err);
        toast.error('Error al cargar el evento');
        setFetching(false);
      });
  }, [id, router]);

  if (fetching)
    return (
      <div className="text-center py-20 text-neutral-400">
        Cargando datos del evento...
      </div>
    );
  if (!loaded)
    return (
      <div className="text-center py-20 text-red-400">
        Evento no encontrado.
      </div>
    );

  const backPath = afterEditPath(loaded.access, String(id));

  const updateEvent = async (event: EventFormValues) => {
    try {
      const response = await apiFetch(`/events/${id}`, {
        method: 'PUT',
        body: JSON.stringify(buildEventUpdate(event, loaded.phase)),
      });
      if (response.ok) {
        toast.success('Evento actualizado exitosamente');
        router.push(backPath);
        return;
      }
      toast.error(
        getApiErrorMessage(await response.json(), 'Error al actualizar'),
      );
    } catch {
      toast.error('Error de conexión');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-0 pt-8 md:pt-12 pb-24">
      <Link
        href={backPath}
        className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors mb-6 font-medium"
      >
        <ArrowLeft className="w-4 h-4" />{' '}
        {loaded.access.role === 'OWNER'
          ? 'Volver a mis eventos'
          : 'Volver al evento'}
      </Link>

      <h1 className="font-outfit text-3xl font-bold mb-8 flex items-center gap-3">
        <Edit className="w-8 h-8 text-indigo-400" /> Editar Evento
      </h1>

      <EventForm
        mode="edit"
        eventId={String(id)}
        rules={{ phase: loaded.phase, saved: loaded.values }}
        defaultValues={loaded.values}
        permissions={editPermissions(loaded.access)}
        onSubmit={updateEvent}
      />
    </div>
  );
}
