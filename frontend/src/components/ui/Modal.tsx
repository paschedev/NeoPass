'use client';

import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useScrollLock } from '@/hooks/useScrollLock';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Classes of the dialog box (size, background, padding). */
  className?: string;
  /** Classes of the backdrop behind the dialog. */
  overlayClassName?: string;
  labelledBy?: string;
}

/**
 * Centered dialog rendered in a portal: locks the page scroll and closes with
 * Escape or a click on the backdrop.
 */
export default function Modal({
  open,
  onClose,
  children,
  className = 'bg-neutral-900 border border-white/10 rounded-3xl w-full max-w-md shadow-2xl',
  overlayClassName = 'bg-black/60 backdrop-blur-sm',
  labelledBy,
}: ModalProps) {
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 overscroll-contain ${overlayClassName}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={className}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
