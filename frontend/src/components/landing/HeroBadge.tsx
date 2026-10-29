'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';

// Abre la frase de marca y después rotan cosas que el código cumple: la
// venta se acredita en la cuenta de Mercado Pago del organizador, cada RRPP
// vende con su link y su comisión, y el equipo manda QR free.
const PHRASES = [
  'La nueva era de los eventos',
  'Cobrás directo en tu Mercado Pago',
  'RRPP con link y comisión',
  'QR free para tus invitados',
];

const INTERVAL_MS = 3500;

export default function HeroBadge({ className = '' }: { className?: string }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(
      () => setCurrent((index) => (index + 1) % PHRASES.length),
      INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <p
      className={`items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-sm font-medium ${className}`}
    >
      <Star aria-hidden="true" className="w-4 h-4 shrink-0" />
      {/* Todas las frases en la misma celda: la etiqueta mide lo que la más
          larga y no cambia de ancho. La que entra espera a que salga la otra. */}
      <span className="grid">
        {PHRASES.map((phrase, index) => {
          const shown = index === current;
          return (
            <span
              key={phrase}
              aria-hidden={shown ? undefined : true}
              style={{ opacity: shown ? 1 : 0 }}
              className={`[grid-area:1/1] text-center transition-opacity duration-300 ${
                shown ? 'delay-300' : ''
              }`}
            >
              {phrase}
            </span>
          );
        })}
      </span>
    </p>
  );
}
