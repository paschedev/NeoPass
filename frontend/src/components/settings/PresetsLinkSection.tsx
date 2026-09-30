import Link from 'next/link';
import { Ticket } from 'lucide-react';

export default function PresetsLinkSection() {
  return (
    <section className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center text-pink-400">
            <Ticket className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              Plantillas de entradas
            </h2>
            <p className="text-neutral-400 text-sm">
              Los tipos de entrada que usás seguido, para cargarlos rápido
            </p>
          </div>
        </div>
        <Link
          href="/panel/configuracion/presets"
          className="w-full sm:w-auto text-center bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors"
        >
          Administrar plantillas
        </Link>
      </div>
    </section>
  );
}
