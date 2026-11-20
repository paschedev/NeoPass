import { describe, expect, it } from 'vitest';
import { z } from './zod';

describe('zod del front', () => {
  it('no compila validadores con new Function', () => {
    expect(z.config().jitless).toBe(true);
  });

  it('valida igual', () => {
    const schema = z.object({ email: z.string().email() });
    expect(schema.safeParse({ email: 'ana@neopass.ar' }).success).toBe(true);
    expect(schema.safeParse({ email: 'no' }).success).toBe(false);
  });
});
