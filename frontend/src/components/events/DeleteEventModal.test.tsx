import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import DeleteEventModal from './DeleteEventModal';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/utils/toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const EVENT = { id: 'event-1', title: 'Fiesta de primavera' };

function renderModal(
  asOrganizer: { ticketsSold: number; accountEmail: string } | null,
  onDeleted = vi.fn(),
) {
  render(
    <DeleteEventModal
      event={EVENT}
      open
      onClose={() => {}}
      onDeleted={onDeleted}
      asOrganizer={asOrganizer && { name: 'Productora Sur', ...asOrganizer }}
    />,
  );
  return onDeleted;
}

const confirmButton = () => screen.getByRole('button', { name: /^Eliminar|^Dar de baja/ });

function typeName(name: string) {
  fireEvent.change(screen.getByLabelText(/Escribí el nombre del evento/), {
    target: { value: name },
  });
}

describe('DeleteEventModal', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('el botón queda deshabilitado hasta escribir el nombre exacto del evento', () => {
    renderModal({ ticketsSold: 0, accountEmail: 'org@neopass.test' });

    expect(confirmButton()).toBeDisabled();
    typeName('Fiesta');
    expect(confirmButton()).toBeDisabled();
    typeName('Fiesta de primavera');
    expect(confirmButton()).toBeEnabled();
  });

  it('con ventas avisa que el organizador se hace cargo y que las ventas siguen registradas', () => {
    renderModal({ ticketsSold: 12, accountEmail: 'org@neopass.test' });

    expect(screen.getByText(/Ya vendiste 12 entradas/)).toBeInTheDocument();
    expect(screen.getByText(/no NeoPass/)).toBeInTheDocument();
    expect(screen.getByText(/siguen registradas/)).toBeInTheDocument();
  });

  it('sin ventas no muestra el aviso de las entradas vendidas', () => {
    renderModal({ ticketsSold: 0, accountEmail: 'org@neopass.test' });

    expect(screen.queryByText(/Ya vendiste/)).not.toBeInTheDocument();
  });

  it('la vista previa del aviso muestra el email de la cuenta hasta que se elige otro', () => {
    renderModal({ ticketsSold: 3, accountEmail: 'org@neopass.test' });

    expect(screen.getByTestId('deletion-preview')).toHaveTextContent(
      'org@neopass.test',
    );
    fireEvent.change(screen.getByLabelText(/Email de contacto/), {
      target: { value: 'reclamos@productora.test' },
    });
    expect(screen.getByTestId('deletion-preview')).toHaveTextContent(
      'reclamos@productora.test',
    );
  });

  it('elimina el evento con el email de contacto elegido', async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 200 }));
    const onDeleted = renderModal({
      ticketsSold: 3,
      accountEmail: 'org@neopass.test',
    });

    fireEvent.change(screen.getByLabelText(/Email de contacto/), {
      target: { value: 'reclamos@productora.test' },
    });
    typeName('Fiesta de primavera');
    fireEvent.click(confirmButton());

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(apiFetch).toHaveBeenCalledWith('/events/event-1', {
      method: 'DELETE',
      body: JSON.stringify({ contactEmail: 'reclamos@productora.test' }),
    });
  });

  it('sin email elegido no lo manda: queda el de la cuenta', async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 200 }));
    renderModal({ ticketsSold: 0, accountEmail: 'org@neopass.test' });

    typeName('Fiesta de primavera');
    fireEvent.click(confirmButton());

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/events/event-1', {
        method: 'DELETE',
        body: JSON.stringify({}),
      }),
    );
  });

  it('como ADMIN da de baja sin pedir email y avisa que se muestra el del organizador', async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 200 }));
    renderModal(null);

    expect(screen.queryByLabelText(/Email de contacto/)).not.toBeInTheDocument();
    expect(screen.getByText(/email del organizador/)).toBeInTheDocument();
    typeName('Fiesta de primavera');
    fireEvent.click(confirmButton());

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/events/event-1', {
        method: 'DELETE',
        body: JSON.stringify({}),
      }),
    );
  });
});
