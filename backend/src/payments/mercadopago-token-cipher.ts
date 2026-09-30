import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';
export const ENCRYPTED_TOKEN_PREFIX = `${VERSION}:`;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

// Organizers' Mercado Pago tokens are stored encrypted (AES-256-GCM): a leak of
// the database alone does not let anyone collect or refund on their behalf.
// Stored as "v1:<base64 of iv + tag + ciphertext>"; the version leaves room to
// rotate the key later.
export class MercadoPagoTokenCipher {
  private readonly key: Buffer;

  constructor(base64Key: string) {
    this.key = Buffer.from(base64Key, 'base64');
    if (this.key.length !== KEY_BYTES) {
      throw new Error(
        `MERCADOPAGO_TOKEN_KEY must be ${KEY_BYTES} bytes in base64`,
      );
    }
  }

  encrypt(token: string) {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(token, 'utf8'),
      cipher.final(),
    ]);
    const payload = Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
    return `${ENCRYPTED_TOKEN_PREFIX}${payload.toString('base64')}`;
  }

  // Throws if the value was not encrypted with this key or was altered.
  decrypt(stored: string) {
    if (!this.isEncrypted(stored)) {
      throw new Error('The Mercado Pago token is not encrypted');
    }
    const payload = Buffer.from(
      stored.slice(ENCRYPTED_TOKEN_PREFIX.length),
      'base64',
    );
    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      payload.subarray(0, IV_BYTES),
    );
    decipher.setAuthTag(payload.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    return Buffer.concat([
      decipher.update(payload.subarray(IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ]).toString('utf8');
  }

  isEncrypted(stored: string) {
    return stored.startsWith(ENCRYPTED_TOKEN_PREFIX);
  }
}
