import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import EventActivity from './EventActivity';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));

const PATH = '/events/organizer/e1/activity';

const entry = (id: string, summary: string, actor = 'Ana Pérez') => ({
  id,
  type: 'EVENT_UPDATED',
  summary,
  actor: { name: actor },
  createdAt: '2026-10-05T15:30:00.000Z', // dom 5/10 12:30 en Argentina
});

function server(pages: Record<number, unknown>) {
  vi.mocked(apiFetch).mockImplementation(async (path) => {
    const page = Number(
      new URL(String(path), 'http://x').searchParams.get('page'),
    );
    return pages[page]
      ? Response.json(pages[page])
      : Response.json({}, { status: 500 });
  });
}

describe('EventActivity', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('muestra cada cambio con quién lo hizo y cuándo', async () => {
    server({
      1: {
        items: [
          entry(
            'a1',
            'Cambió el precio de "General" en "Preventa" de $1.000 a $1.500.',
          ),
          entry('a2', 'Invitó a Bruno como scanner.', 'Dueña'),
        ],
        total: 2,
        page: 1,
        limit: 50,
      },
    });

    render(<EventActivity eventId="e1" />);

    const first = await screen.findByRole('listitem', {
      name: /Cambió el precio/,
    });
    expect(first).toHaveTextContent('Ana Pérez');
    expect(first).toHaveTextContent('12:30');
    expect(
      screen.getByRole('listitem', { name: /Invitó a Bruno/ }),
    ).toHaveTextContent('Dueña');
    expect(
      screen.queryByRole('button', { name: 'Ver más' }),
    ).not.toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith(`${PATH}?page=1`);
  });

  it('"Ver más" trae la página siguiente debajo de lo que ya se ve', async () => {
    server({
      1: { items: [entry('a1', 'Cambio nuevo')], total: 2, page: 1, limit: 1 },
      2: { items: [entry('a2', 'Cambio viejo')], total: 2, page: 2, limit: 1 },
    });
    render(<EventActivity eventId="e1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Ver más' }));

    expect(
      await screen.findByRole('listitem', { name: /Cambio viejo/ }),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole('listitem')
        .map((item) => item.getAttribute('aria-label')),
    ).toEqual(['Cambio nuevo', 'Cambio viejo']);
    expect(
      screen.queryByRole('button', { name: 'Ver más' }),
    ).not.toBeInTheDocument();
  });

  it('sin cambios lo dice', async () => {
    server({ 1: { items: [], total: 0, page: 1, limit: 50 } });

    render(<EventActivity eventId="e1" />);

    expect(
      await screen.findByText('Todavía no hay cambios en este evento.'),
    ).toBeInTheDocument();
  });

  it('si no se puede cargar, lo avisa', async () => {
    server({});

    render(<EventActivity eventId="e1" />);

    expect(
      await screen.findByText('No pudimos cargar el historial.'),
    ).toBeInTheDocument();
  });
});
