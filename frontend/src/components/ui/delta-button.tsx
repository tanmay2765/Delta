import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

export const deltaButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap",
  {
    variants: {
      variant: {
        primary:
          "bg-linear-to-b from-primary-glow to-primary text-primary-foreground shadow-[0_10px_30px_-12px_var(--primary)] hover:brightness-110 active:brightness-95",
        glass: "glass-soft text-foreground hover:bg-glass-strong hover:border-glass-border",
        ghost: "text-muted-foreground hover:text-foreground hover:bg-glass",
        outline: "border border-glass-border bg-transparent text-foreground hover:bg-glass",
        danger: "bg-destructive text-destructive-foreground hover:brightness-110",
        success: "bg-success text-success-foreground hover:brightness-110",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        xl: "h-14 px-8 text-base",
        icon: "h-11 w-11",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  },
);

export interface DeltaButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof deltaButtonVariants> {
  asChild?: boolean;
}

export function DeltaButton({
  className,
  variant,
  size,
  block,
  asChild,
  ...props
}: DeltaButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(deltaButtonVariants({ variant, size, block }), className)} {...props} />
  );
}
