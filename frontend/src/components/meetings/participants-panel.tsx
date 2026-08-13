import { Mic, MicOff, Search, UserPlus, Video, VideoOff, X } from "lucide-react";
import { useMemo, useState } from "react";
import { DeltaAvatar } from "@/components/ui/delta-avatar";
import { DeltaButton } from "@/components/ui/delta-button";
import { cn } from "@/lib/utils";
import type { Participant } from "@/lib/types";

export function ParticipantsPanel({
  participants,
  onToggleMic,
  onToggleCamera,
  onClose,
  onInvite,
}: {
  participants: Participant[];
  onToggleMic: (id: string) => void;
  onToggleCamera: (id: string) => void;
  onClose: () => void;
  onInvite: () => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () => participants.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase())),
    [participants, query],
  );

  return (
    <aside className="glass-panel flex h-full w-full flex-col rounded-2xl bg-card/70 p-4 lg:w-[320px]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">
          Participants ({participants.length})
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close participants panel"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-glass hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search participants"
          aria-label="Search participants"
          className="glass-soft h-10 w-full rounded-xl pl-9 pr-3 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <ul className="no-scrollbar mt-3 flex-1 space-y-1 overflow-y-auto">
        {filtered.length === 0 && (
          <li className="py-6 text-center text-sm text-muted-foreground">No participants found</li>
        )}
        {filtered.map((p) => (
          <li
            key={p.id}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2 py-2 hover:bg-glass"
          >
            <div className="relative">
              <DeltaAvatar name={p.name} size="md" />
              {p.speaking && (
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-success" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{p.name}</p>
              {p.isHost && <p className="text-xs text-muted-foreground">Host</p>}
            </div>
            <div className="flex items-center gap-1">
              <IconToggle
                on={p.micOn}
                onClick={() => onToggleMic(p.id)}
                label={`${p.micOn ? "Mute" : "Unmute"} ${p.name}`}
                onIcon={<Mic className="h-4 w-4" />}
                offIcon={<MicOff className="h-4 w-4" />}
              />
              <IconToggle
                on={p.cameraOn}
                onClick={() => onToggleCamera(p.id)}
                label={`${p.cameraOn ? "Disable" : "Enable"} camera for ${p.name}`}
                onIcon={<Video className="h-4 w-4" />}
                offIcon={<VideoOff className="h-4 w-4" />}
              />
            </div>
          </li>
        ))}
      </ul>

      <DeltaButton block className="mt-3" onClick={onInvite}>
        <UserPlus className="h-4 w-4" />
        Invite People
      </DeltaButton>
    </aside>
  );
}

function IconToggle({
  on,
  onClick,
  label,
  onIcon,
  offIcon,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  onIcon: React.ReactNode;
  offIcon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={on}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-lg transition-colors",
        on ? "text-primary-glow hover:bg-glass" : "text-destructive hover:bg-glass",
      )}
    >
      {on ? onIcon : offIcon}
    </button>
  );
}
