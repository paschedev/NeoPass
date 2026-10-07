// Estado guardado de un evento, como lo lee el organizador en su panel.
export const EVENT_STATUS_STYLES: Record<string, string> = {
  PUBLISHED: 'bg-emerald-500/10 text-emerald-400',
  DRAFT: 'bg-amber-500/10 text-amber-400',
};

export const EVENT_STATUS_LABELS: Record<string, string> = {
  PUBLISHED: 'PUBLICADO',
  DRAFT: 'BORRADOR',
  FINISHED: 'FINALIZADO',
  CANCELLED: 'CANCELADO',
};

export const DEFAULT_STATUS_STYLE = 'bg-white/10 text-neutral-400';

// La etiqueta del evento en el panel: un evento eliminado lo dice, sea cual
// sea su estado guardado.
export function eventStatusBadge(event: {
  status: string;
  deletedAt?: string | null;
}): { label: string; className: string } {
  if (event.deletedAt) {
    return { label: 'ELIMINADO', className: 'bg-red-500/10 text-red-400' };
  }
  return {
    label: EVENT_STATUS_LABELS[event.status] ?? event.status,
    className: EVENT_STATUS_STYLES[event.status] ?? DEFAULT_STATUS_STYLE,
  };
}
