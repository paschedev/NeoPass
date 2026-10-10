import { describe, expect, it } from 'vitest';
import { sameEmail, suggestEmailFix } from './email-suggestion';

describe('suggestEmailFix', () => {
  it.each([
    ['juan@gmial.com', 'juan@gmail.com'],
    ['juan@gamil.com', 'juan@gmail.com'],
    ['juan@gmai.com', 'juan@gmail.com'],
    ['juan@gmail.con', 'juan@gmail.com'],
    ['juan@gmail.co', 'juan@gmail.com'],
    ['juan@gmail.com.ar', 'juan@gmail.com'],
    ['juan@gmial.con', 'juan@gmail.com'],
    ['juan@hotmial.com', 'juan@hotmail.com'],
    ['juan@hotmail.con.ar', 'juan@hotmail.com.ar'],
    ['juan@outlok.com', 'juan@outlook.com'],
    ['juan@yaho.com.ar', 'juan@yahoo.com.ar'],
    ['juan@iclod.com', 'juan@icloud.com'],
  ])('corrige un dominio común mal escrito: %s → %s', (typed, expected) => {
    expect(suggestEmailFix(typed)).toBe(expected);
  });

  it.each([
    'juan@gmail.com',
    'juan@hotmail.com.ar',
    'juan@outlook.es',
    'juan@live.com.mx',
    'juan@hotmail.com.br',
    'juan@estudio.com.ar',
    'juan@empresa.co',
  ])('no sugiere nada con un dominio bien escrito o propio: %s', (typed) => {
    expect(suggestEmailFix(typed)).toBeNull();
  });

  it.each(['juan@ymail.com', 'juan@mail.com', 'juan@email.com'])(
    'no confunde a un proveedor real parecido a uno común: %s',
    (typed) => {
      expect(suggestEmailFix(typed)).toBeNull();
    },
  );

  it('respeta lo que va antes de la arroba tal como se escribió', () => {
    expect(suggestEmailFix(' Juan.Perez+entradas@GMIAL.COM ')).toBe(
      'Juan.Perez+entradas@gmail.com',
    );
  });

  it('sin arroba o sin dominio no sugiere nada', () => {
    expect(suggestEmailFix('juan')).toBeNull();
    expect(suggestEmailFix('juan@')).toBeNull();
    expect(suggestEmailFix('@gmial.com')).toBeNull();
  });
});

describe('sameEmail', () => {
  it('las mayúsculas y los espacios de más no cuentan como diferencia', () => {
    expect(sameEmail('juan@gmail.com', ' Juan@Gmail.COM ')).toBe(true);
  });

  it('una letra distinta es otro correo', () => {
    expect(sameEmail('juan@gmail.com', 'juan@gmial.com')).toBe(false);
    expect(sameEmail('juan.perez@gmail.com', 'juanperez@gmail.com')).toBe(
      false,
    );
  });
});
