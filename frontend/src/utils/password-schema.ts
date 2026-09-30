import { z } from 'zod';

// Same rules as the backend: at least 8 characters.
const newPasswordFields = {
  newPassword: z.string().min(8, 'Tiene que tener al menos 8 caracteres'),
  confirmPassword: z.string(),
};

const passwordsMatch = (values: {
  newPassword: string;
  confirmPassword: string;
}) => values.newPassword === values.confirmPassword;

const mismatch = {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
};

// Reset link: only the new password, twice.
export const newPasswordSchema = z
  .object(newPasswordFields)
  .refine(passwordsMatch, mismatch);

// Change from the settings page: also the current password.
export const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, 'Ingresá tu contraseña actual'),
    ...newPasswordFields,
  })
  .refine(passwordsMatch, mismatch);

export type NewPasswordValues = z.infer<typeof newPasswordSchema>;
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
