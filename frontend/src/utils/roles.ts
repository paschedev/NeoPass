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

// Organizadores, o quien tiene una invitación de scanner o encargado aceptada
// en un evento vigente.
export function canScan(user: RoleFlags | null): boolean {
  return isOrganizer(user) || !!user?.isCurrentlyScanner;
}

// Quien trabaja o trabajó como staff de un evento: RPP alguna vez (por su
// historial de plata) o scanner o encargado de un evento vigente. Un
// organizador lo ve solo si trabaja como staff de eventos ajenos.
export function canSeeStaffPanel(user: RoleFlags | null): boolean {
  return !!user?.hasBeenRpp || !!user?.isCurrentlyScanner;
}
