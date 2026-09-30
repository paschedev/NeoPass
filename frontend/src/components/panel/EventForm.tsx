'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Calendar, Info, MapPin, Save, Video } from 'lucide-react';
import TandasManager from '@/components/TandasManager';
import { useCloudinaryUpload } from '@/hooks/useCloudinaryUpload';
import type { EventFormValues } from '@/utils/event-edit';
import {
  buildEventSchema,
  getDateLimits,
  toEventPayload,
  type EventDateRules,
  type EventFormInput,
} from '@/utils/event-form';
import FlyerField from './FlyerField';

const EMPTY_EVENT: EventFormInput = {
  title: '',
  description: '',
  imageUrl: '',
  youtubeLink: '',
  startDate: '',
  endDate: '',
  venueName: '',
  venueAddress: '',
};

const SUBMIT_LABELS = {
  create: { full: 'Publicar Evento', short: 'Publicar', busy: 'Creando...' },
  edit: { full: 'Guardar Cambios', short: 'Guardar', busy: 'Guardando...' },
};

const fieldClass = (error?: string) =>
  `w-full bg-white/5 border ${error ? 'border-red-500' : 'border-white/10'} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors read-only:opacity-60`;
const dateFieldClass = (error?: string) =>
  `w-full max-w-full bg-white/5 border ${error ? 'border-red-500' : 'border-white/10'} rounded-xl px-2 md:px-4 py-3 text-sm md:text-base text-white focus:outline-none focus:border-indigo-500 transition-colors [color-scheme:dark] block read-only:opacity-60`;

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="text-sm font-medium text-neutral-400 mb-1 flex items-center gap-2"
      >
        {label}
      </label>
      {children}
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-black/40 border border-white/10 rounded-2xl p-6 md:p-8">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
        {icon} {title}
      </h2>
      {children}
    </div>
  );
}

// Formulario de crear y editar evento. Valida cada campo al cambiar, con las
// mismas reglas de fechas que el backend según el momento del evento.
export default function EventForm({
  mode,
  rules,
  defaultValues = EMPTY_EVENT,
  initialBatches = [],
  onSubmit,
}: {
  mode: 'create' | 'edit';
  // Se leen al montar: la página arma el formulario con el evento ya cargado.
  rules: EventDateRules;
  defaultValues?: EventFormInput;
  initialBatches?: unknown[];
  onSubmit: (event: EventFormValues) => Promise<void>;
}) {
  const router = useRouter();
  const [schema] = useState(() => buildEventSchema(rules));
  const [batches, setBatches] = useState(initialBatches);
  const { uploading, upload } = useCloudinaryUpload();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<EventFormInput>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onChange',
  });

  const inProgress = rules.phase === 'IN_PROGRESS';
  const [imageUrl, startDate, endDate] = useWatch({
    control,
    name: ['imageUrl', 'startDate', 'endDate'],
  });
  const limits = getDateLimits({ startDate, endDate }, rules, new Date());
  const labels = SUBMIT_LABELS[mode];

  const handleFlyer = async (file: File) => {
    const url = await upload(file);
    if (url) setValue('imageUrl', url, { shouldValidate: true });
  };

  return (
    <form
      onSubmit={handleSubmit((values) =>
        onSubmit(toEventPayload(values, batches)),
      )}
      className="space-y-8"
      noValidate
    >
      {inProgress && (
        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 text-sm text-indigo-200 flex gap-3">
          <Info className="w-5 h-5 shrink-0 text-indigo-400" />
          <p>
            El evento está en curso: podés cambiar los textos, la imagen y
            extender el fin. El inicio, el lugar y las tandas quedan fijos, y la
            venta sigue.
          </p>
        </div>
      )}

      <Section
        icon={<Info className="text-indigo-400 w-5 h-5" />}
        title="Información General"
      >
        <div className="space-y-5">
          <FlyerField
            imageUrl={imageUrl}
            uploading={uploading}
            error={errors.imageUrl?.message}
            onFile={handleFlyer}
          />
          <Field
            id="title"
            label="Nombre del evento"
            error={errors.title?.message}
          >
            <input
              id="title"
              type="text"
              placeholder="Ej: Tech Meetup 2026"
              className={fieldClass(errors.title?.message)}
              {...register('title')}
            />
          </Field>
          <Field
            id="youtubeLink"
            label={
              <>
                <Video className="w-4 h-4" /> Link de YouTube (opcional)
              </>
            }
            error={errors.youtubeLink?.message}
          >
            <input
              id="youtubeLink"
              type="url"
              placeholder="Ej: https://youtube.com/watch?v=..."
              className={fieldClass(errors.youtubeLink?.message)}
              {...register('youtubeLink')}
            />
          </Field>
          <Field
            id="description"
            label="Descripción"
            error={errors.description?.message}
          >
            <textarea
              id="description"
              rows={4}
              placeholder="Contá de qué trata el evento..."
              className={fieldClass(errors.description?.message)}
              {...register('description')}
            />
          </Field>
        </div>
      </Section>

      <Section
        icon={<Calendar className="text-purple-400 w-5 h-5" />}
        title="Fecha y Hora"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field
            id="startDate"
            label="Inicio"
            error={errors.startDate?.message}
          >
            <input
              id="startDate"
              type="datetime-local"
              readOnly={inProgress}
              min={limits.startMin}
              max={limits.startMax}
              className={dateFieldClass(errors.startDate?.message)}
              {...register('startDate', {
                // El fin se valida contra el inicio: si ya estaba elegido, se revisa de nuevo.
                onChange: () => {
                  if (getValues('endDate')) void trigger('endDate');
                },
              })}
            />
          </Field>
          <Field id="endDate" label="Fin" error={errors.endDate?.message}>
            <input
              id="endDate"
              type="datetime-local"
              min={limits.endMin}
              className={dateFieldClass(errors.endDate?.message)}
              {...register('endDate')}
            />
          </Field>
        </div>
      </Section>

      <Section
        icon={<MapPin className="text-emerald-400 w-5 h-5" />}
        title="Ubicación"
      >
        <div className="space-y-5">
          <Field
            id="venueName"
            label="Nombre del lugar"
            error={errors.venueName?.message}
          >
            <input
              id="venueName"
              type="text"
              readOnly={inProgress}
              placeholder="Ej: Centro de Convenciones"
              className={fieldClass(errors.venueName?.message)}
              {...register('venueName')}
            />
          </Field>
          <Field
            id="venueAddress"
            label="Dirección"
            error={errors.venueAddress?.message}
          >
            <input
              id="venueAddress"
              type="text"
              readOnly={inProgress}
              placeholder="Ej: Av. Principal 1234, CABA"
              className={fieldClass(errors.venueAddress?.message)}
              {...register('venueAddress')}
            />
          </Field>
        </div>
      </Section>

      <div className="mt-12 pt-12 border-t border-white/10">
        <fieldset
          aria-label="Tandas"
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
          disabled={isSubmitting || uploading}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 md:px-8 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          <span className="md:hidden">
            {isSubmitting ? labels.busy : labels.short}
          </span>
          <span className="hidden md:inline">
            {isSubmitting ? labels.busy : labels.full}
          </span>
        </button>
      </div>
    </form>
  );
}
