'use client';

import { useState } from 'react';
import toast from '@/utils/toast';
import { validateImageFile } from '@/utils/cloudinary';
import { uploadSignedImage } from '@/utils/cloudinary-upload';

// Sube una imagen a Cloudinary con la firma de /media/presign. Devuelve la URL
// segura, o null si no se pudo (el aviso al usuario ya se mostró). Al editar
// un evento, la firma se pide para ese evento: así la consigue también un
// co-organizador con permiso de editar la info.
export function useCloudinaryUpload(eventId?: string) {
  const [uploading, setUploading] = useState(false);
  const presignPath = eventId
    ? `/media/presign?eventId=${encodeURIComponent(eventId)}`
    : '/media/presign';

  const upload = async (file: File): Promise<string | null> => {
    const invalid = validateImageFile(file);
    if (invalid) {
      toast.error(invalid);
      return null;
    }

    setUploading(true);
    const toastId = toast.loading('Subiendo imagen...');
    try {
      const result = await uploadSignedImage(file, presignPath);
      if ('error' in result) {
        toast.error(result.error, { id: toastId });
        return null;
      }
      toast.success('Imagen subida', { id: toastId });
      return result.url;
    } catch {
      toast.error('Error de conexión al subir la imagen', { id: toastId });
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { uploading, upload };
}
