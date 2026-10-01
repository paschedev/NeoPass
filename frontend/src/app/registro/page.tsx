'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import { TURNSTILE_OPTIONS } from '@/utils/captcha';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import { toE164Phone } from '@/utils/phone';
import PhoneInput from '@/components/forms/PhoneInput';
import PasswordInput from '@/components/forms/PasswordInput';
import { z } from 'zod';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const registerSchema = z
  .object({
    firstName: z
      .string()
      .min(2, 'Mínimo 2 caracteres')
      .max(16, 'Máximo 16 caracteres'),
    lastName: z
      .string()
      .min(2, 'Mínimo 2 caracteres')
      .max(16, 'Máximo 16 caracteres'),
    email: z
      .string()
      .email('Correo electrónico inválido')
      .max(38, 'Máximo 38 caracteres'),
    password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .max(32, 'Máximo 32 caracteres'),
    confirmPassword: z.string(),
    isOrganizer: z.boolean(),
    phonePrefix: z.string(),
    phoneNumber: z.string().optional(),
    companyName: z.string().max(50, 'Máximo 50 caracteres').optional(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        message: 'Las contraseñas no coinciden',
        path: ['confirmPassword'],
      });
    }
    if (data.isOrganizer) {
      if (!data.phoneNumber) {
        ctx.addIssue({
          code: 'custom',
          message: 'El número de teléfono es obligatorio',
          path: ['phoneNumber'],
        });
      } else if (!toE164Phone(data.phonePrefix, data.phoneNumber)) {
        ctx.addIssue({
          code: 'custom',
          message: 'El número de teléfono no es válido',
          path: ['phoneNumber'],
        });
      }
    }
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegistroPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const [captchaError, setCaptchaError] = useState(false);
  const [mounted, setMounted] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      isOrganizer: false,
      phonePrefix: '+54',
      phoneNumber: '',
      companyName: '',
    },
  });

  const isOrganizer = watch('isOrganizer');
  const phonePrefix = watch('phonePrefix');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const start = e.target.selectionStart;
    const formatted = e.target.value
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    e.target.value = formatted;
    e.target.setSelectionRange(start, start);
  };

  const onSubmit = async (data: RegisterFormValues) => {
    setLoading(true);
    setError('');

    const payload: any = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: data.password,
      captchaToken,
      role: data.isOrganizer ? 'ORGANIZER' : 'CUSTOMER',
    };

    if (data.isOrganizer) {
      payload.phone = toE164Phone(data.phonePrefix, data.phoneNumber ?? '');
      if (data.companyName?.trim()) {
        payload.companyName = data.companyName.trim();
      }
    }

    try {
      const response = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      } else {
        setError(
          getApiErrorMessage(responseData, 'Error al registrar el usuario'),
        );
      }
    } catch (err) {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950 p-4">
        <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-8 rounded-3xl text-center">
          <h2 className="text-2xl font-bold mb-2">¡Registro exitoso!</h2>
          <p>Te estamos redirigiendo al login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 relative overflow-x-hidden flex flex-col px-4">
      <div className="flex-1 min-h-[6rem] md:min-h-[8rem]" />
      <div className="w-full max-w-md bg-neutral-900 border border-white/5 p-8 rounded-3xl shadow-2xl z-10 mx-auto shrink-0">
        <div className="text-center mb-8">
          <Link
            href="/"
            className="font-outfit text-3xl font-bold tracking-tighter inline-block mb-2"
          >
            Neo<span className="text-indigo-500">Pass</span>
          </Link>
          <p className="text-neutral-400">Creá tu cuenta gratis</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">
                Nombre
              </label>
              <Controller
                name="firstName"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    maxLength={16}
                    spellCheck="false"
                    className={`w-full bg-white/5 border ${errors.firstName ? 'border-red-500' : 'border-white/10'} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors`}
                    placeholder="Juan"
                    onChange={(e) => {
                      handleNameChange(e);
                      field.onChange(e.target.value);
                    }}
                  />
                )}
              />
              {errors.firstName && (
                <span className="text-red-400 text-xs mt-1 block">
                  {errors.firstName.message}
                </span>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">
                Apellido
              </label>
              <Controller
                name="lastName"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    maxLength={16}
                    spellCheck="false"
                    className={`w-full bg-white/5 border ${errors.lastName ? 'border-red-500' : 'border-white/10'} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors`}
                    placeholder="Pérez"
                    onChange={(e) => {
                      handleNameChange(e);
                      field.onChange(e.target.value);
                    }}
                  />
                )}
              />
              {errors.lastName && (
                <span className="text-red-400 text-xs mt-1 block">
                  {errors.lastName.message}
                </span>
              )}
            </div>
          </div>

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
                  maxLength={38}
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
                <PasswordInput
                  {...field}
                  maxLength={32}
                  className={`w-full bg-white/5 border ${errors.password ? 'border-red-500' : 'border-white/10'} rounded-xl pl-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors`}
                  placeholder="••••••••"
                />
              )}
            />
            {errors.password && (
              <span className="text-red-400 text-xs mt-1 block">
                {errors.password.message}
              </span>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">
              Confirmar contraseña
            </label>
            <Controller
              name="confirmPassword"
              control={control}
              render={({ field }) => (
                <PasswordInput
                  {...field}
                  maxLength={32}
                  className={`w-full bg-white/5 border ${errors.confirmPassword ? 'border-red-500' : 'border-white/10'} rounded-xl pl-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors`}
                  placeholder="••••••••"
                />
              )}
            />
            {errors.confirmPassword && (
              <span className="text-red-400 text-xs mt-1 block">
                {errors.confirmPassword.message}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-4 rounded-xl mt-4">
            <Controller
              name="isOrganizer"
              control={control}
              render={({ field: { value, onChange, ...field } }) => (
                <input
                  {...field}
                  type="checkbox"
                  id="isOrganizer"
                  checked={value}
                  onChange={(e) => onChange(e.target.checked)}
                  className="w-5 h-5 accent-indigo-500 rounded cursor-pointer"
                />
              )}
            />
            <label
              htmlFor="isOrganizer"
              className="text-sm font-medium text-white cursor-pointer select-none"
            >
              Soy productor / organizador
            </label>
          </div>

          {isOrganizer && (
            <div className="space-y-4 pt-4 border-t border-white/10 mt-4 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-1">
                    Celular / WhatsApp
                  </label>
                  <Controller
                    name="phoneNumber"
                    control={control}
                    render={({ field }) => (
                      <PhoneInput
                        prefix={phonePrefix}
                        onPrefixChange={(code) =>
                          setValue('phonePrefix', code, {
                            shouldValidate: true,
                          })
                        }
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        invalid={!!errors.phoneNumber}
                      />
                    )}
                  />
                  {errors.phoneNumber && (
                    <span className="text-red-400 text-xs mt-1 block">
                      {errors.phoneNumber.message}
                    </span>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-1">
                    Nombre de la productora o marca (opcional)
                  </label>
                  <Controller
                    name="companyName"
                    control={control}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="text"
                        maxLength={50}
                        spellCheck="false"
                        className={`w-full bg-white/5 border ${errors.companyName ? 'border-red-500' : 'border-white/10'} rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors`}
                        placeholder="Ej: Producciones Norte, Studio 54"
                      />
                    )}
                  />
                  {errors.companyName && (
                    <span className="text-red-400 text-xs mt-1 block">
                      {errors.companyName.message}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

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
                  options={TURNSTILE_OPTIONS}
                  className="w-full"
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
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 mt-6 disabled:opacity-50"
          >
            {!mounted ? (
              'Conectando...'
            ) : loading ? (
              'Registrando...'
            ) : (
              <>
                <UserPlus className="w-5 h-5" /> Crear cuenta
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-neutral-500">
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300">
            Ingresá acá
          </Link>
        </div>
      </div>
      <div className="flex-1 min-h-[4rem]" />
    </div>
  );
}
