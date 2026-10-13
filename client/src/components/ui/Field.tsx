import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

/**
 * Kontrol form dengan label programatik dan pesan error yang terhubung ke field
 * (blueprint 8 dan aturan aksesibilitas DESIGN.md).
 *
 * Semua kontrol memakai `forwardRef` karena react-hook-form mendaftarkan input
 * lewat `ref`; tanpa itu nilai form tidak pernah terisi ke DOM.
 */

const CONTROL_BASE =
  'w-full rounded-sm border border-line-input bg-surface px-3 text-body text-ink placeholder:text-ink-3 disabled:bg-surface2 disabled:text-ink-3';

interface FieldWrapperProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

function FieldWrapper({ label, htmlFor, error, hint, required, children, className = '' }: FieldWrapperProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-label font-medium text-ink">
        {label}
        {required ? <span className="ml-1 text-danger">*</span> : null}
        {!required && !error ? (
          <span className="ml-1 text-caption font-normal text-ink-3">(opsional)</span>
        ) : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${htmlFor}-hint`} className="text-caption text-ink-3">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-caption font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> {
  label: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, containerClassName, required, ...rest },
  ref,
) {
  const id = useId();

  return (
    <FieldWrapper
      label={label}
      htmlFor={id}
      error={error}
      hint={hint}
      required={required}
      className={containerClassName}
    >
      <input
        id={id}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`${CONTROL_BASE} h-11 sm:h-10`}
        {...rest}
      />
    </FieldWrapper>
  );
});

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'className'> {
  label: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
  children: ReactNode;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, error, hint, containerClassName, required, children, ...rest },
  ref,
) {
  const id = useId();

  return (
    <FieldWrapper
      label={label}
      htmlFor={id}
      error={error}
      hint={hint}
      required={required}
      className={containerClassName}
    >
      <select
        id={id}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`${CONTROL_BASE} h-11 sm:h-10`}
        {...rest}
      >
        {children}
      </select>
    </FieldWrapper>
  );
});

export interface TextAreaFieldProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'className'> {
  label: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(function TextAreaField(
  { label, error, hint, containerClassName, required, ...rest },
  ref,
) {
  const id = useId();

  return (
    <FieldWrapper
      label={label}
      htmlFor={id}
      error={error}
      hint={hint}
      required={required}
      className={containerClassName}
    >
      <textarea
        id={id}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`${CONTROL_BASE} min-h-[88px] py-2`}
        {...rest}
      />
    </FieldWrapper>
  );
});

export interface CheckboxFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type' | 'className'> {
  label: string;
  hint?: string;
}

export const CheckboxField = forwardRef<HTMLInputElement, CheckboxFieldProps>(function CheckboxField(
  { label, hint, ...rest },
  ref,
) {
  const id = useId();

  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        ref={ref}
        type="checkbox"
        className="mt-0.5 h-5 w-5 shrink-0 rounded-sm border-line-input text-brand-700 accent-brand-700"
        {...rest}
      />
      <label htmlFor={id} className="flex flex-col text-label text-ink">
        {label}
        {hint ? <span className="text-caption text-ink-3">{hint}</span> : null}
      </label>
    </div>
  );
});
