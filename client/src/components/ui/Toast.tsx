import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

type Variant = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  variant: Variant;
}

interface ToastContextValue {
  show: (message: string, variant?: Variant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<Variant, ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />,
  error: <AlertTriangle className="h-5 w-5 text-danger" aria-hidden="true" />,
  info: <Info className="h-5 w-5 text-info" aria-hidden="true" />,
};

const BORDERS: Record<Variant, string> = {
  success: 'border-l-success',
  error: 'border-l-danger',
  info: 'border-l-info',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (message: string, variant: Variant = 'info') => {
      counter.current += 1;
      const id = counter.current;
      setToasts((current) => [...current, { id, message, variant }]);
      window.setTimeout(() => dismiss(id), variant === 'error' ? 7000 : 4200);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (message: string) => show(message, 'success'),
      error: (message: string) => show(message, 'error'),
      info: (message: string) => show(message, 'info'),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-3 bottom-3 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:items-end"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.variant === 'error' ? 'alert' : 'status'}
            className={`animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-md border border-line border-l-4 bg-surface px-3.5 py-3 shadow-lg ${BORDERS[toast.variant]}`}
          >
            {ICONS[toast.variant]}
            <p className="flex-1 text-sm text-ink">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="rounded-sm p-1 text-ink-3 hover:bg-surface2 hover:text-ink"
              aria-label="Tutup notifikasi"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast harus dipakai di dalam ToastProvider');
  return context;
}
