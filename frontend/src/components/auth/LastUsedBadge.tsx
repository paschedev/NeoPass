// La etiqueta "Último usado" sobre el borde del método con el que se entró la
// última vez en este navegador.
export default function LastUsedBadge() {
  return (
    <span className="pointer-events-none absolute -top-2.5 right-4 z-10 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold leading-4 text-neutral-950 shadow">
      Último usado
    </span>
  );
}
