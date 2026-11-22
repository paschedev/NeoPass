// Datos de la prueba de carga: los crea seed.js y los usan el servicio y los
// escenarios de k6. Ids fijos, así nadie tiene que pasarse listas: cada tipo
// de dato tiene su prefijo y el número va al final (UUID v4 válido).
const PREFIX = {
  buyer: '10000000',
  organizer: '20000000',
  event: '30000000',
  batch: '40000000',
  ticketType: '50000000',
  scanner: '60000000',
  staff: '70000000',
};

export function loadId(kind, n) {
  return `${PREFIX[kind]}-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

export const LAYOUT = {
  organizers: 4,
  // Eventos 1..40 publicados, a la venta. Cada uno tiene la entrada general
  // n y la VIP n + vipOffset, con stock de sobra.
  events: 40,
  vipOffset: 100,
  // Tandas para agotar: entradas 201, 202 y 203 del evento 1, una por corrida.
  selloutTypes: [201, 202, 203],
  selloutStock: 500,
  buyers: 3000,
  // Evento de la puerta (escáner): empieza a la media hora de cargar los datos.
  doorEvent: 50,
  doorTickets: 30000,
  scanners: 20,
};

export const buyerEmail = (n) => `comprador-${n}@carga.neopass.test`;
export const scannerEmail = (n) => `escaner-${n}@carga.neopass.test`;
export const organizerEmail = (n) => `organizador-${n}@carga.neopass.test`;
export const qrCode = (n) => `carga-qr-${n}`;
// Organizador que publica el evento n.
export const organizerOfEvent = (n) => ((n - 1) % LAYOUT.organizers) + 1;
