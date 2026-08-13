import { Clock, Users } from "lucide-react";
import { DeltaAvatar } from "@/components/ui/delta-avatar";
import { GlassCard } from "@/components/ui/glass-card";
import type { MeetingHistoryItem } from "@/lib/types";

export function RecentMeetings({ items }: { items: MeetingHistoryItem[] }) {
  return (
    <GlassCard className="flex h-full flex-col p-5">
      <h2 className="text-lg font-semibold tracking-tight">Recent Meeting History</h2>

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No meetings yet.</p>
      ) : (
        <ul className="no-scrollbar mt-4 max-h-[280px] space-y-3 overflow-y-auto pr-1">
          {items.map((item) => (
            <li
              key={item.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl p-2 transition-colors hover:bg-glass"
            >
              <DeltaAvatar name={item.host} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {new Date(item.date).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  · {item.host}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium tabular-nums">{item.durationLabel}</p>
                <p className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {item.durationLabel}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {item.participantCount}
                  </span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}
