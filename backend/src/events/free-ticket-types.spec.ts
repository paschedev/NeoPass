import {
  allowedFreeTicketBatches,
  allowsFreeTicketType,
  freeTicketsUpTo,
  NO_FREE_TICKET_TYPES,
  pickFreeTicketTypes,
  UNKNOWN_FREE_TICKET_TYPE,
} from './free-ticket-types';

describe('allowsFreeTicketType', () => {
  it('el mismo nombre vale sin importar mayúsculas ni espacios', () => {
    expect(allowsFreeTicketType(['General'], '  general ')).toBe(true);
    expect(allowsFreeTicketType([' vip'], 'VIP')).toBe(true);
  });

  it('un nombre parecido no alcanza', () => {
    expect(allowsFreeTicketType(['VIP'], 'VIP Gold')).toBe(false);
    expect(allowsFreeTicketType([], 'General')).toBe(false);
  });
});

describe('pickFreeTicketTypes', () => {
  const eventTypes = ['General', 'VIP', 'General'];

  it('sin tipos elegidos da error', () => {
    expect(() => pickFreeTicketTypes(undefined, eventTypes)).toThrow(
      NO_FREE_TICKET_TYPES,
    );
    expect(() => pickFreeTicketTypes([], eventTypes)).toThrow(
      NO_FREE_TICKET_TYPES,
    );
  });

  it('un tipo que el evento no tiene da error', () => {
    expect(() => pickFreeTicketTypes(['General', 'Mesa'], eventTypes)).toThrow(
      UNKNOWN_FREE_TICKET_TYPE,
    );
    expect(() => pickFreeTicketTypes(['General'], [])).toThrow(
      UNKNOWN_FREE_TICKET_TYPE,
    );
  });

  it('guarda cada tipo una vez, como lo escribe el evento y en el orden elegido', () => {
    expect(
      pickFreeTicketTypes(['vip', ' general', 'GENERAL'], eventTypes),
    ).toEqual(['VIP', 'General']);
  });
});

describe('freeTicketsUpTo', () => {
  it('dice el tope y los tipos', () => {
    expect(freeTicketsUpTo(10, ['General', 'VIP'])).toBe(
      'hasta 10 QR free de General y VIP',
    );
    expect(freeTicketsUpTo(1, ['VIP'])).toBe('hasta 1 QR free de VIP');
  });

  it('sin tipos, solo el tope', () => {
    expect(freeTicketsUpTo(5, [])).toBe('hasta 5 QR free');
  });
});

describe('allowedFreeTicketBatches', () => {
  const batches = [
    {
      name: 'Preventa',
      ticketTypes: [
        { id: 't-1', name: 'General' },
        { id: 't-2', name: 'VIP' },
      ],
    },
    { name: 'Mesas', ticketTypes: [{ id: 't-3', name: 'Mesa' }] },
  ];

  it('deja solo los tipos permitidos y saca las tandas que quedan vacías', () => {
    expect(allowedFreeTicketBatches(batches, ['vip'])).toEqual([
      { name: 'Preventa', ticketTypes: [{ id: 't-2', name: 'VIP' }] },
    ]);
  });
});
