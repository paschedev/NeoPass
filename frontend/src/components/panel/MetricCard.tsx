// Una celda de la franja de métricas del Resumen: va dentro de un <dl> y las
// líneas entre celdas las dibuja la franja (gap de 1 px sobre el borde).
export default function MetricCard({
  title,
  value,
  className = '',
}: {
  title: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={`bg-neutral-950 px-3 py-4 md:px-6 md:py-5 min-w-0 ${className}`}
    >
      <dt className="text-sm text-neutral-400">{title}</dt>
      <dd className="mt-1 font-outfit text-2xl md:text-3xl font-bold tracking-tight text-white tabular-nums">
        {value}
      </dd>
    </div>
  );
}
