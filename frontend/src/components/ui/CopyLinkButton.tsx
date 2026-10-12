'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Link2, X } from 'lucide-react';
import { copyLink } from '@/utils/share';

type CopyState = 'idle' | 'copied' | 'failed';

const FEEDBACK_MS = 2000;

// Cómo se ve el botón después de tocarlo, y lo que escucha un lector de
// pantalla. El rebote solo corre si el teléfono no pide menos movimiento.
const RESULT = {
  copied: {
    Icon: Check,
    label: '¡Copiado!',
    announcement: 'Link copiado',
    className: 'bg-emerald-600 hover:bg-emerald-600 text-white',
  },
  failed: {
    Icon: X,
    label: 'No se pudo copiar',
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
  const Icon = result?.Icon ?? Link2;

  return (
    <>
      <button
        type="button"
        onClick={copy}
        // Después de tocarlo se lee lo que muestra ("¡Copiado!").
        aria-label={result ? undefined : ariaLabel}
        className={`${className} transition-colors ${result ? `${result.className} motion-safe:animate-pop` : idleClassName}`}
      >
        <Icon className="w-4 h-4" /> {result?.label ?? 'Copiar link'}
      </button>
      <span role="status" className="sr-only">
        {result?.announcement}
      </span>
    </>
  );
}
