import { apiFetch } from '@/utils/api';

// Lo que firma el backend: el preset de los flyers, o la carpeta fija de la
// foto de perfil (que reemplaza a la anterior).
type UploadSignature = {
  signature: string;
  timestamp: number;
  cloudName: string;
  apiKey: string;
  uploadPreset?: string;
  publicId?: string;
  overwrite?: boolean;
};

export type UploadResult = { url: string } | { error: string };

// Sube una imagen a Cloudinary con la firma de `presignPath` y devuelve su URL
// segura o el motivo por el que no se pudo. No avisa nada: lo hace quien la
// usa. El archivo se valida antes (validateImageFile).
export async function uploadSignedImage(
  file: File,
  presignPath: string,
): Promise<UploadResult> {
  const signRes = await apiFetch(presignPath);
  if (!signRes.ok) return { error: 'No tenés permiso para subir imágenes' };
  const sign = (await signRes.json()) as UploadSignature;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', sign.apiKey);
  formData.append('timestamp', sign.timestamp.toString());
  formData.append('signature', sign.signature);
  if (sign.uploadPreset) formData.append('upload_preset', sign.uploadPreset);
  if (sign.publicId) formData.append('public_id', sign.publicId);
  if (sign.overwrite) formData.append('overwrite', 'true');

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`,
    { method: 'POST', body: formData },
  );
  if (!res.ok) return { error: 'No se pudo subir la imagen. Probá de nuevo.' };
  const { secure_url } = (await res.json()) as { secure_url: string };
  return { url: secure_url };
}
