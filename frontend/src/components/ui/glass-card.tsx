import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "soft" | "strong";
  as?: "div" | "section" | "aside";
}

export function GlassCard({
  className,
  variant = "default",
  as: Tag = "div",
  ...props
}: GlassCardProps) {
  return (
    <Tag
      className={cn(
        "rounded-2xl",
        variant === "default" && "glass-panel",
        variant === "soft" && "glass-soft",
        variant === "strong" && "glass-panel bg-glass-strong",
        className,
      )}
      {...props}
    />
  );
}
