import { Prisma } from '@prisma/client';
import { BatchDto } from './dto/batch.dto';
import {
  batchChangesSummary,
  changedEventInfo,
  describeBatchChanges,
  eventUpdateSummary,
  statusChange,
} from './event-changes';

const START = new Date('2026-12-20T23:00:00.000Z');
const END = new Date('2026-12-21T06:00:00.000Z');

const event = {
  status: 'PUBLISHED',
  title: 'Fiesta',
  description: 'La mejor fiesta',
  imageUrl: 'https://res.cloudinary.com/test/flyer.jpg',
  youtubeLink: null,
  startDate: START,
  endDate: END,
  venueName: 'Niceto',
  venueAddress: 'Niceto Vega 5510',
  venueCity: 'CABA',
  latitude: -34.58,
  longitude: -58.43,
  venuePlaceId: 'place-1',
};

const storedBatch = {
  id: 'batch-1',
  name: 'Preventa',
  isVisible: true,
  publishAt: null,
  closeAt: null,
  publishWhenPreviousSoldOut: false,
  ticketTypes: [
    {
      id: 'type-1',
      name: 'General',
      price: new Prisma.Decimal(1000),
      stock: 100,
    },
  ],
};

// The batch as the edit form sends it back: prices as numbers, no dates.
function sentBatch(
  changes: Partial<BatchDto> = {},
  typeChanges: Partial<BatchDto['ticketTypes'][number]> = {},
): BatchDto {
  return {
    id: 'batch-1',
    name: 'Preventa',
    isVisible: true,
    ticketTypes: [
      {
        id: 'type-1',
        name: 'General',
        price: 1000,
        stock: 100,
        ...typeChanges,
      },
    ],
    ...changes,
  };
}

describe('qué cambia al editar un evento', () => {
  describe('la info', () => {
    it('el formulario entero sin cambios no cambia nada', () => {
      expect(
        changedEventInfo(event, {
          ...event,
          status: 'PUBLISHED',
          youtubeLink: null,
          startDate: START.toISOString(),
          endDate: END.toISOString(),
        }),
      ).toEqual([]);
    });

    it('nombra cada cosa que cambia, en el orden del formulario', () => {
      expect(
        changedEventInfo(event, {
          endDate: '2026-12-21T07:00:00.000Z',
          title: 'Fiesta de fin de año',
          venueAddress: 'Otra calle 123',
        }),
      ).toEqual(['el título', 'la fecha de fin', 'la dirección']);
    });

    it('la ciudad, las coordenadas y el lugar de Google son la ubicación en el mapa', () => {
      expect(changedEventInfo(event, { latitude: -34.6 })).toEqual([
        'la ubicación en el mapa',
      ]);
      expect(changedEventInfo(event, { venuePlaceId: null })).toEqual([
        'la ubicación en el mapa',
      ]);
    });

    it('un video vacío es lo mismo que no tener video', () => {
      expect(
        changedEventInfo({ ...event, youtubeLink: '' }, { youtubeLink: null }),
      ).toEqual([]);
      expect(
        changedEventInfo(event, {
          youtubeLink: 'https://www.youtube.com/watch?v=abc',
        }),
      ).toEqual(['el video']);
    });
  });

  describe('el texto del historial', () => {
    it('junta la info y el estado, y sin cambios no hay texto', () => {
      expect(
        eventUpdateSummary(['el título', 'la fecha de fin'], 'PUBLISHED'),
      ).toBe('Editó el título y la fecha de fin. Publicó el evento.');
      expect(eventUpdateSummary([], 'DRAFT')).toBe(
        'Pasó el evento a borrador.',
      );
      expect(eventUpdateSummary([], null)).toBeNull();
    });

    it('los cambios de tandas van en una oración', () => {
      expect(
        batchChangesSummary([
          'borró la tanda "VIP"',
          'cambió el stock de "General" en "Preventa" de 100 a 150',
        ]),
      ).toBe(
        'Borró la tanda "VIP" y cambió el stock de "General" en "Preventa" de 100 a 150.',
      );
    });
  });

  describe('el estado', () => {
    it('solo cuenta si cambia', () => {
      expect(statusChange(event, { status: 'PUBLISHED' })).toBeNull();
      expect(statusChange(event, {})).toBeNull();
      expect(statusChange(event, { status: 'DRAFT' })).toBe('DRAFT');
    });
  });

  describe('las tandas', () => {
    it('las mismas tandas, con el precio como texto, no cambian nada', () => {
      expect(
        describeBatchChanges(
          [storedBatch],
          [
            sentBatch(
              { publishWhenPreviousSoldOut: false },
              { price: '1000.00' as unknown as number },
            ),
          ],
        ),
      ).toEqual([]);
    });

    it('cuenta el precio y el stock con el antes y el después', () => {
      expect(
        describeBatchChanges(
          [storedBatch],
          [sentBatch({}, { price: 1500.5, stock: 150 })],
        ),
      ).toEqual([
        'cambió el precio de "General" en "Preventa" de $1.000 a $1.500,50',
        'cambió el stock de "General" en "Preventa" de 100 a 150',
      ]);
    });

    it('cuenta las tandas y entradas nuevas con su precio, y las borradas', () => {
      expect(
        describeBatchChanges(
          [storedBatch],
          [
            sentBatch({
              ticketTypes: [{ name: 'Mesa', price: 20000, stock: 10 }],
            }),
            {
              name: 'VIP',
              isVisible: true,
              ticketTypes: [{ name: 'Barra', price: 5000, stock: 50 }],
            },
          ],
        ),
      ).toEqual([
        'borró "General" de "Preventa"',
        'agregó "Mesa" a $20.000 en "Preventa"',
        'creó la tanda "VIP" con "Barra" a $5.000',
      ]);
      expect(describeBatchChanges([storedBatch], [])).toEqual([
        'borró la tanda "Preventa"',
      ]);
    });

    it('cuenta los nombres, la visibilidad, las fechas de venta y la publicación automática', () => {
      expect(
        describeBatchChanges(
          [storedBatch],
          [
            sentBatch(
              {
                name: 'Anticipada',
                isVisible: false,
                closeAt: '2026-12-15T03:00:00.000Z',
                publishWhenPreviousSoldOut: true,
              },
              { name: 'Campo' },
            ),
          ],
        ),
      ).toEqual([
        'renombró la tanda "Preventa" a "Anticipada"',
        'ocultó la tanda "Anticipada"',
        'cambió las fechas de venta de "Anticipada"',
        'cambió la publicación automática de "Anticipada"',
        'renombró "General" a "Campo" en "Anticipada"',
      ]);
    });

    it('una fecha de venta igual a la guardada no es un cambio', () => {
      const publishAt = new Date('2026-12-01T15:00:00.000Z');

      expect(
        describeBatchChanges(
          [{ ...storedBatch, publishAt }],
          [sentBatch({ publishAt: publishAt.toISOString() })],
        ),
      ).toEqual([]);
    });
  });
});
