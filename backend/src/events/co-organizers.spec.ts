import {
  coOrganizerTerms,
  describePermissions,
  permissionsError,
} from './co-organizers';

describe('describePermissions', () => {
  it('sin permisos, solo escanear', () => {
    expect(describePermissions([], null, [])).toBe('escanear');
  });

  it('une los permisos en el orden de las casillas, con "y" antes del último', () => {
    expect(
      describePermissions(
        ['VIEW_ATTENDEES', 'EDIT_EVENT', 'VIEW_SALES'],
        null,
        [],
      ),
    ).toBe(
      'escanear, editar la info del evento, ver ventas y recaudación y ver y exportar la lista del público',
    );
  });

  it('el QR free lleva los tipos y el tope, en singular si es una entrada', () => {
    expect(
      describePermissions(['SEND_FREE_TICKETS'], 20, ['General', 'VIP']),
    ).toBe('escanear y mandar QR free de General y VIP (hasta 20 entradas)');
    expect(describePermissions(['SEND_FREE_TICKETS'], 1, ['VIP'])).toBe(
      'escanear y mandar QR free de VIP (hasta 1 entrada)',
    );
    expect(describePermissions(['SEND_FREE_TICKETS'], null, ['General'])).toBe(
      'escanear y mandar QR free de General',
    );
  });
});

describe('permissionsError', () => {
  it('manejar el staff y los pagos a RRPP exige ver las ventas', () => {
    expect(permissionsError(['MANAGE_STAFF'])).toBe(
      'Para manejar el staff y los pagos a RRPP también tiene que poder ver las ventas',
    );
    expect(permissionsError(['MANAGE_STAFF', 'VIEW_SALES'])).toBeNull();
  });
});

describe('coOrganizerTerms', () => {
  it('ordena los permisos y guarda el tope y los tipos solo con QR free', () => {
    expect(
      coOrganizerTerms(['VIEW_SALES', 'EDIT_EVENT'], 10, ['General']),
    ).toEqual({
      permissions: ['EDIT_EVENT', 'VIEW_SALES'],
      freeTicketLimit: null,
      freeTicketTypes: [],
    });
    expect(coOrganizerTerms(['SEND_FREE_TICKETS'], 10, ['General'])).toEqual({
      permissions: ['SEND_FREE_TICKETS'],
      freeTicketLimit: 10,
      freeTicketTypes: ['General'],
    });
    expect(coOrganizerTerms(['SEND_FREE_TICKETS'], undefined, ['VIP'])).toEqual(
      {
        permissions: ['SEND_FREE_TICKETS'],
        freeTicketLimit: null,
        freeTicketTypes: ['VIP'],
      },
    );
  });
});
