import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

const fieldClass =
  "w-full rounded-lg border border-stroke bg-background px-3 py-2 text-sm text-text placeholder:text-muted";

export function Input({
  label,
  hint,
  className,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const inputId = id ?? props.name;
  return (
    <label className="block space-y-1.5 text-sm" htmlFor={inputId}>
      <span className="font-medium text-text">{label}</span>
      <input id={inputId} className={cn(fieldClass, className)} {...props} />
      {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function TextArea({
  label,
  id,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const inputId = id ?? props.name;
  return (
    <label className="block space-y-1.5 text-sm" htmlFor={inputId}>
      <span className="font-medium text-text">{label}</span>
      <textarea id={inputId} className={cn(fieldClass, "min-h-24")} {...props} />
    </label>
  );
}

export function Select({
  label,
  id,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const inputId = id ?? props.name;
  return (
    <label className="block space-y-1.5 text-sm" htmlFor={inputId}>
      <span className="font-medium text-text">{label}</span>
      <select id={inputId} className={fieldClass} {...props}>
        {children}
      </select>
    </label>
  );
}
