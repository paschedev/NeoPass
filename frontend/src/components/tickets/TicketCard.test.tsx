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
      startDate: '2026-10-03T23:00:00.000Z',
      venueName: 'Club Central',
    },
  },
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
});
