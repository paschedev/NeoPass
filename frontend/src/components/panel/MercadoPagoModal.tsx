'use client';

import toast from 'react-hot-toast';
import { Link2, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';

// Explica la vinculación y redirige al OAuth de Mercado Pago.
export default function MercadoPagoModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const handleConnect = async () => {
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
    } catch {
      toast.error('Error de conexión al servidor');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="mp-modal-title"
      className="bg-neutral-900 border border-white/10 p-8 rounded-3xl w-full max-w-md relative shadow-2xl"
    >
      <button
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute top-6 right-6 text-neutral-500 hover:text-white transition-colors bg-white/5 p-2 rounded-full hover:bg-white/10"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="w-16 h-16 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center mb-6">
        <Link2 className="w-8 h-8" />
      </div>

      <h2 id="mp-modal-title" className="text-2xl font-bold mb-2">
        Vincular Mercado Pago
      </h2>
      <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
        Al conectar tu cuenta de Mercado Pago autorizarás a NeoPass a procesar
        las ventas en tu nombre. El dinero del valor de tus entradas irá{' '}
        <strong>directamente a tu cuenta</strong> sin descuentos. El cargo por
        servicio de la plataforma se le cobra como un extra directamente al
        comprador final.
      </p>

      <button
        onClick={handleConnect}
        className="w-full bg-[#009EE3] hover:bg-[#0089C7] text-white py-4 rounded-full font-bold transition-all shadow-lg shadow-[#009EE3]/20 flex items-center justify-center gap-2 mb-6"
      >
        Conectar con Mercado Pago
      </button>
    </Modal>
  );
}
