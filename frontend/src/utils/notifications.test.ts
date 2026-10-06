import { describe, expect, it } from 'vitest';
import {
  feedPath,
  notificationHref,
  pendingInvitationStaffId,
} from './notifications';

describe('pendingInvitationStaffId', () => {
  const invite = (status: 'PENDING' | 'ACCEPTED') => ({
    type: 'STAFF_INVITE',
    metadata: { status, eventStaffId: 'staff-1' },
  });

  it('una invitación sin responder se puede aceptar o rechazar', () => {
    expect(pendingInvitationStaffId(invite('PENDING'))).toBe('staff-1');
  });

  it('una invitación ya respondida no', () => {
    expect(pendingInvitationStaffId(invite('ACCEPTED'))).toBeNull();
  });

  it('otro tipo de aviso no', () => {
    expect(
      pendingInvitationStaffId({
        type: 'SYSTEM',
        metadata: { status: 'PENDING', eventStaffId: 'staff-1' },
      }),
    ).toBeNull();
  });
});

describe('feedPath', () => {
  it('pide la primera página con la cantidad indicada', () => {
    expect(feedPath({ limit: 3 })).toBe('/notifications/feed?limit=3');
  });

  it('suma el cursor de la página anterior y el filtro de solicitudes', () => {
    expect(feedPath({ limit: 20, cursor: 'n20', onlyRequests: true })).toBe(
      '/notifications/feed?limit=20&cursor=n20&onlyRequests=true',
    );
  });
});

describe('notificationHref', () => {
  it('devuelve el link interno del aviso', () => {
    expect(notificationHref({ actionUrl: '/panel/tickets' })).toBe(
      '/panel/tickets',
    );
  });

  it.each([
    ['sin link', null],
    ['un sitio externo', 'https://otro-sitio.test/robo'],
    ['un link que arranca con //', '//otro-sitio.test'],
    ['javascript:', 'javascript:alert(1)'],
  ])('con %s no hay link', (_, actionUrl) => {
    expect(notificationHref({ actionUrl })).toBeNull();
  });
});
