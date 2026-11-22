import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createResendLimits } from './resend-limits.js';

// Mails spaced like the app's queue: one every 125 ms (8 per second).
function sendSpaced(limits, count, startAt = 0, gapMs = 125) {
  return Array.from({ length: count }, (_, i) =>
    limits.admit(startAt + i * gapMs),
  );
}

describe('Resend simulado', () => {
  it('Free acepta hasta completar 100 mails en el día, contando los ya enviados', () => {
    const limits = createResendLimits({ plan: 'free', sentToday: 3 });

    const results = sendSpaced(limits, 120);

    assert.equal(results.filter((r) => r.accepted).length, 97);
    assert.equal(results[97].body.name, 'daily_quota_exceeded');
    assert.equal(results[97].status, 429);
  });

  it('Free también corta al llegar a 3.000 en el mes', () => {
    const limits = createResendLimits({
      plan: 'free',
      sentToday: 0,
      sentThisMonth: 2995,
    });

    const results = sendSpaced(limits, 10);

    assert.equal(results.filter((r) => r.accepted).length, 5);
    assert.equal(results[5].body.name, 'monthly_quota_exceeded');
  });

  it('Pro no tiene tope diario', () => {
    const limits = createResendLimits({ plan: 'pro', sentToday: 5000 });

    const results = sendSpaced(limits, 2000);

    assert.ok(results.every((r) => r.accepted));
  });

  it('el ritmo de la cola de mails (8 por segundo) nunca pasa los 10 por segundo', () => {
    const limits = createResendLimits({ plan: 'pro' });

    const results = sendSpaced(limits, 400);

    assert.ok(results.every((r) => r.accepted));
  });

  it('el pedido número 11 dentro del mismo segundo se rechaza por ritmo', () => {
    const limits = createResendLimits({ plan: 'pro' });

    const results = sendSpaced(limits, 11, 0, 50);

    assert.equal(results.filter((r) => r.accepted).length, 10);
    assert.equal(results[10].body.name, 'rate_limit_exceeded');
  });

  it('pasado un segundo del primero, vuelve a aceptar', () => {
    const limits = createResendLimits({ plan: 'pro' });
    sendSpaced(limits, 10, 0, 10);

    assert.equal(limits.admit(1000).accepted, true);
  });

  it('un rechazo por ritmo no gasta cupo del día', () => {
    const limits = createResendLimits({ plan: 'free', sentToday: 0 });
    sendSpaced(limits, 15, 0, 10);

    assert.equal(limits.usage().today, 10);
  });
});
