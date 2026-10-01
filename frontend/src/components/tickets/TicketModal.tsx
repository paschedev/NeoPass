'use client';

import { useState } from 'react';
import { ArrowRightLeft, Eye, EyeOff, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Modal from '@/components/ui/Modal';
import type { UserSearchResult } from '@/hooks/useUserSearch';
import TransferPanel from './TransferPanel';
import { formatEventDate, isVoidTicket, type MyTicket } from './types';

// Entrada abierta: QR oculto hasta tocarlo y transferencia si sigue válida.
export default function TicketModal({
  ticket,
  onClose,
  onTransfer,
  transferring,
}: {
  ticket: MyTicket | null;
  onClose: () => void;
  onTransfer: (ticket: MyTicket, user: UserSearchResult) => void;
  transferring: boolean;
}) {
  return (
    <Modal
      open={!!ticket}
      onClose={onClose}
      overlayClassName="bg-black/90"
      className="bg-neutral-900 border border-white/10 rounded-[2rem] w-full max-w-md relative flex flex-col max-h-[75vh] md:max-h-[85vh] my-auto"
    >
      {/* key: cada entrada abre con el QR oculto y sin transferencia en curso */}
      {ticket && (
        <TicketDetail
          key={ticket.id}
          ticket={ticket}
          onClose={onClose}
          onTransfer={onTransfer}
          transferring={transferring}
        />
      )}
    </Modal>
  );
}

function TicketDetail({
  ticket,
  onClose,
  onTransfer,
  transferring,
}: {
  ticket: MyTicket;
  onClose: () => void;
  onTransfer: (ticket: MyTicket, user: UserSearchResult) => void;
  transferring: boolean;
}) {
  const [qrRevealed, setQrRevealed] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  return (
    <>
      <div className="p-6 pb-0 flex justify-between items-start shrink-0">
        <div className="bg-indigo-500/20 text-indigo-300 px-4 py-1.5 rounded-full text-xs font-bold border border-indigo-500/30">
          {ticket.ticketType.name.toUpperCase()}
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-8 overflow-y-auto overscroll-contain">
        <div className="text-center mb-8">
          <h2 className="font-outfit text-2xl font-bold text-white mb-2">
            {ticket.ticketType.event.title}
          </h2>
          <p className="text-neutral-400 text-sm">
            {formatEventDate(ticket.ticketType.event.startDate)}
          </p>
        </div>

        {isVoidTicket(ticket.status) ? (
          <p className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 text-center text-sm text-neutral-300">
            Entrada anulada: el pago se devolvió y el QR ya no sirve para
            entrar.
          </p>
        ) : (
          <>
            <div className="bg-white rounded-[2rem] p-6 mb-8 mx-auto w-64 relative group">
              <div
                className={`transition-all duration-500 ${!qrRevealed ? 'blur-md brightness-50' : ''}`}
              >
                <QRCodeSVG
                  value={ticket.qrCode}
                  size={208}
                  level="H"
                  includeMargin={false}
                  className="w-full h-auto"
                />
              </div>

              {!qrRevealed && (
                <button
                  type="button"
                  className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer text-neutral-900 hover:scale-105 transition-transform"
                  onClick={() => setQrRevealed(true)}
                >
                  <Eye className="w-10 h-10 mb-2 drop-shadow-md" />
                  <span className="font-bold text-sm drop-shadow-md bg-white/80 px-3 py-1 rounded-full">
                    Tocá para revelar
                  </span>
                </button>
              )}

              {qrRevealed && (
                <button
                  onClick={() => setQrRevealed(false)}
                  aria-label="Ocultar QR"
                  className="absolute -bottom-4 -right-4 bg-neutral-900 text-white p-3 rounded-full border border-white/10 shadow-xl hover:bg-neutral-800 transition-colors"
                >
                  <EyeOff className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="text-center font-mono text-neutral-500 text-sm tracking-widest mb-8">
              {ticket.qrCode.split('-')[0].toUpperCase()}
            </div>
          </>
        )}

        {ticket.status === 'VALID' && (
          <div className="border-t border-white/10 pt-6">
            {!showTransfer ? (
              <button
                onClick={() => setShowTransfer(true)}
                className="w-full py-4 rounded-xl flex items-center justify-center gap-2 font-medium bg-white/5 hover:bg-white/10 text-white transition-colors"
              >
                <ArrowRightLeft className="w-5 h-5" />
                Transferir entrada
              </button>
            ) : (
              <TransferPanel
                transferring={transferring}
                onCancel={() => setShowTransfer(false)}
                onConfirm={(user) => onTransfer(ticket, user)}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}
