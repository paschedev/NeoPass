'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import { nextScan } from '@/utils/scan-cooldown';
import {
  addToScanHistory,
  closesByItself,
  scanTone,
  SUCCESS_RESULT_MS,
  type ScanHistoryEntry,
} from '@/utils/scan-result';
import { playScanFeedback } from '@/utils/scan-sound';

export interface ScanResult {
  status: string;
  message: string;
  event?: string;
  type?: string;
  isGuestList?: boolean;
  opensAt?: string;
  validUntil?: string;
  usedAt?: string;
  usedBy?: string;
  usedByYou?: boolean;
}

export type DoorScannerState =
  | { kind: 'scanning' }
  | { kind: 'checking' }
  | { kind: 'result'; result: ScanResult; canRetry: boolean };

const NO_CONNECTION: ScanResult = {
  status: 'NO_CONNECTION',
  message: 'NO SE PUDO VALIDAR',
};

type Timer = { current: ReturnType<typeof setTimeout> | null };

function stopTimer(timer: Timer) {
  if (timer.current) clearTimeout(timer.current);
  timer.current = null;
}

// Un resultado por vez: mientras se valida un QR o se ve su resultado, la
// cámara no valida ningún otro (ver `nextScan`).
export function useDoorScanner() {
  const [state, setState] = useState<DoorScannerState>({ kind: 'scanning' });
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);
  const busy = useRef(false);
  const seen = useRef<ReadonlyMap<string, number>>(new Map());
  const lastCode = useRef<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextHistoryId = useRef(1);

  const dismiss = useCallback(() => {
    stopTimer(closeTimer);
    busy.current = false;
    setState({ kind: 'scanning' });
  }, []);

  const showResult = useCallback(
    (result: ScanResult, canRetry = false) => {
      stopTimer(closeTimer);
      busy.current = true;
      setState({ kind: 'result', result, canRetry });
      const tone = scanTone(result.status);
      const entry: ScanHistoryEntry = {
        id: nextHistoryId.current++,
        at: new Date().toISOString(),
        tone,
        message: result.message,
        detail: result.type,
      };
      setHistory((current) => addToScanHistory(current, entry));
      playScanFeedback(tone);
      if (closesByItself(tone)) {
        closeTimer.current = setTimeout(dismiss, SUCCESS_RESULT_MS);
      }
    },
    [dismiss],
  );

  const check = useCallback(
    async (code: string) => {
      busy.current = true;
      lastCode.current = code;
      setState({ kind: 'checking' });
      try {
        const response = await apiFetch('/tickets/check-in', {
          method: 'POST',
          body: JSON.stringify({ qrCode: code }),
        });
        const data = await response.json();
        if (response.ok) {
          showResult(data as ScanResult);
        } else {
          showResult(
            {
              status: 'INVALID',
              message: getApiErrorMessage(data, 'Error del servidor'),
            },
            response.status >= 500,
          );
        }
      } catch {
        // Sin respuesta (señal, servidor caído): puede que haya entrado o no,
        // así que se ofrece reintentar en vez de adivinar.
        showResult(NO_CONNECTION, true);
      }
    },
    [showResult],
  );

  // Lo que ve la cámara, unas dos veces por segundo.
  const onDetect = useCallback(
    (codes: string[]) => {
      const next = nextScan(codes, seen.current, Date.now(), busy.current);
      seen.current = next.seen;
      if (next.code) void check(next.code);
    },
    [check],
  );

  const retry = useCallback(() => {
    stopTimer(closeTimer);
    if (lastCode.current) void check(lastCode.current);
  }, [check]);

  useEffect(() => () => stopTimer(closeTimer), []);

  return { state, history, onDetect, dismiss, retry, showResult };
}
