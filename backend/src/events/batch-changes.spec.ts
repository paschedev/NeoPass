import { planBatchChanges } from './batch-changes';
import { BatchDto, TicketTypeDto } from './dto/batch.dto';

function ticketType(overrides: Partial<TicketTypeDto> = {}): TicketTypeDto {
  return { name: 'General', price: 1000, stock: 100, ...overrides };
}

function batch(overrides: Partial<BatchDto> = {}): BatchDto {
  return {
    name: 'Tanda 1',
    isVisible: true,
    ticketTypes: [ticketType()],
    ...overrides,
  };
}

describe('cambios de tandas al guardar un evento', () => {
  const stored = [
    { id: 'b1', ticketTypes: [{ id: 't1' }, { id: 't2' }] },
    { id: 'b2', ticketTypes: [{ id: 't3' }] },
  ];

  it('una tanda guardada que no viene en el pedido se borra con sus entradas', () => {
    const changes = planBatchChanges(stored, [
      batch({
        id: 'b1',
        ticketTypes: [ticketType({ id: 't1' }), ticketType({ id: 't2' })],
      }),
    ]);

    expect(changes.deletedBatchIds).toEqual(['b2']);
    expect(changes.deletedTicketTypeIds).toEqual([]);
  });

  it('una entrada que no viene en su tanda se borra', () => {
    const changes = planBatchChanges(stored, [
      batch({ id: 'b1', ticketTypes: [ticketType({ id: 't1' })] }),
      batch({ id: 'b2', ticketTypes: [ticketType({ id: 't3' })] }),
    ]);

    expect(changes.deletedBatchIds).toEqual([]);
    expect(changes.deletedTicketTypeIds).toEqual(['t2']);
  });

  it('las tandas y entradas sin id se crean y las que tienen id se actualizan', () => {
    const changes = planBatchChanges(stored, [
      batch({
        id: 'b1',
        name: 'Preventa',
        ticketTypes: [
          ticketType({ id: 't1', price: 1500, stock: 80 }),
          ticketType({ id: 't2' }),
          ticketType({ name: 'VIP', price: 5000, stock: 10 }),
        ],
      }),
      batch({ id: 'b2', ticketTypes: [ticketType({ id: 't3' })] }),
      batch({ name: 'Tanda 3', ticketTypes: [ticketType({ name: 'Puerta' })] }),
    ]);

    expect(changes.batches).toEqual([
      expect.objectContaining({
        id: 'b1',
        name: 'Preventa',
        ticketTypes: [
          { id: 't1', name: 'General', price: 1500, stock: 80 },
          { id: 't2', name: 'General', price: 1000, stock: 100 },
          { id: undefined, name: 'VIP', price: 5000, stock: 10 },
        ],
      }),
      expect.objectContaining({ id: 'b2' }),
      expect.objectContaining({
        id: undefined,
        name: 'Tanda 3',
        ticketTypes: [
          { id: undefined, name: 'Puerta', price: 1000, stock: 100 },
        ],
      }),
    ]);
  });

  it('en un evento nuevo todo se crea y no se borra nada', () => {
    const changes = planBatchChanges([], [batch(), batch({ name: 'Tanda 2' })]);

    expect(changes.deletedBatchIds).toEqual([]);
    expect(changes.deletedTicketTypeIds).toEqual([]);
    expect(changes.batches.map((b) => b.id)).toEqual([undefined, undefined]);
  });

  it('la ventana de venta se guarda como fechas y sin ventana queda sin límite', () => {
    const [withWindow, withoutWindow] = planBatchChanges(
      [],
      [
        batch({
          publishAt: '2026-10-01T20:00:00.000Z',
          closeAt: '2026-10-05T03:00:00.000Z',
        }),
        batch(),
      ],
    ).batches;

    expect(withWindow.publishAt).toEqual(new Date('2026-10-01T20:00:00.000Z'));
    expect(withWindow.closeAt).toEqual(new Date('2026-10-05T03:00:00.000Z'));
    expect(withoutWindow.publishAt).toBeNull();
    expect(withoutWindow.closeAt).toBeNull();
  });

  it('guarda si la tanda es visible y "publicar al agotarse la anterior" es falso si no viene', () => {
    const [hidden, chained] = planBatchChanges(
      [],
      [
        batch({ isVisible: false }),
        batch({ publishWhenPreviousSoldOut: true }),
      ],
    ).batches;

    expect(hidden).toMatchObject({
      isVisible: false,
      publishWhenPreviousSoldOut: false,
    });
    expect(chained).toMatchObject({
      isVisible: true,
      publishWhenPreviousSoldOut: true,
    });
  });
});
