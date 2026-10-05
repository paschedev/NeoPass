import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import toast from '@/utils/toast';
import AttendeeList from './AttendeeList';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/utils/toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

const ana = {
  ticketId: 'k1',
  name: 'Ana Pérez',
  ticketType: 'General',
  batch: 'Preventa',
  status: 'USED',
  checkedInAt: '2026-10-10T02:30:00.000Z',
  freeTicket: false,
};
const bruno = {
  ticketId: 'k2',
  name: 'Bruno Díaz',
  ticketType: 'Campo',
  batch: 'General',
  status: 'VALID',
  checkedInAt: null,
  freeTicket: false,
};

const page = (items: unknown[], total = items.length, pageNumber = 1) =>
  Response.json({ items, total, page: pageNumber, limit: 50 });

const listCalls = () =>
  vi
    .mocked(apiFetch)
    .mock.calls.map(([path]) => path)
    .filter((path) => path.includes('/attendees?'));

describe('AttendeeList', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:publico');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => vi.clearAllMocks());

  it('el público: cada persona con la entrada, el estado y la hora de ingreso, sin email', async () => {
    vi.mocked(apiFetch).mockImplementation(async () => page([ana, bruno]));

    render(<AttendeeList eventId="e1" />);

    const section = screen.getByRole('region', { name: 'Público' });
    const row = await within(section).findByRole('row', { name: /Ana Pérez/ });
    expect(
      within(section).queryByRole('columnheader', { name: 'Email' }),
    ).not.toBeInTheDocument();
    expect(row).toHaveTextContent('General · Preventa');
    expect(row).toHaveTextContent('Ingresó');
    expect(row).toHaveTextContent('9/10 23:30');
    expect(screen.getByRole('row', { name: /Bruno Díaz/ })).toHaveTextContent(
      'Válida',
    );
    expect(listCalls()).toEqual(['/events/organizer/e1/attendees?page=1']);
  });

  it('marca las entradas que llegaron como QR free', async () => {
    const dani = {
      ...bruno,
      ticketId: 'k3',
      name: 'Dani Invitada',
      freeTicket: true,
    };
    vi.mocked(apiFetch).mockImplementation(async () => page([ana, dani]));

    render(<AttendeeList eventId="e1" />);

    const row = await screen.findByRole('row', { name: /Dani Invitada/ });
    expect(row).toHaveTextContent('QR free');
    expect(
      screen.getByRole('row', { name: /Ana Pérez/ }),
    ).not.toHaveTextContent('QR free');
  });

  it('busca por nombre', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path) =>
      path.includes('q=bru') ? page([bruno]) : page([ana, bruno]),
    );
    render(<AttendeeList eventId="e1" />);
    await screen.findByRole('row', { name: /Ana Pérez/ });

    const search = screen.getByRole('searchbox', { name: 'Buscar' });
    expect(search).toHaveAttribute('placeholder', 'Buscar por nombre');
    fireEvent.change(search, { target: { value: 'bru' } });

    await waitFor(() =>
      expect(
        screen.queryByRole('row', { name: /Ana Pérez/ }),
      ).not.toBeInTheDocument(),
    );
    expect(listCalls()).toContain(
      '/events/organizer/e1/attendees?q=bru&page=1',
    );
  });

  it('pasa de página', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path) =>
      path.includes('page=2') ? page([bruno], 51, 2) : page([ana], 51),
    );
    render(<AttendeeList eventId="e1" />);
    await screen.findByText('Página 1 de 2');

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Bruno Díaz/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  });

  it('exporta todo el público a publico.csv', async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    vi.mocked(apiFetch).mockImplementation(async (path) =>
      path.endsWith('/export')
        ? new Response('"Nombre"', { headers: { 'Content-Type': 'text/csv' } })
        : page([ana]),
    );
    render(<AttendeeList eventId="e1" />);
    await screen.findByRole('row', { name: /Ana Pérez/ });

    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));

    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(apiFetch).toHaveBeenCalledWith(
      '/events/organizer/e1/attendees/export',
    );
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe(
      'publico.csv',
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:publico');
    click.mockRestore();
  });

  it('si la exportación falla lo avisa', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path) =>
      path.endsWith('/export')
        ? Response.json({ message: 'No' }, { status: 500 })
        : page([ana]),
    );
    render(<AttendeeList eventId="e1" />);
    await screen.findByRole('row', { name: /Ana Pérez/ });

    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'No se pudo exportar la lista del público',
      ),
    );
  });

  it('sin entradas lo dice, y una búsqueda sin resultados también', async () => {
    vi.mocked(apiFetch).mockImplementation(async () => page([]));
    render(<AttendeeList eventId="e1" />);

    expect(
      await screen.findByText('Todavía no hay entradas emitidas.'),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar' }), {
      target: { value: 'zzz' },
    });
    const section = screen.getByRole('region', { name: 'Público' });
    expect(
      await within(section).findByText('Nadie coincide con «zzz».'),
    ).toBeInTheDocument();
  });
});
