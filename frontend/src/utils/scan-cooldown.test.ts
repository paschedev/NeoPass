import { describe, expect, it } from 'vitest';
import { isRepeatedScan, SAME_QR_COOLDOWN_MS } from './scan-cooldown';

describe('isRepeatedScan', () => {
  const last = { code: 'qr-1', at: 1_000 };

  it('ignora el mismo QR mientras dura la espera', () => {
    expect(isRepeatedScan('qr-1', last, 1_000 + SAME_QR_COOLDOWN_MS - 1)).toBe(
      true,
    );
  });

  it('vuelve a leer el mismo QR cuando pasó la espera', () => {
    expect(isRepeatedScan('qr-1', last, 1_000 + SAME_QR_COOLDOWN_MS)).toBe(
      false,
    );
  });

  it('un QR distinto se lee enseguida', () => {
    expect(isRepeatedScan('qr-2', last, 1_001)).toBe(false);
  });

  it('el primer escaneo siempre se lee', () => {
    expect(isRepeatedScan('qr-1', null, 1_001)).toBe(false);
  });
});
