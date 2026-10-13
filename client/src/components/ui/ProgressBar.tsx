export function ProgressBar({
  value,
  color,
  label,
  size = 'md',
}: {
  value: number;
  /** Warna brand tugas; dipakai sebagai isian progres. */
  color?: string;
  label?: string;
  size?: 'sm' | 'md';
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div className="flex items-center gap-2">
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progres'}
        className={`h-2 w-full min-w-[52px] overflow-hidden rounded-full bg-surface2 ${size === 'sm' ? 'h-1.5' : ''}`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-200"
          style={{ width: `${clamped}%`, backgroundColor: color ?? '#0F766E' }}
        />
      </div>
      <span className="tabular w-9 text-right text-caption text-ink-2">{clamped}%</span>
    </div>
  );
}
