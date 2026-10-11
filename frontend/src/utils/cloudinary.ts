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

// La foto de perfil cuadrada, centrada en la cara y del tamaño en que se
// muestra (en píxeles), para no bajar la imagen original.
export const avatarImageUrl = (rawUrl: string, size: number): string => {
  const urlParts = rawUrl.split('/upload/');
  if (!rawUrl.includes('cloudinary.com') || urlParts.length !== 2) {
    return rawUrl;
  }
  return `${urlParts[0]}/upload/c_fill,g_face,w_${size},h_${size},f_auto,q_auto/${urlParts[1]}`;
};

// La imagen que se ve al compartir un link (1200×630): el flyer entero,
// centrado sobre el color predominante de sus bordes (el fondo desenfocado,
// b_blurred, da 400 en Cloudinary) y en JPG, que WhatsApp muestra siempre.
export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 };

export const shareImageUrl = (rawUrl: string): string => {
  const urlParts = rawUrl.split('/upload/');
  if (!rawUrl.includes('cloudinary.com') || urlParts.length !== 2) {
    return rawUrl;
  }
  return `${urlParts[0]}/upload/c_pad,b_auto,w_${SHARE_IMAGE_SIZE.width},h_${SHARE_IMAGE_SIZE.height},f_jpg,q_auto/${urlParts[1]}`;
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
