'use client';
import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  name?: string;
  buttonClassName?: string;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
  className = '',
  disabled = false,
  name,
  buttonClassName,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={
          buttonClassName ||
          `w-full h-full min-h-[48px] flex items-center justify-between px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:bg-white/10`
        }
      >
        <span
          className={`truncate mr-2 ${!selectedOption && placeholder ? 'text-neutral-400' : 'text-white'}`}
        >
          {selectedOption
            ? selectedOption.label
            : placeholder || 'Seleccionar...'}
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-neutral-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1.5 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top">
          <div className="max-h-60 overflow-y-auto overscroll-contain custom-scrollbar p-1.5 flex flex-col gap-1">
            {options.length > 0 ? (
              options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between ${
                    value === option.value
                      ? 'bg-indigo-600 text-white font-medium shadow-sm'
                      : 'text-neutral-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                </button>
              ))
            ) : (
              <div className="px-3 py-2.5 text-sm text-neutral-500 text-center">
                Sin opciones
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
