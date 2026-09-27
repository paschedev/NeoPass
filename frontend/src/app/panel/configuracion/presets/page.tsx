'use client';

import { useState, useEffect } from 'react';
import { Ticket, Plus, Trash2, Edit2, Check, X, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { apiFetch } from '@/utils/api';
import Modal from '@/components/ui/Modal';

export default function PresetsPage() {
  const router = useRouter();
  const [presets, setPresets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [presetToDelete, setPresetToDelete] = useState<string | null>(null);

  const fetchPresets = async () => {
    try {
      const res = await apiFetch('/presets');
      if (res.ok) {
        const data = await res.json();
        setPresets(data);
      }
    } catch (e) {
      toast.error('Error al cargar las plantillas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPresets();
  }, []);

  const handleSave = async () => {
    if (!editForm.name) {
      toast.error('El nombre de la plantilla es requerido');
      return;
    }
    const url = editingId ? `/presets/${editingId}` : `/presets`;
    const method = editingId ? 'PUT' : 'POST';

    try {
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify({ name: editForm.name, price: 0 }),
      });
      if (res.ok) {
        toast.success('Plantilla guardada');
        setEditingId(null);
        setIsCreating(false);
        fetchPresets();
      } else {
        toast.error('Error al guardar la plantilla');
      }
    } catch (e) {
      toast.error('Error de conexión');
    }
  };

  const confirmDelete = async () => {
    if (!presetToDelete) return;
    const id = presetToDelete;

    try {
      const res = await apiFetch(`/presets/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Plantilla eliminada');
        fetchPresets();
      } else {
        toast.error('Error al eliminar');
      }
    } catch (e) {
      toast.error('Error de conexión');
    } finally {
      setPresetToDelete(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 md:px-8 md:py-8">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl text-neutral-300 hover:text-white mb-6 md:mb-8 transition-colors w-fit text-sm font-medium"
      >
        <ArrowLeft className="w-4 h-4" /> Volver a configuración
      </button>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-outfit text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <div className="w-10 h-10 bg-pink-500/20 text-pink-400 rounded-xl flex items-center justify-center">
              <Ticket className="w-5 h-5" />
            </div>
            Plantillas de Tickets
          </h1>
          <p className="text-neutral-400">
            Administra tus tipos de entradas favoritos para crear eventos más
            rápido.
          </p>
        </div>
        <button
          onClick={() => {
            if (presets.length >= 7) {
              toast.error('Límite de 7 plantillas alcanzado.');
              return;
            }
            setIsCreating(true);
            setEditForm({ name: '' });
          }}
          disabled={isCreating || presets.length >= 7}
          className="bg-indigo-600 hover:bg-indigo-500 text-white w-12 h-12 md:w-auto md:h-auto md:px-4 md:py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          title="Nueva Plantilla"
        >
          <Plus className="w-6 h-6 md:w-4 md:h-4" />
          <span className="hidden md:inline">Nueva Plantilla</span>
        </button>
      </div>

      <div className="space-y-4">
        {isCreating && (
          <div className="bg-white/5 border border-indigo-500/50 rounded-2xl p-4 flex items-center gap-4">
            <div className="flex-1">
              <input
                type="text"
                maxLength={20}
                placeholder="Nombre de la Plantilla (Ej: General)"
                value={editForm.name}
                onChange={(e) => setEditForm({ name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                }}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                className="w-10 h-10 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-xl flex items-center justify-center transition-colors"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsCreating(false)}
                className="w-10 h-10 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-neutral-400">
            Cargando plantillas...
          </div>
        ) : presets.length === 0 && !isCreating ? (
          <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-neutral-600">
              <Ticket className="w-8 h-8" />
            </div>
            <p className="text-neutral-400 mb-4">
              No tienes plantillas guardadas.
            </p>
            <button
              onClick={() => {
                setIsCreating(true);
                setEditForm({ name: '' });
              }}
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
              {editingId === preset.id ? (
                <>
                  <div className="flex-1 mr-4">
                    <input
                      type="text"
                      maxLength={20}
                      value={editForm.name}
                      onChange={(e) => setEditForm({ name: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave();
                      }}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSave}
                      className="w-10 h-10 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-xl flex items-center justify-center transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="w-10 h-10 bg-neutral-500/20 hover:bg-neutral-500/30 text-neutral-400 rounded-xl flex items-center justify-center transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex-1 min-w-0 pr-4">
                    <h3 className="text-white font-medium truncate">
                      {preset.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setEditingId(preset.id);
                        setEditForm({ name: preset.name });
                        setIsCreating(false);
                      }}
                      className="w-10 h-10 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPresetToDelete(preset.id)}
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

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!presetToDelete}
        onClose={() => setPresetToDelete(null)}
        className="bg-neutral-900 border border-white/10 p-8 rounded-3xl w-full max-w-sm relative shadow-2xl animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Trash2 className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-center mb-2">
          Eliminar Plantilla
        </h2>
        <p className="text-sm text-neutral-400 text-center mb-8">
          ¿Estás seguro de que deseas eliminar esta plantilla? Esta acción no se
          puede deshacer.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setPresetToDelete(null)}
            className="flex-1 px-4 py-3 rounded-xl font-medium text-neutral-400 hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
          <button
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
