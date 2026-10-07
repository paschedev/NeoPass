import toast from './toast';

// La página pública del evento, sin código de RPP: lo que se venda desde ahí
// no le suma comisión a nadie.
export function eventLink(origin: string, eventId: string) {
  return `${origin}/eventos/${eventId}`;
}

// Copia un link y avisa si se pudo. El navegador lo puede rechazar (sin
// permiso, o sin portapapeles fuera de HTTPS): en ese caso nunca dice "copiado".
export async function copyLink(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    toast.success('Link copiado');
    return true;
  } catch {
    toast.error('No se pudo copiar el link');
    return false;
  }
}
