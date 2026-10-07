import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import toast from '@/utils/toast';
import RppEventDetailsPage from './page';

vi.mock('next/navigation', () => ({
  useParams: () => ({ eventId: 'e1' }),
  useRouter: () => ({ back: vi.fn() }),
}));
vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/utils/toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

const stats = {
  eventName: 'Fiesta Bresh',
  totalEarned: 0,
  totalTicketsSold: 0,
  clicks: 0,
  totalPaid: 0,
  balance: 0,
  payments: [],
  staffId: 's1',
  recentSales: [],
};

const withClipboard = (writeText: () => Promise<void>) =>
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });

async function copyButton() {
  vi.mocked(apiFetch).mockResolvedValue(Response.json(stats));
  render(<RppEventDetailsPage />);
  return screen.findByRole('button', { name: 'Copiar link' });
}

describe('Métricas del RPP en un evento', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('"Copiar link" copia el link de venta del RPP y avisa que quedó copiado', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    withClipboard(writeText);

    fireEvent.click(await copyButton());

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/eventos/e1?rpp=s1`,
      ),
    );
    expect(toast.success).toHaveBeenCalledWith('Link copiado');
  });

  it('si el navegador no deja copiar, avisa que no se pudo en vez de decir "copiado"', async () => {
    withClipboard(vi.fn().mockRejectedValue(new Error('NotAllowedError')));

    fireEvent.click(await copyButton());

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('No se pudo copiar el link'),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });
});
