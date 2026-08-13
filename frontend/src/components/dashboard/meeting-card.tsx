import { Link } from "@tanstack/react-router";
import { MoreVertical } from "lucide-react";
import { AvatarStack } from "@/components/ui/delta-avatar";
import { DeltaButton } from "@/components/ui/delta-button";
import { GlassCard } from "@/components/ui/glass-card";
import type { Meeting } from "@/lib/types";

function timeRange(meeting: Meeting) {
  const start = new Date(meeting.startTime);
  const end = new Date(start.getTime() + meeting.durationMinutes * 60000);
  const fmt = (d: Date) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${fmt(start)} - ${fmt(end)}`;
}

export function MeetingCard({ meeting }: { meeting: Meeting }) {
  return (
    <GlassCard variant="soft" className="flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold tracking-tight">{meeting.title}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{timeRange(meeting)}</p>
        </div>
        <button
          type="button"
          aria-label={`Options for ${meeting.title}`}
          className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-glass hover:text-foreground"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>

      <AvatarStack names={meeting.participants.map((p) => p.name)} />

      <div className="flex items-center gap-2">
        <DeltaButton size="sm" asChild>
          <Link to="/join" search={{ id: meeting.id }}>
            Rejoin
          </Link>
        </DeltaButton>
        <DeltaButton size="sm" variant="outline" asChild>
          <Link to="/join" search={{ id: meeting.id }}>
            Details
          </Link>
        </DeltaButton>
      </div>
    </GlassCard>
  );
}
