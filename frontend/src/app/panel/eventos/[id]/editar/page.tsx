'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar,
  MapPin,
  Info,
  Image as ImageIcon,
  Video,
  Edit,
  Save,
  UploadCloud,
  ArrowLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import TandasManager from '@/components/TandasManager';
import { useCloudinaryUpload } from '@/hooks/useCloudinaryUpload';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import { IMAGE_UPLOAD_TYPES } from '@/utils/cloudinary';
import {
  buildEventUpdate,
  closedEventLabel,
  getEventPhase,
  type EventPhase,
} from '@/utils/event-edit';
import { toDateTimeLocalInput } from '@/utils/format';

export default function EditarEventoPage() {
  const router = useRouter();
  const { id } = useParams();

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [imageUrl, setImageUrl] = useState<string>('');
  const { uploading, upload } = useCloudinaryUpload();
  const [eventData, setEventData] = useState<any>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [startDate, setStartDate] = useState('');
  const [phase, setPhase] = useState<EventPhase>('NOT_STARTED');
  const inProgress = phase === 'IN_PROGRESS';

  useEffect(() => {
    apiFetch(`/events/organizer/${id}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);
        return data;
      })
      .then((data) => {
        const loadedPhase = getEventPhase(data, new Date());
        if (loadedPhase === 'CLOSED') {
          toast.error(
            `${closedEventLabel(data.status)}: ya no se puede editar`,
          );
          router.replace('/panel?tab=events');
          return;
        }
        setPhase(loadedPhase);
        setEventData(data);
        if (data.imageUrl) setImageUrl(data.imageUrl);
        if (data.startDate) setStartDate(toDateTimeLocalInput(data.startDate));
        if (data.ticketBatches) setBatches(data.ticketBatches);
        setFetching(false);
      })
      .catch((err) => {
        console.error(err);
        toast.error('Error al cargar el evento');
        setFetching(false);
      });
  }, [id, router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Validate image
    if (!imageUrl) {
      toast.error('La imagen (Flyer) del evento es obligatoria.');
      return;
    }

    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = buildEventUpdate(
      {
        title: formData.get('title') as string,
        description: formData.get('description') as string,
        imageUrl: imageUrl,
        youtubeLink: (formData.get('youtubeLink') as string) || null,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(formData.get('endDate') as string).toISOString(),
        venueName: formData.get('venueName') as string,
        venueAddress: formData.get('venueAddress') as string,
        batches: batches,
      },
      phase,
    );

    try {
      const response = await apiFetch(`/events/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      const responseData = await response.json();

      if (response.ok) {
        toast.success('Evento actualizado exitosamente');
        router.push('/panel?tab=events');
      } else {
        toast.error(getApiErrorMessage(responseData, 'Error al actualizar'));
        setLoading(false);
      }
    } catch (error) {
      console.error(error);
      toast.error('Error de conexión');
      setLoading(false);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await upload(file);
    if (url) setImageUrl(url);
  };

  if (fetching)
    return (
      <div className="text-center py-20 text-neutral-400">
        Cargando datos del evento...
      </div>
    );
  if (!eventData)
    return (
      <div className="text-center py-20 text-red-400">
        Evento no encontrado.
      </div>
    );

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-0 pt-8 md:pt-12 pb-24">
      <Link
        href="/panel?tab=events"
        className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors mb-6 font-medium"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a mis eventos
      </Link>

      <h1 className="font-outfit text-3xl font-bold mb-8 flex items-center gap-3">
        <Edit className="w-8 h-8 text-indigo-400" /> Editar Evento
      </h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        {inProgress && (
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 text-sm text-indigo-200 flex gap-3">
            <Info className="w-5 h-5 shrink-0 text-indigo-400" />
            <p>
              El evento está en curso: podés cambiar los textos, la imagen y
              extender el fin. El inicio, el lugar y las tandas quedan fijos, y
              la venta sigue.
            </p>
          </div>
        )}
        <div className="bg-black/40 border border-white/10 rounded-2xl p-6 md:p-8">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Info className="text-indigo-400 w-5 h-5" /> Información General
          </h2>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">
                Flyer / Portada del Evento
              </label>
              <div className="relative w-full h-48 bg-white/5 border-2 border-dashed border-white/10 hover:border-indigo-500 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors overflow-hidden group">
                <input
                  type="file"
                  accept={IMAGE_UPLOAD_TYPES.join(',')}
                  onChange={handleImageChange}
                  disabled={uploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  title="Subir imagen"
                />
                {imageUrl ? (
                  <>
                    <img
                      src={imageUrl}
                      alt="Flyer"
                      className="w-full h-full object-cover group-hover:opacity-40 transition-opacity"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="bg-black/70 text-white px-4 py-2 rounded-full font-medium flex items-center gap-2 backdrop-blur-sm">
                        <UploadCloud className="w-4 h-4" /> Cambiar imagen
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-8 h-8 text-neutral-500 mb-2" />
                    <span className="text-sm text-neutral-400">
                      Click o arrastra una imagen aquí
                    </span>
                    <span className="text-xs text-neutral-600 mt-1">
                      Recomendado: 1920x1080px (Máx 10MB)
                    </span>
                  </>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">
                Nombre del evento
              </label>
              <input
                name="title"
                defaultValue={eventData.title}
                required
                type="text"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1 flex items-center gap-2">
                <Video className="w-4 h-4" /> Link de YouTube
              </label>
              <input
                name="youtubeLink"
                defaultValue={eventData.youtubeLink || ''}
                type="url"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">
                Descripción
              </label>
              <textarea
                name="description"
                defaultValue={eventData.description}
                required
                rows={4}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="bg-black/40 border border-white/10 rounded-2xl p-6 md:p-8">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Calendar className="text-purple-400 w-5 h-5" /> Fecha y Hora
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">
                Inicio
              </label>
              <input
                name="startDate"
                required
                type="datetime-local"
                readOnly={inProgress}
                min={
                  inProgress
                    ? undefined
                    : toDateTimeLocalInput(new Date().toISOString())
                }
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full max-w-full bg-white/5 border border-white/10 rounded-xl px-2 md:px-4 py-3 text-sm md:text-base text-white focus:outline-none focus:border-indigo-500 transition-colors [color-scheme:dark] block read-only:opacity-60"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">
                Fin
              </label>
              <input
                name="endDate"
                required
                type="datetime-local"
                min={
                  inProgress
                    ? toDateTimeLocalInput(eventData.endDate)
                    : startDate ||
                      toDateTimeLocalInput(new Date().toISOString())
                }
                defaultValue={
                  eventData.endDate
                    ? toDateTimeLocalInput(eventData.endDate)
                    : ''
                }
                className="w-full max-w-full bg-white/5 border border-white/10 rounded-xl px-2 md:px-4 py-3 text-sm md:text-base text-white focus:outline-none focus:border-indigo-500 transition-colors [color-scheme:dark] block"
              />
            </div>
          </div>
        </div>

        <div className="bg-black/40 border border-white/10 rounded-2xl p-6 md:p-8">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <MapPin className="text-emerald-400 w-5 h-5" /> Ubicación
          </h2>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">
                Nombre del lugar
              </label>
              <input
                name="venueName"
                defaultValue={eventData.venueName}
                required
                readOnly={inProgress}
                type="text"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors read-only:opacity-60"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">
                Dirección
              </label>
              <input
                name="venueAddress"
                defaultValue={eventData.venueAddress}
                required
                readOnly={inProgress}
                type="text"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors read-only:opacity-60"
              />
            </div>
          </div>
        </div>

        <div className="mt-12 pt-12 border-t border-white/10">
          <fieldset
            disabled={inProgress}
            className="min-w-0 disabled:opacity-60"
          >
            <TandasManager batches={batches} setBatches={setBatches} />
          </fieldset>
        </div>

        <div className="flex justify-center md:justify-end gap-4 mt-12 w-full">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 rounded-xl font-medium text-neutral-400 hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || uploading}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 md:px-8 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            <span className="md:hidden">
              {loading ? 'Guardando...' : 'Guardar'}
            </span>
            <span className="hidden md:inline">
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
