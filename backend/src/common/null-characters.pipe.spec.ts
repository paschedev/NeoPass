import { BadRequestException } from '@nestjs/common';
import { NullCharactersPipe } from './null-characters.pipe';

describe('NullCharactersPipe', () => {
  const pipe = new NullCharactersPipe();
  const run = (value: unknown) =>
    pipe.transform(value, { type: 'body', metatype: Object });

  it('deja pasar los datos sin caracteres nulos tal cual', () => {
    const body = { title: 'Fiesta', batches: [{ name: 'Preventa' }], n: 3 };

    expect(run(body)).toBe(body);
    expect(run(null)).toBeNull();
  });

  it.each([
    ['en un texto', 'Fies\u0000ta'],
    ['en un campo', { title: 'Fiesta\u0000' }],
    [
      'dentro de una lista',
      { batches: [{ ticketTypes: [{ name: '\u0000' }] }] },
    ],
    ['en el nombre de un campo', { 'tit\u0000le': 'Fiesta' }],
  ])('rechaza un carácter nulo %s', (_case, value) => {
    expect(() => run(value)).toThrow(
      new BadRequestException('El texto tiene caracteres no válidos'),
    );
  });

  it('no revisa los IDs de la ruta: un ID mal formado sigue respondiendo que no existe', () => {
    expect(
      pipe.transform('no-es-un-id\u0000', { type: 'param', metatype: String }),
    ).toBe('no-es-un-id\u0000');
  });

  it('también revisa los filtros de la URL', () => {
    expect(() =>
      pipe.transform({ q: '\u0000' }, { type: 'query', metatype: Object }),
    ).toThrow(BadRequestException);
  });
});
