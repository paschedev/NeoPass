'use client';

import { Loader2 } from 'lucide-react';
import { useMercadoPagoConnect } from '@/hooks/useMercadoPagoConnect';

const VARIANTS = {
  connect: {
    label: 'Conectar con Mercado Pago',
    className:
      'w-full bg-[#009EE3] hover:bg-[#0089C7] text-white py-4 rounded-full font-bold shadow-lg shadow-[#009EE3]/20 hover:shadow-[#009EE3]/40 focus-visible:ring-[#009EE3]/60',
  },
  change: {
    label: 'Cambiar Cuenta Vinculada',
    className:
      'w-full sm:w-auto bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-xl text-sm font-medium focus-visible:ring-white/30',
  },
};

// Botón que lleva al OAuth de Mercado Pago; queda "Conectando..." hasta salir.
export default function ConnectMercadoPagoButton({
  variant = 'connect',
}: {
  variant?: keyof typeof VARIANTS;
}) {
  const { connecting, connect } = useMercadoPagoConnect();
  const { label, className } = VARIANTS[variant];

  return (
    <button
      type="button"
      onClick={connect}
      disabled={connecting}
      className={`${className} flex items-center justify-center gap-2 transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 disabled:opacity-70 disabled:cursor-wait disabled:active:scale-100`}
    >
      {connecting ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" /> Conectando...
        </>
      ) : (
        label
      )}
    </button>
  );
}
