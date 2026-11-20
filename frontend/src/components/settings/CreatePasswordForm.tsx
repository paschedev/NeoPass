'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from '@/utils/zod';
import toast from '@/utils/toast';
import { updateSessionUser, type SessionUser } from '@/hooks/useCurrentUser';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import GoogleButton from '@/components/auth/GoogleButton';
import PasswordInput from '@/components/forms/PasswordInput';

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .max(32, 'Máximo 32 caracteres'),
    confirmation: z.string(),
  })
  .refine((data) => data.password === data.confirmation, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmation'],
  });

type Values = z.infer<typeof schema>;

const INPUT =
  'w-full bg-black/50 border border-white/10 rounded-xl pl-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors text-sm';

// Una cuenta hecha con Google crea su contraseña para entrar también con el
// correo. Primero confirma con Google: una sesión copiada no alcanza.
export default function CreatePasswordForm({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  const [credential, setCredential] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ password }: Values) => {
    setServerError(null);
    try {
      const res = await apiFetch('/auth/google/password', {
        method: 'POST',
        body: JSON.stringify({ credential, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Una credencial vencida se pide de nuevo.
        if (res.status === 401) setCredential(null);
        setServerError(
          getApiErrorMessage(data, 'No se pudo crear la contraseña'),
        );
        return;
      }
      updateSessionUser(data as SessionUser);
      toast.success('Creaste tu contraseña');
      onDone();
    } catch {
      setServerError('Error de conexión. Probá de nuevo.');
    }
  };

  if (!credential) {
    return (
      <div className="space-y-4 max-w-sm">
        <p className="text-sm text-neutral-300">
          Para crear tu contraseña, confirmá que sos vos con Google.
        </p>
        <GoogleButton
          onCredential={(next) => {
            setServerError(null);
            setCredential(next);
          }}
        />
        {serverError && (
          <p role="alert" className="text-red-400 text-sm">
            {serverError}
          </p>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-neutral-400 hover:text-white transition-colors"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 max-w-md"
      noValidate
    >
      <div>
        <label
          htmlFor="new-password"
          className="block text-sm font-medium text-neutral-400 mb-2"
        >
          Contraseña nueva
        </label>
        <PasswordInput
          id="new-password"
          autoComplete="new-password"
          placeholder="••••••••"
          className={INPUT}
          {...register('password')}
        />
        {errors.password && (
          <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
        )}
      </div>
      <div>
        <label
          htmlFor="new-password-confirmation"
          className="block text-sm font-medium text-neutral-400 mb-2"
        >
          Repetí la contraseña
        </label>
        <PasswordInput
          id="new-password-confirmation"
          autoComplete="new-password"
          placeholder="••••••••"
          className={INPUT}
          {...register('confirmation')}
        />
        {errors.confirmation && (
          <p className="text-red-400 text-xs mt-1">
            {errors.confirmation.message}
          </p>
        )}
      </div>
      {serverError && (
        <p role="alert" className="text-red-400 text-sm">
          {serverError}
        </p>
      )}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="bg-transparent hover:bg-white/5 text-neutral-300 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Guardando...' : 'Crear contraseña'}
        </button>
      </div>
    </form>
  );
}
