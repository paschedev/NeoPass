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
