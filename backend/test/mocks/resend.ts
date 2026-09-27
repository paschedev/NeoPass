// Doble del SDK de Resend (moduleNameMapper en test/jest-e2e.json): ningún test
// manda mails reales. Por defecto el envío sale bien; cada test puede cambiarlo.
type SendResult = { data: { id: string } | null; error: unknown };

export const resendMock = {
  send: jest.fn<Promise<SendResult>, [unknown]>(),
};

export class Resend {
  constructor(readonly apiKey?: string) {}

  readonly emails = {
    send: (payload: unknown) => resendMock.send(payload),
  };
}
