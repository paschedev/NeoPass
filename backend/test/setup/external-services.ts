import { mercadoPagoMock } from '../mocks/mercadopago';
import { resendMock } from '../mocks/resend';

// Ningún test llama a servicios externos: fetch (Turnstile, OAuth de Mercado Pago)
// falla si el test no lo simula, y los SDK de Mercado Pago y Resend son dobles.
// Antes de cada test todo vuelve a su comportamiento por defecto.
function rejectUnmockedFetch(input: string | URL | Request): Promise<Response> {
  const url = input instanceof Request ? input.url : String(input);
  return Promise.reject(new Error(`Unmocked network call in test: ${url}`));
}

globalThis.fetch = jest.fn(rejectUnmockedFetch);

beforeEach(() => {
  jest.mocked(fetch).mockReset().mockImplementation(rejectUnmockedFetch);
  mercadoPagoMock.preferenceCreate.mockReset();
  mercadoPagoMock.paymentGet.mockReset();
  resendMock.send
    .mockReset()
    .mockResolvedValue({ data: { id: 'test-email-id' }, error: null });
});
