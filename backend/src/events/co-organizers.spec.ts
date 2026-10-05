import {
  coOrganizerTerms,
  describePermissions,
  permissionsError,
} from './co-organizers';

describe('describePermissions', () => {
  it('sin permisos, solo escanear', () => {
    expect(describePermissions([], null)).toBe('escanear');
  });

  it('une los permisos en el orden de las casillas, con "y" antes del último', () => {
    expect(
      describePermissions(['VIEW_ATTENDEES', 'EDIT_EVENT', 'VIEW_SALES'], null),
    ).toBe(
      'escanear, editar la info del evento, ver ventas y recaudación y ver y exportar asistentes',
    );
  });

  it('el QR free lleva el tope, en singular si es una entrada', () => {
    expect(describePermissions(['SEND_FREE_TICKETS'], 20)).toBe(
      'escanear y mandar QR free (hasta 20 entradas)',
    );
    expect(describePermissions(['SEND_FREE_TICKETS'], 1)).toBe(
      'escanear y mandar QR free (hasta 1 entrada)',
    );
  });
});

describe('permissionsError', () => {
  it('manejar el staff y los pagos a RPPs exige ver las ventas', () => {
    expect(permissionsError(['MANAGE_STAFF'])).toBe(
      'Para manejar el staff y los pagos a RPPs también tiene que poder ver las ventas',
    );
    expect(permissionsError(['MANAGE_STAFF', 'VIEW_SALES'])).toBeNull();
  });
});

describe('coOrganizerTerms', () => {
  it('ordena los permisos y guarda el tope solo con QR free', () => {
    expect(coOrganizerTerms(['VIEW_SALES', 'EDIT_EVENT'], 10)).toEqual({
      permissions: ['EDIT_EVENT', 'VIEW_SALES'],
      freeTicketLimit: null,
    });
    expect(coOrganizerTerms(['SEND_FREE_TICKETS'], 10)).toEqual({
      permissions: ['SEND_FREE_TICKETS'],
      freeTicketLimit: 10,
    });
    expect(coOrganizerTerms(['SEND_FREE_TICKETS'], undefined)).toEqual({
      permissions: ['SEND_FREE_TICKETS'],
      freeTicketLimit: null,
    });
  });
});
