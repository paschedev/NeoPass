import { MercadoPagoTokenCipher } from './mercadopago-token-cipher';

const KEY = Buffer.alloc(32, 7).toString('base64');
const OTHER_KEY = Buffer.alloc(32, 9).toString('base64');
const TOKEN = 'APP_USR-1234567890-organizer-token';

describe('MercadoPagoTokenCipher', () => {
  const cipher = new MercadoPagoTokenCipher(KEY);

  it('el token guardado no se puede leer y se recupera con la clave', () => {
    const stored = cipher.encrypt(TOKEN);

    expect(stored).not.toContain(TOKEN);
    expect(cipher.isEncrypted(stored)).toBe(true);
    expect(cipher.decrypt(stored)).toBe(TOKEN);
  });

  it('cifrar dos veces el mismo token da valores distintos', () => {
    expect(cipher.encrypt(TOKEN)).not.toBe(cipher.encrypt(TOKEN));
  });

  it('con otra clave no se puede descifrar', () => {
    const stored = cipher.encrypt(TOKEN);

    expect(() =>
      new MercadoPagoTokenCipher(OTHER_KEY).decrypt(stored),
    ).toThrow();
  });

  it('un valor alterado no se descifra', () => {
    const [version, payload] = cipher.encrypt(TOKEN).split(':');
    const bytes = Buffer.from(payload, 'base64');
    bytes[bytes.length - 1] ^= 1;

    expect(() =>
      cipher.decrypt(`${version}:${bytes.toString('base64')}`),
    ).toThrow();
  });

  it('un token en texto plano no pasa por cifrado', () => {
    expect(cipher.isEncrypted(TOKEN)).toBe(false);
    expect(() => cipher.decrypt(TOKEN)).toThrow();
  });

  it('la clave tiene que tener 32 bytes', () => {
    expect(
      () => new MercadoPagoTokenCipher(Buffer.alloc(16).toString('base64')),
    ).toThrow();
  });
});
