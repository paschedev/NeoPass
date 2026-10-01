'use client';

import { useRef, useState } from 'react';
import toast from '@/utils/toast';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';

// Vincula la cuenta de Mercado Pago del organizador: pide el link de OAuth y
// lleva al usuario a autorizar. Mientras tanto el botón queda "conectando".
export function useMercadoPagoConnect() {
  const pending = useRef(false);
  const [connecting, setConnecting] = useState(false);

  const connect = async () => {
    if (pending.current) return;
    pending.current = true;
    setConnecting(true);
    try {
      const response = await apiFetch('/payments/oauth/link');
      const data = await response.json().catch(() => null);
      if (response.ok && data?.url) {
        window.location.assign(data.url);
        return;
      }
      toast.error(
        getApiErrorMessage(data, 'No se pudo generar el link de Mercado Pago'),
      );
    } catch {
      toast.error('Error de conexión al servidor');
    }
    pending.current = false;
    setConnecting(false);
  };

  return { connecting, connect };
}
