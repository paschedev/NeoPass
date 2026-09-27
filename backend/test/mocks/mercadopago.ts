// Doble del SDK de Mercado Pago (moduleNameMapper en test/jest-e2e.json): ningún
// test llama a la API real. Cada test define las respuestas con mercadoPagoMock;
// el segundo argumento es el access token con el que se creó el cliente.
export const mercadoPagoMock = {
  preferenceCreate: jest.fn<Promise<unknown>, [unknown, string]>(),
  paymentGet: jest.fn<Promise<unknown>, [unknown, string]>(),
};

export class MercadoPagoConfig {
  constructor(readonly options: { accessToken: string }) {}
}

export class Preference {
  constructor(private readonly config: MercadoPagoConfig) {}

  create(request: unknown) {
    return mercadoPagoMock.preferenceCreate(
      request,
      this.config.options.accessToken,
    );
  }
}

export class Payment {
  constructor(private readonly config: MercadoPagoConfig) {}

  get(request: unknown) {
    return mercadoPagoMock.paymentGet(request, this.config.options.accessToken);
  }
}
