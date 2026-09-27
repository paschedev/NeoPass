'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useUserSearch, type UserSearchResult } from '@/hooks/useUserSearch';

// Elegir a quién transferir una entrada y confirmar.
export default function TransferPanel({
  transferring,
  onCancel,
  onConfirm,
}: {
  transferring: boolean;
  onCancel: () => void;
  onConfirm: (user: UserSearchResult) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(
    null,
  );
  const searchResults = useUserSearch(searchTerm);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
      <p className="text-sm text-neutral-400">
        Ingresa el email o usuario al que deseas transferir esta entrada.
      </p>

      {!selectedUser ? (
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar usuario o email..."
            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-indigo-500 outline-none transition-colors"
          />
          {searchResults.length > 0 && (
            <div className="absolute bottom-full mb-2 left-0 right-0 bg-neutral-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-10 max-h-48 overflow-y-auto overscroll-contain">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => {
                    setSelectedUser(user);
                    setSearchTerm('');
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center justify-between transition-colors border-b border-white/5 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0 uppercase">
                      {user.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-white font-medium text-sm truncate">
                        {user.name}
                      </div>
                      <div className="text-neutral-400 text-xs truncate">
                        {user.email}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl p-3 px-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0 uppercase">
              {selectedUser.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="text-white font-medium text-sm truncate">
                {selectedUser.name}
              </div>
              <div className="text-neutral-400 text-xs truncate">
                {selectedUser.email}
              </div>
            </div>
          </div>
          <button
            onClick={() => setSelectedUser(null)}
            aria-label="Elegir otro destinatario"
            className="text-neutral-500 hover:text-red-400 p-2 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={() => selectedUser && onConfirm(selectedUser)}
          disabled={!selectedUser || transferring}
          className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all active:scale-95 disabled:opacity-50"
        >
          {transferring ? 'Transfiriendo...' : 'Confirmar'}
        </button>
      </div>
    </div>
  );
}
