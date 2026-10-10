import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Avatar from './Avatar';

describe('Avatar', () => {
  it('con foto la muestra', () => {
    render(
      <Avatar
        user={{
          name: 'Ana Pérez',
          avatarUrl:
            'https://res.cloudinary.com/neopass/image/upload/v1/avatars/u1.jpg',
        }}
        size="sm"
      />,
    );

    expect(screen.getByRole('img', { name: 'Ana Pérez' })).toHaveAttribute(
      'src',
      expect.stringContaining('/avatars/u1.jpg'),
    );
  });

  it('sin foto muestra la inicial del nombre', () => {
    render(<Avatar user={{ name: 'ana Pérez', avatarUrl: null }} size="lg" />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });
});
