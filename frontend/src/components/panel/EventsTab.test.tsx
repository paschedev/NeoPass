import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EventsTab from './EventsTab';
import type { OrganizerEvent } from './types';

const HOUR_MS = 60 * 60 * 1000;
const now = new Date('2026-10-01T20:00:00Z');
const at = (hours: number) =>
  new Date(now.getTime() + hours * HOUR_MS).toISOString();

function organizerEvent(overrides: Partial<OrganizerEvent>): OrganizerEvent {
  return {
    id: 'event-1',
    title: 'Fiesta de primavera',
    status: 'PUBLISHED',
    startDate: at(24),
    endDate: at(30),
    venueName: 'Club',
    ticketTypes: [],
    ...overrides,
  };
}

function renderTab(event: OrganizerEvent) {
  render(
    <EventsTab
      events={[event]}
      loading={false}
      error={false}
      onRetry={() => {}}
    />,
  );
}

describe('EventsTab', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('deja editar un evento que no terminó', () => {
    vi.useFakeTimers({ now, toFake: ['Date'] });
    renderTab(organizerEvent({}));

    expect(screen.getByRole('link', { name: 'Editar Evento' })).toHaveAttribute(
      'href',
      '/panel/eventos/event-1/editar',
    );
  });

  it('un evento finalizado muestra "Evento finalizado" en vez de editar', () => {
    vi.useFakeTimers({ now, toFake: ['Date'] });
    renderTab(organizerEvent({ status: 'FINISHED' }));

    expect(screen.getByText('Evento finalizado')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Editar Evento' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('FINALIZADO')).toBeInTheDocument();
  });

  it('un evento cuyo fin ya pasó tampoco se puede editar', () => {
    vi.useFakeTimers({ now, toFake: ['Date'] });
    renderTab(organizerEvent({ startDate: at(-6), endDate: at(-1) }));

    expect(screen.getByText('Evento finalizado')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Editar Evento' }),
    ).not.toBeInTheDocument();
  });

  it('un evento cancelado muestra "Evento cancelado"', () => {
    vi.useFakeTimers({ now, toFake: ['Date'] });
    renderTab(organizerEvent({ status: 'CANCELLED' }));

    expect(screen.getByText('Evento cancelado')).toBeInTheDocument();
    expect(screen.getByText('CANCELADO')).toBeInTheDocument();
  });
});
