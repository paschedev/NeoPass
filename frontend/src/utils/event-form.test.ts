import { describe, expect, it } from 'vitest';
import {
  buildEventSchema,
  getDateLimits,
  toEventFormInput,
  toEventPayload,
  type EventFormInput,
} from './event-form';

// Fechas en hora local de Buenos Aires (TZ fijo en la config de Vitest).
const NOW = new Date('2026-10-01T12:00:00-03:00');
const clock = () => NOW;

const valid: EventFormInput = {
  title: 'Fiesta de primavera',
  description: 'Música toda la noche',
  imageUrl: 'https://res.cloudinary.com/neopass/image/upload/v1/fiesta.jpg',
  youtubeLink: '',
  startDate: '2026-10-10T22:00',
  endDate: '2026-10-11T05:00',
  venueName: 'Club Central',
  venueAddress: 'Av. Siempre Viva 742',
  batches: [],
};

const errorsOf = (
  values: EventFormInput,
  rules: Parameters<typeof buildEventSchema>[0] = { phase: 'NOT_STARTED' },
) => {
  const result = buildEventSchema(rules, clock).safeParse(values);
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
  );
};

describe('buildEventSchema', () => {
  it('crear: acepta un inicio futuro con el fin posterior al inicio', () => {
    expect(errorsOf(valid)).toEqual({});
  });

  it('crear: rechaza un inicio que ya pasó', () => {
    expect(errorsOf({ ...valid, startDate: '2026-10-01T11:59' })).toEqual({
      startDate: 'La fecha de inicio ya pasó',
    });
  });

  it('rechaza un fin igual o anterior al inicio', () => {
    expect(errorsOf({ ...valid, endDate: '2026-10-10T22:00' })).toEqual({
      endDate: 'El fin tiene que ser posterior al inicio',
    });
    expect(errorsOf({ ...valid, startDate: '2026-10-11T06:00' })).toEqual({
      endDate: 'El fin tiene que ser posterior al inicio',
    });
  });

  it('pide nombre, descripción, flyer, fechas, lugar y dirección', () => {
    const empty: EventFormInput = {
      title: '  ',
      description: '',
      imageUrl: '',
      youtubeLink: '',
      startDate: '',
      endDate: '',
      venueName: '',
      venueAddress: '',
      batches: [],
    };

    expect(errorsOf(empty)).toEqual({
      title: 'Poné el nombre del evento',
      description: 'Contá de qué trata el evento',
      imageUrl: 'Subí el flyer del evento',
      startDate: 'Elegí la fecha de inicio',
      endDate: 'Elegí la fecha de fin',
      venueName: 'Poné el nombre del lugar',
      venueAddress: 'Poné la dirección',
    });
  });

  it('el link de YouTube es opcional, pero si se completa tiene que ser un link', () => {
    expect(
      errorsOf({ ...valid, youtubeLink: 'https://youtu.be/abc123' }),
    ).toEqual({});
    expect(errorsOf({ ...valid, youtubeLink: 'mi video' })).toEqual({
      youtubeLink: 'El link de YouTube no es válido',
    });
  });

  it('editar antes de empezar: un inicio nuevo que ya pasó se rechaza', () => {
    const rules = {
      phase: 'NOT_STARTED' as const,
      saved: { startDate: '2026-10-01T12:30', endDate: valid.endDate },
    };

    expect(
      errorsOf({ ...valid, startDate: '2026-10-01T11:00' }, rules),
    ).toEqual({ startDate: 'La fecha de inicio ya pasó' });
  });

  it('editar antes de empezar: el inicio guardado sin cambios se acepta aunque haya llegado la hora', () => {
    const rules = {
      phase: 'NOT_STARTED' as const,
      saved: { startDate: '2026-10-01T12:00', endDate: valid.endDate },
    };

    expect(
      errorsOf({ ...valid, startDate: '2026-10-01T12:00' }, rules),
    ).toEqual({});
  });

  it('en curso: el fin solo se puede extender', () => {
    const rules = {
      phase: 'IN_PROGRESS' as const,
      saved: { startDate: '2026-10-01T10:00', endDate: '2026-10-01T20:00' },
    };
    const started = { ...valid, startDate: '2026-10-01T10:00' };

    expect(
      errorsOf({ ...started, endDate: '2026-10-01T19:00' }, rules),
    ).toEqual({
      endDate: 'El evento ya empezó: el fin solo se puede extender',
    });
    expect(
      errorsOf({ ...started, endDate: '2026-10-01T20:00' }, rules),
    ).toEqual({});
    expect(
      errorsOf({ ...started, endDate: '2026-10-02T02:00' }, rules),
    ).toEqual({});
  });
});

describe('getDateLimits', () => {
  it('crear: el inicio va de ahora hasta el fin elegido y el fin arranca en el inicio', () => {
    expect(
      getDateLimits(
        { startDate: valid.startDate, endDate: valid.endDate },
        { phase: 'NOT_STARTED' },
        NOW,
      ),
    ).toEqual({
      startMin: '2026-10-01T12:00',
      startMax: '2026-10-11T05:00',
      endMin: '2026-10-10T22:00',
    });
  });

  it('sin fechas elegidas, los dos selectores arrancan en ahora', () => {
    expect(
      getDateLimits(
        { startDate: '', endDate: '' },
        { phase: 'NOT_STARTED' },
        NOW,
      ),
    ).toEqual({
      startMin: '2026-10-01T12:00',
      startMax: undefined,
      endMin: '2026-10-01T12:00',
    });
  });

  it('en curso: el inicio no tiene selector y el fin arranca en el fin guardado', () => {
    expect(
      getDateLimits(
        { startDate: '2026-10-01T10:00', endDate: '2026-10-01T20:00' },
        {
          phase: 'IN_PROGRESS',
          saved: { startDate: '2026-10-01T10:00', endDate: '2026-10-01T20:00' },
        },
        NOW,
      ),
    ).toEqual({ endMin: '2026-10-01T20:00' });
  });
});

// Tanda como la guarda el formulario: fechas en ISO, precio y stock como texto.
const batch = (
  overrides: Partial<EventFormInput['batches'][number]> = {},
): EventFormInput['batches'][number] => ({
  name: 'Preventa',
  isVisible: true,
  publishAt: null,
  closeAt: null,
  ticketTypes: [{ name: 'General', price: '5000', stock: '100' }],
  ...overrides,
});

describe('tandas del formulario', () => {
  it('pide nombre de tanda y de entrada, precio y stock entero mayor a 0', () => {
    expect(
      errorsOf({
        ...valid,
        batches: [
          batch({
            name: ' ',
            ticketTypes: [
              { name: '', price: '', stock: '0' },
              { name: 'VIP', price: '-1', stock: '2.5' },
              { name: 'Mesa', price: '1000', stock: '' },
            ],
          }),
        ],
      }),
    ).toEqual({
      'batches.0.name': 'Poné el nombre de la tanda',
      'batches.0.ticketTypes.0.name': 'Poné el nombre de la entrada',
      'batches.0.ticketTypes.0.price': 'Poné el precio (0 si es gratis)',
      'batches.0.ticketTypes.0.stock': 'El stock tiene que ser mayor a 0',
      'batches.0.ticketTypes.1.price': 'El precio no puede ser negativo',
      'batches.0.ticketTypes.1.stock':
        'El stock tiene que ser un número entero',
      'batches.0.ticketTypes.2.stock': 'Poné el stock',
    });
  });

  it('el precio no puede superar $99.999.999,99', () => {
    expect(
      errorsOf({
        ...valid,
        batches: [
          batch({
            ticketTypes: [{ name: 'General', price: '100000000', stock: '1' }],
          }),
        ],
      }),
    ).toEqual({
      'batches.0.ticketTypes.0.price': 'El precio máximo es $99.999.999,99',
    });
  });

  it('el stock no puede quedar por debajo de lo vendido y reservado', () => {
    const general = { name: 'General', price: '5000.00', sold: 3, reserved: 2 };

    expect(
      errorsOf({
        ...valid,
        batches: [batch({ ticketTypes: [{ ...general, stock: 4 }] })],
      }),
    ).toEqual({
      'batches.0.ticketTypes.0.stock':
        'El stock no puede ser menor a lo vendido y reservado (5)',
    });
    expect(
      errorsOf({
        ...valid,
        batches: [batch({ ticketTypes: [{ ...general, stock: 5 }] })],
      }),
    ).toEqual({});
  });

  it('revisa la ventana de venta de cada tanda contra el fin del evento elegido', () => {
    // El evento termina el 11/10 a las 05:00 de Buenos Aires (08:00 UTC).
    expect(
      errorsOf({
        ...valid,
        batches: [
          batch(),
          batch({ name: 'General', closeAt: '2026-10-11T09:00:00.000Z' }),
        ],
      }),
    ).toEqual({
      'batches.1.closeAt': 'No puede ser después del fin del evento',
    });
  });

  it('editar: acepta el inicio de venta guardado aunque ya haya pasado', () => {
    const selling = batch({ id: 'b1', publishAt: '2026-09-30T12:00:00.000Z' });

    expect(errorsOf({ ...valid, batches: [selling] })).toEqual({
      'batches.0.publishAt': 'Esta fecha ya pasó',
    });
    expect(
      errorsOf(
        { ...valid, batches: [selling] },
        { phase: 'NOT_STARTED', saved: { ...valid, batches: [selling] } },
      ),
    ).toEqual({});
  });

  it('en curso no revisa las ventanas: las tandas quedan como están', () => {
    const started = { ...valid, startDate: '2026-10-01T10:00' };
    const selling = batch({ id: 'b1', publishAt: '2026-09-30T12:00:00.000Z' });

    expect(
      errorsOf(
        { ...started, batches: [selling] },
        { phase: 'IN_PROGRESS', saved: started },
      ),
    ).toEqual({});
  });
});

describe('toEventFormInput', () => {
  it('carga un evento guardado con las fechas en hora local, sin nulls y con sus tandas', () => {
    const general = {
      id: 't1',
      name: 'General',
      price: '5000.00',
      stock: 100,
      sold: 3,
      reserved: 1,
    };
    expect(
      toEventFormInput({
        title: 'Fiesta',
        description: 'Desc',
        imageUrl: null,
        youtubeLink: null,
        startDate: '2026-10-11T01:00:00.000Z',
        endDate: '2026-10-11T08:00:00.000Z',
        venueName: null,
        venueAddress: 'Calle 1',
        ticketBatches: [
          {
            id: 'b1',
            name: 'Preventa',
            isVisible: true,
            publishAt: null,
            closeAt: '2026-10-10T20:00:00.000Z',
            publishWhenPreviousSoldOut: false,
            ticketTypes: [general],
          },
        ],
      }),
    ).toEqual({
      title: 'Fiesta',
      description: 'Desc',
      imageUrl: '',
      youtubeLink: '',
      startDate: '2026-10-10T22:00',
      endDate: '2026-10-11T05:00',
      venueName: '',
      venueAddress: 'Calle 1',
      batches: [
        {
          id: 'b1',
          name: 'Preventa',
          isVisible: true,
          publishAt: null,
          closeAt: '2026-10-10T20:00:00.000Z',
          publishWhenPreviousSoldOut: false,
          ticketTypes: [{ ...general, stock: '100' }],
        },
      ],
    });
  });
});

describe('toEventPayload', () => {
  it('manda las fechas en ISO, el YouTube vacío como null y precio y stock como números', () => {
    const parsed = buildEventSchema({ phase: 'NOT_STARTED' }, clock).parse({
      ...valid,
      batches: [batch({ tempId: 'nueva' })],
    });

    expect(toEventPayload(parsed)).toEqual({
      title: 'Fiesta de primavera',
      description: 'Música toda la noche',
      imageUrl: valid.imageUrl,
      youtubeLink: null,
      startDate: '2026-10-11T01:00:00.000Z',
      endDate: '2026-10-11T08:00:00.000Z',
      venueName: 'Club Central',
      venueAddress: 'Av. Siempre Viva 742',
      batches: [
        {
          tempId: 'nueva',
          name: 'Preventa',
          isVisible: true,
          publishAt: null,
          closeAt: null,
          ticketTypes: [{ name: 'General', price: 5000, stock: 100 }],
        },
      ],
    });
  });
});
