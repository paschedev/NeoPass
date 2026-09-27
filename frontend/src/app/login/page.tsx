'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogIn } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import { getSafeRedirect } from '@/utils/redirect';
import { saveSession } from '@/hooks/useCurrentUser';
import { getHomePath } from '@/utils/navigation';
import { z } from 'zod';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const loginSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const [captchaError, setCaptchaError] = useState(false);
  const [mounted, setMounted] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    setMounted(true);
    if (window.location.search.includes('expired=1')) {
      setError('Tu sesión expiró. Ingresá de nuevo.');
    }
  }, []);

  const onSubmit = async (data: LoginFormValues) => {
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          captchaToken,
        }),
      });

      const responseData = await response.json();

      if (response.ok) {
        saveSession(responseData.access_token, responseData.user);

        const urlParams = new URLSearchParams(window.location.search);
        const callbackUrl = getSafeRedirect(urlParams.get('callbackUrl'));
        window.location.replace(callbackUrl ?? getHomePath(responseData.user));
      } else {
        setError(getApiErrorMessage(responseData, 'Credenciales inválidas'));
      }
    } catch (err) {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 p-4 relative overflow-hidden">
      <div className="w-full max-w-md bg-neutral-900 border border-white/5 p-8 rounded-3xl shadow-2xl">
        <div className="text-center mb-8">
          <Link
            href="/"
            className="font-outfit text-3xl font-bold tracking-tighter inline-block mb-2"
          >
            Neo<span className="text-indigo-500">Pass</span>
          </Link>
          <p className="text-neutral-400">Ingresá a tu cuenta</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

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
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">
              Contraseña
            </label>
            <Controller
              name="password"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  type="password"
                  required
                  className={`w-full bg-white/5 border ${errors.password ? 'border-red-500' : 'border-white/10'} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors`}
                  placeholder="••••••••"
                />
              )}
            />
            {errors.password && (
              <span className="text-red-400 text-xs mt-1 block">
                {errors.password.message}
              </span>
            )}
            <div className="flex justify-end mt-2">
              <Link
                href="/password-recovery"
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          </div>

          {mounted && process.env.NODE_ENV === 'production' && (
            <div className="flex flex-col items-center justify-center mt-6">
              {!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? (
                <div className="text-red-400 text-sm p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-center w-full">
                  Falta configurar la clave de seguridad (Turnstile).
                </div>
              ) : (
                <Turnstile
                  siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                  onSuccess={(token) => {
                    setCaptchaToken(token);
                    setCaptchaError(false);
                  }}
                  onError={() => setCaptchaError(true)}
                  options={{ theme: 'dark' }}
                />
              )}
              {captchaError && (
                <div className="text-red-400 text-sm p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-center w-full mt-2">
                  Error de seguridad. Desactivá el AdBlocker o recargá la
                  página.
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={
              !mounted ||
              loading ||
              captchaError ||
              (!captchaToken && process.env.NODE_ENV === 'production')
            }
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
          >
            {!mounted ? (
              'Conectando...'
            ) : loading ? (
              'Ingresando...'
            ) : (
              <>
                <LogIn className="w-5 h-5" /> Entrar
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-neutral-500">
          ¿No tenés cuenta?{' '}
          <Link
            href="/registro"
            className="text-indigo-400 hover:text-indigo-300"
          >
            Registrate gratis
          </Link>
        </div>
      </div>
    </div>
  );
}
