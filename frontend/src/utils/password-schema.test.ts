import { describe, expect, it } from 'vitest';
import { changePasswordSchema, newPasswordSchema } from './password-schema';

function errors(result: { error?: { issues: { message: string }[] } }) {
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe('newPasswordSchema', () => {
  it('la contraseña nueva tiene que tener al menos 8 caracteres', () => {
    const result = newPasswordSchema.safeParse({
      newPassword: 'corta7',
      confirmPassword: 'corta7',
    });

    expect(errors(result)).toEqual(['Tiene que tener al menos 8 caracteres']);
  });

  it('la confirmación tiene que coincidir', () => {
    const result = newPasswordSchema.safeParse({
      newPassword: 'clave-nueva-456',
      confirmPassword: 'otra-clave-789',
    });

    expect(errors(result)).toEqual(['Las contraseñas no coinciden']);
  });
});

describe('changePasswordSchema', () => {
  it('para cambiarla hace falta la contraseña actual', () => {
    const result = changePasswordSchema.safeParse({
      oldPassword: '',
      newPassword: 'clave-nueva-456',
      confirmPassword: 'clave-nueva-456',
    });

    expect(errors(result)).toEqual(['Ingresá tu contraseña actual']);
  });

  it('también pide 8 caracteres y que la confirmación coincida', () => {
    const result = changePasswordSchema.safeParse({
      oldPassword: 'clave-actual-123',
      newPassword: 'corta7',
      confirmPassword: 'otra',
    });

    expect(errors(result)).toEqual([
      'Tiene que tener al menos 8 caracteres',
      'Las contraseñas no coinciden',
    ]);
  });
});
