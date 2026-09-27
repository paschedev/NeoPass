type MetricColor = 'emerald' | 'indigo' | 'purple' | 'blue';

const COLOR_STYLES: Record<MetricColor, string> = {
  emerald: 'bg-emerald-500/10 group-hover:bg-emerald-500/20',
  indigo: 'bg-indigo-500/10 group-hover:bg-indigo-500/20',
  purple: 'bg-purple-500/10 group-hover:bg-purple-500/20',
  blue: 'bg-blue-500/10 group-hover:bg-blue-500/20',
};

export default function MetricCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: MetricColor;
}) {
  return (
    <div className="bg-neutral-900 border border-white/5 rounded-3xl p-5 relative overflow-hidden group hover:border-white/10 transition-all hover:-translate-y-1 shadow-xl flex items-center justify-between">
      <div
        className={`absolute top-0 right-0 w-32 h-32 ${COLOR_STYLES[color]} rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none transition-colors`}
      />
      <div className="relative z-10 flex flex-col">
        <div className="text-sm font-medium text-neutral-400 mb-1">{title}</div>
        <div className="font-outfit text-3xl lg:text-4xl font-bold tracking-tight text-white">
          {value}
        </div>
      </div>
      <div className="relative z-10 p-3 bg-white/5 rounded-2xl border border-white/5 shadow-inner shrink-0">
        {icon}
      </div>
    </div>
  );
}
