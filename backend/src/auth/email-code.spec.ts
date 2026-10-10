import {
  codeRequestError,
  generateEmailCode,
  nextSendWindow,
  wrongCodeMessage,
} from './email-code';

const NOW = new Date('2026-10-10T15:00:00.000Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const MINUTE_MS = 60 * 1000;

describe('Código para confirmar el correo', () => {
  it('son 6 números, con los ceros de adelante', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateEmailCode()).toMatch(/^\d{6}$/);
    }
  });

  describe('cuándo se puede pedir otro', () => {
    it('el primero sale siempre', () => {
      expect(codeRequestError(null, 'ana@gmail.com', NOW)).toBeNull();
    });

    it('entre un código y otro al mismo correo tiene que pasar un minuto', () => {
      const previous = {
        email: 'ana@gmail.com',
        sentAt: ago(20 * 1000),
        sentInWindow: 1,
        windowStartedAt: ago(20 * 1000),
      };

      expect(codeRequestError(previous, 'Ana@Gmail.com', NOW)).toBe(
        'Esperá 40 segundos para pedir otro código',
      );
    });

    it('a otro correo (por ejemplo, para corregir uno mal escrito) no espera el minuto', () => {
      const previous = {
        email: 'ana@gmial.com',
        sentAt: ago(20 * 1000),
        sentInWindow: 1,
        windowStartedAt: ago(20 * 1000),
      };

      expect(codeRequestError(previous, 'ana@gmail.com', NOW)).toBeNull();
    });

    it('como mucho 5 por hora, a cualquier correo', () => {
      const previous = {
        email: 'ana@gmail.com',
        sentAt: ago(2 * MINUTE_MS),
        sentInWindow: 5,
        windowStartedAt: ago(30 * MINUTE_MS),
      };

      expect(codeRequestError(previous, 'otro@gmail.com', NOW)).toBe(
        'Llegaste al máximo de 5 códigos por hora. Probá de nuevo más tarde.',
      );
    });

    it('pasada la hora vuelve a contar de cero', () => {
      const previous = {
        email: 'ana@gmail.com',
        sentAt: ago(2 * MINUTE_MS),
        sentInWindow: 5,
        windowStartedAt: ago(61 * MINUTE_MS),
      };

      expect(codeRequestError(previous, 'ana@gmail.com', NOW)).toBeNull();
      expect(nextSendWindow(previous, NOW)).toEqual({
        sentInWindow: 1,
        windowStartedAt: NOW,
      });
    });

    it('dentro de la hora suma uno a los enviados', () => {
      const previous = {
        email: 'ana@gmail.com',
        sentAt: ago(2 * MINUTE_MS),
        sentInWindow: 2,
        windowStartedAt: ago(10 * MINUTE_MS),
      };

      expect(nextSendWindow(previous, NOW)).toEqual({
        sentInWindow: 3,
        windowStartedAt: previous.windowStartedAt,
      });
      expect(nextSendWindow(null, NOW)).toEqual({
        sentInWindow: 1,
        windowStartedAt: NOW,
      });
    });
  });

  it('un código incorrecto avisa cuántos intentos quedan', () => {
    expect(wrongCodeMessage(1)).toBe(
      'El código no es correcto. Te quedan 4 intentos.',
    );
    expect(wrongCodeMessage(4)).toBe(
      'El código no es correcto. Te queda 1 intento.',
    );
    expect(wrongCodeMessage(5)).toBe(
      'El código no es correcto. Pedí uno nuevo.',
    );
  });
});
