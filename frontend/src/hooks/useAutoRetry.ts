'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { retryDelayMs } from '@/utils/busy-retry';

const TICK_MS = 250;

// For a load that can fail for a while (too many people, a slow server, no
// signal). After a failure, `schedule` starts a countdown; when it ends, or
// with `retryNow`, `attempt` goes up and the page loads again from its effect.
// `secondsLeft` is null while there is no countdown: loading or loaded.
export function useAutoRetry() {
  const [attempt, setAttempt] = useState(0);
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const failures = useRef(0);

  const retryNow = useCallback(() => {
    setRetryAt(null);
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    if (retryAt === null) return;
    const timer = setInterval(() => {
      const current = Date.now();
      if (current < retryAt) setNow(current);
      else retryNow();
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [retryAt, retryNow]);

  const schedule = useCallback((retryAfter: string | null) => {
    failures.current += 1;
    const current = Date.now();
    setNow(current);
    setRetryAt(current + retryDelayMs(failures.current, retryAfter));
  }, []);

  const succeeded = useCallback(() => {
    failures.current = 0;
  }, []);

  return {
    attempt,
    secondsLeft:
      retryAt === null ? null : Math.max(0, Math.ceil((retryAt - now) / 1000)),
    schedule,
    succeeded,
    retryNow,
  };
}
