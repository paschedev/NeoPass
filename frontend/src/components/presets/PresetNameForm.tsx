'use client';

import { Check, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { presetSchema, type PresetValues } from '@/utils/preset-form';

// Name of a new or existing preset. `onSave` returns the server's error
// message, or null when it was saved.
export default function PresetNameForm({
  defaultName = '',
  onSave,
  onCancel,
}: {
  defaultName?: string;
  onSave: (name: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PresetValues>({
    resolver: zodResolver(presetSchema),
    defaultValues: { name: defaultName },
  });

  const onSubmit = async ({ name }: PresetValues) => {
    const error = await onSave(name);
    if (error) setError('name', { message: error });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-1 items-start gap-4"
    >
      <div className="flex-1">
        <input
          type="text"
          aria-label="Nombre de la plantilla"
          autoFocus
          maxLength={20}
          spellCheck={false}
          placeholder="Nombre de la plantilla (ej: General)"
          className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
          {...register('name')}
        />
        {errors.name && (
          <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          aria-label="Guardar"
          disabled={isSubmitting}
          className="w-10 h-10 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-xl flex items-center justify-center transition-colors disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          type="button"
          aria-label="Cancelar"
          onClick={onCancel}
          className="w-10 h-10 bg-neutral-500/20 hover:bg-neutral-500/30 text-neutral-400 rounded-xl flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}
