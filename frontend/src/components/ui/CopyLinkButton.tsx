'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Link2, X } from 'lucide-react';
import { copyLink } from '@/utils/share';

type CopyState = 'idle' | 'copied' | 'failed';

const FEEDBACK_MS = 2000;

// Lo que muestra el botón en cada momento. Los textos tienen largos parecidos
// y van superpuestos: el botón guarda el lugar del más largo y no cambia de
// tamaño (ni mueve a los botones de al lado) al confirmar.
const LABELS: { state: CopyState; Icon: typeof Link2; text: string }[] = [
  { state: 'idle', Icon: Link2, text: 'Copiar link' },
  { state: 'copied', Icon: Check, text: '¡Copiado!' },
  { state: 'failed', Icon: X, text: 'No se copió' },
];

// Cómo se ve el botón después de tocarlo, y lo que escucha un lector de
// pantalla. El rebote solo corre si el teléfono no pide menos movimiento.
const RESULT = {
  copied: {
    announcement: 'Link copiado',
    className: 'bg-emerald-600 hover:bg-emerald-600 text-white',
  },
  failed: {
    announcement: 'No se pudo copiar el link',
    className: 'bg-red-600 hover:bg-red-600 text-white',
  },
};

// "Copiar link" que confirma en el mismo botón: verde con "¡Copiado!", o rojo
// si el navegador no dejó copiar, y a los 2 segundos vuelve. Cada pantalla
// pone el tamaño (className) y los colores de reposo (idleClassName). El link
// se arma al tocarlo.
export default function CopyLinkButton({
  link,
  className,
  idleClassName,
  ariaLabel,
}: {
  link: () => string;
  className: string;
  idleClassName: string;
  ariaLabel?: string;
}) {
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    const copied = await copyLink(link());
    if (timer.current) clearTimeout(timer.current);
    setState(copied ? 'copied' : 'failed');
    timer.current = setTimeout(() => setState('idle'), FEEDBACK_MS);
  };

  const result = state === 'idle' ? null : RESULT[state];

  return (
    <>
      <button
        type="button"
        onClick={copy}
        // Después de tocarlo se lee lo que muestra ("¡Copiado!").
        aria-label={result ? undefined : ariaLabel}
        className={`${className} transition-colors ${result ? `${result.className} motion-safe:animate-pop` : idleClassName}`}
      >
        <span className="grid">
          {LABELS.map(({ state: labelState, Icon, text }) => (
            <span
              key={labelState}
              data-label
              aria-hidden={labelState === state ? undefined : true}
              className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-2 ${labelState === state ? '' : 'invisible'}`}
            >
              <Icon className="w-4 h-4" />
              {text}
            </span>
          ))}
        </span>
      </button>
      <span role="status" className="sr-only">
        {result?.announcement}
      </span>
    </>
  );
}
