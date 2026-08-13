import { cn } from "@/lib/utils";

const SIZES = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-28 w-28 text-2xl",
} as const;

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** Deterministic hue per name so avatars stay stable across renders. */
function hueFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export function DeltaAvatar({
  name,
  size = "md",
  ring,
  className,
}: {
  name: string;
  size?: keyof typeof SIZES;
  ring?: boolean;
  className?: string;
}) {
  const hue = hueFor(name);
  return (
    <span
      aria-label={name}
      title={name}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-semibold text-foreground select-none",
        SIZES[size],
        ring && "ring-2 ring-background",
        className,
      )}
      style={{
        background: `linear-gradient(140deg, oklch(0.55 0.14 ${hue}), oklch(0.38 0.10 ${(hue + 40) % 360}))`,
      }}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ names, max = 4 }: { names: string[]; max?: number }) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((n) => (
        <DeltaAvatar key={n} name={n} size="sm" ring />
      ))}
      {extra > 0 && (
        <span className="grid h-8 w-8 place-items-center rounded-full bg-muted text-[10px] font-semibold ring-2 ring-background">
          +{extra}
        </span>
      )}
    </div>
  );
}
