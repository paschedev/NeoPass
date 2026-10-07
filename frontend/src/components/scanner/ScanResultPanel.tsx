'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RotateCw,
  XCircle,
} from 'lucide-react';
import type { DoorScannerState } from '@/hooks/useDoorScanner';
import {
  checkInOpensLabel,
  entryDeadlinePassedLabel,
  scanTone,
  usedDetailLabel,
  type ScanTone,
} from '@/utils/scan-result';

export const TONE_STYLES: Record<
  ScanTone,
  { bgDark: string; border: string; bgSolid: string; Icon: typeof CheckCircle2 }
> = {
  success: {
    bgDark: 'bg-emerald-950',
    border: 'border-emerald-500 shadow-emerald-500/50',
    bgSolid: 'bg-emerald-500/95',
    Icon: CheckCircle2,
  },
  warning: {
    bgDark: 'bg-amber-950',
    border: 'border-amber-500 shadow-amber-500/50',
    bgSolid: 'bg-amber-500/95',
    Icon: AlertTriangle,
  },
  error: {
    bgDark: 'bg-red-950',
    border: 'border-red-500 shadow-red-500/50',
    bgSolid: 'bg-red-500/95',
    Icon: XCircle,
  },
};

const DETAIL =
  'text-lg opacity-90 text-center px-4 font-medium bg-black/20 py-2 rounded-2xl';

// Tapa la cámara mientras se valida y mientras se ve el resultado: un
// resultado por vez, nada se valida por detrás.
export default function ScanResultPanel({
  state,
  onNext,
  onRetry,
}: {
  state: Exclude<DoorScannerState, { kind: 'scanning' }>;
  onNext: () => void;
  onRetry: () => void;
}) {
  if (state.kind === 'checking') {
    return (
      <section
        aria-label="Resultado del escaneo"
        className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-neutral-950/90 text-white"
      >
        <Loader2 className="w-16 h-16 animate-spin" />
        <p className="text-2xl font-bold">Validando…</p>
      </section>
    );
  }

  const { result, canRetry } = state;
  const { bgSolid, Icon } = TONE_STYLES[scanTone(result.status)];
  const details = [
    result.event &&
      `${result.event} - ${result.type}${result.isGuestList ? ' · QR free' : ''}`,
    usedDetailLabel(result),
    result.validUntil && entryDeadlinePassedLabel(result.validUntil),
    result.opensAt && checkInOpensLabel(result.opensAt),
    result.status === 'NO_CONNECTION' && 'Revisá la conexión y reintentá',
  ].filter((detail): detail is string => Boolean(detail));

  return (
    <section
      aria-label="Resultado del escaneo"
      aria-live="assertive"
      className={`absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-white animate-in fade-in zoom-in duration-300 ${bgSolid}`}
    >
      <Icon className="w-24 h-24" />
      <h2 className="text-4xl font-black text-center tracking-tight leading-tight">
        {result.message}
      </h2>
      {details.map((detail) => (
        <p key={detail} className={DETAIL}>
          {detail}
        </p>
      ))}
      <div className="mt-2 flex w-full gap-2">
        {canRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-white/60 py-3 font-bold"
          >
            <RotateCw className="w-5 h-5" />
            Reintentar
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          className="flex-1 rounded-xl bg-white py-3 font-bold text-neutral-950"
        >
          Escanear siguiente
        </button>
      </div>
    </section>
  );
}
