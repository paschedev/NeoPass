'use client';

import { XCircle, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CheckoutFailurePage() {
  const router = useRouter();

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="bg-neutral-900 border border-white/10 p-8 md:p-12 rounded-3xl w-full max-w-lg text-center shadow-2xl">
        <div className="w-20 h-20 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-10 h-10" />
        </div>

        <h1 className="font-outfit text-3xl font-bold text-white mb-4">
          Pago Rechazado
        </h1>
        <p className="text-neutral-400 mb-8 leading-relaxed">
          Hubo un problema al procesar tu tarjeta o el pago fue rechazado por
          Mercado Pago. Por favor, intenta nuevamente con otro medio de pago.
        </p>

        <button
          onClick={() => router.back()}
          className="w-full bg-white/10 hover:bg-white/20 text-white py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" /> Volver a intentar
        </button>
      </div>
    </div>
  );
}
