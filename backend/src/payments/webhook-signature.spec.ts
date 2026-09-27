import { createHmac } from 'node:crypto';
import { isValidWebhookSignature } from './webhook-signature';

const SECRET = 'webhook-secret';
const TS = '1742505638683';

function sign(dataId: string, requestId: string, secret = SECRET) {
  const manifest = `id:${dataId};request-id:${requestId};ts:${TS};`;
  const hash = createHmac('sha256', secret).update(manifest).digest('hex');
  return `ts=${TS},v1=${hash}`;
}

describe('isValidWebhookSignature', () => {
  it('acepta una notificación firmada con la clave secreta', () => {
    expect(
      isValidWebhookSignature({
        xSignature: sign('123456', 'req-1'),
        xRequestId: 'req-1',
        dataId: '123456',
        secret: SECRET,
      }),
    ).toBe(true);
  });

  it('rechaza una firma hecha con otra clave', () => {
    expect(
      isValidWebhookSignature({
        xSignature: sign('123456', 'req-1', 'otra-clave'),
        xRequestId: 'req-1',
        dataId: '123456',
        secret: SECRET,
      }),
    ).toBe(false);
  });

  it('rechaza la notificación si cambiaron el id del pago', () => {
    expect(
      isValidWebhookSignature({
        xSignature: sign('123456', 'req-1'),
        xRequestId: 'req-1',
        dataId: '999999',
        secret: SECRET,
      }),
    ).toBe(false);
  });

  it('rechaza una notificación sin firma', () => {
    expect(
      isValidWebhookSignature({
        xSignature: undefined,
        xRequestId: 'req-1',
        dataId: '123456',
        secret: SECRET,
      }),
    ).toBe(false);
  });

  it.each(['basura', 'v1=abc', `ts=${TS}`, `ts=abc,v1=abc`])(
    'rechaza un header mal formado: %s',
    (xSignature) => {
      expect(
        isValidWebhookSignature({
          xSignature,
          xRequestId: 'req-1',
          dataId: '123456',
          secret: SECRET,
        }),
      ).toBe(false);
    },
  );
});
