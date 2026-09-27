'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Send } from 'lucide-react';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import { z } from 'zod';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const recoverySchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
});

type RecoveryFormValues = z.infer<typeof recoverySchema>;

export default function PasswordRecoveryPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RecoveryFormValues>({
    resolver: zodResolver(recoverySchema),
    mode: 'onChange',
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: RecoveryFormValues) => {
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: data.email }),
      });

      if (response.ok) {
        setSuccess(true);
      } else {
        const responseData = await response.json();
        setError(
          getApiErrorMessage(
            responseData,
            'Error al intentar recuperar la contraseña',
          ),
        );
      }
    } catch (err) {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 p-4 relative overflow-hidden">
      <div className="w-full max-w-md bg-neutral-900 border border-white/5 p-8 rounded-3xl shadow-2xl relative z-10">
        <Link
          href="/login"
          className="absolute top-8 left-8 text-neutral-500 hover:text-white transition-colors"
          title="Volver al Login"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>

        <div className="text-center mb-8 mt-2">
          <h1 className="font-outfit text-3xl font-bold tracking-tighter mb-2 text-white">
            Recuperar Acceso
          </h1>
          <p className="text-neutral-400 text-sm px-4">
            Ingresá tu correo electrónico y te enviaremos las instrucciones para
            restablecer tu contraseña.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        {success ? (
          <div className="mb-6 p-5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl text-center flex flex-col items-center justify-center gap-3">
            <svg
              className="w-12 h-12 text-emerald-500 mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <p className="font-medium text-lg">¡Solicitud procesada!</p>
            <p className="text-sm opacity-90 px-2">
              Si el correo ingresado coincide con una cuenta existente, en breve
              recibirás las instrucciones para restablecer tu contraseña.
            </p>
            <Link
              href="/login"
              className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Volver al Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">
                Email
              </label>
              <Controller
                name="email"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="email"
                    required
                    className={`w-full bg-white/5 border ${errors.email ? 'border-red-500' : 'border-white/10'} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors`}
                    placeholder="tucorreo@ejemplo.com"
                  />
                )}
              />
              {errors.email && (
                <span className="text-red-400 text-xs mt-1 block">
                  {errors.email.message}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
            >
              {loading ? (
                'Enviando...'
              ) : (
                <>
                  <Send className="w-4 h-4" /> Enviar enlace
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
