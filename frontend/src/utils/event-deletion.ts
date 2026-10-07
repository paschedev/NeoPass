// Cómo se ve un evento eliminado para quien compró (GET /tickets/my-tickets).
export interface EventDeletion {
  // true si lo dio de baja NeoPass; false si lo eliminó su organizador.
  byNeoPass: boolean;
  organizerName: string;
  contactEmail: string | null;
}

// Para no eliminar un evento por accidente: hay que escribir su nombre tal
// cual (sin importar los espacios de las puntas).
export function isDeletionConfirmed(typed: string, title: string): boolean {
  return typed.trim() !== '' && typed.trim() === title.trim();
}

export function deletionNoticeTitle(byNeoPass: boolean): string {
  return byNeoPass
    ? 'NeoPass dio de baja este evento'
    : 'El organizador eliminó este evento';
}
