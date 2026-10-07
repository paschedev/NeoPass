import { describe, expect, it } from 'vitest';
import { isDeletionConfirmed } from './event-deletion';

describe('isDeletionConfirmed', () => {
  it('confirma solo con el nombre exacto del evento', () => {
    expect(isDeletionConfirmed('Fiesta de primavera', 'Fiesta de primavera')).toBe(
      true,
    );
    expect(isDeletionConfirmed('Fiesta', 'Fiesta de primavera')).toBe(false);
    expect(isDeletionConfirmed('fiesta de primavera', 'Fiesta de primavera')).toBe(
      false,
    );
  });

  it('los espacios de más al principio o al final no cuentan', () => {
    expect(isDeletionConfirmed('  Fiesta de primavera ', 'Fiesta de primavera')).toBe(
      true,
    );
  });

  it('vacío nunca confirma', () => {
    expect(isDeletionConfirmed('', 'Fiesta de primavera')).toBe(false);
  });
});
