'use client';

import { useState } from 'react';
import { Link2, Save, Key, Lock, Ticket } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import { saveSession, useCurrentUser } from '@/hooks/useCurrentUser';
import { isOrganizer } from '@/utils/roles';
import PasswordInput from '@/components/forms/PasswordInput';

export default function ConfiguracionPage() {
  const [loadingMp, setLoadingMp] = useState(false);
  const { user } = useCurrentUser();
  const hasLinkedMp = !!user?.hasLinkedMp;

  // Password state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loadingPwd, setLoadingPwd] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const router = useRouter();

  const handleConnectMp = async () => {
    if (!user) return;
    try {
      const response = await apiFetch('/payments/oauth/link');
      const data = await response.json();
      if (response.ok && data.url) {
        window.location.href = data.url;
      } else {
        toast.error(
          getApiErrorMessage(data, 'Error al generar link de MercadoPago'),
        );
      }
    } catch (err) {
      toast.error('Error de conexión al servidor');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Las nuevas contraseñas no coinciden');
      return;
    }

    setLoadingPwd(true);
    try {
      const res = await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();

      if (res.ok) {
        // The change closes every other session; this one keeps going with
        // the new token.
        if (user) saveSession(data.access_token, user);
        toast.success('Contraseña actualizada con éxito');
        setShowPasswordForm(false);
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(getApiErrorMessage(data, 'Error al cambiar la contraseña'));
      }
    } catch (error) {
      toast.error('Error de conexión con el servidor');
    } finally {
      setLoadingPwd(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!user?.email) {
      toast.error('No se pudo identificar tu correo electrónico');
      return;
    }
    const toastId = toast.loading('Solicitando reseteo...');
    try {
      const res = await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: user.email }),
      });
      if (res.ok) {
        toast.success('Se ha enviado un enlace a tu correo.', { id: toastId });
      } else {
        toast.error('Hubo un problema.', { id: toastId });
      }
    } catch (error) {
      toast.error('Error de conexión.', { id: toastId });
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-0 pt-6 pb-24 md:py-12">
      <h1 className="font-outfit text-3xl font-bold text-white mb-8">
        Configuración
      </h1>

      {/* Contraseña Section */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center text-purple-400">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                Seguridad de la Cuenta
              </h2>
              <p className="text-neutral-400 text-sm">
                Gestiona tu contraseña y métodos de acceso
              </p>
            </div>
          </div>
          {!showPasswordForm && (
            <button
              onClick={() => setShowPasswordForm(true)}
              className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white px-4 py-3 sm:py-2 rounded-xl text-sm font-medium transition-colors"
            >
              Cambiar Contraseña
            </button>
          )}
        </div>

        {showPasswordForm && (
          <div className="mt-6 border-t border-white/10 pt-6 animate-in slide-in-from-top-4 fade-in duration-300">
            <form
              onSubmit={handleChangePassword}
              className="space-y-4 max-w-md"
            >
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">
                  Contraseña Actual
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-neutral-500" />
                  </div>
                  <PasswordInput
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    required
                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">
                  Nueva Contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Key className="h-4 w-4 text-neutral-500" />
                  </div>
                  <PasswordInput
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-2">
                  Confirmar Nueva Contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Key className="h-4 w-4 text-neutral-500" />
                  </div>
                  <PasswordInput
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>

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
                    onClick={() => setShowPasswordForm(false)}
                    className="bg-transparent hover:bg-white/5 text-neutral-300 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={
                      loadingPwd ||
                      !oldPassword ||
                      !newPassword ||
                      !confirmPassword
                    }
                    className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {loadingPwd ? 'Actualizando...' : 'Actualizar'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Mercado Pago Section */}
      {isOrganizer(user) && (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
              <Link2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Mercado Pago</h2>
              <p className="text-neutral-400 text-sm">
                Gestiona tu token de cobro de entradas
              </p>
            </div>
          </div>

          {hasLinkedMp ? (
            <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <p className="text-emerald-400 text-sm font-medium flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                Ya tienes una cuenta de Mercado Pago vinculada.
              </p>
              <button
                onClick={handleConnectMp}
                className="w-full sm:w-auto bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                Cambiar Cuenta Vinculada
              </button>
            </div>
          ) : (
            <div className="mb-6">
              <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
                Al conectar tu cuenta de Mercado Pago autorizarás a NeoPass a
                procesar las ventas en tu nombre. El dinero del valor de tus
                entradas irá <strong>directamente a tu cuenta</strong> sin
                descuentos. El cargo por servicio de la plataforma se le cobra
                como un extra directamente al comprador final.
              </p>
              <button
                onClick={handleConnectMp}
                className="w-full bg-[#009EE3] hover:bg-[#0089C7] text-white py-4 rounded-full font-bold transition-all shadow-lg shadow-[#009EE3]/20 flex items-center justify-center gap-2 mb-6"
              >
                Conectar con Mercado Pago
              </button>
            </div>
          )}
        </div>
      )}

      {/* Ticket Presets Section */}
      {isOrganizer(user) && (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center text-pink-400">
                <Ticket className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  Plantillas de Tickets
                </h2>
                <p className="text-neutral-400 text-sm">
                  Gestiona tus presets rápidos para los eventos
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push('/panel/configuracion/presets')}
              className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white px-6 py-3 sm:py-3 rounded-xl text-sm font-medium transition-colors"
            >
              Administrar Plantillas
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
