import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import toast from '@/utils/toast';
import ProfileForm from './ProfileForm';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/utils/toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(() => 'toast-foto'),
  },
}));

const organizer = {
  id: 'u1',
  email: 'agus@gmail.com',
  name: 'Agustín Zannantonio',
  role: 'ORGANIZER',
  avatarUrl: null as string | null,
  companyName: 'Productora Sur' as string | null,
  emailVerified: true,
  hasLinkedMp: false,
  hasBeenRpp: false,
  isCurrentlyScanner: false,
};
const customer = {
  ...organizer,
  name: 'Ana Pérez',
  role: 'CUSTOMER',
  companyName: null,
};
const PHOTO_URL =
  'https://res.cloudinary.com/neopass/image/upload/v2/avatars/u1.jpg';
const cloudinaryFetch = vi.fn();

// El perfil que trae /auth/me y el que devuelve guardar (lo enviado aplicado).
function server(user: typeof organizer, save?: (body: object) => Response) {
  vi.mocked(apiFetch).mockImplementation(async (path, init) => {
    if (path === '/auth/me' && init?.method === 'PATCH') {
      const body = JSON.parse(String(init.body)) as object;
      return save ? save(body) : Response.json({ ...user, ...body });
    }
    if (path === '/auth/me') return Response.json(user);
    if (path === '/media/avatar-presign') {
      return Response.json({
        signature: 'firma',
        timestamp: 1,
        cloudName: 'neopass',
        apiKey: 'clave',
        publicId: 'avatars/u1',
        overwrite: true,
      });
    }
    return Response.json({});
  });
}

function logIn(user: typeof organizer) {
  localStorage.setItem('token', 'token');
  localStorage.setItem('user', JSON.stringify(user));
}

const savedBody = () => {
  const call = vi
    .mocked(apiFetch)
    .mock.calls.find(([, init]) => init?.method === 'PATCH');
  return JSON.parse(String(call?.[1]?.body));
};

describe('Perfil', () => {
  beforeEach(() => vi.stubGlobal('fetch', cloudinaryFetch));

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('muestra los datos de la cuenta y guarda el nombre y la productora', async () => {
    logIn(organizer);
    server(organizer);
    render(<ProfileForm />);

    const name = await screen.findByLabelText('Nombre y apellido');
    const company = screen.getByLabelText('Productora o marca (opcional)');
    expect(name).toHaveValue('Agustín Zannantonio');
    expect(company).toHaveValue('Productora Sur');
    fireEvent.change(name, { target: { value: 'Agustín Z.' } });
    fireEvent.change(company, { target: { value: 'Productora Norte' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Guardamos tus datos'),
    );
    expect(savedBody()).toEqual({
      name: 'Agustín Z.',
      companyName: 'Productora Norte',
    });
    expect(JSON.parse(localStorage.getItem('user')!)).toMatchObject({
      name: 'Agustín Z.',
      companyName: 'Productora Norte',
    });
  });

  it('solo manda lo que cambió: sin tocar la productora no la pisa', async () => {
    logIn(organizer);
    server(organizer);
    render(<ProfileForm />);

    fireEvent.change(await screen.findByLabelText('Nombre y apellido'), {
      target: { value: 'Agustín Z.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(savedBody()).toEqual({ name: 'Agustín Z.' });
  });

  it('después de guardar muestra lo que quedó guardado, sin espacios de más', async () => {
    logIn(organizer);
    server(organizer, () =>
      Response.json({ ...organizer, name: 'Agustín Z.' }),
    );
    render(<ProfileForm />);

    const name = await screen.findByLabelText('Nombre y apellido');
    fireEvent.change(name, { target: { value: '  Agustín   Z. ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(name).toHaveValue('Agustín Z.'));
  });

  it('a quien no organiza no le pide productora', async () => {
    logIn(customer);
    server(customer);
    render(<ProfileForm />);

    await screen.findByLabelText('Nombre y apellido');

    expect(
      screen.queryByLabelText('Productora o marca (opcional)'),
    ).not.toBeInTheDocument();
  });

  it('si el servidor rechaza un dato muestra el motivo', async () => {
    logIn(organizer);
    server(organizer, () =>
      Response.json(
        { message: 'El nombre no puede incluir "NeoPass"' },
        { status: 400 },
      ),
    );
    render(<ProfileForm />);

    fireEvent.change(await screen.findByLabelText('Nombre y apellido'), {
      target: { value: 'Equipo NeoPass' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El nombre no puede incluir "NeoPass"',
    );
  });

  it('cambiar la foto la sube y la deja en el perfil', async () => {
    logIn(organizer);
    server(organizer);
    cloudinaryFetch.mockResolvedValue(Response.json({ secure_url: PHOTO_URL }));
    render(<ProfileForm />);

    fireEvent.change(await screen.findByLabelText('Cambiar foto'), {
      target: {
        files: [new File(['imagen'], 'yo.jpg', { type: 'image/jpeg' })],
      },
    });

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Foto actualizada', {
        id: 'toast-foto',
      }),
    );
    expect(savedBody()).toEqual({ avatarUrl: PHOTO_URL });
    expect(JSON.parse(localStorage.getItem('user')!)).toMatchObject({
      avatarUrl: PHOTO_URL,
    });
  });

  it('quitar la foto la saca del perfil', async () => {
    const withPhoto = { ...organizer, avatarUrl: PHOTO_URL };
    logIn(withPhoto);
    server(withPhoto);
    render(<ProfileForm />);

    fireEvent.click(await screen.findByRole('button', { name: 'Quitar foto' }));

    await waitFor(() => expect(savedBody()).toEqual({ avatarUrl: null }));
  });

  it('el correo se ve y se cambia desde Configuración', async () => {
    logIn(organizer);
    server(organizer);
    render(<ProfileForm />);

    expect(await screen.findByText('agus@gmail.com')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Cambiar correo' }),
    ).toHaveAttribute('href', '/panel/configuracion#correo');
  });
});
