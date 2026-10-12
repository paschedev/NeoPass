import { describe, expect, it } from 'vitest';
import {
  allowsFreeTicketType,
  chosenFreeTicketTypes,
  entryDeadlineOptions,
  eventTicketTypeNames,
  freeTicketsBlockedReason,
  freeTicketsSchema,
  freeTicketTypeOptions,
  freeTicketTypesError,
  joinNames,
} from './free-tickets';

describe('freeTicketTypeOptions', () => {
  it('ofrece cada tipo de entrada de todas las tandas como "Tipo · Tanda"', () => {
    expect(
      freeTicketTypeOptions([
        {
          name: 'Preventa',
          ticketTypes: [
            { id: 't1', name: 'General' },
            { id: 't2', name: 'VIP' },
          ],
        },
        { name: 'Invitados', ticketTypes: [{ id: 't3', name: 'General' }] },
      ]),
    ).toEqual([
      { id: 't1', label: 'General · Preventa' },
      { id: 't2', label: 'VIP · Preventa' },
      { id: 't3', label: 'General · Invitados' },
    ]);
  });
});

const at = (local: string) => new Date(`${local}-03:00`);

describe('entryDeadlineOptions', () => {
  it('ofrece horarios cada 30 minutos desde después del inicio hasta el fin', () => {
    const options = entryDeadlineOptions(
      {
        startDate: at('2026-10-10T23:00').toISOString(),
        endDate: at('2026-10-11T02:00').toISOString(),
      },
      at('2026-10-10T12:00'),
    );

    expect(options.map((option) => option.label)).toEqual([
      '23:30',
      '00:00',
      '00:30',
      '01:00',
      '01:30',
      '02:00',
    ]);
    expect(options[3].value).toBe(at('2026-10-11T01:00').toISOString());
  });

  it('si el inicio no cae en punto ni y media, arranca en la media hora siguiente', () => {
    const options = entryDeadlineOptions(
      {
        startDate: at('2026-10-10T22:15').toISOString(),
        endDate: at('2026-10-10T23:30').toISOString(),
      },
      at('2026-10-10T12:00'),
    );

    expect(options.map((option) => option.label)).toEqual([
      '22:30',
      '23:00',
      '23:30',
    ]);
  });

  it('no ofrece horarios que ya pasaron', () => {
    const options = entryDeadlineOptions(
      {
        startDate: at('2026-10-10T23:00').toISOString(),
        endDate: at('2026-10-11T02:00').toISOString(),
      },
      at('2026-10-11T00:10'),
    );

    expect(options[0].label).toBe('00:30');
  });

  it('si el evento dura más de un día, cada opción dice también el día', () => {
    const options = entryDeadlineOptions(
      {
        startDate: at('2026-10-10T20:00').toISOString(),
        endDate: at('2026-10-12T04:00').toISOString(),
      },
      at('2026-10-10T12:00'),
    );

    expect(options[0].label).toBe('sáb, 10 oct, 20:30');
  });
});

describe('freeTicketsSchema', () => {
  const valid = {
    ticketTypeId: 't1',
    quantity: '3',
    email: '  Ana@Example.com ',
    name: '',
    validUntil: '',
  };

  it('arma el envío con el correo prolijo, la cantidad como número y sin hora límite', () => {
    expect(freeTicketsSchema.parse(valid)).toEqual({
      ticketTypeId: 't1',
      quantity: 3,
      email: 'ana@example.com',
      name: null,
      validUntil: null,
    });
  });

  it('manda el nombre y la hora límite si se completaron', () => {
    const validUntil = at('2026-10-11T01:00').toISOString();

    expect(
      freeTicketsSchema.parse({ ...valid, name: ' Ana ', validUntil }),
    ).toMatchObject({ name: 'Ana', validUntil });
  });

  it.each([
    ['un correo inválido', { email: 'ana@' }, 'Poné un correo válido'],
    ['sin tipo de entrada', { ticketTypeId: '' }, 'Elegí un tipo de entrada'],
    [
      'un nombre de más de 60 caracteres',
      { name: 'a'.repeat(61) },
      'El nombre puede tener hasta 60 caracteres',
    ],
  ])('rechaza %s', (_case, override, message) => {
    const result = freeTicketsSchema.safeParse({ ...valid, ...override });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(message);
  });
});

describe('freeTicketsBlockedReason', () => {
  const event = {
    status: 'PUBLISHED',
    startDate: at('2026-10-10T23:00').toISOString(),
    endDate: at('2026-10-11T05:00').toISOString(),
  };
  const now = at('2026-10-10T12:00');

  it('un evento publicado que no terminó y con tipos de entrada permite mandar', () => {
    expect(freeTicketsBlockedReason(event, 2, now)).toBeNull();
  });

  it('en borrador pide publicarlo', () => {
    expect(
      freeTicketsBlockedReason({ ...event, status: 'DRAFT' }, 2, now),
    ).toBe('Publicá el evento para mandar QR free.');
  });

  it.each([
    ['terminó', event, at('2026-10-11T06:00')],
    ['se canceló', { ...event, status: 'CANCELLED' }, now],
  ])('si el evento %s ya no deja mandar', (_case, closed, when) => {
    expect(freeTicketsBlockedReason(closed, 2, when)).toBe(
      'El evento terminó: ya no se pueden mandar QR free.',
    );
  });

  it('sin tipos de entrada no hay qué mandar', () => {
    expect(freeTicketsBlockedReason(event, 0, now)).toBe(
      'Creá un tipo de entrada para mandar QR free.',
    );
  });

  it('a quien no le quedó ningún tipo permitido le dice que lo pida', () => {
    expect(freeTicketsBlockedReason(event, 0, now, true)).toBe(
      'No tenés tipos de entrada habilitados para QR free. Pedíselos a quien organiza el evento.',
    );
  });
});

describe('tipos de entrada que se pueden regalar', () => {
  const batches = [
    {
      name: 'Preventa',
      ticketTypes: [
        { id: 't1', name: 'General' },
        { id: 't2', name: 'VIP' },
      ],
    },
    {
      name: 'Lote 1',
      ticketTypes: [
        { id: 't3', name: 'general ' },
        { id: 't4', name: 'Mesa' },
      ],
    },
  ];

  it('los nombres del evento van una vez cada uno, en el orden de las tandas', () => {
    expect(eventTicketTypeNames(batches)).toEqual(['General', 'VIP', 'Mesa']);
  });

  it('un nombre permitido vale en todas las tandas, sin importar mayúsculas ni espacios', () => {
    expect(allowsFreeTicketType(['general'], 'General ')).toBe(true);
    expect(allowsFreeTicketType(['VIP'], 'VIP Gold')).toBe(false);
  });

  it('el formulario ofrece solo los tipos permitidos; sin lista, todos', () => {
    expect(freeTicketTypeOptions(batches, ['General'])).toEqual([
      { id: 't1', label: 'General · Preventa' },
      { id: 't3', label: 'general  · Lote 1' },
    ]);
    expect(freeTicketTypeOptions(batches, null)).toHaveLength(4);
  });

  it('de lo tildado quedan solo los tipos que el evento tiene, en su orden', () => {
    expect(
      chosenFreeTicketTypes(
        ['Mesa', 'VIP Gold', 'general'],
        ['General', 'VIP', 'Mesa'],
      ),
    ).toEqual(['General', 'Mesa']);
  });

  it('une los nombres como se leen', () => {
    expect(joinNames(['General'])).toBe('General');
    expect(joinNames(['General', 'VIP'])).toBe('General y VIP');
    expect(joinNames(['General', 'VIP', 'Mesa'])).toBe('General, VIP y Mesa');
  });

  it('habilitar QR free pide al menos un tipo', () => {
    expect(freeTicketTypesError([])).toBe(
      'Elegí al menos un tipo de entrada para los QR free',
    );
    expect(freeTicketTypesError(['General'])).toBeNull();
  });
});
