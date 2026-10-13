import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

import { Button } from './Button';

/**
 * Dialog modal sederhana: fokus dipindahkan ke dalam dialog saat dibuka,
 * Escape menutup, dan klik latar menutup dialog.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const titleId = useId();
  const descriptionId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    const focusable = container?.querySelector<HTMLElement>(
      'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  } as const;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink/40 p-3 sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        ref={containerRef}
        className={`animate-fade-in w-full ${widths[size]} rounded-lg border border-line bg-surface shadow-lg`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3.5 sm:px-5">
          <div>
            <h2 id={titleId} className="text-h3 font-semibold text-ink">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-0.5 text-sm text-ink-3">
                {description}
              </p>
            ) : null}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Tutup dialog">
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-4 py-4 sm:px-5">{children}</div>

        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3.5 sm:px-5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Hapus',
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Batal
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-body text-ink-2">{message}</p>
    </Dialog>
  );
}
