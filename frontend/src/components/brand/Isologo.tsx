'use client';

import { useId } from 'react';
import { BRAND_FROM, BRAND_TO, ISOLOGO } from './paths';

// Un id que sirve dentro de url(#…): sin los símbolos que pone useId.
export function useSvgId(prefix: string) {
  return prefix + useId().replace(/[^a-zA-Z0-9_-]/g, '');
}

// La N de NeoPass. Decorativa por defecto: quien la acompaña con el nombre no
// necesita que la lean dos veces. El tamaño lo pone quien la usa (alto con
// h-*, ancho automático).
export default function Isologo({
  className = '',
  label,
}: {
  className?: string;
  label?: string;
}) {
  const gradient = useSvgId('isologo');
  const { x1, y1, x2, y2 } = ISOLOGO.gradient;

  return (
    <svg
      viewBox={`0 0 ${ISOLOGO.width} ${ISOLOGO.height}`}
      className={className}
      {...(label
        ? { role: 'img', 'aria-label': label }
        : { 'aria-hidden': true })}
      focusable="false"
    >
      <defs>
        <linearGradient
          id={gradient}
          gradientUnits="userSpaceOnUse"
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
        >
          <stop offset="0" stopColor={BRAND_FROM} />
          <stop offset="1" stopColor={BRAND_TO} />
        </linearGradient>
      </defs>
      <path d={ISOLOGO.d} fill={`url(#${gradient})`} />
    </svg>
  );
}
