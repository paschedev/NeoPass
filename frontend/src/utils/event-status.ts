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
