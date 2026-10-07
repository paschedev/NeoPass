import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScanTone } from './scan-result';

type Beep = { frequency: number; seconds: number };

// Records the beeps that the page would play.
function fakeAudio() {
  const beeps: Beep[] = [];
  class FakeAudioContext {
    state = 'running';
    currentTime = 0;
    destination = {};
    createGain() {
      return { gain: { value: 0 }, connect: vi.fn() };
    }
    createOscillator() {
      const oscillator = {
        type: '',
        frequency: { value: 0 },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn((at: number) => {
          const [startAt] = oscillator.start.mock.calls.at(-1) as [number];
          beeps.push({
            frequency: oscillator.frequency.value,
            seconds: at - startAt,
          });
        }),
      };
      return oscillator;
    }
    resume = vi.fn();
  }
  vi.stubGlobal('AudioContext', FakeAudioContext);
  return beeps;
}

async function play(tone: ScanTone) {
  const { playScanFeedback } = await import('./scan-sound');
  playScanFeedback(tone);
}

describe('playScanFeedback', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('verde: un pitido agudo y corto', async () => {
    const beeps = fakeAudio();

    await play('success');

    expect(beeps).toHaveLength(1);
    expect(beeps[0].frequency).toBeGreaterThanOrEqual(800);
  });

  it('amarillo: dos pitidos', async () => {
    const beeps = fakeAudio();

    await play('warning');

    expect(beeps).toHaveLength(2);
  });

  it('rojo: un pitido grave y largo', async () => {
    const beeps = fakeAudio();

    await play('error');

    expect(beeps).toHaveLength(1);
    expect(beeps[0].frequency).toBeLessThan(400);
    expect(beeps[0].seconds).toBeGreaterThanOrEqual(0.3);
  });

  it('vibra con un patrón distinto según el resultado', async () => {
    fakeAudio();
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });

    for (const tone of ['success', 'warning', 'error'] as const) {
      await play(tone);
    }

    const patterns = vibrate.mock.calls.map(([pattern]) =>
      JSON.stringify(pattern),
    );
    expect(new Set(patterns).size).toBe(3);
  });

  it('en un navegador sin audio ni vibración no falla', async () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('navigator', {});

    await expect(play('success')).resolves.toBeUndefined();
  });
});
