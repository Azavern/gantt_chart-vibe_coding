import type { ReactNode } from 'react';

export function Card({
  children,
  className = '',
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article';
}) {
  return <Tag className={`rounded-md border border-line bg-surface shadow-sm ${className}`}>{children}</Tag>;
}

export function CardHeader({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
      <div className="flex items-start gap-3">
        {icon ? (
          <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-sm bg-brand-50 text-brand-700">
            {icon}
          </span>
        ) : null}
        <div>
          <h2 className="text-h3 font-semibold text-ink">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-ink-3">{description}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: 'neutral' | 'brand' | 'danger';
}) {
  const tones = {
    neutral: 'bg-surface text-ink',
    brand: 'bg-gradient-to-br from-brand-700 to-brand-600 text-white',
    danger: 'bg-danger-bg text-danger',
  } as const;

  return (
    <div className={`rounded-md border border-line p-4 shadow-sm ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-2">
        <p className={`text-caption font-medium uppercase tracking-wide ${tone === 'brand' ? 'text-brand-50' : 'text-ink-3'}`}>
          {label}
        </p>
        {icon ? <span aria-hidden="true">{icon}</span> : null}
      </div>
      <p className="tabular mt-2 text-xl font-semibold sm:text-2xl">{value}</p>
      {hint ? (
        <p className={`mt-1 text-caption ${tone === 'brand' ? 'text-brand-100' : 'text-ink-3'}`}>{hint}</p>
      ) : null}
    </div>
  );
}
