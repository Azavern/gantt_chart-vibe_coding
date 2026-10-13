import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900 disabled:bg-brand-200 disabled:text-brand-700',
  secondary:
    'border border-line bg-surface text-ink hover:bg-surface2 active:bg-line disabled:text-ink-3',
  ghost: 'text-ink-2 hover:bg-surface2 active:bg-line disabled:text-ink-3',
  danger: 'bg-danger text-white hover:brightness-110 active:brightness-95 disabled:bg-danger-bg disabled:text-danger',
};

const SIZES: Record<Size, string> = {
  // Target sentuh minimal 44px pada layar kecil, lebih rapat di desktop.
  sm: 'h-9 px-3 text-label sm:h-8',
  md: 'h-11 px-4 text-label sm:h-10',
  lg: 'h-12 px-5 text-body',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  block = false,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-sm font-medium transition-colors',
        'disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        block ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {loading ? <Spinner className="h-4 w-4" /> : icon}
      {children}
    </button>
  );
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin text-current ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
