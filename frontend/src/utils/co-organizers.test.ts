import { describe, expect, it } from 'vitest';
import {
  afterEditPath,
  buildCoOrganizerTerms,
  can,
  canEditEvent,
  editPermissions,
  freeTicketLimitError,
  freeTicketsLeft,
  permissionDeniedMessage,
  permissionsSummary,
  togglePermission,
} from './co-organizers';

describe('qué puede hacer quien está en sesión', () => {
  const coOrganizer = (permissions: Parameters<typeof can>[1][]) => ({
    role: 'CO_ORGANIZER' as const,
    permissions,
    freeTicketLimit: null,
  });

  it('puede lo que tiene marcado', () => {
    expect(can(coOrganizer(['VIEW_SALES']), 'VIEW_SALES')).toBe(true);
    expect(can(coOrganizer(['VIEW_SALES']), 'MANAGE_STAFF')).toBe(false);
  });

  it('entra a editar si puede cambiar la info o las tandas', () => {
    expect(canEditEvent(coOrganizer(['EDIT_EVENT']))).toBe(true);
    expect(canEditEvent(coOrganizer(['MANAGE_BATCHES']))).toBe(true);
    expect(canEditEvent(coOrganizer(['VIEW_SALES']))).toBe(false);
  });

  it('al editar, cada parte del formulario se habilita con su permiso', () => {
    expect(editPermissions(coOrganizer(['EDIT_EVENT']))).toEqual({
      canEditInfo: true,
      canManageBatches: false,
    });
    expect(editPermissions(coOrganizer(['MANAGE_BATCHES']))).toEqual({
      canEditInfo: false,
      canManageBatches: true,
    });
  });

  it('después de editar, el dueño vuelve a Mis eventos y el co-organizador al detalle', () => {
    expect(
      afterEditPath(
        { role: 'OWNER', permissions: [], freeTicketLimit: null },
        'e1',
      ),
    ).toBe('/panel?tab=events');
    expect(afterEditPath(coOrganizer(['EDIT_EVENT']), 'e1')).toBe(
      '/panel/eventos/e1',
    );
  });

  it('el aviso de una sección sin permiso dice qué falta, como el backend', () => {
    expect(permissionDeniedMessage('VIEW_SALES')).toBe(
      'No tenés permiso para ver ventas y recaudación',
    );
    expect(permissionDeniedMessage('MANAGE_STAFF')).toBe(
      'No tenés permiso para manejar el staff y los pagos a RPPs',
    );
  });

  it('los QR free que le quedan: el tope menos los no anulados (y los usados de un envío anulado)', () => {
    expect(
      freeTicketsLeft(10, [
        { status: 'ACTIVE', quantity: 3, checkedIn: 1 },
        { status: 'CANCELLED', quantity: 4, checkedIn: 2 },
      ]),
    ).toBe(5);
    expect(freeTicketsLeft(2, [{ status: 'ACTIVE', quantity: 3, checkedIn: 0 }])).toBe(0);
  });
});

describe('permisos de un co-organizador', () => {
  it('marcar "Staff y pagos" también marca "Ver ventas", que necesita', () => {
    expect(togglePermission([], 'MANAGE_STAFF')).toEqual([
      'VIEW_SALES',
      'MANAGE_STAFF',
    ]);
  });

  it('desmarcar "Ver ventas" también desmarca "Staff y pagos"', () => {
    expect(
      togglePermission(['VIEW_SALES', 'MANAGE_STAFF', 'EDIT_EVENT'], 'VIEW_SALES'),
    ).toEqual(['EDIT_EVENT']);
  });

  it('los permisos quedan en el orden de las casillas', () => {
    expect(togglePermission(['SEND_FREE_TICKETS'], 'EDIT_EVENT')).toEqual([
      'EDIT_EVENT',
      'SEND_FREE_TICKETS',
    ]);
    expect(togglePermission(['EDIT_EVENT', 'VIEW_SALES'], 'EDIT_EVENT')).toEqual([
      'VIEW_SALES',
    ]);
  });

  it('el tope de QR free vacío es sin tope; si se completa, entero desde 1', () => {
    expect(freeTicketLimitError('')).toBeNull();
    expect(freeTicketLimitError('20')).toBeNull();
    expect(freeTicketLimitError('0')).toBe(
      'El tope de QR free tiene que ser un número entero mayor a 0',
    );
    expect(freeTicketLimitError('2.5')).toBe(
      'El tope de QR free tiene que ser un número entero mayor a 0',
    );
  });

  it('el tope solo se manda con el permiso de QR free', () => {
    expect(buildCoOrganizerTerms(['SEND_FREE_TICKETS'], '20')).toEqual({
      permissions: ['SEND_FREE_TICKETS'],
      freeTicketLimit: 20,
    });
    expect(buildCoOrganizerTerms(['SEND_FREE_TICKETS'], '')).toEqual({
      permissions: ['SEND_FREE_TICKETS'],
      freeTicketLimit: null,
    });
    expect(buildCoOrganizerTerms(['VIEW_SALES'], '20')).toEqual({
      permissions: ['VIEW_SALES'],
      freeTicketLimit: null,
    });
  });

  it('resume lo que puede hacer, siempre empezando por escanear', () => {
    expect(permissionsSummary([], null)).toBe('Escanear');
    expect(
      permissionsSummary(['VIEW_SALES', 'SEND_FREE_TICKETS'], 20),
    ).toBe('Escanear · Ver ventas · QR free (hasta 20)');
  });
});
