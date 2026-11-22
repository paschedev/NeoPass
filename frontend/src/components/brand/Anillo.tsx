import type { CSSProperties } from 'react';

// El anillo vidrioso de los estados vacíos, en su pastilla oscura. La luz
// queda quieta y la textura gira debajo, así el reflejo cambia de lugar. Solo
// se mueve esa capa, con transform; con "reducir movimiento" queda quieto.
// Es decorativo: el texto de al lado dice qué pasa.

const RING_MASK =
  'radial-gradient(closest-side, transparent 55%, #000 57%, #000 97%, transparent 99.5%)';

const MASKED: CSSProperties = {
  maskImage: RING_MASK,
  WebkitMaskImage: RING_MASK,
};

const TEXTURE: CSSProperties = {
  background:
    'conic-gradient(from 0deg, #0d0b22 0deg, #2b2780 26deg, #c7d2fe 46deg, #f8faff 52deg, #5b55e8 66deg, #14123a 104deg, #0a0a14 150deg, #3a33b8 190deg, #a5b4fc 212deg, #eef2ff 218deg, #4338ca 236deg, #110f2c 280deg, #6d28d9 318deg, #1b1650 340deg, #0d0b22 360deg)',
};

// La luz fija: arriba a la izquierda brilla, abajo a la derecha se apaga.
const LIGHT: CSSProperties = {
  background:
    'radial-gradient(90% 70% at 28% 18%, rgba(255,255,255,.5), rgba(255,255,255,0) 46%), radial-gradient(80% 80% at 78% 88%, rgba(0,0,0,.7), rgba(0,0,0,0) 60%)',
  mixBlendMode: 'soft-light',
};

// El volumen del tubo: oscuro en los bordes, apenas claro en el medio.
const TUBE: CSSProperties = {
  background:
    'radial-gradient(closest-side, rgba(0,0,0,0) 54%, rgba(0,0,0,.6) 57%, rgba(255,255,255,.1) 70%, rgba(0,0,0,0) 80%, rgba(0,0,0,.55) 96%, rgba(0,0,0,0) 99.5%)',
};

// El filo de adentro y de afuera, más marcado donde pega la luz.
const EDGE_FADE =
  'linear-gradient(160deg, #000 10%, rgba(0,0,0,.25) 60%, #000 100%)';
const EDGE: CSSProperties = {
  background:
    'radial-gradient(closest-side, rgba(255,255,255,0) 56%, rgba(255,255,255,.55) 57.2%, rgba(255,255,255,0) 59.5%, rgba(255,255,255,0) 95%, rgba(255,255,255,.3) 97.5%, rgba(255,255,255,0) 99.5%)',
  maskImage: EDGE_FADE,
  WebkitMaskImage: EDGE_FADE,
};

export default function Anillo({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`grid size-24 place-items-center rounded-3xl border border-white/10 bg-[radial-gradient(120%_100%_at_50%_0%,#1a1a22,#0b0b0f_70%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_40px_-18px_rgba(0,0,0,0.9)] ${className}`}
    >
      <div className="relative size-16">
        <div
          className="absolute inset-0 overflow-hidden rounded-full"
          style={MASKED}
        >
          <div
            className="absolute -inset-[30%] motion-safe:animate-girar"
            style={TEXTURE}
          />
          <div className="absolute inset-0" style={LIGHT} />
        </div>
        <div className="absolute inset-0 rounded-full" style={TUBE} />
        <div className="absolute inset-0 rounded-full" style={EDGE} />
      </div>
    </div>
  );
}
