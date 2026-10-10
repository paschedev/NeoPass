'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { Mail, ShieldCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from '@/utils/toast';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import { IMAGE_UPLOAD_TYPES, validateImageFile } from '@/utils/cloudinary';
import { uploadSignedImage } from '@/utils/cloudinary-upload';
import { isOrganizer } from '@/utils/roles';
import {
  updateSessionUser,
  useCurrentUser,
  type SessionUser,
} from '@/hooks/useCurrentUser';
import Avatar from './Avatar';

const ACCOUNT_TYPE_LABELS: Record<SessionUser['role'], string> = {
  ADMIN: 'Administrador de NeoPass',
  ORGANIZER: 'Organizador de eventos',
  CUSTOMER: 'Usuario estándar',
};

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Escribí tu nombre y apellido')
    .max(60, 'Máximo 60 caracteres'),
  companyName: z.string().trim().max(50, 'Máximo 50 caracteres'),
});

type ProfileValues = z.infer<typeof schema>;

// Guarda en el backend los datos enviados y deja la sesión con el perfil que
// devuelve (ya limpio: sin espacios de más). Si no se pudo, el motivo.
async function saveProfile(
  changes: object,
): Promise<{ profile: SessionUser } | { error: string }> {
  const res = await apiFetch('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(changes),
  });
  const body: unknown = await res.json();
  if (!res.ok) {
    return { error: getApiErrorMessage(body, 'No pudimos guardar tus datos') };
  }
  updateSessionUser(body as SessionUser);
  return { profile: body as SessionUser };
}

function ProfilePhoto({ user }: { user: SessionUser }) {
  const [busy, setBusy] = useState(false);

  const change = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Permite volver a elegir el mismo archivo después.
    event.target.value = '';
    if (!file) return;
    const invalid = validateImageFile(file);
    if (invalid) {
      toast.error(invalid);
      return;
    }

    setBusy(true);
    const toastId = toast.loading('Subiendo tu foto...');
    try {
      const uploaded = await uploadSignedImage(file, '/media/avatar-presign');
      const saved =
        'error' in uploaded
          ? uploaded
          : await saveProfile({ avatarUrl: uploaded.url });
      if ('error' in saved) toast.error(saved.error, { id: toastId });
      else toast.success('Foto actualizada', { id: toastId });
    } catch {
      toast.error('Error de conexión al subir la foto', { id: toastId });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const saved = await saveProfile({ avatarUrl: null });
      if ('error' in saved) toast.error(saved.error);
      else toast.success('Quitamos tu foto');
    } catch {
      toast.error('Error de conexión. Probá de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 shrink-0">
      <Avatar user={user} size="lg" />
      <label
        className={`text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors ${busy ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
      >
        Cambiar foto
        <input
          type="file"
          accept={IMAGE_UPLOAD_TYPES.join(',')}
          onChange={change}
          disabled={busy}
          className="sr-only"
        />
      </label>
      {user.avatarUrl && (
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="text-xs text-neutral-500 hover:text-red-400 transition-colors disabled:opacity-50"
        >
          Quitar foto
        </button>
      )}
    </div>
  );
}

function ProfileFields({ user }: { user: SessionUser }) {
  const organizer = isOrganizer(user);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<ProfileValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: user.name, companyName: user.companyName ?? '' },
  });

  // Solo lo que cambió: un dato que no se tocó nunca se pisa.
  const onSubmit = async ({ name, companyName }: ProfileValues) => {
    setServerError(null);
    const changes: { name?: string; companyName?: string | null } = {};
    if (dirtyFields.name) changes.name = name;
    if (organizer && dirtyFields.companyName) {
      changes.companyName = companyName || null;
    }
    if (Object.keys(changes).length === 0) return;
    try {
      const saved = await saveProfile(changes);
      if ('error' in saved) {
        setServerError(saved.error);
        return;
      }
      reset({
        name: saved.profile.name,
        companyName: saved.profile.companyName ?? '',
      });
      toast.success('Guardamos tus datos');
    } catch {
      setServerError('Error de conexión. Probá de nuevo.');
    }
  };

  const inputClass =
    'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors';

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex-1 w-full space-y-5"
      noValidate
    >
      <div>
        <label
          htmlFor="profile-name"
          className="block text-sm font-medium text-neutral-400 mb-1"
        >
          Nombre y apellido
        </label>
        <input
          id="profile-name"
          autoComplete="name"
          maxLength={60}
          className={inputClass}
          {...register('name')}
        />
        {errors.name && (
          <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>
        )}
      </div>

      {organizer && (
        <div>
          <label
            htmlFor="profile-company"
            className="block text-sm font-medium text-neutral-400 mb-1"
          >
            Productora o marca (opcional)
          </label>
          <input
            id="profile-company"
            maxLength={50}
            placeholder="Ej: Producciones Norte"
            className={inputClass}
            {...register('companyName')}
          />
          <p className="text-neutral-500 text-xs mt-1">
            Si la cargás, es el nombre que ven tus compradores y tu staff.
          </p>
          {errors.companyName && (
            <p className="text-red-400 text-xs mt-1">
              {errors.companyName.message}
            </p>
          )}
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-neutral-400 mb-1 flex items-center gap-2">
          <Mail className="w-4 h-4" /> Correo
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-white break-all">{user.email}</span>
          <Link
            href="/panel/configuracion#correo"
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Cambiar correo
          </Link>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-neutral-400 mb-1 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" /> Tipo de cuenta
        </p>
        <span className="inline-block px-3 py-1 bg-white/10 text-white text-sm rounded-lg font-medium border border-white/5">
          {ACCOUNT_TYPE_LABELS[user.role]}
        </span>
      </div>

      {serverError && (
        <p role="alert" className="text-red-400 text-sm">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
      >
        Guardar cambios
      </button>
    </form>
  );
}

// Mi perfil: foto, nombre y apellido, productora (organizadores) y el correo.
// Trae el perfil al entrar: las sesiones viejas no tienen la productora.
export default function ProfileForm() {
  const { user, refresh } = useCurrentUser();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    refresh()
      .catch((error: unknown) => console.error(error))
      .finally(() => setLoaded(true));
  }, [refresh]);

  if (!user || !loaded) {
    return <p className="text-neutral-400">Cargando perfil...</p>;
  }

  return (
    <div className="bg-neutral-900 border border-white/5 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start gap-8 shadow-2xl">
      <ProfilePhoto user={user} />
      <ProfileFields key={user.id} user={user} />
    </div>
  );
}
