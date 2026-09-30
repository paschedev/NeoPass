import { z } from 'zod';

export const MAX_PRESETS = 7;

export const presetSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Poné un nombre para la plantilla')
    .max(20, 'Tiene que tener hasta 20 caracteres'),
});

export type PresetValues = z.infer<typeof presetSchema>;
