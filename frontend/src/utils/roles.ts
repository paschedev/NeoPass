// Permisos derivados de la sesión. Solo sirven para la UI: el backend
// vuelve a validar cada acción.
export interface RoleFlags {
  role: string;
  hasBeenRpp?: boolean;
  isCurrentlyScanner?: boolean;
}

export function isOrganizer(user: RoleFlags | null): boolean {
  return user?.role === 'ORGANIZER' || user?.role === 'ADMIN';
}

// Organizadores, o quien tiene una invitación de scanner aceptada en un
// evento vigente.
export function canScan(user: RoleFlags | null): boolean {
  return isOrganizer(user) || !!user?.isCurrentlyScanner;
}

export function canSeeRppPanel(user: RoleFlags | null): boolean {
  return isOrganizer(user) || !!user?.hasBeenRpp;
}
