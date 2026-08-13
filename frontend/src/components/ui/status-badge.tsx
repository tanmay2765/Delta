import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Tone = "neutral" | "primary" | "success" | "danger" | "warning";

const TONES: Record<Tone, string> = {
  neutral: "bg-glass text-muted-foreground border-glass-border",
  primary: "bg-primary/15 text-primary-glow border-primary/30",
  success: "bg-success/15 text-success border-success/30",
  danger: "bg-destructive/15 text-destructive border-destructive/30",
  warning: "bg-warning/15 text-warning border-warning/30",
};

export function StatusBadge({
  tone = "neutral",
  dot,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
