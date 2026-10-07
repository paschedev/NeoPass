import { describe, expect, it } from 'vitest';
import { nextScan, SAME_QR_GAP_MS } from './scan-cooldown';

const seenAt = (entries: [string, number][]) => new Map(entries);

describe('nextScan', () => {
  it('el primer QR que aparece se valida', () => {
    const { code, seen } = nextScan(['qr-1'], new Map(), 1_000, false);

    expect(code).toBe('qr-1');
    expect(seen.get('qr-1')).toBe(1_000);
  });

  it('el mismo QR que sigue frente a la cámara no se vuelve a validar', () => {
    let seen = seenAt([['qr-1', 1_000]]);

    for (const now of [1_500, 3_000, 4_500, 6_000]) {
      const next = nextScan(['qr-1'], seen, now, false);
      expect(next.code).toBeNull();
      seen = next.seen;
    }
  });

  it('si el QR sale de la cámara y vuelve después de la espera, se valida de nuevo', () => {
    const { code } = nextScan(
      ['qr-1'],
      seenAt([['qr-1', 1_000]]),
      1_000 + SAME_QR_GAP_MS,
      false,
    );

    expect(code).toBe('qr-1');
  });

  it('un QR distinto se valida enseguida', () => {
    const { code } = nextScan(
      ['qr-1', 'qr-2'],
      seenAt([['qr-1', 1_000]]),
      1_200,
      false,
    );

    expect(code).toBe('qr-2');
  });

  it('mientras hay un resultado en pantalla no valida ninguno y no lo da por visto', () => {
    const busy = nextScan(['qr-2'], seenAt([['qr-1', 1_000]]), 1_200, true);

    expect(busy.code).toBeNull();
    expect(busy.seen.has('qr-2')).toBe(false);
    expect(nextScan(['qr-2'], busy.seen, 1_700, false).code).toBe('qr-2');
  });

  it('el QR ya validado que sigue a la vista mientras se ve su resultado no se valida al cerrarlo', () => {
    const busy = nextScan(['qr-1'], seenAt([['qr-1', 1_000]]), 2_500, true);

    expect(nextScan(['qr-1'], busy.seen, 4_000, false).code).toBeNull();
  });

  it('olvida los QR que dejó de ver', () => {
    const { seen } = nextScan(
      [],
      seenAt([['qr-1', 1_000]]),
      1_000 + SAME_QR_GAP_MS,
      false,
    );

    expect(seen.size).toBe(0);
  });
});
