'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Edit2, Plus, Ticket, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import { MAX_PRESETS } from '@/utils/preset-form';
import Modal from '@/components/ui/Modal';
import PresetNameForm from '@/components/presets/PresetNameForm';
import type { TicketPreset } from '@/components/tandas/BatchCard';

const NEW = 'new';
const LOAD_ERROR = 'No se pudieron cargar las plantillas';

async function fetchPresets() {
  const res = await apiFetch('/presets');
  if (!res.ok) throw new Error(`GET /presets ${res.status}`);
  return (await res.json()) as TicketPreset[];
}

export default function PresetsPage() {
  const [presets, setPresets] = useState<TicketPreset[]>([]);
  const [loading, setLoading] = useState(true);
  // Preset being edited, NEW while creating one, or null.
  const [editing, setEditing] = useState<string | null>(null);
  const [presetToDelete, setPresetToDelete] = useState<TicketPreset | null>(
    null,
  );

  useEffect(() => {
    fetchPresets()
      .then(setPresets)
      .catch(() => toast.error(LOAD_ERROR))
      .finally(() => setLoading(false));
  }, []);

  const loadPresets = async () => {
    try {
      setPresets(await fetchPresets());
    } catch {
      toast.error(LOAD_ERROR);
    }
  };

  const save = async (name: string) => {
    const isNew = editing === NEW;
    try {
      const res = await apiFetch(isNew ? '/presets' : `/presets/${editing}`, {
        method: isNew ? 'POST' : 'PUT',
        body: JSON.stringify({ name, price: 0 }),
      });
      if (!res.ok) {
        return getApiErrorMessage(
          await res.json(),
          'No se pudo guardar la plantilla',
        );
      }
    } catch {
      return 'Error de conexión. Probá de nuevo.';
    }
    toast.success('Plantilla guardada');
    setEditing(null);
    await loadPresets();
    return null;
  };

  const confirmDelete = async () => {
    if (!presetToDelete) return;
    try {
      const res = await apiFetch(`/presets/${presetToDelete.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Plantilla eliminada');
        await loadPresets();
      } else {
        toast.error(
          getApiErrorMessage(
            await res.json(),
            'No se pudo eliminar la plantilla',
          ),
        );
      }
    } catch {
      toast.error('Error de conexión. Probá de nuevo.');
    } finally {
      setPresetToDelete(null);
    }
  };

  const canCreate = editing !== NEW && presets.length < MAX_PRESETS;

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 pt-6 pb-24 md:py-8">
      <Link
        href="/panel/configuracion"
        className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl text-neutral-300 hover:text-white mb-6 md:mb-8 transition-colors w-fit text-sm font-medium"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a configuración
      </Link>

      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-outfit text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <div className="w-10 h-10 bg-pink-500/20 text-pink-400 rounded-xl flex items-center justify-center">
              <Ticket className="w-5 h-5" />
            </div>
            Plantillas de entradas
          </h1>
          <p className="text-neutral-400">
            Guardá los tipos de entrada que usás seguido para crear eventos más
            rápido. Hasta {MAX_PRESETS}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(NEW)}
          disabled={!canCreate}
          aria-label="Nueva plantilla"
          className="bg-indigo-600 hover:bg-indigo-500 text-white w-12 h-12 md:w-auto md:h-auto md:px-4 md:py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <Plus className="w-6 h-6 md:w-4 md:h-4" />
          <span className="hidden md:inline">Nueva plantilla</span>
        </button>
      </div>

      <div className="space-y-4">
        {editing === NEW && (
          <div className="bg-white/5 border border-indigo-500/50 rounded-2xl p-4 flex">
            <PresetNameForm onSave={save} onCancel={() => setEditing(null)} />
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-neutral-400">
            Cargando plantillas...
          </div>
        ) : presets.length === 0 && editing !== NEW ? (
          <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-neutral-600">
              <Ticket className="w-8 h-8" />
            </div>
            <p className="text-neutral-400 mb-4">
              No tenés plantillas guardadas.
            </p>
            <button
              type="button"
              onClick={() => setEditing(NEW)}
              className="text-indigo-400 hover:text-indigo-300 font-medium text-sm transition-colors"
            >
              Crear tu primera plantilla
            </button>
          </div>
        ) : (
          presets.map((preset) => (
            <div
              key={preset.id}
              className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between group hover:border-white/20 transition-colors"
            >
              {editing === preset.id ? (
                <PresetNameForm
                  defaultName={preset.name}
                  onSave={save}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <>
                  <h3 className="flex-1 min-w-0 pr-4 text-white font-medium truncate">
                    {preset.name}
                  </h3>
                  <div className="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => setEditing(preset.id)}
                      aria-label={`Editar ${preset.name}`}
                      className="w-10 h-10 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetToDelete(preset)}
                      aria-label={`Eliminar ${preset.name}`}
                      className="w-10 h-10 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl flex items-center justify-center transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      <Modal
        open={!!presetToDelete}
        onClose={() => setPresetToDelete(null)}
        className="bg-neutral-900 border border-white/10 p-8 rounded-3xl w-full max-w-sm relative shadow-2xl animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Trash2 className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-center mb-2">
          Eliminar plantilla
        </h2>
        <p className="text-sm text-neutral-400 text-center mb-8">
          ¿Querés eliminar «{presetToDelete?.name}»? Los eventos que ya la
          usaron no cambian.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setPresetToDelete(null)}
            className="flex-1 px-4 py-3 rounded-xl font-medium text-neutral-400 hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmDelete}
            className="flex-1 bg-red-600 hover:bg-red-500 text-white px-4 py-3 rounded-xl font-medium transition-all active:scale-95"
          >
            Eliminar
          </button>
        </div>
      </Modal>
    </div>
  );
}
