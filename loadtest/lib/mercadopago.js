// Mercado Pago simulado: guarda cada preferencia que crea el backend y, cuando
// el backend consulta el pago, lo devuelve aprobado por el total de la orden.
// El id del pago es el id de la orden: los avisos que manda el generador usan
// ese id, así no hace falta guardar otro.

// Comisión de MP al instante (6,6 % + IVA), la que supone el reparto de NeoPass.
const MERCADOPAGO_FEE_RATE = 0.07986;

// Los tokens de los organizadores de carga son "TEST-carga-org-<n>" y su
// cuenta de MP es 9000000 + n (lo arma seed.mjs).
export const SELLER_TOKEN_PREFIX = 'TEST-carga-org-';

export function mercadoPagoUserIdOf(token) {
  if (!token?.startsWith(SELLER_TOKEN_PREFIX)) return null;
  const n = Number(token.slice(SELLER_TOKEN_PREFIX.length));
  return Number.isInteger(n) && n > 0 ? String(9_000_000 + n) : null;
}

export function createMercadoPago() {
  const preferences = new Map();
  const paymentReads = new Map();
  const notified = new Set();

  function createPreference(token, body, now) {
    const orderId = body?.external_reference;
    const cents = (body?.items ?? []).reduce(
      (sum, item) =>
        sum + Math.round(Number(item.unit_price) * 100) * Number(item.quantity),
      0,
    );
    if (!orderId || !Number.isFinite(cents) || cents <= 0) {
      return { status: 400, body: { message: 'invalid preference', status: 400 } };
    }
    preferences.set(orderId, {
      orderId,
      cents,
      mpUserId: mercadoPagoUserIdOf(token),
      createdAt: now,
    });
    return {
      status: 201,
      body: {
        id: `pref-${orderId}`,
        init_point: `https://carga.neopass.test/mp/${orderId}`,
      },
    };
  }

  function readPayment(paymentId, now) {
    const preference = preferences.get(paymentId);
    if (!preference) {
      return { status: 404, body: { message: 'Payment not found', status: 404 } };
    }
    const reads = paymentReads.get(paymentId);
    if (reads) reads.count += 1;
    else paymentReads.set(paymentId, { firstAt: now, count: 1 });

    const amount = preference.cents / 100;
    const approvedAt = new Date(now).toISOString();
    return {
      status: 200,
      body: {
        id: paymentId,
        status: 'approved',
        status_detail: 'accredited',
        external_reference: paymentId,
        transaction_amount: amount,
        date_approved: approvedAt,
        money_release_date: approvedAt,
        fee_details: [
          {
            type: 'mercadopago_fee',
            fee_payer: 'collector',
            amount: Math.round(amount * MERCADOPAGO_FEE_RATE * 100) / 100,
          },
        ],
      },
    };
  }

  // Órdenes con preferencia que todavía no se pagaron, para que el generador
  // mande sus avisos; cada una se entrega una sola vez.
  function takeOrdersToPay(limit) {
    const orders = [];
    for (const { orderId, mpUserId } of preferences.values()) {
      if (orders.length >= limit) break;
      if (paymentReads.has(orderId) || notified.has(orderId)) continue;
      notified.add(orderId);
      orders.push({ orderId, mpUserId });
    }
    return orders;
  }

  return {
    createPreference,
    readPayment,
    takeOrdersToPay,
    stats: () => ({
      preferences: preferences.size,
      noticesPrepared: notified.size,
      paymentsRead: paymentReads.size,
    }),
    paymentRecords: () =>
      [...paymentReads.entries()].map(([orderId, read]) => ({
        orderId,
        firstReadAt: read.firstAt,
        reads: read.count,
      })),
    reset: () => {
      preferences.clear();
      paymentReads.clear();
      notified.clear();
    },
  };
}
