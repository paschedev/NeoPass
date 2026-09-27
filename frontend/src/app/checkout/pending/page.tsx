'use client';

import { Clock, Ticket, Calendar as CalendarIcon } from 'lucide-react';
import Link from 'next/link';

export default function CheckoutPendingPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="bg-neutral-900 border border-white/10 p-8 md:p-12 rounded-3xl w-full max-w-lg text-center shadow-2xl">
        <div className="w-20 h-20 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock className="w-10 h-10" />
        </div>

        <h1 className="font-outfit text-3xl font-bold text-white mb-4">
          Pago Pendiente
        </h1>
        <p className="text-neutral-400 mb-8 leading-relaxed">
          Tu pago está siendo procesado (por ejemplo, si usaste Rapipago o Pago
          Fácil). Una vez que el saldo se acredite, tus entradas se generarán
          automáticamente.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/panel/tickets"
            className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-4 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <Ticket className="w-5 h-5" /> Mis Tickets
          </Link>
          <Link
            href="/"
            className="flex-1 bg-white/10 hover:bg-white/20 text-white py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
          >
            <CalendarIcon className="w-5 h-5" /> Eventos
          </Link>
        </div>
      </div>
    </div>
  );
}
