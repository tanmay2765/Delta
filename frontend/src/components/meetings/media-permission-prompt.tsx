import { Mic, Video } from "lucide-react";
import { DeltaButton } from "@/components/ui/delta-button";

export function MediaPermissionPrompt({
  onEnable,
  isRequesting,
  error,
}: {
  onEnable: () => void;
  isRequesting?: boolean;
  error?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-4 text-center">
      <div className="mx-auto flex max-w-md flex-col items-center gap-3">
        <div className="flex gap-2 text-primary-glow">
          <Video className="h-5 w-5" />
          <Mic className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium">Allow camera and microphone</p>
        <p className="text-xs text-muted-foreground">
          Your browser needs permission before video and audio can work in this meeting.
        </p>
        <DeltaButton onClick={onEnable} disabled={isRequesting}>
          {isRequesting ? "Waiting for permission..." : "Enable camera & microphone"}
        </DeltaButton>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
