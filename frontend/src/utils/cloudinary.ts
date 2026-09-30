/**
 * Optimizes a raw Cloudinary URL by injecting transformation parameters.
 * Adds auto format (f_auto) for WebP/AVIF delivery and auto quality (q_auto).
 * Optionally forces a 16:9 aspect ratio crop.
 */
export const optimizeCloudinaryUrl = (
  rawUrl: string,
  applyCrop: boolean = false,
): string => {
  if (!rawUrl || !rawUrl.includes('cloudinary.com')) return rawUrl;

  const urlParts = rawUrl.split('/upload/');
  if (urlParts.length !== 2) return rawUrl;

  // Parámetros base: f_auto (formato WebP/AVIF) y q_auto (compresión inteligente)
  let transforms = 'f_auto,q_auto';

  // Si se requiere recorte estricto a 16:9
  if (applyCrop) {
    transforms += ',c_fill,ar_16:9';
  }

  return `${urlParts[0]}/upload/${transforms}/${urlParts[1]}`;
};

export const IMAGE_UPLOAD_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
];
const MAX_IMAGE_MB = 10;

// Devuelve el motivo por el que el archivo no se puede subir, o null si está bien.
export const validateImageFile = (file: File): string | null => {
  if (!IMAGE_UPLOAD_TYPES.includes(file.type)) {
    return 'Formato no permitido. Solo JPG, PNG, WebP, AVIF o GIF.';
  }
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
    return `La imagen supera el límite de ${MAX_IMAGE_MB} MB.`;
  }
  return null;
};
