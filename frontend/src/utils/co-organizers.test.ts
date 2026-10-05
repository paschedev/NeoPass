import { describe, expect, it } from 'vitest';
import {
  buildCoOrganizerTerms,
  freeTicketLimitError,
  permissionsSummary,
  togglePermission,
} from './co-organizers';

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
