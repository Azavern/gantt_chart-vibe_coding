import type { ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { Button, Spinner } from './Button';

export function LoadingBlock({ label = 'Memuat data…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-ink-3">
      <Spinner className="h-5 w-5 text-brand-600" />
      {label}
    </div>
  );
}

export function SkeletonRows({
  rows = 5,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div role="status" aria-label="Memuat data" className="animate-pulse space-y-2 p-4">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-3">
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <div
              key={columnIndex}
              className="h-4 flex-1 rounded-sm bg-surface2"
              style={{ maxWidth: columnIndex === 0 ? '40%' : undefined }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  title = 'Data gagal dimuat',
}: {
  message: string;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-danger-bg text-danger">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <p className="font-medium text-ink">{title}</p>
        <p className="mt-1 text-sm text-ink-3">{message}</p>
      </div>
      {onRetry ? (
        <Button variant="secondary" size="sm" icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />} onClick={onRetry}>
          Coba lagi
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 text-brand-700" aria-hidden="true">
        {icon}
      </span>
      <div className="max-w-md">
        <p className="font-semibold text-ink">{title}</p>
        <p className="mt-1 text-sm text-ink-3">{description}</p>
      </div>
      {action}
    </div>
  );
}
