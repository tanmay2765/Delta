import { cn } from "@/lib/utils";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useId } from "react";

const fieldBase =
  "w-full rounded-xl border border-glass-border bg-glass px-4 text-[15px] text-foreground placeholder:text-muted-foreground/70 backdrop-blur-md transition-all focus:outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/25";

interface FieldWrapProps {
  label?: string | undefined;
  error?: string | undefined;
  hint?: string | undefined;
  htmlFor?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
}

export function Field({ label, error, hint, htmlFor, children, className }: FieldWrapProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground/90">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

interface DeltaInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
}

export function DeltaInput({
  label,
  error,
  hint,
  icon,
  trailing,
  className,
  id,
  ...props
}: DeltaInputProps) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <Field label={label} error={error} hint={hint} htmlFor={inputId}>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          aria-invalid={!!error}
          className={cn(
            fieldBase,
            "h-12",
            icon && "pl-11",
            trailing && "pr-11",
            error && "border-destructive/70 focus:ring-destructive/25",
            className,
          )}
          {...props}
        />
        {trailing && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {trailing}
          </span>
        )}
      </div>
    </Field>
  );
}

interface DeltaTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function DeltaTextarea({ label, error, className, id, ...props }: DeltaTextareaProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <Field label={label} error={error} htmlFor={fieldId}>
      <textarea
        id={fieldId}
        className={cn(fieldBase, "min-h-[84px] resize-none py-3", className)}
        {...props}
      />
    </Field>
  );
}

interface DeltaSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export function DeltaSelect({ label, error, className, id, children, ...props }: DeltaSelectProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <Field label={label} error={error} htmlFor={fieldId}>
      <select
        id={fieldId}
        className={cn(fieldBase, "h-12 appearance-none bg-card/60 pr-10", className)}
        {...props}
      >
        {children}
      </select>
    </Field>
  );
}
