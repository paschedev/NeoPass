import { describe, expect, it } from 'vitest';
import type { PublicEvent } from './event-metadata';
import { eventJsonLd, homeJsonLd } from './structured-data';

const EVENT_ID = '3f1c2b6e-8a4d-4c1e-9b7a-2d5e6f708192';
const EVENT_URL = `https://neopass.ar/eventos/${EVENT_ID}`;

// Con los nombres de campo de GET /events/:id.
const event: PublicEvent = {
  title: 'Noche de Techno',
  description: 'Seis horas de techno.',
  imageUrl:
    'https://res.cloudinary.com/neopass/image/upload/v1760000000/flyers/noche.jpg',
  startDate: '2026-11-15T02:00:00.000Z',
  endDate: '2026-11-15T08:00:00.000Z',
  venueName: 'Club Central',
  venueAddress: 'Av. Colón 1234',
  venueCity: 'Córdoba',
  latitude: -31.41,
  longitude: -64.19,
  organizerName: 'Productora Sur',
  buyerFeePercentage: '10.00',
  ticketBatches: [
    {
      name: 'Preventa',
      publishAt: null,
      saleStatus: 'SOLD_OUT',
      ticketTypes: [{ name: 'General', price: '30000', available: 0 }],
    },
    {
      name: 'Tanda 1',
      publishAt: null,
      saleStatus: 'ON_SALE',
      ticketTypes: [
        { name: 'General', price: '35000', available: 120 },
        { name: 'VIP', price: '50000.50', available: 0 },
      ],
    },
    {
      name: 'Tanda 2',
      publishAt: '2026-11-10T15:00:00.000Z',
      saleStatus: 'UPCOMING',
      ticketTypes: [{ name: 'General', price: '40000', available: 200 }],
    },
  ],
};

describe('Ficha del evento para Google', () => {
  it('dice qué es, cuándo y dónde, con la dirección y el mapa', () => {
    const data = eventJsonLd(event, EVENT_ID);

    expect(data).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'Noche de Techno',
      description: 'Seis horas de techno.',
      startDate: '2026-11-15T02:00:00.000Z',
      endDate: '2026-11-15T08:00:00.000Z',
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: {
        '@type': 'Place',
        name: 'Club Central',
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'Av. Colón 1234',
          addressLocality: 'Córdoba',
          addressCountry: 'AR',
        },
        geo: { '@type': 'GeoCoordinates', latitude: -31.41, longitude: -64.19 },
      },
      image: [event.imageUrl],
      organizer: { '@type': 'Organization', name: 'Productora Sur' },
      url: EVENT_URL,
    });
  });

  it('cada entrada lleva el precio con el cargo de servicio incluido, en pesos', () => {
    const { offers } = eventJsonLd(event, EVENT_ID);

    expect(offers?.map(({ name, price }) => [name, price])).toEqual([
      ['Preventa · General', 33000],
      ['Tanda 1 · General', 38500],
      // 50.000,50 + 10 % = 55.000,55: redondeado a centavos como el checkout.
      ['Tanda 1 · VIP', 55000.55],
      ['Tanda 2 · General', 44000],
    ]);
    expect(offers?.every((offer) => offer.priceCurrency === 'ARS')).toBe(true);
    expect(offers?.every((offer) => offer.url === EVENT_URL)).toBe(true);
  });

  it('marca qué entradas quedan, cuáles se agotaron y cuáles salen a la venta más adelante', () => {
    const { offers } = eventJsonLd(event, EVENT_ID);

    expect(offers?.map((offer) => offer.availability)).toEqual([
      'https://schema.org/SoldOut',
      'https://schema.org/InStock',
      // En venta pero sin lugar: agotada.
      'https://schema.org/SoldOut',
      'https://schema.org/PreOrder',
    ]);
    expect(offers?.[3]).toMatchObject({ validFrom: '2026-11-10T15:00:00.000Z' });
    expect(offers?.[1]).not.toHaveProperty('validFrom');
  });

  it('un evento sin flyer, descripción, organizador, mapa ni tandas sigue armando una ficha válida', () => {
    const data = eventJsonLd(
      {
        title: 'Fiesta',
        imageUrl: null,
        startDate: '2026-12-01T01:00:00.000Z',
        venueName: 'Bar del Centro',
        description: null,
        latitude: null,
        longitude: null,
        ticketBatches: [],
      },
      EVENT_ID,
    );

    expect(data).not.toHaveProperty('image');
    expect(data).not.toHaveProperty('description');
    expect(data).not.toHaveProperty('organizer');
    expect(data).not.toHaveProperty('offers');
    expect(data.location).not.toHaveProperty('geo');
    expect(data.location.address).toEqual({
      '@type': 'PostalAddress',
      addressCountry: 'AR',
    });
  });
});

describe('Datos del sitio para Google', () => {
  it('se llama NeoPass, dice qué es y tiene logo, contacto, país y el Instagram de la marca', () => {
    expect(homeJsonLd()).toEqual({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          name: 'NeoPass',
          alternateName: 'neopass.ar',
          url: 'https://neopass.ar/',
          inLanguage: 'es-AR',
        },
        {
          '@type': 'Organization',
          name: 'NeoPass',
          url: 'https://neopass.ar/',
          logo: 'https://neopass.ar/apple-icon.png',
          description: expect.stringMatching(/^Ticketera argentina/),
          email: 'soporte@neopass.ar',
          areaServed: { '@type': 'Country', name: 'Argentina' },
          sameAs: ['https://www.instagram.com/neopass.ar/'],
        },
      ],
    });
  });
});
