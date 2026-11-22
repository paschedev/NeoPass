// Límites de Resend que simula el servicio de carga (verificados el 2026-11-18):
// - Free: 100 mails por día y 3.000 por mes.
// - Pro (USD 20 por mes): sin tope diario; 50.000 por mes con excedente pago,
//   que una prueba no alcanza.
// - Los dos: 10 pedidos por segundo por equipo.
// Resend no publica cómo cuenta el segundo: acá es una ventana móvil de 1 s,
// la lectura más estricta.

export const PLANS = {
  free: { daily: 100, monthly: 3000 },
  pro: { daily: Infinity, monthly: Infinity },
};

const REQUESTS_PER_SECOND = 10;
const WINDOW_MS = 1000;

export function createResendLimits({
  plan = 'pro',
  sentToday = 0,
  sentThisMonth = 0,
} = {}) {
  const limits = PLANS[plan];
  if (!limits) throw new Error(`Unknown Resend plan: ${plan}`);
  const recent = [];
  let today = sentToday;
  let month = Math.max(sentThisMonth, sentToday);

  // Decide one request at `now` (ms). Every request counts for the per-second
  // limit, also the rejected ones; only an accepted one spends quota.
  function admit(now) {
    while (recent.length > 0 && recent[0] <= now - WINDOW_MS) recent.shift();
    const overRate = recent.length >= REQUESTS_PER_SECOND;
    recent.push(now);
    if (overRate) {
      return rejection(
        'rate_limit_exceeded',
        'Too many requests. You can only make 10 requests per second.',
      );
    }
    if (today >= limits.daily) {
      return rejection(
        'daily_quota_exceeded',
        'You have reached your daily email sending quota.',
      );
    }
    if (month >= limits.monthly) {
      return rejection(
        'monthly_quota_exceeded',
        'You have reached your monthly email sending quota.',
      );
    }
    today += 1;
    month += 1;
    return { accepted: true };
  }

  return {
    admit,
    usage: () => ({ plan, today, month }),
  };
}

function rejection(name, message) {
  return { accepted: false, status: 429, body: { statusCode: 429, name, message } };
}
