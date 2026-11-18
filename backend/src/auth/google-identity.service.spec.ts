import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleIdentityService } from './google-identity.service';

function service(clientId: string | undefined) {
  return new GoogleIdentityService({
    get: () => clientId,
  } as unknown as ConfigService);
}

describe('GoogleIdentityService', () => {
  it.each([undefined, ''])(
    'sin GOOGLE_CLIENT_ID (%p) entrar con Google no está disponible',
    async (clientId) => {
      await expect(service(clientId).verify('credencial')).rejects.toThrow(
        ServiceUnavailableException,
      );
    },
  );
});
