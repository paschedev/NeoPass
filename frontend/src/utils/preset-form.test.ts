import { describe, expect, it } from 'vitest';
import { presetSchema } from './preset-form';

describe('presetSchema', () => {
  it('el nombre es obligatorio: solo espacios no vale', () => {
    const result = presetSchema.safeParse({ name: '   ' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(
      'Poné un nombre para la plantilla',
    );
  });

  it('el nombre tiene hasta 20 caracteres', () => {
    expect(presetSchema.safeParse({ name: 'a'.repeat(20) }).success).toBe(true);

    const result = presetSchema.safeParse({ name: 'a'.repeat(21) });
    expect(result.error?.issues[0].message).toBe(
      'Tiene que tener hasta 20 caracteres',
    );
  });

  it('se guarda sin los espacios de los costados', () => {
    expect(presetSchema.parse({ name: '  VIP  ' })).toEqual({ name: 'VIP' });
  });
});
