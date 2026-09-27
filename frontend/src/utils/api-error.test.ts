import { describe, expect, it } from 'vitest';
import { getApiErrorMessage } from './api-error';

describe('getApiErrorMessage', () => {
  it('devuelve el mensaje del backend', () => {
    expect(
      getApiErrorMessage({ message: 'Evento no encontrado' }, 'Error'),
    ).toBe('Evento no encontrado');
  });

  it('une los errores de validación, uno por línea', () => {
    expect(
      getApiErrorMessage(
        { message: ['El título es obligatorio', 'La fecha no es válida'] },
        'Error',
      ),
    ).toBe('El título es obligatorio\nLa fecha no es válida');
  });

  it.each([null, {}, { message: '' }, { message: [] }, 'texto'])(
    'sin mensaje usable (%j) usa el texto por defecto',
    (body) => {
      expect(getApiErrorMessage(body, 'Error al guardar')).toBe(
        'Error al guardar',
      );
    },
  );
});
