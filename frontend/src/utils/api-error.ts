// Mensaje de error de una respuesta del backend. Los errores de validación
// (class-validator) llegan como un array de mensajes: van uno por línea.
export function getApiErrorMessage(body: unknown, fallback: string): string {
  const message =
    body && typeof body === 'object' && 'message' in body
      ? body.message
      : undefined;
  if (Array.isArray(message) && message.length > 0) return message.join('\n');
  if (typeof message === 'string' && message) return message;
  return fallback;
}
