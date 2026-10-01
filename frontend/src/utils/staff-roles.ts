// Nombre de cada rol del staff para el organizador. En la navegación y en el
// panel del propio RPP se usa "RPP", que es como lo conocen ellos.
export const STAFF_ROLE_LABELS = {
  SCANNER: 'Scanner',
  PROMOTER: 'Promotor',
  MANAGER: 'Encargado',
} as const;

export function staffRoleLabel(role: string): string {
  return STAFF_ROLE_LABELS[role as keyof typeof STAFF_ROLE_LABELS] ?? role;
}
