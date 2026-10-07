import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import EscanearPage from './page';
import { apiFetch } from '@/utils/api';
import { playScanFeedback } from '@/utils/scan-sound';

type ScannerProps = {
  onScan: (codes: { rawValue: string }[]) => void;
  sound?: boolean;
  allowMultiple?: boolean;
};
let scanner: ScannerProps;

vi.mock('@yudiel/react-qr-scanner', () => ({
  Scanner: (props: ScannerProps) => {
    scanner = props;
    return <div>Cámara</div>;
  },
}));
vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/utils/scan-sound', () => ({ playScanFeedback: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const mockedFetch = vi.mocked(apiFetch);

const VALID = {
  success: true,
  status: 'VALID',
  message: 'VÁLIDO',
  event: 'Fiesta Bresh',
  type: 'General',
};

function answer(body: object, status = 201) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

function checkedCodes() {
  return mockedFetch.mock.calls.map(
    ([, init]) => JSON.parse(String(init?.body)).qrCode as string,
  );
}

// The camera reads what is in front of it about twice a second.
async function camera(...codes: string[]) {
  await act(async () => {
    scanner.onScan(codes.map((rawValue) => ({ rawValue })));
  });
}

async function wait(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

async function holdInFront(code: string, ms: number) {
  for (let elapsed = 0; elapsed < ms; elapsed += 500) {
    await camera(code);
    await wait(500);
  }
}

function result() {
  return screen.queryByRole('region', { name: 'Resultado del escaneo' });
}

function nextScanButton() {
  return within(result()!).getByRole('button', { name: 'Escanear siguiente' });
}

describe('Scanner de accesos', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(new Date('2026-10-10T23:41:00-03:00'));
    localStorage.setItem('user', JSON.stringify({ role: 'ORGANIZER' }));
    render(<EscanearPage />);
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('al leer un QR muestra "Validando…" y después el resultado', async () => {
    let respond: (response: Response) => void = () => {};
    mockedFetch.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        respond = resolve;
      }),
    );

    await camera('qr-1');

    expect(within(result()!).getByText('Validando…')).toBeInTheDocument();

    await act(async () => respond(answer(VALID)));

    expect(within(result()!).getByText('VÁLIDO')).toBeInTheDocument();
    expect(
      within(result()!).getByText('Fiesta Bresh - General'),
    ).toBeInTheDocument();
  });

  it('el verde se cierra solo a los 2 s', async () => {
    mockedFetch.mockResolvedValueOnce(answer(VALID));
    await camera('qr-1');

    await wait(1_900);
    expect(result()).not.toBeNull();
    await wait(200);

    expect(result()).toBeNull();
  });

  it('el verde también se cierra antes con un toque', async () => {
    mockedFetch.mockResolvedValueOnce(answer(VALID));
    await camera('qr-1');

    fireEvent.click(nextScanButton());

    expect(result()).toBeNull();
  });

  it.each([
    ['amarillo', { success: false, status: 'USED', message: 'YA INGRESÓ' }],
    ['rojo', { success: false, status: 'INVALID', message: 'INVÁLIDO' }],
  ])(
    'el %s queda en pantalla hasta tocar "Escanear siguiente"',
    async (_, body) => {
      mockedFetch.mockResolvedValueOnce(answer(body));
      await camera('qr-1');

      await wait(10_000);
      expect(within(result()!).getByText(body.message)).toBeInTheDocument();

      fireEvent.click(nextScanButton());
      expect(result()).toBeNull();
    },
  );

  it('mientras se ve un resultado no valida otro QR: lo valida al cerrarlo', async () => {
    mockedFetch.mockResolvedValue(answer(VALID));
    await camera('qr-1');

    await camera('qr-2');
    expect(checkedCodes()).toEqual(['qr-1']);

    fireEvent.click(nextScanButton());
    await camera('qr-2');

    expect(checkedCodes()).toEqual(['qr-1', 'qr-2']);
  });

  it('el mismo QR que sigue frente a la cámara no se vuelve a validar', async () => {
    mockedFetch.mockResolvedValue(answer(VALID));

    await holdInFront('qr-1', 6_000);

    expect(checkedCodes()).toEqual(['qr-1']);
  });

  it('si se saca el QR y se vuelve a mostrar, se valida otra vez y dice cuándo y quién lo escaneó', async () => {
    mockedFetch.mockResolvedValueOnce(answer(VALID)).mockResolvedValueOnce(
      answer({
        success: false,
        status: 'USED',
        message: 'YA INGRESÓ',
        usedAt: '2026-10-10T23:41:00-03:00',
        usedBy: 'Juan Pérez',
        usedByYou: true,
      }),
    );
    await camera('qr-1');
    await wait(2_000);

    await wait(2_500);
    await camera('qr-1');

    expect(checkedCodes()).toEqual(['qr-1', 'qr-1']);
    expect(within(result()!).getByText('YA INGRESÓ')).toBeInTheDocument();
    expect(
      within(result()!).getByText(
        'Entró a las 23:41 (hace 4 s) · lo escaneaste vos',
      ),
    ).toBeInTheDocument();
  });

  it('sin conexión avisa que no se pudo validar y "Reintentar" vuelve a mandar el mismo QR', async () => {
    mockedFetch
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(answer(VALID));
    await camera('qr-1');

    expect(
      within(result()!).getByText('NO SE PUDO VALIDAR'),
    ).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(
        within(result()!).getByRole('button', { name: 'Reintentar' }),
      );
    });

    expect(checkedCodes()).toEqual(['qr-1', 'qr-1']);
    expect(within(result()!).getByText('VÁLIDO')).toBeInTheDocument();
  });

  it('muestra los últimos escaneos, el más reciente arriba', async () => {
    mockedFetch
      .mockResolvedValueOnce(answer(VALID))
      .mockResolvedValueOnce(
        answer({ success: false, status: 'INVALID', message: 'INVÁLIDO' }),
      );
    await camera('qr-1');
    fireEvent.click(nextScanButton());
    await camera('qr-2');

    const history = screen.getByRole('region', { name: 'Últimos escaneos' });
    const rows = within(history).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('INVÁLIDO');
    expect(rows[1]).toHaveTextContent('VÁLIDO');
    expect(rows[1]).toHaveTextContent('General');
  });

  it('suena y vibra una vez por resultado, no con cada lectura de la cámara', async () => {
    mockedFetch.mockResolvedValue(answer(VALID));

    await holdInFront('qr-1', 3_000);

    expect(scanner.sound).toBe(false);
    expect(playScanFeedback).toHaveBeenCalledTimes(1);
    expect(playScanFeedback).toHaveBeenCalledWith('success');
  });
});
