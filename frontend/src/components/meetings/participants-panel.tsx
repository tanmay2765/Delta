import { Mic, MicOff, Search, UserPlus, Video, VideoOff, X } from "lucide-react";
import { useMemo, useState } from "react";
import { DeltaAvatar } from "@/components/ui/delta-avatar";
import { DeltaButton } from "@/components/ui/delta-button";
import { cn } from "@/lib/utils";
import type { JoinRequest, Participant } from "@/lib/types";
import { InvitePeopleModal } from "./invite-people-modal";

export function ParticipantsPanel({
  participants,
  onClose,
  meetingId,
  inviteCode,
  meetingTitle,
  isHost,
  joinRequests,
  onApproveRequest,
  onDenyRequest,
  onToggleMicPermission,
  onToggleCameraPermission,
}: {
  participants: Participant[];
  onClose: () => void;
  meetingId: string;
  inviteCode: string;
  meetingTitle: string;
  isHost: boolean;
  joinRequests?: JoinRequest[];
  onApproveRequest?: (requestId: number) => void;
  onDenyRequest?: (requestId: number) => void;
  onToggleMicPermission?: (participantId: string, allowed: boolean) => void;
  onToggleCameraPermission?: (participantId: string, allowed: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  const filtered = useMemo(
    () => participants.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase())),
    [participants, query],
  );

  return (
    <>
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

        {isHost && joinRequests && joinRequests.length > 0 && (
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
            <p className="text-sm font-medium">Waiting to join ({joinRequests.length})</p>
            <ul className="mt-2 space-y-2">
              {joinRequests.map((request) => (
                <li
                  key={request.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-glass px-2 py-2"
                >
                  <span className="truncate text-sm">{request.displayName}</span>
                  <span className="flex gap-1">
                    <DeltaButton
                      size="sm"
                      variant="ghost"
                      onClick={() => onDenyRequest?.(request.id)}
                    >
                      Deny
                    </DeltaButton>
                    <DeltaButton size="sm" onClick={() => onApproveRequest?.(request.id)}>
                      Admit
                    </DeltaButton>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

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
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {p.name}
                  {p.isSelf && <span className="text-muted-foreground"> (You)</span>}
                </p>
                {p.isHost ? (
                  <p className="text-xs text-muted-foreground">Host</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {p.micAllowed ? "Mic allowed" : "Mic blocked"}
                    {" · "}
                    {p.cameraAllowed ? "Camera allowed" : "Camera blocked"}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {isHost && !p.isSelf && !p.isHost ? (
                  <>
                    <PermissionToggle
                      allowed={p.micAllowed}
                      onClick={() => onToggleMicPermission?.(p.id, !p.micAllowed)}
                      label={`${p.micAllowed ? "Revoke" : "Allow"} microphone for ${p.name}`}
                      onIcon={<Mic className="h-4 w-4" />}
                      offIcon={<MicOff className="h-4 w-4" />}
                    />
                    <PermissionToggle
                      allowed={p.cameraAllowed}
                      onClick={() => onToggleCameraPermission?.(p.id, !p.cameraAllowed)}
                      label={`${p.cameraAllowed ? "Revoke" : "Allow"} camera for ${p.name}`}
                      onIcon={<Video className="h-4 w-4" />}
                      offIcon={<VideoOff className="h-4 w-4" />}
                    />
                  </>
                ) : (
                  <>
                    <StatusIcon
                      on={p.micOn}
                      onIcon={<Mic className="h-4 w-4" />}
                      offIcon={<MicOff className="h-4 w-4" />}
                    />
                    <StatusIcon
                      on={p.cameraOn}
                      onIcon={<Video className="h-4 w-4" />}
                      offIcon={<VideoOff className="h-4 w-4" />}
                    />
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>

        <DeltaButton block className="mt-3" onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Invite People
        </DeltaButton>
      </aside>

      <InvitePeopleModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        meetingId={meetingId}
        inviteCode={inviteCode}
        meetingTitle={meetingTitle}
      />
    </>
  );
}

function PermissionToggle({
  allowed,
  onClick,
  label,
  onIcon,
  offIcon,
}: {
  allowed: boolean;
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
      aria-pressed={allowed}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-lg transition-colors hover:bg-glass",
        allowed ? "text-primary-glow" : "text-destructive",
      )}
    >
      {allowed ? onIcon : offIcon}
    </button>
  );
}

function StatusIcon({
  on,
  onIcon,
  offIcon,
}: {
  on: boolean;
  onIcon: React.ReactNode;
  offIcon: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "grid h-8 w-8 place-items-center rounded-lg",
        on ? "text-primary-glow" : "text-destructive",
      )}
      aria-hidden
    >
      {on ? onIcon : offIcon}
    </span>
  );
}
