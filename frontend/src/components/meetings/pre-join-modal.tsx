import { Mic, Video } from "lucide-react";
import { DeltaButton } from "@/components/ui/delta-button";

export function PreJoinModal({
  open,
  onEnableMedia,
  onContinueWithoutMedia,
  isRequesting,
  error,
  hostName,
}: {
  open: boolean;
  onEnableMedia: () => void;
  onContinueWithoutMedia: () => void;
  isRequesting?: boolean;
  error?: string | null;
  hostName?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-[#2d2d2d] p-8 text-center shadow-2xl">
        <div className="mx-auto mb-6 flex h-32 w-full max-w-xs items-center justify-center rounded-xl bg-[#1a1a1a]">
          <div className="flex items-center gap-4 text-[#0e72ed]">
            <Video className="h-10 w-10" />
            <Mic className="h-10 w-10" />
          </div>
        </div>

        <h2 className="text-xl font-semibold text-white">
          Do you want people to see and hear you in the meeting?
        </h2>
        <p className="mt-2 text-sm text-white/60">
          {hostName ? `${hostName}'s meeting · ` : ""}
          You can turn off your microphone and camera anytime.
        </p>

        <DeltaButton
          className="mt-6 w-full max-w-sm bg-[#0e72ed] hover:bg-[#0b5cff]"
          onClick={onEnableMedia}
          disabled={isRequesting}
        >
          <Video className="h-4 w-4" />
          {isRequesting ? "Waiting for browser permission..." : "Use microphone and camera"}
        </DeltaButton>

        <button
          type="button"
          onClick={onContinueWithoutMedia}
          className="mt-4 text-sm text-[#6eadff] hover:underline"
        >
          Continue without microphone and camera
        </button>

        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
