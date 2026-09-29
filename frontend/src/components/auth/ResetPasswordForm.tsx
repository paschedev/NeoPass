'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Key } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';

const resetSchema = z
  .object({
    newPassword: z.string().min(8, 'Tiene que tener al menos 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

type ResetFormValues = z.infer<typeof resetSchema>;

const cardClass =
  'max-w-md mx-4 md:mx-auto mt-20 bg-white/5 border border-white/10 p-8 rounded-3xl';
const inputClass =
  'w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors text-sm';
const linkButtonClass =
  'inline-block bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-medium transition-colors';

// Public screen of the reset link: it works without a session.
export default function ResetPasswordForm({ token }: { token: string | null }) {
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormValues>({ resolver: zodResolver(resetSchema) });

  if (!token) {
    return (
      <div className={`${cardClass} text-center`}>
        <h1 className="text-2xl font-bold text-white mb-2">
          El link no es válido
        </h1>
        <p className="text-neutral-400 mb-6">
          Puede estar incompleto. Pedí uno nuevo y usalo dentro de la hora.
        </p>
        <Link href="/password-recovery" className={linkButtonClass}>
          Pedir un link nuevo
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className={`${cardClass} text-center`}>
        <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <Key className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">
          ¡Contraseña cambiada!
        </h1>
        <p className="text-neutral-400 mb-6">
          Ya podés entrar con tu contraseña nueva. Cerramos las sesiones que
          tenías abiertas.
        </p>
        <Link href="/login" className={linkButtonClass}>
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  const onSubmit = async ({ newPassword }: ResetFormValues) => {
    setServerError(null);
    try {
      const res = await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      });
      if (res.ok) {
        setDone(true);
        return;
      }
      setServerError(
        getApiErrorMessage(
          await res.json(),
          'No se pudo cambiar la contraseña',
        ),
      );
    } catch {
      setServerError('Error de conexión. Probá de nuevo.');
    }
  };

  return (
    <div className={cardClass}>
      <h1 className="text-2xl font-bold text-white mb-2">
        Elegí una contraseña nueva
      </h1>
      <p className="text-neutral-400 mb-6 text-sm">
        Tiene que tener al menos 8 caracteres.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="newPassword"
            className="block text-sm font-medium text-neutral-400 mb-2"
          >
            Nueva contraseña
          </label>
          <input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            className={inputClass}
            {...register('newPassword')}
          />
          {errors.newPassword && (
            <p className="text-red-400 text-xs mt-1">
              {errors.newPassword.message}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-neutral-400 mb-2"
          >
            Repetí la contraseña
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            className={inputClass}
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <p className="text-red-400 text-xs mt-1">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>
        {serverError && (
          <p role="alert" className="text-red-400 text-sm">
            {serverError}
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50 mt-4"
        >
          {isSubmitting ? 'Guardando...' : 'Guardar contraseña nueva'}
        </button>
      </form>
    </div>
  );
}
