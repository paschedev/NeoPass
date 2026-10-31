// Nombre de cada rol del staff para el organizador. En la navegación y en el
// panel del propio RRPP se usa "RRPP", que es como lo conocen ellos.
export const STAFF_ROLE_LABELS = {
  SCANNER: 'Scanner',
  PROMOTER: 'Promotor',
  MANAGER: 'Co-organizador',
} as const;

export function staffRoleLabel(role: string): string {
  return STAFF_ROLE_LABELS[role as keyof typeof STAFF_ROLE_LABELS] ?? role;
}

// El rol como lo lee quien trabaja en el evento (página Staff): el promotor
// se ve como "RRPP", que es como lo conocen ellos.
const OWN_ROLE_LABELS: Record<string, string> = {
  ...STAFF_ROLE_LABELS,
  PROMOTER: 'RRPP',
};

export function ownRoleLabel(role: string): string {
  return OWN_ROLE_LABELS[role] ?? role;
}
