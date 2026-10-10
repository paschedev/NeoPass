'use client';

import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import PasswordInput from '@/components/forms/PasswordInput';

const schema = z.object({
  newEmail: z.string().trim().email('Escribí un correo válido'),
  password: z.string().min(1, 'Escribí tu contraseña actual'),
});

type ChangeEmailValues = z.infer<typeof schema>;

// Pide el código para pasar la cuenta a otro correo. La cuenta sigue con el
// de antes hasta que se escribe ese código (`onSent` abre ese paso).
export default function ChangeEmailForm({
  onSent,
  onCancel,
}: {
  onSent: (sentTo: string, password: string) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangeEmailValues>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ newEmail, password }: ChangeEmailValues) => {
    setServerError(null);
    try {
      const res = await apiFetch('/auth/email/change', {
        method: 'POST',
        body: JSON.stringify({ newEmail, password }),
      });
      const body: unknown = await res.json();
      if (!res.ok) {
        setServerError(getApiErrorMessage(body, 'No pudimos mandar el código'));
        return;
      }
      onSent((body as { sentTo: string }).sentTo, password);
    } catch {
      setServerError('Error de conexión. Probá de nuevo.');
    }
  };

  const inputClass =
    'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div>
        <label
          htmlFor={`${id}-email`}
          className="block text-sm font-medium text-neutral-400 mb-1"
        >
          Correo nuevo
        </label>
        <input
          id={`${id}-email`}
          type="email"
          autoComplete="email"
          maxLength={254}
          placeholder="tucorreo@ejemplo.com"
          className={inputClass}
          {...register('newEmail')}
        />
        {errors.newEmail && (
          <p className="text-red-400 text-xs mt-1">{errors.newEmail.message}</p>
        )}
      </div>

      <div>
        <label
          htmlFor={`${id}-password`}
          className="block text-sm font-medium text-neutral-400 mb-1"
        >
          Contraseña actual
        </label>
        <PasswordInput
          id={`${id}-password`}
          autoComplete="current-password"
          placeholder="••••••••"
          className={inputClass}
          {...register('password')}
        />
        {errors.password && (
          <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
        )}
      </div>

      {serverError && (
        <p role="alert" className="text-red-400 text-sm">
          {serverError}
        </p>
      )}

      <div className="flex justify-end gap-3">
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
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
        >
          Mandar código
        </button>
      </div>
    </form>
  );
}
