import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import type { EventFormInput } from '@/utils/event-form';
import EventForm from './EventForm';

vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn() }) }));
vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));

const NOW = new Date('2026-10-01T12:00:00-03:00');

const saved: EventFormInput = {
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

type FormBatch = EventFormInput['batches'][number];

const general = {
  id: 't1',
  name: 'General',
  price: '5000.00',
  stock: '100',
  sold: 0,
  reserved: 0,
};

const savedBatch = (overrides: Partial<FormBatch> = {}): FormBatch => ({
  id: 'b1',
  name: 'Preventa',
  isVisible: true,
  publishAt: null,
  closeAt: null,
  publishWhenPreviousSoldOut: false,
  ticketTypes: [general],
  ...overrides,
});

const renderEdit = (batches: FormBatch[], onSubmit = vi.fn()) => {
  const values = { ...saved, batches };
  render(
    <EventForm
      mode="edit"
      rules={{ phase: 'NOT_STARTED', saved: values }}
      defaultValues={values}
      onSubmit={onSubmit}
    />,
  );
  return onSubmit;
};

describe('EventForm', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    // TandasManager carga los presets al montarse.
    vi.mocked(apiFetch).mockImplementation(async () => Response.json([]));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('avisa apenas se elige un inicio posterior al fin, sin esperar a guardar', async () => {
    render(
      <EventForm
        mode="create"
        rules={{ phase: 'NOT_STARTED' }}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Fin'), {
      target: { value: '2026-10-10T20:00' },
    });
    fireEvent.change(screen.getByLabelText('Inicio'), {
      target: { value: '2026-10-10T22:00' },
    });

    expect(
      await screen.findByText('El fin tiene que ser posterior al inicio'),
    ).toBeInTheDocument();
  });

  it('avisa apenas se elige un inicio que ya pasó', async () => {
    render(
      <EventForm
        mode="create"
        rules={{ phase: 'NOT_STARTED' }}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Inicio'), {
      target: { value: '2026-10-01T04:20' },
    });

    expect(
      await screen.findByText('La fecha de inicio ya pasó'),
    ).toBeInTheDocument();
  });

  it('con datos faltantes no envía y muestra cada error debajo de su campo', async () => {
    const onSubmit = vi.fn();
    render(
      <EventForm
        mode="create"
        rules={{ phase: 'NOT_STARTED' }}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /publicar/i }));

    expect(
      await screen.findByText('Poné el nombre del evento'),
    ).toBeInTheDocument();
    expect(screen.getByText('Subí el flyer del evento')).toBeInTheDocument();
    expect(screen.getByText('Elegí la fecha de inicio')).toBeInTheDocument();
    expect(screen.getByText('Poné la dirección')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('envía el evento con las fechas en ISO y precio y stock como números', async () => {
    const onSubmit = renderEdit([savedBatch()]);

    fireEvent.change(screen.getByLabelText('Nombre del evento'), {
      target: { value: 'Fiesta de verano' },
    });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Fiesta de verano',
      description: 'Música toda la noche',
      imageUrl: saved.imageUrl,
      youtubeLink: null,
      startDate: '2026-10-11T01:00:00.000Z',
      endDate: '2026-10-11T08:00:00.000Z',
      venueName: 'Club Central',
      venueAddress: 'Av. Siempre Viva 742',
      batches: [
        {
          ...savedBatch(),
          ticketTypes: [{ ...general, price: 5000, stock: 100 }],
        },
      ],
    });
  });

  it('marca el fin de venta posterior al evento apenas se elige', async () => {
    renderEdit([savedBatch()]);

    fireEvent.click(screen.getByLabelText('Venta hasta'));
    fireEvent.change(screen.getByLabelText('Fecha de fin de venta'), {
      target: { value: '2026-10-12T00:00' },
    });

    expect(
      await screen.findByText('No puede ser después del fin del evento'),
    ).toBeInTheDocument();
  });

  it('al acortar el evento revisa de nuevo las fechas de venta de las tandas', async () => {
    renderEdit([savedBatch({ closeAt: '2026-10-11T05:00:00.000Z' })]);

    fireEvent.change(screen.getByLabelText('Fin'), {
      target: { value: '2026-10-11T01:00' },
    });

    expect(
      await screen.findByText('No puede ser después del fin del evento'),
    ).toBeInTheDocument();
  });

  it('avisa si dos tandas visibles se venden al mismo tiempo', () => {
    renderEdit([
      savedBatch(),
      savedBatch({ id: 'b2', name: 'General', ticketTypes: [] }),
    ]);

    expect(
      screen.getByText(/"Preventa" y "General" se venden al mismo tiempo/),
    ).toBeInTheDocument();
  });

  it('con errores en las tandas no envía y los muestra en la entrada', async () => {
    const onSubmit = renderEdit([
      savedBatch({ ticketTypes: [{ ...general, price: '' }] }),
    ]);

    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    expect(
      await screen.findByText('Poné el precio (0 si es gratis)'),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('agregar una entrada a una tanda no cambia las otras', () => {
    renderEdit([
      savedBatch(),
      savedBatch({ id: 'b2', name: 'General', isVisible: false }),
    ]);
    const first = screen.getByRole('region', { name: 'Tanda 1' });
    const second = screen.getByRole('region', { name: 'Tanda 2' });

    fireEvent.click(
      within(first).getByRole('button', { name: /ticket nuevo/i }),
    );

    expect(
      within(first).getAllByPlaceholderText('Nombre de la entrada'),
    ).toHaveLength(2);
    expect(
      within(second).getAllByPlaceholderText('Nombre de la entrada'),
    ).toHaveLength(1);
  });

  it('en curso: el inicio y el lugar quedan fijos y las tandas deshabilitadas', () => {
    const started = { ...saved, startDate: '2026-10-01T10:00' };
    render(
      <EventForm
        mode="edit"
        rules={{ phase: 'IN_PROGRESS', saved: started }}
        defaultValues={started}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText(/el evento está en curso/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Inicio')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Nombre del lugar')).toHaveAttribute(
      'readonly',
    );
    expect(screen.getByLabelText('Dirección')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Fin')).not.toHaveAttribute('readonly');
    expect(screen.getByRole('group', { name: 'Tandas' })).toBeDisabled();
  });
});
