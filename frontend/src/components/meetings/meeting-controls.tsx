import {
  Circle,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  MoreHorizontal,
  PhoneOff,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import { DeltaButton } from "@/components/ui/delta-button";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface MeetingControlsProps {
  micOn: boolean;
  cameraOn: boolean;
  sharing: boolean;
  recording: boolean;
  participantsOpen: boolean;
  chatOpen: boolean;
  unreadChat: number;
  participantCount: number;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleShare: () => void;
  onToggleRecording: () => void;
  onToggleParticipants: () => void;
  onToggleChat: () => void;
  onMore: () => void;
  onLeave: () => void;
}

export function MeetingControls(props: MeetingControlsProps) {
  return (
    <div className="glass-panel mx-auto flex w-full max-w-3xl items-center justify-center gap-1.5 overflow-x-auto rounded-2xl bg-card/70 px-3 py-3 sm:gap-3 sm:px-5">
      <ControlButton
        label={props.micOn ? "Mute" : "Unmute"}
        active={props.micOn}
        onClick={props.onToggleMic}
        icon={props.micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
      />
      <ControlButton
        label="Camera"
        active={props.cameraOn}
        onClick={props.onToggleCamera}
        icon={props.cameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
      />
      <ControlButton
        label="Share"
        active={props.sharing}
        onClick={props.onToggleShare}
        icon={<MonitorUp className="h-5 w-5" />}
      />
      <ControlButton
        label="Record"
        active={props.recording}
        onClick={props.onToggleRecording}
        icon={<Circle className={cn("h-5 w-5", props.recording && "fill-current")} />}
      />
      <ControlButton
        label="People"
        active={props.participantsOpen}
        onClick={props.onToggleParticipants}
        icon={<Users className="h-5 w-5" />}
        badge={props.participantCount}
      />
      <ControlButton
        label="Chat"
        active={props.chatOpen}
        onClick={props.onToggleChat}
        icon={<MessageSquare className="h-5 w-5" />}
        badge={props.unreadChat > 0 ? props.unreadChat : undefined}
        badgeTone="danger"
      />
      <ControlButton
        label="More"
        active={false}
        onClick={props.onMore}
        icon={<MoreHorizontal className="h-5 w-5" />}
      />

      <DeltaButton variant="danger" className="ml-1 shrink-0 sm:ml-3" onClick={props.onLeave}>
        <PhoneOff className="h-4 w-4" />
        <span className="hidden sm:inline">Leave</span>
      </DeltaButton>
    </div>
  );
}

function ControlButton({
  label,
  icon,
  active,
  onClick,
  badge,
  badgeTone = "primary",
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
  badge?: number | undefined;
  badgeTone?: "primary" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className="group flex shrink-0 flex-col items-center gap-1"
    >
      <span
        className={cn(
          "relative grid h-11 w-12 place-items-center rounded-xl transition-colors sm:h-12 sm:w-14",
          active ? "bg-primary/25 text-primary-glow" : "bg-secondary text-muted-foreground",
          "group-hover:brightness-125",
        )}
      >
        {icon}
        {badge !== undefined && (
          <span
            className={cn(
              "absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-semibold",
              badgeTone === "danger"
                ? "bg-destructive text-destructive-foreground"
                : "bg-primary text-primary-foreground",
            )}
          >
            {badge}
          </span>
        )}
      </span>
      <span className="hidden text-[11px] text-muted-foreground sm:block">{label}</span>
    </button>
  );
}
