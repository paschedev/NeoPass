import { calculateCheckoutTotals } from './checkout';
import type { PublicEvent } from './event-metadata';
import { INSTAGRAM_URL, SITE_NAME, SITE_URL, eventPath } from './site';

// Datos para Google (schema.org, en JSON-LD). No cambian nada de lo que se
// ve: le dicen a Google cómo se llama el sitio y cuál es su logo, y de cada
// evento cuándo y dónde es y cuánto sale la entrada.

const SCHEMA = 'https://schema.org';

// En la home: el nombre que Google pone arriba del resultado («NeoPass» en
// lugar de «neopass.ar»), el logo y las redes de la marca.
export function homeJsonLd() {
  return {
    '@context': SCHEMA,
    '@graph': [
      {
        '@type': 'WebSite',
        name: SITE_NAME,
        alternateName: 'neopass.ar',
        url: `${SITE_URL}/`,
      },
      {
        '@type': 'Organization',
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        logo: `${SITE_URL}/apple-icon.png`,
        sameAs: [INSTAGRAM_URL],
      },
    ],
  };
}

type Batch = NonNullable<PublicEvent['ticketBatches']>[number];
type TicketType = Batch['ticketTypes'][number];

function availability(batch: Batch, type: TicketType) {
  if (batch.saleStatus === 'UPCOMING') return `${SCHEMA}/PreOrder`;
  if (batch.saleStatus === 'ON_SALE' && type.available > 0) {
    return `${SCHEMA}/InStock`;
  }
  return `${SCHEMA}/SoldOut`;
}

// Google pide el precio con los cargos incluidos: lo que paga quien compra
// una entrada, con el mismo cálculo del checkout.
const priceWithFee = (price: string | number, fee: string | number) =>
  calculateCheckoutTotals([{ id: 'entrada', price }], { entrada: 1 }, fee)
    .total;

function offers(event: PublicEvent, url: string) {
  return (event.ticketBatches ?? []).flatMap((batch) =>
    batch.ticketTypes.map((type) => ({
      '@type': 'Offer',
      name: `${batch.name} · ${type.name}`,
      price: priceWithFee(type.price, event.buyerFeePercentage ?? 0),
      priceCurrency: 'ARS',
      availability: availability(batch, type),
      url,
      ...(batch.saleStatus === 'UPCOMING' && batch.publishAt
        ? { validFrom: batch.publishAt }
        : {}),
    })),
  );
}

function place(event: PublicEvent) {
  const { latitude, longitude } = event;
  return {
    '@type': 'Place',
    name: event.venueName,
    address: {
      '@type': 'PostalAddress',
      ...(event.venueAddress ? { streetAddress: event.venueAddress } : {}),
      ...(event.venueCity ? { addressLocality: event.venueCity } : {}),
      addressCountry: 'AR',
    },
    ...(typeof latitude === 'number' && typeof longitude === 'number'
      ? { geo: { '@type': 'GeoCoordinates', latitude, longitude } }
      : {}),
  };
}

// La ficha del evento: con ella Google lo puede mostrar en búsquedas como
// «fiestas en Córdoba este sábado». La API solo devuelve eventos publicados
// que no terminaron; uno cancelado deja de existir y sale de Google solo.
export function eventJsonLd(event: PublicEvent, id: string) {
  const url = `${SITE_URL}${eventPath(id)}`;
  const eventOffers = offers(event, url);
  return {
    '@context': SCHEMA,
    '@type': 'Event',
    name: event.title,
    ...(event.description ? { description: event.description } : {}),
    startDate: event.startDate,
    ...(event.endDate ? { endDate: event.endDate } : {}),
    eventStatus: `${SCHEMA}/EventScheduled`,
    eventAttendanceMode: `${SCHEMA}/OfflineEventAttendanceMode`,
    location: place(event),
    ...(event.imageUrl ? { image: [event.imageUrl] } : {}),
    ...(event.organizerName
      ? { organizer: { '@type': 'Organization', name: event.organizerName } }
      : {}),
    ...(eventOffers.length > 0 ? { offers: eventOffers } : {}),
    url,
  };
}
