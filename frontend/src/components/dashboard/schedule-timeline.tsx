import { AvatarStack } from "@/components/ui/delta-avatar";
import { GlassCard } from "@/components/ui/glass-card";
import type { Meeting } from "@/lib/types";

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

function label(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${suffix}`;
}

export function ScheduleTimeline({ meetings }: { meetings: Meeting[] }) {
  return (
    <GlassCard className="flex h-full flex-col p-5">
      <h2 className="text-lg font-semibold tracking-tight">Daily Schedule Timeline</h2>
      <div className="no-scrollbar mt-4 max-h-[560px] space-y-1 overflow-y-auto pr-1">
        {HOURS.map((hour) => {
          const slot = meetings.filter((m) => new Date(m.startTime).getHours() === hour);
          return (
            <div key={hour} className="grid grid-cols-[52px_minmax(0,1fr)] gap-3">
              <span className="pt-1 text-xs text-muted-foreground">{label(hour)}</span>
              <div className="min-h-[44px] border-t border-glass-border pt-1">
                {slot.map((m) => (
                  <div
                    key={m.id}
                    className="mb-2 rounded-xl border-l-2 border-primary bg-glass p-3 backdrop-blur-md"
                  >
                    <p className="truncate text-sm font-medium">{m.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.host}</p>
                    <div className="mt-2">
                      <AvatarStack names={m.participants.map((p) => p.name)} max={3} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
