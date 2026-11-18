import { Prisma } from '@prisma/client';
import { isDatabaseBusyError } from './prisma-errors';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('error de Prisma', {
    code,
    clientVersion: 'test',
  });

describe('isDatabaseBusyError', () => {
  it('reconoce que la base no dio abasto: sin conexión libre o con la transacción vencida', () => {
    expect(isDatabaseBusyError(prismaError('P2024'))).toBe(true);
    expect(isDatabaseBusyError(prismaError('P2028'))).toBe(true);
  });

  it('no confunde con eso los demás errores', () => {
    expect(isDatabaseBusyError(prismaError('P2002'))).toBe(false);
    expect(isDatabaseBusyError(new Error('P2024'))).toBe(false);
  });
});
