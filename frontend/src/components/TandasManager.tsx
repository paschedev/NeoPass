'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Edit2, Save, Ticket } from 'lucide-react';
import toast from 'react-hot-toast';
import CustomSelect from '@/components/CustomSelect';
import { apiFetch } from '@/utils/api';
import { fromDateTimeLocalInput, toDateTimeLocalInput } from '@/utils/format';

export default function TandasManager({
  batches,
  setBatches,
  onSave,
}: {
  batches: any[];
  setBatches: (b: any[]) => void;
  onSave?: () => void;
}) {
  const [presets, setPresets] = useState<any[]>([]);
  const [fetchingPresets, setFetchingPresets] = useState(true);

  useEffect(() => {
    fetchPresets();
  }, []);

  const fetchPresets = async () => {
    try {
      const res = await apiFetch('/presets');
      if (res.ok) {
        const data = await res.json();
        setPresets(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFetchingPresets(false);
    }
  };

  const addBatch = () => {
    setBatches([
      ...batches,
      {
        tempId: Date.now().toString(),
        name: `Tanda ${batches.length + 1}`,
        status: 'DRAFT',
        publishAt: null,
        closeAt: null,
        publishWhenPreviousSoldOut: false,
        ticketTypes: [],
      },
    ]);
  };

  const addTicketType = (batchIndex: number, presetId: string = '') => {
    const newBatches = [...batches];
    let newTicket = {
      tempId: Date.now().toString(),
      name: 'Nueva Entrada',
      price: 0,
      stock: 100,
    };

    if (presetId) {
      const preset = presets.find((p) => p.id === presetId);
      if (preset) {
        newTicket = {
          tempId: Date.now().toString(),
          name: preset.name,
          price: 0,
          stock: 100,
        };
      }
    }

    newBatches[batchIndex].ticketTypes.push(newTicket);
    setBatches(newBatches);
  };

  const removeBatch = (batchIndex: number) => {
    const batch = batches[batchIndex];
    const hasSold = batch.ticketTypes?.some((t: any) => t.sold > 0);
    if (hasSold) {
      toast.error(
        'No puedes eliminar una tanda que ya tiene ventas. Pásala a estado ENDED o DRAFT.',
      );
      return;
    }
    const newBatches = [...batches];
    newBatches.splice(batchIndex, 1);
    setBatches(newBatches);
  };

  const removeTicketType = (batchIndex: number, ticketIndex: number) => {
    const ticket = batches[batchIndex].ticketTypes[ticketIndex];
    if (ticket.sold > 0) {
      toast.error(
        'No puedes eliminar un ticket con ventas. Pon su stock restante en 0.',
      );
      return;
    }
    const newBatches = [...batches];
    newBatches[batchIndex].ticketTypes.splice(ticketIndex, 1);
    setBatches(newBatches);
  };

  const updateBatch = (batchIndex: number, field: string, value: any) => {
    const newBatches = [...batches];
    newBatches[batchIndex][field] = value;
    setBatches(newBatches);
  };

  const updateTicket = (
    batchIndex: number,
    ticketIndex: number,
    field: string,
    value: any,
  ) => {
    const newBatches = [...batches];
    newBatches[batchIndex].ticketTypes[ticketIndex][field] = value;
    setBatches(newBatches);
  };

  // Removing internal save function, parent will handle it if needed.

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Ticket className="text-pink-400 w-5 h-5" /> Tandas y Entradas
          </h2>
          <p className="text-sm text-neutral-400 mt-1">
            Administra los lotes de ventas, precios y disponibilidad.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={addBatch}
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Nueva Tanda
          </button>
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              className="bg-pink-600 hover:bg-pink-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> Guardar Tandas
            </button>
          )}
        </div>
      </div>

      {batches.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl bg-white/5">
          <Ticket className="w-8 h-8 text-neutral-500 mx-auto mb-3" />
          <p className="text-neutral-400">
            No hay tandas configuradas para este evento.
          </p>
          <button
            onClick={addBatch}
            className="text-pink-400 hover:text-pink-300 text-sm font-medium mt-2"
          >
            Crea tu primera tanda
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {batches.map((batch, bIdx) => (
            <div
              key={batch.id || batch.tempId}
              className="bg-black/50 border border-white/10 rounded-2xl p-6 relative"
            >
              {/* Batch Header */}
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                <div className="flex-1 w-full md:w-auto md:min-w-[200px]">
                  <label className="text-xs text-neutral-500 uppercase font-bold mb-1 block">
                    Nombre de Tanda
                  </label>
                  <input
                    type="text"
                    value={batch.name}
                    onChange={(e) => updateBatch(bIdx, 'name', e.target.value)}
                    className="w-full bg-transparent border-b border-white/20 focus:border-pink-500 text-lg font-bold text-white focus:outline-none px-0 py-1"
                  />
                </div>

                <div className="w-full md:w-auto">
                  <label className="text-xs text-neutral-500 uppercase font-bold mb-1 block">
                    Estado
                  </label>
                  <CustomSelect
                    value={batch.status}
                    onChange={(val) => updateBatch(bIdx, 'status', val)}
                    options={[
                      { value: 'DRAFT', label: 'Oculta' },
                      { value: 'PUBLISHED', label: 'Pública' },
                      { value: 'ENDED', label: 'Finalizada' },
                    ]}
                  />
                </div>

                <div className="w-full md:w-auto flex flex-col gap-3">
                  {/* Switch Programar Publicación */}
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={!!batch.publishAt}
                          onChange={(e) =>
                            updateBatch(
                              bIdx,
                              'publishAt',
                              e.target.checked
                                ? new Date().toISOString()
                                : null,
                            )
                          }
                        />
                        <div
                          className={`block w-10 h-6 rounded-full transition-colors ${batch.publishAt ? 'bg-indigo-500' : 'bg-white/10'}`}
                        ></div>
                        <div
                          className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${batch.publishAt ? 'transform translate-x-4' : ''}`}
                        ></div>
                      </div>
                      <span className="text-xs text-neutral-400 font-medium uppercase">
                        Programar Publicación
                      </span>
                    </label>
                    {batch.publishAt && (
                      <input
                        type="datetime-local"
                        max={
                          batch.closeAt
                            ? toDateTimeLocalInput(batch.closeAt)
                            : undefined
                        }
                        value={toDateTimeLocalInput(batch.publishAt)}
                        onChange={(e) =>
                          updateBatch(
                            bIdx,
                            'publishAt',
                            fromDateTimeLocalInput(e.target.value),
                          )
                        }
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
                      />
                    )}
                  </div>

                  {/* Switch Fecha Límite */}
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={!!batch.closeAt}
                          onChange={(e) =>
                            updateBatch(
                              bIdx,
                              'closeAt',
                              e.target.checked
                                ? new Date(
                                    Date.now() + 60 * 60 * 1000,
                                  ).toISOString()
                                : null,
                            )
                          }
                        />
                        <div
                          className={`block w-10 h-6 rounded-full transition-colors ${batch.closeAt ? 'bg-pink-500' : 'bg-white/10'}`}
                        ></div>
                        <div
                          className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${batch.closeAt ? 'transform translate-x-4' : ''}`}
                        ></div>
                      </div>
                      <span className="text-xs text-neutral-400 font-medium uppercase">
                        Fecha Límite
                      </span>
                    </label>
                    {batch.closeAt && (
                      <input
                        type="datetime-local"
                        min={
                          batch.publishAt
                            ? toDateTimeLocalInput(batch.publishAt)
                            : undefined
                        }
                        value={toDateTimeLocalInput(batch.closeAt)}
                        onChange={(e) =>
                          updateBatch(
                            bIdx,
                            'closeAt',
                            fromDateTimeLocalInput(e.target.value),
                          )
                        }
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-pink-500 [color-scheme:dark]"
                      />
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeBatch(bIdx)}
                  className="absolute top-4 right-4 md:static md:top-auto md:right-auto w-8 h-8 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors md:mt-6"
                  title="Eliminar tanda"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Tickets in Batch */}
              <div className="bg-white/5 border border-white/5 rounded-xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Ticket className="w-4 h-4 text-neutral-400" /> Tipos de
                    Entradas
                  </h3>

                  <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                    <div className="w-full sm:w-48 sm:flex-none">
                      <CustomSelect
                        value=""
                        onChange={(val) => {
                          if (val) {
                            addTicketType(bIdx, val);
                          }
                        }}
                        placeholder="+ Cargar Plantilla"
                        options={presets.map((p) => ({
                          value: p.id,
                          label: p.name,
                        }))}
                        className="w-full h-full"
                        buttonClassName="w-full h-full min-h-[38px] flex items-center justify-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 border-0 rounded-xl text-xs text-white font-medium transition-colors"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => addTicketType(bIdx)}
                      className="w-full sm:w-auto min-h-[38px] flex items-center justify-center bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 px-4 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap"
                    >
                      + Ticket Nuevo
                    </button>
                  </div>
                </div>

                {!batch.ticketTypes || batch.ticketTypes.length === 0 ? (
                  <p className="text-neutral-500 text-sm text-center py-4">
                    Agrega entradas a esta tanda
                  </p>
                ) : (
                  <div className="space-y-2">
                    {batch.ticketTypes.map((ticket: any, tIdx: number) => (
                      <div
                        key={ticket.id || ticket.tempId}
                        className="flex flex-wrap items-center gap-3 bg-black/40 p-3 rounded-lg border border-white/5"
                      >
                        <div className="flex-1 min-w-[150px]">
                          <input
                            type="text"
                            placeholder="Nombre del Ticket"
                            value={ticket.name}
                            maxLength={30}
                            onChange={(e) =>
                              updateTicket(bIdx, tIdx, 'name', e.target.value)
                            }
                            className="w-full bg-transparent border-b border-transparent hover:border-white/20 focus:border-indigo-500 text-sm text-white focus:outline-none px-1 py-1"
                          />
                        </div>
                        <div className="w-24 relative">
                          <span className="absolute left-2 top-1 text-neutral-500 text-sm">
                            $
                          </span>
                          <input
                            type="number"
                            placeholder="0"
                            value={ticket.price === 0 ? '' : ticket.price}
                            onChange={(e) => {
                              const val = e.target.value.replace(
                                /^0+(?=\d)/,
                                '',
                              );
                              updateTicket(
                                bIdx,
                                tIdx,
                                'price',
                                val === '' ? 0 : Number(val),
                              );
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded px-2 pl-5 py-1 text-sm text-emerald-400 font-bold focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div className="w-24">
                          <input
                            type="number"
                            placeholder="Stock"
                            title="Capacidad de este ticket"
                            value={ticket.stock === 0 ? '' : ticket.stock}
                            onChange={(e) => {
                              const val = e.target.value.replace(
                                /^0+(?=\d)/,
                                '',
                              );
                              updateTicket(
                                bIdx,
                                tIdx,
                                'stock',
                                val === '' ? 0 : Number(val),
                              );
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded px-3 py-1 text-sm text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        {ticket.sold !== undefined && (
                          <div className="text-xs text-neutral-400 bg-white/5 px-2 py-1 rounded">
                            Vendidos: {ticket.sold}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeTicketType(bIdx, tIdx)}
                          className="w-7 h-7 flex items-center justify-center text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
