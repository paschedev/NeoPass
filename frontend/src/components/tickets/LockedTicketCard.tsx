import { Calendar, Gift, Lock, MapPin } from 'lucide-react';

// Un QR free que llegó al correo de la cuenta mientras el correo no está
// confirmado. Tiene la forma de una entrada pero translúcida y con candado:
// el servidor no manda nada del evento (cualquiera puede abrir una cuenta con
// un correo ajeno), así que los datos son barras tapadas. Tocarla abre la
// confirmación del correo, no el QR.
export default function LockedTicketCard({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Entrada de regalo bloqueada. Confirmá tu correo para verla."
      className="group w-full text-left bg-neutral-900/50 border border-dashed border-amber-500/30 rounded-3xl overflow-hidden cursor-pointer hover:border-amber-400/60 transition-all relative"
    >
      <div className="p-6">
        <div className="flex justify-between items-start mb-6 opacity-70">
          <div className="bg-white/10 rounded-lg px-3 py-1.5 text-xs font-semibold text-white tracking-wide flex items-center gap-1.5">
            <Gift className="w-3.5 h-3.5 text-indigo-300" />
            Regalo
          </div>
          <div className="px-3 py-1 rounded-full text-xs font-bold border bg-amber-500/10 text-amber-300 border-amber-500/20 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            BLOQUEADA
          </div>
        </div>

        <div className="relative" aria-hidden="true">
          <div className="opacity-40 blur-[2px] select-none">
            <h3 className="font-outfit text-2xl font-bold text-white mb-4">
              Entrada de regalo
            </h3>
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 shrink-0 text-indigo-400" />
                <span className="h-3 w-44 rounded-full bg-white/30" />
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 shrink-0 text-indigo-400" />
                <span className="h-3 w-32 rounded-full bg-white/30" />
              </div>
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-neutral-950/80 border border-amber-500/30 flex items-center justify-center text-amber-300 group-hover:scale-110 transition-transform">
              <Lock className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-white/10 border-dashed flex items-center justify-between gap-3">
          <div className="text-xs text-neutral-400">
            Confirmá tu correo para verla
          </div>
          <div className="text-sm font-medium text-amber-300 group-hover:text-amber-200 transition-colors">
            Desbloquear
          </div>
        </div>
      </div>
    </button>
  );
}
