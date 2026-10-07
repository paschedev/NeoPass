import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import TicketCard from './TicketCard';
import type { MyTicket } from './types';

const TICKET: MyTicket = {
  id: 'ticket-0001',
  status: 'VALID',
  qrCode: 'abcd1234-qr',
  ticketType: {
    name: 'General',
    event: {
      title: 'Fiesta de primavera',
      startDate: '2099-10-10T23:00:00.000Z',
      endDate: '2099-10-11T07:00:00.000Z',
      status: 'PUBLISHED',
      venueName: 'Club Central',
      deletion: null,
    },
  },
};

const ENDED_EVENT = {
  ...TICKET.ticketType.event,
  startDate: '2026-01-10T23:00:00.000Z',
  endDate: '2026-01-11T07:00:00.000Z',
};

describe('TicketCard', () => {
  it.each([
    ['VALID', 'VÁLIDA'],
    ['USED', 'UTILIZADA'],
    ['REFUNDED', 'ANULADA'],
  ])('una entrada %s se muestra como %s', (status, label) => {
    render(<TicketCard ticket={{ ...TICKET, status }} onOpen={() => {}} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('una entrada válida de un evento que ya terminó se muestra como VENCIDA', () => {
    render(
      <TicketCard
        ticket={{ ...TICKET, ticketType: { name: 'General', event: ENDED_EVENT } }}
        onOpen={() => {}}
      />,
    );

    expect(screen.getByText('VENCIDA')).toBeInTheDocument();
  });

  it('una entrada de un evento eliminado se muestra como EVENTO ELIMINADO', () => {
    render(
      <TicketCard
        ticket={{
          ...TICKET,
          ticketType: {
            name: 'General',
            event: {
              ...TICKET.ticketType.event,
              deletion: {
                byNeoPass: false,
                organizerName: 'Productora Sur',
                contactEmail: 'reclamos@productora.test',
              },
            },
          },
        }}
        onOpen={() => {}}
      />,
    );

    expect(screen.getByText('EVENTO ELIMINADO')).toBeInTheDocument();
  });

  it('muestra cuándo empieza y cuándo termina el evento', () => {
    render(<TicketCard ticket={TICKET} onOpen={() => {}} />);

    expect(
      screen.getByText('sáb, 10 oct, 20:00 a dom, 11 oct, 04:00'),
    ).toBeInTheDocument();
  });
});
