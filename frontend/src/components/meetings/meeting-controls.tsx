import {
  ChevronUp,
  Heart,
  LayoutGrid,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  MoreHorizontal,
  PhoneOff,
  Shield,
  Sparkles,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface MeetingControlsProps {
  micOn: boolean;
  cameraOn: boolean;
  micAllowed: boolean;
  cameraAllowed: boolean;
  sharing: boolean;
  participantsOpen: boolean;
  chatOpen: boolean;
  reactOpen: boolean;
  transcriptOpen: boolean;
  galleryView: boolean;
  unreadChat: number;
  participantCount: number;
  isHost: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleShare: () => void;
  onToggleParticipants: () => void;
  onToggleChat: () => void;
  onToggleReact: () => void;
  onToggleTranscript: () => void;
  onToggleGallery: () => void;
  onEnd: () => void;
}

export function MeetingControls(props: MeetingControlsProps) {
  return (
    <footer className="meeting-toolbar flex w-full items-end justify-center gap-1 px-2 pb-3 pt-2 sm:gap-2 sm:px-4">
      <div className="flex max-w-5xl flex-1 items-end justify-center gap-0.5 overflow-x-auto sm:gap-1">
        <ToolbarControl
          label={props.micAllowed ? (props.micOn ? "Mute" : "Unmute") : "Mute"}
          icon={props.micOn && props.micAllowed ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5 text-red-400" />}
          active={props.micOn && props.micAllowed}
          disabled={!props.micAllowed}
          onClick={props.onToggleMic}
          chevron
        />
        <ToolbarControl
          label={props.cameraAllowed ? "Video" : "Video"}
          icon={props.cameraOn && props.cameraAllowed ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5 text-red-400" />}
          active={props.cameraOn && props.cameraAllowed}
          disabled={!props.cameraAllowed}
          onClick={props.onToggleCamera}
          chevron
        />
        <ToolbarControl
          label="Participants"
          icon={<Users className="h-5 w-5" />}
          active={props.participantsOpen}
          onClick={props.onToggleParticipants}
          badge={props.participantCount}
          chevron
        />
        <ToolbarControl
          label="Chat"
          icon={<MessageSquare className="h-5 w-5" />}
          active={props.chatOpen}
          onClick={props.onToggleChat}
          badge={props.unreadChat > 0 ? props.unreadChat : undefined}
          chevron
        />
        <ToolbarControl
          label="React"
          icon={<Heart className="h-5 w-5" />}
          active={props.reactOpen}
          onClick={props.onToggleReact}
          chevron
        />
        <ToolbarControl
          label="Share"
          icon={<MonitorUp className="h-5 w-5" />}
          active={props.sharing}
          onClick={props.onToggleShare}
          variant="share"
        />
        {props.isHost && (
          <ToolbarControl
            label="Host tools"
            icon={<Shield className="h-5 w-5" />}
            active={false}
            onClick={props.onToggleParticipants}
          />
        )}
        <ToolbarControl
          label="Delta AI"
          icon={<Sparkles className="h-5 w-5" />}
          active={props.transcriptOpen}
          onClick={props.onToggleTranscript}
        />
        <ToolbarControl
          label="Views"
          icon={<LayoutGrid className="h-5 w-5" />}
          active={props.galleryView}
          onClick={props.onToggleGallery}
        />
        <ToolbarControl
          label="More"
          icon={<MoreHorizontal className="h-5 w-5" />}
          active={false}
          onClick={props.onToggleGallery}
        />
      </div>

      <button
        type="button"
        onClick={props.onEnd}
        className="ml-2 flex shrink-0 flex-col items-center gap-1 pb-0.5"
        aria-label="End meeting"
      >
        <span className="grid h-12 w-14 place-items-center rounded-xl bg-red-600 text-white sm:h-14 sm:w-16">
          <PhoneOff className="h-5 w-5" />
        </span>
        <span className="hidden text-[11px] text-white/80 sm:block">End</span>
      </button>
    </footer>
  );
}

function ToolbarControl({
  label,
  icon,
  active,
  disabled,
  onClick,
  chevron,
  badge,
  variant = "default",
}: {
  label: string;
  icon: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  chevron?: boolean;
  badge?: number;
  variant?: "default" | "share";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        "group flex shrink-0 flex-col items-center gap-0.5 disabled:cursor-not-allowed disabled:opacity-40",
      )}
    >
      <span
        className={cn(
          "relative flex h-12 items-center rounded-xl sm:h-14",
          variant === "share"
            ? "bg-[#00a884] px-3 text-white"
            : active
              ? "bg-white/15 px-3 text-white"
              : "bg-transparent px-3 text-white/90 hover:bg-white/10",
        )}
      >
        {icon}
        {badge !== undefined && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#0e72ed] px-1 text-[10px] font-semibold text-white">
            {badge}
          </span>
        )}
        {chevron && (
          <ChevronUp className="ml-0.5 h-3 w-3 opacity-60" />
        )}
      </span>
      <span className="hidden max-w-[4.5rem] truncate text-[10px] text-white/70 sm:block">{label}</span>
    </button>
  );
}
