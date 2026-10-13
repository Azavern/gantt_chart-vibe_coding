import type { ReactNode } from 'react';
import { PRIORITY_LABELS, type Priority } from '@gantt/shared';

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface2 text-ink-2 ring-line',
  brand: 'bg-brand-50 text-brand-800 ring-brand-200',
  success: 'bg-success-bg text-success ring-success/30',
  warning: 'bg-warning-bg text-warning ring-warning/30',
  danger: 'bg-danger-bg text-danger ring-danger/30',
  info: 'bg-info-bg text-info ring-info/30',
};

export function Badge({
  tone = 'neutral',
  icon,
  children,
  className = '',
}: {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-medium ring-1 ring-inset ${TONES[tone]} ${className}`}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {children}
    </span>
  );
}

const PRIORITY_TONES: Record<Priority, Tone> = {
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'warning',
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge tone={PRIORITY_TONES[priority]}>
      {priority === 'HIGH' ? '↑ ' : priority === 'LOW' ? '↓ ' : '• '}
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}
