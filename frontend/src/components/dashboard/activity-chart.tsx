import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ActivityPoint } from "@/lib/types";

const MAX = 400;
const TICKS = [400, 300, 200, 100, 0];

export function ActivityChart({ data }: { data: ActivityPoint[] }) {
  const busiest = data.length > 0 ? data.reduce((a, b) => (b.minutes > a.minutes ? b : a), data[0]!) : null;

  return (
    <GlassCard className="flex h-full flex-col p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Meeting Activity Analytics</h2>
        {busiest && <StatusBadge tone="primary">Peak {busiest.day}</StatusBadge>}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Meeting Minutes</p>

      <div className="mt-4 grid grid-cols-[36px_minmax(0,1fr)] gap-3">
        <div className="flex flex-col justify-between py-1 text-right text-xs text-muted-foreground">
          {TICKS.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <div className="flex h-[180px] items-end gap-2 border-l border-glass-border pl-3">
          {data.map((point) => (
            <div key={point.day} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div
                className="w-full rounded-t-md bg-linear-to-t from-primary to-primary-glow"
                style={{ height: `${Math.max(6, (point.minutes / MAX) * 100)}%` }}
                title={`${point.day}: ${point.minutes} min`}
              />
              <span className="truncate text-xs text-muted-foreground">{point.day}</span>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
