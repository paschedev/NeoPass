import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { EventAccess, EventPermission } from '@/utils/co-organizers';
import EventDetailHeader from './EventDetailHeader';

const HOUR_MS = 60 * 60 * 1000;
const now = new Date('2026-10-01T20:00:00Z');
const at = (hours: number) =>
  new Date(now.getTime() + hours * HOUR_MS).toISOString();

const event = (overrides = {}) => ({
  id: 'event-1',
  title: 'Fiesta de primavera',
  status: 'PUBLISHED',
  startDate: at(24),
  endDate: at(30),
  venueName: 'Club Central',
  ...overrides,
});

const OWNER: EventAccess = {
  role: 'OWNER',
  permissions: [
    'EDIT_EVENT',
    'MANAGE_BATCHES',
    'VIEW_SALES',
    'SEND_FREE_TICKETS',
    'VIEW_ATTENDEES',
    'MANAGE_STAFF',
  ],
  freeTicketLimit: null,
};

const coOrganizer = (permissions: EventPermission[]): EventAccess => ({
  role: 'CO_ORGANIZER',
  permissions,
  freeTicketLimit: null,
});

describe('EventDetailHeader', () => {
  afterEach(() => vi.useRealTimers());

  const renderHeader = (
    overrides: Record<string, unknown> = {},
    access: EventAccess = OWNER,
  ) => {
    vi.useFakeTimers({ now, toFake: ['Date'] });
    render(<EventDetailHeader event={event(overrides)} access={access} />);
  };

  it('a quien organiza le ofrece editar, abrir la página pública y volver a sus eventos', () => {
    renderHeader();

    expect(
      screen.getByRole('heading', { name: 'Fiesta de primavera' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Editar evento' })).toHaveAttribute(
      'href',
      '/panel/eventos/event-1/editar',
    );
    expect(
      screen.getByRole('link', { name: /ver página pública/i }),
    ).toHaveAttribute('href', '/eventos/event-1');
    expect(
      screen.getByRole('link', { name: /volver a mis eventos/i }),
    ).toHaveAttribute('href', '/panel?tab=events');
  });

  it('un evento en borrador no tiene página pública', () => {
    renderHeader({ status: 'DRAFT' });

    expect(
      screen.queryByRole('link', { name: /ver página pública/i }),
    ).not.toBeInTheDocument();
  });

  it('un evento finalizado no se edita ni tiene página pública', () => {
    renderHeader({ status: 'FINISHED', startDate: at(-30), endDate: at(-24) });

    expect(screen.getByText('Evento finalizado')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Editar evento' }),
    ).not.toBeInTheDocument();
  });

  it('un co-organizador se ve como tal y vuelve a Staff', () => {
    renderHeader({}, coOrganizer(['VIEW_SALES']));

    expect(screen.getByText('Co-organizador')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /volver a staff/i }),
    ).toHaveAttribute('href', '/panel/staff');
  });

  it.each([
    [['VIEW_SALES'] as EventPermission[], false],
    [['EDIT_EVENT'] as EventPermission[], true],
    [['MANAGE_BATCHES'] as EventPermission[], true],
  ])(
    'un co-organizador con %j ve "Editar evento": %s',
    (permissions, shown) => {
      renderHeader({}, coOrganizer(permissions));

      expect(
        screen.queryByRole('link', { name: 'Editar evento' }) !== null,
      ).toBe(shown);
    },
  );
});
