import { formatClockTime } from '@/utils/format';
import type { ScanHistoryEntry, ScanTone } from '@/utils/scan-result';

const DOT: Record<ScanTone, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
};

// Responde "¿lo validé o no?" sin volver a escanear.
export default function ScanHistory({
  history,
}: {
  history: ScanHistoryEntry[];
}) {
  if (history.length === 0) return null;

  return (
    <section aria-label="Últimos escaneos" className="mt-6 w-full">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-neutral-500">
        Últimos escaneos
      </h2>
      <ul className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-neutral-900">
        {history.map((entry) => (
          <li
            key={entry.id}
            className="flex items-center gap-3 px-4 py-2.5 text-sm"
          >
            <span
              aria-hidden
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[entry.tone]}`}
            />
            <span className="tabular-nums text-neutral-400">
              {formatClockTime(entry.at)}
            </span>
            <span className="font-semibold text-white">{entry.message}</span>
            {entry.detail && (
              <span className="truncate text-neutral-400">{entry.detail}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
