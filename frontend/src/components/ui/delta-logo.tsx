import { cn } from "@/lib/utils";

export function DeltaLogo({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn("grid place-items-center rounded-xl", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 48 48" width={size} height={size} role="img">
        <defs>
          <linearGradient id="delta-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.85 0.11 220)" />
            <stop offset="55%" stopColor="oklch(0.62 0.19 255)" />
            <stop offset="100%" stopColor="oklch(0.42 0.18 268)" />
          </linearGradient>
        </defs>
        <path
          d="M10 5h14c11 0 18 8 18 19s-7 19-18 19H10V5Zm8 7v24h6c6.6 0 11-4.9 11-12s-4.4-12-11-12h-6Z"
          fill="url(#delta-grad)"
        />
        <path d="M30 21 16 43h9l12-19-7-3Z" fill="url(#delta-grad)" opacity="0.85" />
      </svg>
    </span>
  );
}

export function DeltaWordmark() {
  return (
    <span className="flex items-center gap-2">
      <DeltaLogo size={28} />
      <span className="text-lg font-semibold tracking-tight">Delta</span>
    </span>
  );
}
