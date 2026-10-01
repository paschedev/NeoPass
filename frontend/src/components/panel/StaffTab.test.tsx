import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import StaffTab from './StaffTab';
import type { StaffMember } from './types';

function member(id: string, role: string): StaffMember {
  return {
    id,
    role,
    status: 'ACCEPTED',
    commissionType: role === 'PROMOTER' ? 'PERCENTAGE' : null,
    commissionValue: role === 'PROMOTER' ? 10 : null,
    user: { name: `Usuario ${id}`, email: `${id}@neopass.test` },
    event: { title: 'Fiesta de prueba' },
  };
}

describe('StaffTab', () => {
  it('muestra el rol de cada integrante en español', () => {
    render(
      <StaffTab
        staff={[
          member('a', 'PROMOTER'),
          member('b', 'SCANNER'),
          member('c', 'MANAGER'),
        ]}
        loading={false}
        onInvite={vi.fn()}
      />,
    );

    expect(screen.getByText('Promotor')).toBeInTheDocument();
    expect(screen.getByText('Scanner')).toBeInTheDocument();
    expect(screen.getByText('Encargado')).toBeInTheDocument();
    expect(screen.queryByText('PROMOTER')).toBeNull();
  });
});
