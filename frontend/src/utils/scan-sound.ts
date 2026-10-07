import type { ScanTone } from './scan-result';

// En la puerta no siempre se mira la pantalla: cada resultado suena y vibra
// distinto. Verde, un pitido agudo; amarillo, dos; rojo, uno grave y largo.
const FEEDBACK: Record<
  ScanTone,
  {
    wave: OscillatorType;
    frequency: number;
    beeps: number;
    seconds: number;
    vibration: number[];
  }
> = {
  success: {
    wave: 'sine',
    frequency: 880,
    beeps: 1,
    seconds: 0.15,
    vibration: [80],
  },
  warning: {
    wave: 'sine',
    frequency: 660,
    beeps: 2,
    seconds: 0.12,
    vibration: [80, 80, 80],
  },
  error: {
    wave: 'square',
    frequency: 220,
    beeps: 1,
    seconds: 0.4,
    vibration: [400],
  },
};

const GAP_SECONDS = 0.08;
const VOLUME = 0.2;

let audio: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  audio ??= new AudioContext();
  // Sin un toque previo en la página el navegador puede tenerlo en pausa.
  if (audio.state === 'suspended') void audio.resume();
  return audio;
}

export function playScanFeedback(tone: ScanTone): void {
  const { wave, frequency, beeps, seconds, vibration } = FEEDBACK[tone];

  const context = audioContext();
  if (context) {
    for (let i = 0; i < beeps; i++) {
      const start = context.currentTime + i * (seconds + GAP_SECONDS);
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = wave;
      oscillator.frequency.value = frequency;
      gain.gain.value = VOLUME;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + seconds);
    }
  }

  // Solo Android vibra; iOS no tiene la API.
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(vibration);
  }
}
