import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import PresetsPage from './page';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));

type Preset = { id: string; name: string };

// Backend en memoria: GET lista, POST agrega, PUT renombra y DELETE borra.
function mockBackend(initial: Preset[]) {
  let presets = [...initial];
  vi.mocked(apiFetch).mockImplementation(async (url, init) => {
    const method = init?.method ?? 'GET';
    const body = init?.body
      ? (JSON.parse(init.body as string) as { name: string })
      : null;
    const id = url.split('/')[2];
    if (method === 'POST' && body) {
      presets = [...presets, { id: `p${presets.length + 1}`, name: body.name }];
    } else if (method === 'PUT' && body) {
      presets = presets.map((p) =>
        p.id === id ? { ...p, name: body.name } : p,
      );
    } else if (method === 'DELETE') {
      presets = presets.filter((p) => p.id !== id);
    }
    return Response.json(method === 'GET' ? presets : {});
  });
}

function typeName(name: string) {
  fireEvent.change(screen.getByLabelText('Nombre de la plantilla'), {
    target: { value: name },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
}

const seven = Array.from({ length: 7 }, (_, i) => ({
  id: `p${i + 1}`,
  name: `Plantilla ${i + 1}`,
}));

describe('PresetsPage', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('crear una plantilla la guarda y la muestra en la lista', async () => {
    mockBackend([]);
    render(<PresetsPage />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Nueva plantilla' }),
    );
    typeName('  VIP  ');

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/presets', {
        method: 'POST',
        body: JSON.stringify({ name: 'VIP', price: 0 }),
      }),
    );
    expect(await screen.findByText('VIP')).toBeInTheDocument();
  });

  it('no guarda una plantilla sin nombre', async () => {
    mockBackend([]);
    render(<PresetsPage />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Nueva plantilla' }),
    );
    typeName('   ');

    expect(
      await screen.findByText('Poné un nombre para la plantilla'),
    ).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it('editar una plantilla guarda el nombre nuevo', async () => {
    mockBackend([{ id: 'p1', name: 'General' }]);
    render(<PresetsPage />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Editar General' }),
    );
    typeName('Campo');

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/presets/p1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Campo', price: 0 }),
      }),
    );
    expect(await screen.findByText('Campo')).toBeInTheDocument();
  });

  it('eliminar pide confirmación y la saca de la lista', async () => {
    mockBackend([{ id: 'p1', name: 'General' }]);
    render(<PresetsPage />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Eliminar General' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/presets/p1', {
        method: 'DELETE',
      }),
    );
    await waitFor(() =>
      expect(screen.queryByText('General')).not.toBeInTheDocument(),
    );
  });

  it('con 7 plantillas no deja crear otra', async () => {
    mockBackend(seven);
    render(<PresetsPage />);

    expect(await screen.findByText('Plantilla 7')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Nueva plantilla' }),
    ).toBeDisabled();
  });

  it('si el servidor rechaza la plantilla, muestra su mensaje', async () => {
    vi.mocked(apiFetch).mockImplementation(async (_url, init) =>
      init?.method === 'POST'
        ? Response.json(
            { message: 'Has alcanzado el límite máximo de 7 plantillas.' },
            { status: 400 },
          )
        : Response.json([]),
    );
    render(<PresetsPage />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Nueva plantilla' }),
    );
    typeName('VIP');

    expect(
      await screen.findByText(
        'Has alcanzado el límite máximo de 7 plantillas.',
      ),
    ).toBeInTheDocument();
  });
});
