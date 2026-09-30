import { Link2 } from 'lucide-react';
import ConnectMercadoPagoButton from '@/components/panel/ConnectMercadoPagoButton';

// Organizer's Mercado Pago account, where the ticket sales are paid.
export default function MercadoPagoSection({ linked }: { linked: boolean }) {
  return (
    <section className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-8">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
          <Link2 className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Mercado Pago</h2>
          <p className="text-neutral-400 text-sm">
            La cuenta donde cobrás tus entradas
          </p>
        </div>
      </div>

      {linked ? (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <p className="text-emerald-400 text-sm font-medium flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            Ya tenés una cuenta de Mercado Pago vinculada.
          </p>
          <ConnectMercadoPagoButton variant="change" />
        </div>
      ) : (
        <div className="mb-6">
          <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
            Al conectar tu cuenta de Mercado Pago autorizás a NeoPass a procesar
            las ventas en tu nombre. El valor de tus entradas va{' '}
            <strong>directamente a tu cuenta</strong>, sin descuentos. El cargo
            por servicio de la plataforma se le cobra aparte al comprador.
          </p>
          <ConnectMercadoPagoButton />
        </div>
      )}
    </section>
  );
}
