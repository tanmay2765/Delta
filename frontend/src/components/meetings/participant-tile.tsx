import { MicOff, MonitorUp } from "lucide-react";
import { useEffect, useRef } from "react";
import { DeltaAvatar } from "@/components/ui/delta-avatar";
import { cn } from "@/lib/utils";
import type { Participant } from "@/lib/types";

export function ParticipantTile({
  participant,
  large,
  onClick,
  stream,
  className,
}: {
  participant: Participant;
  large?: boolean;
  onClick?: () => void;
  stream?: MediaStream | null;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const showLiveVideo = participant.cameraOn && stream;
  const playRemoteAudio = !participant.isSelf && participant.micOn && stream;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = showLiveVideo ? stream : null;
  }, [showLiveVideo, stream]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.srcObject = playRemoteAudio && !showLiveVideo ? stream : null;
  }, [playRemoteAudio, showLiveVideo, stream]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Focus ${participant.name}`}
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-linear-to-br from-secondary to-rail text-left transition-all",
        large ? "absolute inset-0 h-full w-full" : "aspect-video w-full",
        participant.speaking
          ? "border-[#00a884]/80 shadow-[0_0_20px_-4px_#00a884]"
          : "border-glass-border",
        className,
      )}
    >
      <span className="absolute inset-0 grid place-items-center">
        {showLiveVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={participant.isSelf}
            className={cn("h-full w-full object-cover", participant.isSelf && "mirror")}
          />
        ) : participant.cameraOn ? (
          <DeltaAvatar name={participant.name} size={large ? "xl" : "lg"} />
        ) : (
          <span className="flex flex-col items-center gap-2 text-muted-foreground">
            <DeltaAvatar
              name={participant.name}
              size={large ? "lg" : "md"}
              className="opacity-60"
            />
            <span className="text-xs">Camera off</span>
          </span>
        )}
      </span>

      {playRemoteAudio && !showLiveVideo && (
        <audio ref={audioRef} autoPlay playsInline className="hidden" />
      )}

      <span className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 rounded-lg bg-rail/70 px-2.5 py-1.5 backdrop-blur-md">
        <span className="truncate text-xs font-medium">
          {participant.name}
          {participant.isHost && <span className="text-muted-foreground"> · Host</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {participant.sharingScreen && <MonitorUp className="h-3.5 w-3.5 text-primary-glow" />}
          {!participant.micOn && <MicOff className="h-3.5 w-3.5 text-destructive" />}
        </span>
      </span>
    </button>
  );
}
