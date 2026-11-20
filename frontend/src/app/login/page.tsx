'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Turnstile } from '@marsidev/react-turnstile';
import { TURNSTILE_OPTIONS } from '@/utils/captcha';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import {
  afterSignInPath,
  isGoogleEnabled,
  readLastLoginMethod,
  rememberLoginMethod,
  type LoginMethod,
} from '@/utils/google-sign-in';
import { saveSession } from '@/hooks/useCurrentUser';
import PasswordInput from '@/components/forms/PasswordInput';
import AuthShell, { AuthDivider } from '@/components/auth/AuthShell';
import GoogleSignIn from '@/components/auth/GoogleSignIn';
import LastUsedBadge from '@/components/auth/LastUsedBadge';
import { z } from '@/utils/zod';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const loginSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const INPUT =
  'w-full bg-white/5 border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Una contraseña que no coincide puede ser de una cuenta hecha con Google.
  const [googleHint, setGoogleHint] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const [captchaError, setCaptchaError] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [lastUsed, setLastUsed] = useState<LoginMethod | null>(null);
  const google = isGoogleEnabled();

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
    setLastUsed(readLastLoginMethod());
    if (window.location.search.includes('expired=1')) {
      setError('Tu sesión expiró. Ingresá de nuevo.');
    }
  }, []);

  const onSubmit = async (data: LoginFormValues) => {
    setLoading(true);
    setError('');
    setGoogleHint(false);

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
        rememberLoginMethod('password');
        window.location.replace(
          afterSignInPath(window.location.search, responseData.user),
        );
      } else {
        setError(getApiErrorMessage(responseData, 'Credenciales inválidas'));
        setGoogleHint(google && response.status === 401);
      }
    } catch (err) {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Ingresá a NeoPass"
      subtitle={
        <>
          ¿No tenés cuenta?{' '}
          <Link
            href="/registro"
            className="font-semibold text-white hover:text-indigo-300 transition-colors"
          >
            Registrate
          </Link>
          .
        </>
      }
    >
      {error && (
        <div
          role="alert"
          className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm text-center"
        >
          {error}
          {googleHint && (
            <span className="block mt-1 text-neutral-300">
              ¿Te registraste con Google? Usá el botón de Google.
            </span>
          )}
        </div>
      )}

      {google && (
        <>
          <GoogleSignIn
            lastUsed={lastUsed === 'google'}
            onError={(message) => {
              setError(message);
              setGoogleHint(false);
            }}
          />
          <AuthDivider />
        </>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-neutral-300 mb-1.5"
          >
            Correo
          </label>
          <Controller
            name="email"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                id="email"
                type="email"
                autoComplete="email"
                required
                className={`${INPUT} ${errors.email ? 'border-red-500' : 'border-white/10'}`}
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
          <label
            htmlFor="password"
            className="block text-sm font-medium text-neutral-300 mb-1.5"
          >
            Contraseña
          </label>
          <Controller
            name="password"
            control={control}
            render={({ field }) => (
              <PasswordInput
                {...field}
                id="password"
                autoComplete="current-password"
                required
                className={`${INPUT} pl-4 ${errors.password ? 'border-red-500' : 'border-white/10'}`}
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
          <div className="flex flex-col items-center justify-center">
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
                options={TURNSTILE_OPTIONS}
                className="w-full"
              />
            )}
            {captchaError && (
              <div className="text-red-400 text-sm p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-center w-full mt-2">
                Error de seguridad. Desactivá el AdBlocker o recargá la página.
              </div>
            )}
          </div>
        )}

        <div className="relative">
          <button
            type="submit"
            disabled={
              !mounted ||
              loading ||
              captchaError ||
              (!captchaToken && process.env.NODE_ENV === 'production')
            }
            className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-medium transition-colors disabled:opacity-50"
          >
            {!mounted
              ? 'Conectando...'
              : loading
                ? 'Ingresando...'
                : 'Ingresar'}
          </button>
          {google && lastUsed === 'password' && <LastUsedBadge />}
        </div>
      </form>

      <p className="mt-10 text-center text-xs text-neutral-500">
        <Link
          href="/terminos"
          className="hover:text-neutral-300 underline underline-offset-2"
        >
          Términos de uso
        </Link>{' '}
        ·{' '}
        <Link
          href="/privacidad"
          className="hover:text-neutral-300 underline underline-offset-2"
        >
          Política de privacidad
        </Link>
      </p>
    </AuthShell>
  );
}
