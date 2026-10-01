'use client';

import { UploadCloud } from 'lucide-react';
import { IMAGE_UPLOAD_TYPES } from '@/utils/cloudinary';

// Zona para elegir el flyer del evento; la subida la hace quien la usa.
export default function FlyerField({
  imageUrl,
  uploading,
  error,
  onFile,
}: {
  imageUrl: string;
  uploading: boolean;
  error?: string;
  onFile: (file: File) => void;
}) {
  return (
    <div>
      <label
        htmlFor="flyer"
        className="block text-sm font-medium text-neutral-400 mb-2"
      >
        Flyer / portada del evento
      </label>
      <div
        className={`relative w-full h-48 bg-white/5 border-2 border-dashed ${error ? 'border-red-500' : 'border-white/10'} hover:border-indigo-500 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors overflow-hidden group`}
      >
        <input
          id="flyer"
          type="file"
          accept={IMAGE_UPLOAD_TYPES.join(',')}
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          title="Subir imagen"
        />
        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt="Flyer"
              className="w-full h-full object-cover group-hover:opacity-40 transition-opacity"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <div className="bg-black/70 text-white px-4 py-2 rounded-full font-medium flex items-center gap-2 backdrop-blur-sm">
                <UploadCloud className="w-4 h-4" /> Cambiar imagen
              </div>
            </div>
          </>
        ) : (
          <>
            <UploadCloud className="w-8 h-8 text-neutral-500 mb-2" />
            <span className="text-sm text-neutral-400">
              Hacé clic o arrastrá una imagen acá
            </span>
            <span className="text-xs text-neutral-600 mt-1">
              Recomendado: 1920 × 1080 px (máx. 10 MB)
            </span>
          </>
        )}
      </div>
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}
