import { afterEach, describe, expect, it, vi } from 'vitest';
import hotToast from 'react-hot-toast';
import toast from './toast';

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn(), loading: vi.fn() },
}));

describe('avisos', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('un error usa su texto como id, así el mismo mensaje repetido no se apila', () => {
    toast.error('Error de conexión');
    toast.error('Error de conexión');

    expect(hotToast.error).toHaveBeenCalledTimes(2);
    expect(hotToast.error).toHaveBeenNthCalledWith(1, 'Error de conexión', {
      id: 'Error de conexión',
    });
    expect(hotToast.error).toHaveBeenNthCalledWith(2, 'Error de conexión', {
      id: 'Error de conexión',
    });
  });

  it('un éxito usa su texto como id', () => {
    toast.success('Plantilla guardada');

    expect(hotToast.success).toHaveBeenCalledWith('Plantilla guardada', {
      id: 'Plantilla guardada',
    });
  });

  it('si el aviso trae su propio id (el de "Subiendo imagen..."), se respeta', () => {
    toast.success('Imagen subida', { id: 'toast-1' });
    toast.error('No se pudo subir la imagen', { id: 'toast-1' });

    expect(hotToast.success).toHaveBeenCalledWith('Imagen subida', {
      id: 'toast-1',
    });
    expect(hotToast.error).toHaveBeenCalledWith('No se pudo subir la imagen', {
      id: 'toast-1',
    });
  });
});
