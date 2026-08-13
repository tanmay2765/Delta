import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function ToggleRow({
  checked,
  onChange,
  label,
  icon,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  icon?: ReactNode;
  id?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full border transition-colors",
          checked ? "border-primary/50 bg-primary" : "border-glass-border bg-secondary",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-primary-foreground transition-transform",
            checked ? "translate-x-6" : "translate-x-0.5",
          )}
        />
      </button>
      <span className="flex items-center gap-2 text-[15px] font-medium">
        {label}
        {icon}
      </span>
    </div>
  );
}
