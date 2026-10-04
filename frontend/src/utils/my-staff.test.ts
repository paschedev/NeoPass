import { describe, expect, it } from 'vitest';
import { rppLink } from './my-staff';
import { ownRoleLabel } from './staff-roles';

describe('rppLink', () => {
  it('arma el link de venta del RPP para el evento', () => {
    expect(rppLink('https://neopass.ar', 'e1', 's1')).toBe(
      'https://neopass.ar/eventos/e1?rpp=s1',
    );
  });
});

describe('ownRoleLabel', () => {
  it('nombra el rol como lo conoce quien trabaja en el evento', () => {
    expect(ownRoleLabel('PROMOTER')).toBe('RPP');
    expect(ownRoleLabel('SCANNER')).toBe('Scanner');
    expect(ownRoleLabel('MANAGER')).toBe('Encargado');
  });
});
