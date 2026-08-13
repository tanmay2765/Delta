import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MediaPermissionPrompt } from "@/components/meetings/media-permission-prompt";
import { MediaPreview } from "@/components/meetings/media-preview";
import { DeltaInput } from "@/components/ui/delta-input";
import { DeltaButton } from "@/components/ui/delta-button";
import { GlassCard } from "@/components/ui/glass-card";
import { DeltaLogo } from "@/components/ui/delta-logo";
import { useLocalMedia } from "@/hooks/useLocalMedia";
import { api } from "@/lib/api";
import { displayNameFromUser, getStoredUser } from "@/lib/auth-storage";
import { getMeetingSession, setMeetingSession } from "@/lib/meeting-session";
import { setSharedMediaStream } from "@/lib/shared-media";
import { Link2 } from "lucide-react";

type JoinSearch = {
  code?: string;
  id?: string;
};

export const Route = createFileRoute("/join")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): JoinSearch => ({
    code: typeof search.code === "string" ? search.code : undefined,
    id: typeof search.id === "string" ? search.id : undefined,
  }),
  component: JoinMeeting,
});

function JoinMeeting() {
  const navigate = useNavigate();
  const { code, id: presetId } = Route.useSearch();
  const user = getStoredUser();
  const [meetingId, setMeetingId] = useState(presetId ?? "");
  const [name, setName] = useState(displayNameFromUser(user, "Guest"));
  const [error, setError] = useState("");
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const [resolvedMeetingId, setResolvedMeetingId] = useState<string | null>(null);
  const enteringRef = useRef(false);
  const { stream, cameraOn, micOn, setCameraOn, setMicOn, requestAccess, hasStream, isRequesting, error: mediaError } = useLocalMedia(true, true);

  useEffect(() => {
    if (user && !name) {
      setName(displayNameFromUser(user, "Guest"));
    }
  }, [user, name]);

  const inviteQuery = useQuery({
    queryKey: ["invite", code],
    queryFn: () => api.getMeetingByInviteCode(code!),
    enabled: Boolean(code),
  });

  useEffect(() => {
    if (inviteQuery.data) {
      setMeetingId(inviteQuery.data.id);
    }
  }, [inviteQuery.data]);

  const joinMutation = useMutation({
    mutationFn: (id: string) =>
      api.joinMeeting(id, name.trim(), { micOn, cameraOn }),
    onSuccess: (data) => {
      if (data.status === "awaiting_approval") {
        setResolvedMeetingId(data.meetingId);
        setAwaitingApproval(true);
        return;
      }

      if (!data.participantId || !data.sessionToken) {
        setError("Could not join meeting.");
        return;
      }

      setMeetingSession(data.meetingId, {
        participantId: data.participantId,
        displayName: name.trim(),
        isHost: Boolean(data.isHost),
        sessionToken: data.sessionToken,
      });
      if (stream?.active) setSharedMediaStream(stream);
      navigate({
        to: "/meeting/$meetingId",
        params: { meetingId: data.meetingId },
      });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Meeting not found or you can't join.");
    },
  });

  const waitingMeetingId = resolvedMeetingId ?? meetingId.replace(/\D/g, "");
  const admissionQuery = useQuery({
    queryKey: ["admission", waitingMeetingId, name],
    queryFn: async () => {
      const meeting = await api.getMeeting(waitingMeetingId);
      const admitted = meeting.participants.some(
        (p) => p.name.toLowerCase() === name.trim().toLowerCase(),
      );
      return { admitted, meeting };
    },
    enabled: awaitingApproval && waitingMeetingId.length >= 9 && Boolean(name.trim()),
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (!admissionQuery.data?.admitted || !waitingMeetingId || enteringRef.current) return;

    enteringRef.current = true;
    void (async () => {
      try {
        const result = await api.joinMeeting(waitingMeetingId, name.trim(), { micOn, cameraOn });
        if (!result.participantId || !result.sessionToken) {
          enteringRef.current = false;
          return;
        }

        setMeetingSession(waitingMeetingId, {
          participantId: result.participantId,
          displayName: name.trim(),
          isHost: Boolean(result.isHost),
          sessionToken: result.sessionToken,
        });
        if (stream?.active) setSharedMediaStream(stream);
        navigate({
          to: "/meeting/$meetingId",
          params: { meetingId: waitingMeetingId },
        });
      } catch {
        enteringRef.current = false;
      }
    })();
  }, [admissionQuery.data?.admitted, waitingMeetingId, name, micOn, cameraOn, navigate, stream]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    let raw = meetingId.trim();
    if (raw.includes("/meeting/")) {
      raw = raw.split("/meeting/")[1]?.split(/[?#]/)[0] || raw;
    }
    if (raw.includes("code=")) {
      raw = raw.split("code=")[1]?.split("&")[0]?.trim() || raw;
    }

    const digitsOnly = raw.replace(/\D/g, "");
    const identifier =
      digitsOnly.length >= 9 ? digitsOnly : code?.trim() || raw.trim();

    if (!identifier) {
      setError("Please enter a valid meeting ID or invite link.");
      return;
    }

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }

    const sessionKey = digitsOnly.length >= 9 ? digitsOnly : identifier;
    const existing = getMeetingSession(sessionKey);
    if (
      existing?.participantId &&
      existing.sessionToken &&
      existing.displayName.toLowerCase() === name.trim().toLowerCase()
    ) {
      navigate({
        to: "/meeting/$meetingId",
        params: { meetingId: digitsOnly.length >= 9 ? digitsOnly : inviteQuery.data?.id ?? digitsOnly },
      });
      return;
    }

    joinMutation.mutate(identifier);
  };

  if (awaitingApproval) {
    return (
      <div className="ambient-bg flex min-h-dvh flex-col items-center justify-center px-4">
        <div className="mx-auto max-w-lg text-center">
          <GlassCard className="p-8">
            <h2 className="text-xl font-semibold">Waiting for host to let you in</h2>
            <p className="mt-3 text-muted-foreground">
              The host has enabled approval for this meeting. You&apos;ll join automatically once
              admitted.
            </p>
            <div className="mt-6 flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div className="ambient-bg min-h-dvh">
      <header className="flex items-center justify-between px-6 py-4">
        <Link to="/" className="inline-flex items-center gap-2">
          <DeltaLogo />
        </Link>
        <p className="text-sm text-muted-foreground">No account needed to join</p>
      </header>
      <div className="mx-auto max-w-4xl px-4 pb-12 pt-4">
        <h1 className="mb-8 text-center text-3xl font-semibold tracking-tight">Join a meeting</h1>
        <div className="grid gap-8 lg:grid-cols-2">
          <GlassCard className="p-6">
            <h2 className="text-xl font-semibold tracking-tight mb-6">Join with ID or Link</h2>
            <form onSubmit={handleJoin} className="flex flex-col gap-5">
              <DeltaInput
                label="Meeting ID or Link"
                value={meetingId}
                onChange={(e) => {
                  setMeetingId(e.target.value);
                  setError("");
                }}
                placeholder="e.g. 123 456 789 or invite link"
                error={error}
                icon={<Link2 className="h-4 w-4" />}
                required
              />
              <DeltaInput
                label="Your Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Use a unique name (e.g. Alex, Priya)"
                required
              />
              <div className="mt-4 flex gap-3">
                <DeltaButton
                  type="button"
                  variant="ghost"
                  onClick={() => navigate({ to: "/" })}
                  className="flex-1"
                >
                  Cancel
                </DeltaButton>
                <DeltaButton
                  type="submit"
                  className="flex-1"
                  disabled={joinMutation.isPending || !meetingId || !name}
                >
                  {joinMutation.isPending ? "Joining..." : "Join"}
                </DeltaButton>
              </div>
            </form>
          </GlassCard>

          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold tracking-tight">Audio & Video</h2>
            {!hasStream ? (
              <MediaPermissionPrompt
                onEnable={() => void requestAccess()}
                isRequesting={isRequesting}
                error={mediaError}
              />
            ) : (
              <MediaPreview
                name={name || "You"}
                cameraOn={cameraOn}
                micOn={micOn}
                stream={stream}
                onToggleCamera={() => setCameraOn(!cameraOn)}
                onToggleMic={() => setMicOn(!micOn)}
                statusLabel={joinMutation.isPending ? "Connecting..." : "Ready to join"}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
