'use client';

import { useSvgId } from './Isologo';
import { BRAND_FROM, BRAND_TO, ISOLOGO, LOCKUP, WORDMARK } from './paths';

// El logo completo: «neopass» con la N al final, apuntando hacia adelante, en
// un solo dibujo. Los lectores de pantalla lo leen como «NeoPass». El tamaño
// lo pone quien lo usa (alto con h-*, ancho automático).
export default function Logo({ className = '' }: { className?: string }) {
  const neo = useSvgId('neo');
  const mark = useSvgId('n');

  return (
    <svg
      viewBox={`0 0 ${LOCKUP.width} ${LOCKUP.height}`}
      className={className}
      role="img"
      aria-label="NeoPass"
      focusable="false"
    >
      <defs>
        <linearGradient
          id={mark}
          gradientUnits="userSpaceOnUse"
          {...ISOLOGO.gradient}
        >
          <stop offset="0" stopColor={BRAND_FROM} />
          <stop offset="1" stopColor={BRAND_TO} />
        </linearGradient>
        <linearGradient
          id={neo}
          gradientUnits="userSpaceOnUse"
          {...WORDMARK.gradient}
        >
          <stop offset="0" stopColor={BRAND_FROM} />
          <stop offset="1" stopColor={BRAND_TO} />
        </linearGradient>
      </defs>
      <g transform={`translate(0 ${LOCKUP.wordmarkY})`}>
        {WORDMARK.neo.map((d) => (
          <path key={d} d={d} fill={`url(#${neo})`} />
        ))}
        {WORDMARK.pass.map((d) => (
          <path key={d} d={d} fill="currentColor" />
        ))}
      </g>
      <path
        d={ISOLOGO.d}
        fill={`url(#${mark})`}
        transform={`translate(${LOCKUP.isologoX} 0) scale(${LOCKUP.isologoScale})`}
      />
    </svg>
  );
}
