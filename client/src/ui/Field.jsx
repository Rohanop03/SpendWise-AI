import { forwardRef, useId, useState } from 'react';

import Icon from './Icon.jsx';

/**
 * Label + control + hint + error. The control is rendered by `children(id, describedBy)`
 * so native inputs keep their own semantics (and their `name` for existing tests/e2e).
 */
export function Field({ action, children, className = '', error, hint, id: idProp, label }) {
  const generated = useId();
  const id = idProp || generated;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
        {action}
      </div>
      {children(id, describedBy, Boolean(error))}
      {hint && (
        <p className="field-hint" id={hintId}>
          {hint}
        </p>
      )}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

export function FieldError({ id, message }) {
  return (
    <p aria-live="polite" className="empty:hidden" id={id}>
      {message && (
        <span className="mt-2 flex items-start gap-1.5 text-sm font-bold text-(--ink)">
          <Icon className="mt-0.5 size-4 shrink-0" name="alert" />
          <span>{message}</span>
        </span>
      )}
    </p>
  );
}

export const Input = forwardRef(function Input({ className = '', invalid, ...props }, ref) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={`well ${className}`}
      ref={ref}
      {...props}
    />
  );
});

export const Select = forwardRef(function Select(
  { children, className = '', invalid, ...props },
  ref,
) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={`well ${className}`}
      ref={ref}
      {...props}
    >
      {children}
    </select>
  );
});

export const Textarea = forwardRef(function Textarea({ className = '', invalid, ...props }, ref) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={`well ${className}`}
      ref={ref}
      {...props}
    />
  );
});

/** Password well with a show/hide toggle (accessible name "Show <label>"). */
export const PasswordInput = forwardRef(function PasswordInput(
  { className = '', id, invalid, label, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false);
  return (
    <span
      className={`well flex items-center gap-2 !py-0 !pr-1.5 focus-within:border-(--ink) ${className}`}
    >
      <input
        aria-invalid={invalid || undefined}
        className="min-w-0 flex-1 bg-transparent py-3 outline-none"
        id={id}
        ref={ref}
        type={visible ? 'text' : 'password'}
        {...props}
      />
      <button
        aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
        className="pill pill-ghost pill-sm shrink-0 !min-h-9 !px-3"
        onClick={() => setVisible((current) => !current)}
        type="button"
      >
        <Icon className="size-4" name={visible ? 'eyeOff' : 'eye'} />
        <span aria-hidden="true" className="text-xs">
          {visible ? 'Hide' : 'Show'}
        </span>
      </button>
    </span>
  );
});

/** Banner-style message for form-level API errors and notices. */
export function FormMessage({ children, tone = 'error' }) {
  if (!children) return null;
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl p-4 text-sm leading-6 ${
        tone === 'error' ? 'obsidian' : 'neu-pressed'
      }`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <Icon className="mt-0.5 size-5 shrink-0" name={tone === 'error' ? 'alert' : 'check'} />
      <div className="min-w-0 font-bold">{children}</div>
    </div>
  );
}
