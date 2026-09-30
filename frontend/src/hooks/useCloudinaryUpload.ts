'use client';

import { useState } from 'react';
import toast from '@/utils/toast';
import { apiFetch } from '@/utils/api';
import { validateImageFile } from '@/utils/cloudinary';

type UploadSignature = {
  signature: string;
  timestamp: number;
  cloudName: string;
  apiKey: string;
  uploadPreset: string;
};

// Sube una imagen a Cloudinary con la firma de /media/presign. Devuelve la URL
// segura, o null si no se pudo (el aviso al usuario ya se mostró).
export function useCloudinaryUpload() {
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File): Promise<string | null> => {
    const invalid = validateImageFile(file);
    if (invalid) {
      toast.error(invalid);
      return null;
    }

    setUploading(true);
    const toastId = toast.loading('Subiendo imagen...');
    try {
      const signRes = await apiFetch('/media/presign');
      if (!signRes.ok) {
        toast.error('No tenés permiso para subir imágenes', { id: toastId });
        return null;
      }
      const sign: UploadSignature = await signRes.json();

      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', sign.apiKey);
      formData.append('timestamp', sign.timestamp.toString());
      formData.append('signature', sign.signature);
      formData.append('upload_preset', sign.uploadPreset);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`,
        { method: 'POST', body: formData },
      );
      if (!res.ok) {
        toast.error('No se pudo subir la imagen. Probá de nuevo.', {
          id: toastId,
        });
        return null;
      }
      const { secure_url } = await res.json();
      toast.success('Imagen subida', { id: toastId });
      return secure_url;
    } catch {
      toast.error('Error de conexión al subir la imagen', { id: toastId });
      return null;
    } finally {
      setUploading(false);
    }
  };

  return { uploading, upload };
}
