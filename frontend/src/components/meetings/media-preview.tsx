import { Mic, MicOff, Video, VideoOff } from "lucide-react";
import { DeltaAvatar } from "@/components/ui/delta-avatar";
import { cn } from "@/lib/utils";

/**
 * Local device preview. Real camera capture is not wired up (no media backend
 * requirement yet) — this renders a faithful placeholder driven by React state.
 */
export function MediaPreview({
  name,
  cameraOn,
  micOn,
  onToggleCamera,
  onToggleMic,
  statusLabel = "Ready to join",
  className,
}: {
  name: string;
  cameraOn: boolean;
  micOn: boolean;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  statusLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-glass-border bg-rail",
        className,
      )}
    >
      <div className="grid aspect-video place-items-center bg-linear-to-br from-secondary to-rail">
        {cameraOn ? (
          <DeltaAvatar name={name} size="xl" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <VideoOff className="h-8 w-8" />
            <span className="text-sm">Camera is off</span>
          </div>
        )}
      </div>

      <div className="absolute right-3 top-3 flex gap-2">
        <PreviewToggle
          active={cameraOn}
          onClick={onToggleCamera}
          label={cameraOn ? "Turn camera off" : "Turn camera on"}
        >
          {cameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
        </PreviewToggle>
        <PreviewToggle
          active={micOn}
          onClick={onToggleMic}
          label={micOn ? "Mute microphone" : "Unmute microphone"}
        >
          {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </PreviewToggle>
      </div>

      <div className="flex items-center justify-center gap-2 bg-rail/90 py-2.5 text-sm text-muted-foreground backdrop-blur-md">
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            micOn || cameraOn ? "bg-success" : "bg-muted-foreground",
          )}
        />
        {statusLabel}
      </div>
    </div>
  );
}

function PreviewToggle({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-lg transition-colors",
        active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}
