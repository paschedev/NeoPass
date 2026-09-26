'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  PHONE_PREFIXES,
  findPhonePrefix,
  formatPhoneInput,
} from '@/utils/phone';

// Teléfono con selector de país: el número se formatea mientras se escribe.
// El valor final se arma con toE164Phone(prefix, value).
export default function PhoneInput({
  prefix,
  onPrefixChange,
  value,
  onChange,
  onBlur,
  invalid,
}: {
  prefix: string;
  onPrefixChange: (code: string) => void;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  invalid: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selected = findPhonePrefix(prefix);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  return (
    <div
      className={`flex bg-white/5 border ${invalid ? 'border-red-500' : 'border-white/10'} rounded-xl focus-within:border-indigo-500 focus-within:bg-white/10 transition-all shadow-inner relative`}
    >
      <div
        className="w-[120px] border-r border-white/10 flex-shrink-0 bg-transparent relative"
        ref={dropdownRef}
      >
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full h-full min-h-[48px] flex items-center justify-between px-3 py-3 bg-transparent text-sm text-white focus:outline-none cursor-pointer hover:bg-white/5 rounded-l-xl"
        >
          <div className="flex items-center gap-2">
            <img
              src={`https://flagcdn.com/w20/${selected.country}.png`}
              alt={selected.label}
              className="w-5 h-auto rounded-[2px]"
            />
            <span>{selected.code}</span>
          </div>
          <ChevronDown
            className={`w-3 h-3 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-1 w-48 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl z-50 py-2 max-h-48 overflow-y-auto overscroll-contain custom-scrollbar">
            {PHONE_PREFIXES.map((option) => (
              <button
                key={option.code}
                type="button"
                onClick={() => {
                  onPrefixChange(option.code);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm flex items-center gap-3 transition-colors ${
                  prefix === option.code
                    ? 'bg-indigo-600 text-white'
                    : 'text-neutral-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <img
                  src={`https://flagcdn.com/w20/${option.country}.png`}
                  alt=""
                  className="w-5 h-auto rounded-[2px]"
                />
                <span className="w-8 text-neutral-400">{option.label}</span>
                <span className="font-medium">{option.code}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <input
        type="tel"
        maxLength={18}
        value={value}
        onChange={(e) => onChange(formatPhoneInput(e.target.value, prefix))}
        onBlur={onBlur}
        className="w-full bg-transparent px-4 py-3 text-white focus:outline-none placeholder-neutral-500 rounded-r-xl"
        placeholder="11 2345 6789"
      />
    </div>
  );
}
