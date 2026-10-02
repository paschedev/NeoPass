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
import toast from '@/utils/toast';
import EventForm from './EventForm';

vi.mock('next/navigation', () => ({ useRouter: () => ({ back: vi.fn() }) }));
vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/utils/toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

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

  const renderInProgress = (batches: FormBatch[] = []) => {
    const started = { ...saved, startDate: '2026-10-01T10:00', batches };
    render(
      <EventForm
        mode="edit"
        eventId="e1"
        rules={{ phase: 'IN_PROGRESS', saved: started }}
        defaultValues={started}
        onSubmit={vi.fn()}
      />,
    );
  };

  it('en curso: el inicio y el lugar quedan fijos y no se pueden agregar ni editar tandas', () => {
    renderInProgress([savedBatch()]);

    expect(screen.getByText(/el evento está en curso/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Inicio')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Nombre del lugar')).toHaveAttribute(
      'readonly',
    );
    expect(screen.getByLabelText('Dirección')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Fin')).not.toHaveAttribute('readonly');
    expect(screen.getByLabelText('Nombre de la tanda')).toBeDisabled();
    expect(screen.getByPlaceholderText('Nombre de la entrada')).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: /nueva tanda/i }),
    ).not.toBeInTheDocument();
  });

  describe('acciones de venta de una tanda', () => {
    const SALE_PATH = '/events/e1/batches/b1/sale';
    const ENDED_AT = '2026-10-01T15:00:00.000Z';

    const renderSaved = (batches: FormBatch[], onSubmit = vi.fn()) => {
      const values = { ...saved, batches };
      render(
        <EventForm
          mode="edit"
          eventId="e1"
          rules={{ phase: 'NOT_STARTED', saved: values }}
          defaultValues={values}
          onSubmit={onSubmit}
        />,
      );
      return onSubmit;
    };

    // El servidor responde cómo quedó la tanda.
    const serverAnswers = (answer: Response) =>
      vi
        .mocked(apiFetch)
        .mockImplementation(async (path) =>
          path.endsWith('/sale') ? answer : Response.json([]),
        );

    const saleCalls = () =>
      vi.mocked(apiFetch).mock.calls.filter(([path]) => path.endsWith('/sale'));

    const confirm = (name: RegExp) =>
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', { name }),
      );

    it('finalizar la venta pide confirmación, y cancelar no cambia nada', () => {
      renderSaved([savedBatch()]);

      fireEvent.click(screen.getByRole('button', { name: 'Finalizar venta' }));

      const dialog = screen.getByRole('dialog');
      expect(
        within(dialog).getByText('¿Finalizar la venta de «Preventa»?'),
      ).toBeInTheDocument();
      expect(
        within(dialog).getByText(/quienes ya están pagando/i),
      ).toBeInTheDocument();

      confirm(/cancelar/i);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(saleCalls()).toHaveLength(0);
      expect(screen.getByText('A la venta')).toBeInTheDocument();
    });

    it('al confirmar, la venta termina en el momento sin guardar el formulario', async () => {
      serverAnswers(
        Response.json({
          id: 'b1',
          isVisible: true,
          publishAt: null,
          closeAt: ENDED_AT,
        }),
      );
      const onSubmit = renderSaved([savedBatch()]);

      fireEvent.click(screen.getByRole('button', { name: 'Finalizar venta' }));
      confirm(/finalizar venta/i);

      expect(await screen.findByText('Finalizada')).toBeInTheDocument();
      expect(saleCalls()).toEqual([
        [SALE_PATH, { method: 'PUT', body: JSON.stringify({ action: 'END' }) }],
      ]);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Reabrir venta' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/la venta de la tanda termina al guardar/i),
      ).not.toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('guardar el formulario después conserva el fin de venta que puso el servidor', async () => {
      serverAnswers(
        Response.json({
          id: 'b1',
          isVisible: true,
          publishAt: null,
          closeAt: ENDED_AT,
        }),
      );
      const onSubmit = renderSaved([savedBatch()]);

      fireEvent.click(screen.getByRole('button', { name: 'Finalizar venta' }));
      confirm(/finalizar venta/i);
      await screen.findByText('Finalizada');
      fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      expect(onSubmit.mock.calls[0][0].batches[0]).toMatchObject({
        id: 'b1',
        closeAt: ENDED_AT,
      });
    });

    it('una venta finalizada se puede reabrir', async () => {
      serverAnswers(
        Response.json({
          id: 'b1',
          isVisible: true,
          publishAt: null,
          closeAt: null,
        }),
      );
      renderSaved([savedBatch({ closeAt: '2026-10-01T10:00:00.000Z' })]);

      fireEvent.click(screen.getByRole('button', { name: 'Reabrir venta' }));
      confirm(/reabrir venta/i);

      expect(await screen.findByText('A la venta')).toBeInTheDocument();
      expect(saleCalls()[0][1]).toMatchObject({
        body: JSON.stringify({ action: 'REOPEN' }),
      });
    });

    it('si el servidor rechaza la acción muestra el motivo y la tanda queda igual', async () => {
      serverAnswers(
        Response.json(
          { message: 'Un evento finalizado no se puede editar' },
          { status: 409 },
        ),
      );
      renderSaved([savedBatch()]);

      fireEvent.click(screen.getByRole('button', { name: 'Finalizar venta' }));
      confirm(/finalizar venta/i);

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          'Un evento finalizado no se puede editar',
        ),
      );
      expect(screen.getByText('A la venta')).toBeInTheDocument();
    });

    it('antes de que empiece el evento, ocultar se hace desde Visibilidad y no como acción', () => {
      renderSaved([savedBatch()]);

      expect(
        screen.queryByRole('button', { name: 'Ocultar tanda' }),
      ).not.toBeInTheDocument();
    });

    it('una tanda nueva, todavía sin guardar, no tiene acciones', () => {
      renderSaved([savedBatch({ id: undefined, tempId: 'nueva' })]);

      expect(
        screen.queryByRole('button', { name: 'Finalizar venta' }),
      ).not.toBeInTheDocument();
    });

    it('con el evento en curso se puede finalizar la venta aunque la tanda esté bloqueada', async () => {
      serverAnswers(
        Response.json({
          id: 'b1',
          isVisible: true,
          publishAt: null,
          closeAt: ENDED_AT,
        }),
      );
      renderInProgress([savedBatch()]);

      const endSale = screen.getByRole('button', { name: 'Finalizar venta' });
      expect(endSale).toBeEnabled();
      fireEvent.click(endSale);
      confirm(/finalizar venta/i);

      expect(await screen.findByText('Finalizada')).toBeInTheDocument();
    });

    it('con el evento en curso se puede ocultar la tanda', async () => {
      serverAnswers(
        Response.json({
          id: 'b1',
          isVisible: false,
          publishAt: null,
          closeAt: null,
        }),
      );
      renderInProgress([savedBatch()]);

      fireEvent.click(screen.getByRole('button', { name: 'Ocultar tanda' }));
      confirm(/ocultar tanda/i);

      expect(
        await screen.findByRole('button', { name: 'Mostrar tanda' }),
      ).toBeEnabled();
      expect(saleCalls()[0][1]).toMatchObject({
        body: JSON.stringify({ action: 'HIDE' }),
      });
    });
  });
});
