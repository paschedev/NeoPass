import { Link2 } from 'lucide-react';
import ConnectMercadoPagoButton from '@/components/panel/ConnectMercadoPagoButton';

// Organizer's Mercado Pago account, where the ticket sales are paid.
export default function MercadoPagoSection({ linked }: { linked: boolean }) {
  return (
    <section className="p-6 md:p-8">
      <div className="flex items-center gap-4 mb-6">
        <Link2
          aria-hidden="true"
          className="w-5 h-5 shrink-0 text-neutral-400"
        />
        <div>
          <h2 className="text-lg font-bold text-white">Mercado Pago</h2>
          <p className="text-neutral-400 text-sm">
            La cuenta donde cobrás tus entradas
          </p>
        </div>
      </div>

      {linked ? (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <p className="text-emerald-400 text-sm font-medium flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            Ya tenés una cuenta de Mercado Pago vinculada.
          </p>
          <ConnectMercadoPagoButton variant="change" />
        </div>
      ) : (
        <div>
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
