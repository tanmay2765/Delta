import { MicOff, MonitorUp } from "lucide-react";
import { useEffect, useRef } from "react";
import { DeltaAvatar } from "@/components/ui/delta-avatar";
import { cn } from "@/lib/utils";
import type { Participant } from "@/lib/types";

function streamHasLiveTrack(stream: MediaStream | null | undefined, kind: "audio" | "video") {
  return Boolean(
    stream?.getTracks().some((track) => track.kind === kind && track.readyState === "live"),
  );
}

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

  const hasLiveVideo = streamHasLiveTrack(stream, "video");
  const hasLiveAudio = streamHasLiveTrack(stream, "audio");

  const showLiveVideo = participant.isSelf
    ? participant.cameraOn && hasLiveVideo
    : hasLiveVideo;

  const playRemoteAudio = !participant.isSelf && hasLiveAudio;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = showLiveVideo ? stream ?? null : null;
    if (showLiveVideo && !participant.isSelf) {
      // Audio plays through the hidden <audio> element for reliable autoplay.
      video.muted = true;
      void video.play().catch(() => {});
    }
  }, [showLiveVideo, stream, participant.isSelf]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.srcObject = playRemoteAudio ? stream ?? null : null;
    if (playRemoteAudio) {
      void audio.play().catch(() => {});
    }
  }, [playRemoteAudio, stream]);

  useEffect(() => {
    if (!stream || participant.isSelf) return;

    const resume = () => {
      void videoRef.current?.play().catch(() => {});
      void audioRef.current?.play().catch(() => {});
    };

    stream.addEventListener("addtrack", resume);
    resume();
    return () => stream.removeEventListener("addtrack", resume);
  }, [stream, participant.isSelf]);

  const resumePlayback = () => {
    if (participant.isSelf) return;
    void videoRef.current?.play().catch(() => {});
    void audioRef.current?.play().catch(() => {});
  };

  return (
    <button
      type="button"
      onClick={() => {
        resumePlayback();
        onClick?.();
      }}
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
        ) : (
          <span className="flex flex-col items-center gap-2 text-muted-foreground">
            <DeltaAvatar
              name={participant.name}
              size={large ? "lg" : "md"}
              className="opacity-60"
            />
            <span className="text-xs">{participant.cameraOn ? "Connecting video…" : "Camera off"}</span>
          </span>
        )}
      </span>

      {playRemoteAudio && (
        <audio ref={audioRef} autoPlay playsInline className="hidden" />
      )}

      <span className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 rounded-lg bg-rail/70 px-2.5 py-1.5 backdrop-blur-md">
        <span className="truncate text-xs font-medium">
          {participant.name}
          {participant.isHost && <span className="text-muted-foreground"> · Host</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {participant.sharingScreen && <MonitorUp className="h-3.5 w-3.5 text-primary-glow" />}
          {!participant.micOn && !hasLiveAudio && (
            <MicOff className="h-3.5 w-3.5 text-destructive" />
          )}
        </span>
      </span>
    </button>
  );
}
