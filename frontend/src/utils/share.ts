// La página pública del evento, sin código de RPP: lo que se venda desde ahí
// no le suma comisión a nadie.
export function eventLink(origin: string, eventId: string) {
  return `${origin}/eventos/${eventId}`;
}

// Copia un link y dice si se pudo. El navegador lo puede rechazar (sin
// permiso, o sin portapapeles fuera de HTTPS). El aviso lo da el botón
// (components/ui/CopyLinkButton).
export async function copyLink(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}
