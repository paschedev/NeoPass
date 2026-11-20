import { CloudOff, Users } from 'lucide-react';
import { formatCountdown } from '@/utils/busy-retry';

export type BusyKind = 'busy' | 'failed';

const ICONS = { busy: Users, failed: CloudOff };

// What a page shows while its data cannot be loaded for a while: who is to
// blame in a few words, when it tries again by itself and a way to try now.
// The countdown line keeps its height while a try is running, so nothing
// moves.
export default function BusyNotice({
  kind,
  subject,
  secondsLeft,
  onRetry,
  className = '',
}: {
  kind: BusyKind;
  /** What could not be loaded: "el evento", "los eventos". */
  subject: string;
  secondsLeft: number | null;
  onRetry: () => void;
  className?: string;
}) {
  const Icon = ICONS[kind];
  return (
    <section
      aria-live="polite"
      className={`mx-auto flex max-w-sm flex-col items-center gap-3 text-center ${className}`}
    >
      <h2 className="flex items-center gap-2 font-outfit text-xl font-bold text-white">
        <Icon className="h-5 w-5 shrink-0 text-indigo-400" />
        {kind === 'busy'
          ? 'Hay mucha gente entrando'
          : `No pudimos cargar ${subject}`}
      </h2>
      <p className="min-h-6 text-neutral-400 tabular-nums">
        {secondsLeft === null
          ? 'Intentando de nuevo…'
          : `Reintentamos en ${formatCountdown(secondsLeft)}`}
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={secondsLeft === null}
        className="rounded-xl border border-white/10 bg-white/10 px-6 py-3 font-medium text-white transition-colors hover:bg-white/20 disabled:opacity-50"
      >
        Reintentar ahora
      </button>
    </section>
  );
}
