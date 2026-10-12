'use client';

import type { FreeTicketTypesChoice } from '@/hooks/useFreeTicketTypes';

const NOTE = 'text-xs text-neutral-400';

// Las casillas de los tipos de entrada que alguien puede regalar como QR
// free. Un nombre vale en todas las tandas; de entrada no hay ninguno tildado.
export default function FreeTicketTypesField({
  choice,
}: {
  choice: FreeTicketTypesChoice;
}) {
  const { names, failed } = choice;

  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium text-neutral-400 mb-1">
        Tipos de entrada que puede regalar
      </legend>
      {failed && (
        <p className={NOTE}>No pudimos cargar los tipos de entrada.</p>
      )}
      {!failed && names === null && (
        <p className={NOTE}>Cargando tipos de entrada...</p>
      )}
      {names?.length === 0 && (
        <p className={NOTE}>El evento todavía no tiene tipos de entrada.</p>
      )}
      {names && names.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {names.map((name) => (
            <label
              key={name}
              className="flex items-center gap-2 text-sm text-white cursor-pointer"
            >
              <input
                type="checkbox"
                checked={choice.isChosen(name)}
                onChange={() => choice.toggle(name)}
                className="w-4 h-4 accent-indigo-500"
              />
              {name}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
