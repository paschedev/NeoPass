import { mentionsNeoPass } from './brand-name';

describe('mentionsNeoPass', () => {
  it.each([
    'NeoPass',
    'Soporte NEOPASS',
    'Neo Pass',
    'neo-pass',
    'N.e.o.P.a.s.s',
  ])(
    'detecta la marca aunque cambien mayúsculas, espacios o signos: %s',
    (name) => {
      expect(mentionsNeoPass(name)).toBe(true);
    },
  );

  it.each(['Productora Sur', 'Neo Club', 'Passline', 'Ana Pérez'])(
    'deja pasar nombres sin la marca: %s',
    (name) => {
      expect(mentionsNeoPass(name)).toBe(false);
    },
  );
});
