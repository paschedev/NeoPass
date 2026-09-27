import { describe, expect, it } from 'vitest';
import { getHomePath, getNavItems, showsAppNav } from './navigation';
import type { RoleFlags } from './roles';

const ids = (user: RoleFlags | null) =>
  getNavItems(user).map((item) => item.id);

describe('getNavItems', () => {
  it('sin sesión muestra eventos e ingresar', () => {
    expect(ids(null)).toEqual(['eventos', 'login']);
  });

  it('un comprador ve eventos, tickets y ajustes', () => {
    expect(ids({ role: 'CUSTOMER' })).toEqual([
      'eventos',
      'tickets',
      'ajustes',
    ]);
  });

  it('un scanner sin otros roles tiene el QR al lado de eventos', () => {
    expect(ids({ role: 'CUSTOMER', isCurrentlyScanner: true })).toEqual([
      'eventos',
      'scanner',
      'tickets',
      'ajustes',
    ]);
  });

  it('un RPP que no escanea no ve el QR', () => {
    expect(ids({ role: 'CUSTOMER', hasBeenRpp: true })).toEqual([
      'eventos',
      'rpp',
      'tickets',
      'ajustes',
    ]);
  });

  it('un RPP que además escanea tiene el QR en el centro', () => {
    expect(
      ids({ role: 'CUSTOMER', hasBeenRpp: true, isCurrentlyScanner: true }),
    ).toEqual(['eventos', 'rpp', 'scanner', 'tickets', 'ajustes']);
  });

  it.each(['ORGANIZER', 'ADMIN'])(
    'un %s tiene el QR en el centro y tickets y ajustes dentro de "Más"',
    (role) => {
      const items = getNavItems({ role });

      expect(items.map((item) => item.id)).toEqual([
        'eventos',
        'metricas',
        'scanner',
        'rpp',
        'mas',
      ]);
      const more = items[4];
      expect(more.kind === 'menu' && more.items.map((i) => i.id)).toEqual([
        'tickets',
        'ajustes',
      ]);
    },
  );
});

describe('getHomePath', () => {
  it.each(['ORGANIZER', 'ADMIN'])('un %s entra a su panel', (role) => {
    expect(getHomePath({ role })).toBe('/panel');
  });

  it('el resto entra a sus tickets, aunque escanee o sea RPP', () => {
    expect(getHomePath({ role: 'CUSTOMER' })).toBe('/panel/tickets');
    expect(
      getHomePath({
        role: 'CUSTOMER',
        isCurrentlyScanner: true,
        hasBeenRpp: true,
      }),
    ).toBe('/panel/tickets');
  });
});

describe('showsAppNav', () => {
  it.each([
    '/',
    '/login',
    '/registro',
    '/password-recovery',
    '/reset-password',
  ])('%s se muestra sin la navegación de la app', (pathname) => {
    expect(showsAppNav(pathname)).toBe(false);
  });

  it.each(['/eventos', '/panel', '/panel/tickets'])(
    '%s muestra la navegación de la app',
    (pathname) => {
      expect(showsAppNav(pathname)).toBe(true);
    },
  );
});
