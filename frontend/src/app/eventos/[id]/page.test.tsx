import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import EventPage from './page';

const nav = vi.hoisted(() => ({ search: '' }));
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'e1' }),
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'u1', name: 'Ana', email: 'ana@test.com', role: 'USER' },
    ready: true,
  }),
}));

// Como el widget real: resuelve el desafío una vez y no entrega otro token
// hasta que lo reinician.
const captcha = vi.hoisted(() => ({ issued: 0 }));
vi.mock('@marsidev/react-turnstile', async () => {
  const { forwardRef, useImperativeHandle, useRef } = await import('react');
  const Turnstile = forwardRef<
    { reset: () => void },
    { onSuccess: (token: string) => void }
  >(function Turnstile({ onSuccess }, ref) {
    const solved = useRef(false);
    useImperativeHandle(ref, () => ({
      reset: () => {
        solved.current = false;
      },
    }));
    return (
      <button
        type="button"
        onClick={() => {
          if (solved.current) return;
          solved.current = true;
          captcha.issued += 1;
          onSuccess(`token-${captcha.issued}`);
        }}
      >
        Resolver captcha
      </button>
    );
  });
  return { Turnstile };
});

const event = {
  id: 'e1',
  title: 'Fiesta Bresh',
  description: 'La fiesta',
  imageUrl: null,
  youtubeLink: null,
  startDate: '2026-11-20T02:00:00.000Z',
  endDate: '2026-11-20T08:00:00.000Z',
  venueName: 'Niceto Club',
  venueAddress: 'Niceto Vega 5510',
  venueCity: 'CABA',
  latitude: null,
  longitude: null,
  venuePlaceId: null,
  status: 'PUBLISHED',
  buyerFeePercentage: '18.15',
  organizerName: 'Productora Sur',
  ticketBatches: [],
};

describe('Página del evento', () => {
  afterEach(() => vi.clearAllMocks());

  it('dice quién organiza', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path) =>
      path === '/events/e1' ? Response.json(event) : Response.json([]),
    );

    render(<EventPage />);

    expect(await screen.findByText('Organiza Productora Sur')).toBeVisible();
  });

  it('muestra el flyer entero, sin recortarlo', async () => {
    const imageUrl =
      'https://res.cloudinary.com/neopass/image/upload/v1/flyer.png';
    vi.mocked(apiFetch).mockImplementation(async (path) =>
      path === '/events/e1'
        ? Response.json({ ...event, imageUrl })
        : Response.json([]),
    );

    render(<EventPage />);

    const flyer = await screen.findByRole('img', { name: 'Fiesta Bresh' });
    expect(flyer).toHaveAttribute(
      'src',
      'https://res.cloudinary.com/neopass/image/upload/f_auto,q_auto/v1/flyer.png',
    );
  });

  it('dice cuándo y dónde es', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path) =>
      path === '/events/e1' ? Response.json(event) : Response.json([]),
    );

    render(<EventPage />);

    const when = await screen.findByText('Cuándo');
    expect(when.nextElementSibling).toHaveTextContent(
      /jue, 19 nov, 23:00 hs\s*hasta el vie, 20 nov, 05:00 hs/,
    );
    expect(screen.getByText('Dónde').nextElementSibling).toHaveTextContent(
      /Niceto Club\s*Niceto Vega 5510/,
    );
  });

  function onSale(buyerFeePercentage: string) {
    return {
      ...event,
      buyerFeePercentage,
      ticketBatches: [
        {
          id: 'b1',
          name: 'Primera tanda',
          saleStatus: 'ON_SALE',
          publishAt: null,
          closeAt: null,
          ticketTypes: [
            { id: 't1', name: 'General', price: '10000.00', available: 10 },
          ],
        },
      ],
    };
  }

  it('muestra el cargo de servicio como monto, sin porcentaje, y el total que cobra Mercado Pago', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path) =>
      path === '/events/e1'
        ? Response.json(onSale('18.15'))
        : Response.json([]),
    );

    render(<EventPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sumar una General' }));

    const fee = screen.getByText('Cargo de servicio');
    expect(fee.nextElementSibling).toHaveTextContent('$1.815');
    expect(screen.queryByText(/Cargo de servicio \(/)).not.toBeInTheDocument();
    expect(screen.getByText('$11.815')).toBeVisible();
  });

  it('calcula el cargo con el porcentaje que informa el evento para el comprador', async () => {
    // Un organizador que cobra a 35 días: el comprador paga 10,67 %.
    vi.mocked(apiFetch).mockImplementation(async (path) =>
      path === '/events/e1'
        ? Response.json(onSale('10.67'))
        : Response.json([]),
    );

    render(<EventPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sumar una General' }));

    const fee = screen.getByText('Cargo de servicio');
    expect(fee.nextElementSibling).toHaveTextContent('$1.067');
    expect(screen.getByText('$11.067')).toBeVisible();
  });

  it('si la compra falla, renueva el captcha para que el reintento no repita el ya usado', async () => {
    const sentTokens: string[] = [];
    vi.mocked(apiFetch).mockImplementation(async (path, init) => {
      if (path === '/orders/checkout') {
        sentTokens.push(JSON.parse(String(init?.body)).captchaToken);
        return Response.json(
          {
            statusCode: 503,
            message:
              'Hay mucha demanda en este momento. Probá de nuevo en unos segundos.',
          },
          { status: 503 },
        );
      }
      return path === '/events/e1'
        ? Response.json(onSale('10.67'))
        : Response.json([]);
    });

    render(<EventPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sumar una General' }));
    fireEvent.click(screen.getByRole('button', { name: 'Resolver captcha' }));
    fireEvent.click(screen.getByRole('button', { name: /Comprar/ }));

    // El token ya se validó: no se puede reintentar hasta tener otro.
    const buy = await screen.findByRole('button', { name: /Comprar/ });
    await waitFor(() => expect(buy).toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Resolver captcha' }));
    await waitFor(() => expect(buy).toBeEnabled());
    fireEvent.click(buy);

    await waitFor(() => expect(sentTokens).toHaveLength(2));
    expect(sentTokens[0]).not.toBe(sentTokens[1]);
  });

  describe('la compra', () => {
    afterEach(() => {
      nav.search = '';
    });

    const withBatches = {
      ...event,
      buyerFeePercentage: '10',
      ticketBatches: [
        {
          id: 'b1',
          name: 'Tanda 1',
          saleStatus: 'SOLD_OUT',
          publishAt: null,
          ticketTypes: [],
        },
        {
          id: 'b2',
          name: 'Tanda 2',
          saleStatus: 'ON_SALE',
          publishAt: null,
          ticketTypes: [
            { id: 't1', name: 'General', price: '30000.00', available: 184 },
            { id: 't2', name: 'VIP', price: '40000.00', available: 1 },
          ],
        },
        {
          id: 'b3',
          name: 'Tanda 3',
          saleStatus: 'UPCOMING',
          publishAt: '2026-12-05T23:00:00.000Z',
          ticketTypes: [],
        },
      ],
    };

    const renderWithBatches = () => {
      vi.mocked(apiFetch).mockImplementation(async (path) =>
        path === '/events/e1'
          ? Response.json(withBatches)
          : Response.json([]),
      );
      render(<EventPage />);
    };

    it('tiene su título y cada tanda como subtítulo', async () => {
      renderWithBatches();

      expect(
        await screen.findByRole('heading', { name: 'Comprar entradas' }),
      ).toBeVisible();
      for (const name of ['Tanda 1', 'Tanda 2', 'Tanda 3']) {
        expect(screen.getByRole('heading', { name })).toBeVisible();
      }
    });

    it('una tanda agotada o que todavía no salió es una sola línea', async () => {
      renderWithBatches();

      const soldOut = await screen.findByRole('heading', { name: 'Tanda 1' });
      expect(soldOut.parentElement).toHaveTextContent(/^Tanda 1Agotada$/);
      expect(
        screen.getByRole('heading', { name: 'Tanda 3' }).parentElement,
      ).toHaveTextContent(/^Tanda 3Próximamente · desde 5\/12 20:00 hs$/);
    });

    it('cada entrada muestra su precio y cuántas quedan', async () => {
      renderWithBatches();

      expect(
        (await screen.findByText('General')).nextElementSibling,
      ).toHaveTextContent('$30.000 · 184 disponibles');
      expect(screen.getByText('VIP').nextElementSibling).toHaveTextContent(
        '$40.000 · 1 disponible',
      );
    });

    it('los botones de cantidad dicen qué entrada suman o quitan', async () => {
      renderWithBatches();

      const add = await screen.findByRole('button', { name: 'Sumar una VIP' });
      const remove = screen.getByRole('button', { name: 'Quitar una VIP' });
      expect(remove).toBeDisabled();

      fireEvent.click(add);

      expect(remove).toBeEnabled();
      // Era la última VIP: no deja sumar otra.
      expect(add).toBeDisabled();
      expect(screen.getByRole('button', { name: /Comprar/ })).toHaveTextContent(
        'Comprar(1)',
      );
    });

    it('subtotal, cargo, total y el tope se ven desde el principio, en $0', async () => {
      renderWithBatches();

      expect(
        (await screen.findByText('Subtotal')).nextElementSibling,
      ).toHaveTextContent('$0');
      expect(
        screen.getByText('Cargo de servicio').nextElementSibling,
      ).toHaveTextContent('$0');
      expect(screen.getByText('Total').nextElementSibling).toHaveTextContent(
        '$0',
      );
      expect(screen.getByText('Hasta 10 entradas por compra')).toBeVisible();
      expect(screen.getByRole('button', { name: /Comprar/ })).toBeDisabled();
    });

    it('al llegar a 10 entradas no deja sumar más', async () => {
      renderWithBatches();

      const add = await screen.findByRole('button', {
        name: 'Sumar una General',
      });
      for (let i = 0; i < 10; i += 1) fireEvent.click(add);

      expect(add).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Sumar una VIP' })).toBeDisabled();
      expect(screen.getByText('Hasta 10 entradas por compra')).toBeVisible();
      expect(screen.getByText('Subtotal').nextElementSibling).toHaveTextContent(
        '$300.000',
      );
      expect(screen.getByText('Total').nextElementSibling).toHaveTextContent(
        '$330.000',
      );
    });

    it('si llegó por el link de un promotor lo avisa y no deja cambiarlo', async () => {
      nav.search = 'rpp=p1';
      vi.mocked(apiFetch).mockImplementation(async (path) => {
        if (path === '/events/e1?rpp=p1') return Response.json(withBatches);
        if (path === '/events/e1/promoters')
          return Response.json([{ id: 'p1', name: 'Juli' }]);
        return Response.json([]);
      });

      render(<EventPage />);

      expect(
        await screen.findByText('✓ Llegaste por el link de este promotor'),
      ).toBeVisible();
      expect(screen.getByRole('button', { name: 'Juli' })).toBeDisabled();
    });
  });

  describe('con mucha demanda', () => {
    afterEach(() => vi.useRealTimers());

    const busy = (status: number, retryAfter?: string) =>
      Response.json(
        { message: 'Hay mucha demanda en este momento.' },
        { status, headers: retryAfter ? { 'Retry-After': retryAfter } : {} },
      );

    it('avisa que hay mucha gente, cuenta los segundos y reintenta sola hasta mostrar el evento', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
      let eventCalls = 0;
      vi.mocked(apiFetch).mockImplementation(async (path) => {
        if (path !== '/events/e1') return Response.json([]);
        eventCalls += 1;
        return eventCalls === 1 ? busy(429, '3') : Response.json(event);
      });

      render(<EventPage />);

      expect(await screen.findByText('Hay mucha gente entrando')).toBeVisible();
      expect(screen.getByText(/Reintentamos en 0:0[34]/)).toBeVisible();
      expect(screen.queryByText('Evento no encontrado')).toBeNull();

      await act(async () => {
        vi.advanceTimersByTime(4_500);
      });

      expect(await screen.findByText('Fiesta Bresh')).toBeVisible();
      expect(eventCalls).toBe(2);
    });

    it('sin respuesta a tiempo ofrece reintentar ahora', async () => {
      let eventCalls = 0;
      vi.mocked(apiFetch).mockImplementation(async (path) => {
        if (path !== '/events/e1') return Response.json([]);
        eventCalls += 1;
        if (eventCalls === 1) {
          throw new DOMException('Tardó demasiado', 'TimeoutError');
        }
        return Response.json(event);
      });

      render(<EventPage />);
      expect(
        await screen.findByText('No pudimos cargar el evento'),
      ).toBeVisible();
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar ahora' }));

      expect(await screen.findByText('Fiesta Bresh')).toBeVisible();
    });

    it('con la base saturada también avisa y no dice que el evento no existe', async () => {
      vi.mocked(apiFetch).mockImplementation(async (path) =>
        path === '/events/e1' ? busy(503) : Response.json([]),
      );

      render(<EventPage />);

      expect(await screen.findByText('Hay mucha gente entrando')).toBeVisible();
      expect(screen.queryByText('Evento no encontrado')).toBeNull();
    });

    it('"Evento no encontrado" solo cuando el evento no existe', async () => {
      vi.mocked(apiFetch).mockImplementation(async (path) =>
        path === '/events/e1'
          ? Response.json({ message: 'No encontrado' }, { status: 404 })
          : Response.json([]),
      );

      render(<EventPage />);

      expect(await screen.findByText('Evento no encontrado')).toBeVisible();
      expect(screen.queryByText('Reintentar ahora')).toBeNull();
    });
  });
});
