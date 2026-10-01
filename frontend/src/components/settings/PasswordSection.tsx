'use client';

import { useState } from 'react';
import { Key, Lock, type LucideIcon } from 'lucide-react';
import toast from '@/utils/toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import {
  changePasswordSchema,
  type ChangePasswordValues,
} from '@/utils/password-schema';
import { saveSession, useCurrentUser } from '@/hooks/useCurrentUser';
import PasswordInput from '@/components/forms/PasswordInput';

const FIELDS: {
  name: keyof ChangePasswordValues;
  label: string;
  icon: LucideIcon;
  autoComplete: string;
}[] = [
  {
    name: 'oldPassword',
    label: 'Contraseña actual',
    icon: Lock,
    autoComplete: 'current-password',
  },
  {
    name: 'newPassword',
    label: 'Nueva contraseña',
    icon: Key,
    autoComplete: 'new-password',
  },
  {
    name: 'confirmPassword',
    label: 'Repetí la contraseña nueva',
    icon: Key,
    autoComplete: 'new-password',
  },
];

// "Seguridad de la cuenta" in the settings page: change the password or ask
// for the reset link.
export default function PasswordSection() {
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
  });

  const close = () => {
    reset();
    setServerError(null);
    setOpen(false);
  };

  const onSubmit = async ({
    oldPassword,
    newPassword,
  }: ChangePasswordValues) => {
    setServerError(null);
    try {
      const res = await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(
          getApiErrorMessage(data, 'No se pudo cambiar la contraseña'),
        );
        return;
      }
      // The change closes every other session; this one keeps going with the
      // new token.
      if (user) saveSession(data.access_token, user);
      toast.success('Contraseña actualizada');
      close();
    } catch {
      setServerError('Error de conexión. Probá de nuevo.');
    }
  };

  const handleForgotPassword = async () => {
    if (!user?.email) {
      toast.error('No se pudo identificar tu correo electrónico');
      return;
    }
    const toastId = toast.loading('Pidiendo el link...');
    try {
      const res = await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: user.email }),
      });
      if (res.ok) {
        toast.success('Te mandamos un link a tu correo.', { id: toastId });
      } else {
        toast.error('No se pudo pedir el link.', { id: toastId });
      }
    } catch {
      toast.error('Error de conexión.', { id: toastId });
    }
  };

  return (
    <section className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center text-purple-400">
            <Key className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              Seguridad de la cuenta
            </h2>
            <p className="text-neutral-400 text-sm">
              Gestioná tu contraseña y el acceso a tu cuenta
            </p>
          </div>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white px-4 py-3 sm:py-2 rounded-xl text-sm font-medium transition-colors"
          >
            Cambiar contraseña
          </button>
        )}
      </div>

      {open && (
        <div className="mt-6 border-t border-white/10 pt-6 animate-in slide-in-from-top-4 fade-in duration-300">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4 max-w-md"
            noValidate
          >
            {FIELDS.map(({ name, label, icon: Icon, autoComplete }) => (
              <div key={name}>
                <label
                  htmlFor={name}
                  className="block text-sm font-medium text-neutral-400 mb-2"
                >
                  {label}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Icon className="h-4 w-4 text-neutral-500" />
                  </div>
                  <PasswordInput
                    id={name}
                    autoComplete={autoComplete}
                    placeholder="••••••••"
                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors text-sm"
                    {...register(name)}
                  />
                </div>
                {errors[name] && (
                  <p className="text-red-400 text-xs mt-1">
                    {errors[name]?.message}
                  </p>
                )}
              </div>
            ))}

            {serverError && (
              <p role="alert" className="text-red-400 text-sm">
                {serverError}
              </p>
            )}

            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm text-purple-400 hover:text-purple-300 font-medium transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={close}
                  className="bg-transparent hover:bg-white/5 text-neutral-300 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? 'Actualizando...' : 'Actualizar'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
