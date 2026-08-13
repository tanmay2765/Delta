import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ShieldCheck } from "lucide-react";
import { MeetingControls } from "@/components/meetings/meeting-controls";
import { ParticipantTile } from "@/components/meetings/participant-tile";
import { ParticipantsPanel } from "@/components/meetings/participants-panel";
import { MediaPermissionPrompt } from "@/components/meetings/media-permission-prompt";
import { useLocalMedia } from "@/hooks/useLocalMedia";
import { useMeetingRealtime } from "@/hooks/useMeetingRealtime";
import { api, mapMeetingFromBackend } from "@/lib/api";
import {
  clearMeetingSession,
  getMeetingSession,
  setMeetingSession,
  type MeetingSession,
} from "@/lib/meeting-session";
import type { JoinRequest, Meeting, Participant } from "@/lib/types";

export const Route = createFileRoute("/meeting/$meetingId")({
  component: MeetingRoom,
});

function MeetingRoom() {
  const { meetingId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [session, setSession] = useState<MeetingSession | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [meetingEnded, setMeetingEnded] = useState(false);
  const [canUseMedia, setCanUseMedia] = useState(false);

  const {
    stream,
    cameraOn,
    micOn,
    setCameraOn,
    setMicOn,
    stopStream,
    error: mediaError,
    isRequesting,
    requestAccess,
    hasStream,
  } = useLocalMedia(true, true);

  const [sharing, setSharing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const stored = getMeetingSession(meetingId);
      if (!stored?.participantId || !stored.sessionToken) {
        navigate({ to: "/join", search: { id: meetingId } });
        return;
      }

      try {
        const resumed = await api.resumeSession(
          meetingId,
          stored.participantId,
          stored.sessionToken,
        );
        if (cancelled) return;

        if (!resumed.participantId || !resumed.sessionToken) {
          clearMeetingSession(meetingId);
          navigate({ to: "/join", search: { id: meetingId } });
          return;
        }

        const nextSession: MeetingSession = {
          participantId: resumed.participantId,
          displayName: stored.displayName,
          isHost: Boolean(resumed.isHost),
          sessionToken: resumed.sessionToken,
        };
        setMeetingSession(meetingId, nextSession);
        setSession(nextSession);
        setCanUseMedia(Boolean(resumed.isHost || resumed.cameraAllowed || resumed.micAllowed));
        setCameraOn(Boolean(resumed.cameraOn && (resumed.cameraAllowed || resumed.isHost)));
        setMicOn(Boolean(resumed.micOn && (resumed.micAllowed || resumed.isHost)));
        setSessionReady(true);

        if (resumed.isHost) {
          try {
            await api.startMeeting(meetingId, resumed.participantId, resumed.sessionToken);
            queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] });
          } catch {
            // Timer sync will happen via websocket/refetch.
          }
        }
      } catch {
        if (!cancelled) {
          clearMeetingSession(meetingId);
          navigate({ to: "/join", search: { id: meetingId } });
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [meetingId, navigate, queryClient, setCameraOn, setMicOn]);

  const { data: meeting, isLoading } = useQuery({
    queryKey: ["meeting", meetingId, session?.participantId],
    queryFn: () => api.getMeeting(meetingId, session?.participantId),
    enabled: sessionReady && Boolean(session?.participantId),
    refetchInterval: sessionReady ? 15000 : false,
  });

  const handleMeetingUpdate = useCallback(
    (payload: Record<string, unknown>) => {
      if (!session?.participantId) return;
      const mapped = mapMeetingFromBackend(
        payload as Parameters<typeof mapMeetingFromBackend>[0],
        session.participantId,
      );
      queryClient.setQueryData(["meeting", meetingId, session.participantId], mapped);
    },
    [meetingId, queryClient, session?.participantId],
  );

  const handleMeetingEnded = useCallback(() => {
    setMeetingEnded(true);
    stopStream();
    clearMeetingSession(meetingId);
    navigate({ to: "/" });
  }, [meetingId, navigate, stopStream]);

  useMeetingRealtime(meetingId, session, handleMeetingUpdate, handleMeetingEnded);

  const { data: joinRequests = [] } = useQuery({
    queryKey: ["join-requests", meetingId],
    queryFn: () => api.listJoinRequests(meetingId),
    enabled: sessionReady && Boolean(session?.isHost),
    refetchInterval: session?.isHost ? 5000 : false,
  });

  const selfParticipant = useMemo(
    () => meeting?.participants.find((p) => p.isSelf),
    [meeting?.participants],
  );

  useEffect(() => {
    if (!selfParticipant) return;
    const allowedMic = selfParticipant.micAllowed || session?.isHost;
    const allowedCamera = selfParticipant.cameraAllowed || session?.isHost;
    setCanUseMedia(Boolean(allowedMic || allowedCamera));
    if (!allowedMic && micOn) setMicOn(false);
    if (!allowedCamera && cameraOn) setCameraOn(false);
  }, [selfParticipant, session?.isHost, micOn, cameraOn, setMicOn, setCameraOn]);

  useEffect(() => {
    if (!meeting?.startedAt) {
      setTimer(0);
      return;
    }
    const start = new Date(meeting.startedAt).getTime();
    const tick = () => setTimer(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [meeting?.startedAt]);

  useEffect(() => {
    if (meeting?.status === "ended" && !meetingEnded) {
      handleMeetingEnded();
    }
  }, [meeting?.status, meetingEnded, handleMeetingEnded]);

  const syncMedia = useCallback(
    async (nextMic: boolean, nextCamera: boolean) => {
      if (!session?.participantId || !session.sessionToken) return;
      try {
        await api.updateParticipantMedia(meetingId, session.participantId, session.sessionToken, {
          micOn: nextMic,
          cameraOn: nextCamera,
        });
      } catch {
        // Realtime update will reconcile state.
      }
    },
    [meetingId, session?.participantId, session?.sessionToken],
  );

  const handleToggleMic = () => {
    if (!selfParticipant?.micAllowed) return;
    const next = !micOn;
    setMicOn(next);
    void syncMedia(next, cameraOn);
  };

  const handleToggleCamera = () => {
    if (!selfParticipant?.cameraAllowed) return;
    const next = !cameraOn;
    setCameraOn(next);
    void syncMedia(micOn, next);
  };

  const permissionMutation = useMutation({
    mutationFn: ({
      participantId,
      micAllowed,
      cameraAllowed,
    }: {
      participantId: string;
      micAllowed?: boolean;
      cameraAllowed?: boolean;
    }) => {
      if (!session?.participantId || !session.sessionToken) {
        throw new Error("Missing host session");
      }
      return api.updateParticipantPermissions(
        meetingId,
        session.participantId,
        session.sessionToken,
        Number(participantId),
        { micAllowed, cameraAllowed },
      );
    },
  });

  const approveMutation = useMutation({
    mutationFn: (requestId: number) => api.approveJoinRequest(meetingId, requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["join-requests", meetingId] });
    },
  });

  const denyMutation = useMutation({
    mutationFn: (requestId: number) => api.denyJoinRequest(meetingId, requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["join-requests", meetingId] });
    },
  });

  const handleLeave = async () => {
    stopStream();
    if (session?.participantId && session.sessionToken) {
      try {
        await api.leaveMeeting(meetingId, session.participantId, session.sessionToken);
      } catch {
        // Leave locally even if API fails.
      }
    }
    clearMeetingSession(meetingId);
    navigate({ to: "/" });
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (!sessionReady || isLoading || !meeting || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Reconnecting to meeting...</p>
        </div>
      </div>
    );
  }

  const participants: Participant[] = meeting.participants.map((p) => {
    const isSelf = p.id === String(session.participantId);
    return {
      ...p,
      isSelf,
      micOn: isSelf ? micOn : p.micOn,
      cameraOn: isSelf ? cameraOn : p.cameraOn,
      sharingScreen: isSelf ? sharing : p.sharingScreen,
    };
  });

  const joinedParticipants = participants.filter((p) => p.status !== "awaiting");
  const activeSpeaker =
    joinedParticipants.find((p) => p.isSelf) ||
    joinedParticipants.find((p) => p.isHost) ||
    joinedParticipants[0];
  const otherParticipants = joinedParticipants.filter((p) => p.id !== activeSpeaker?.id);

  return (
    <div className="ambient-bg flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <StatusBadge tone="success" dot>
            {meeting.startedAt ? formatTime(timer) : "Waiting for host"}
          </StatusBadge>
          <div className="hidden h-4 w-px bg-glass-border sm:block" />
          <h1 className="hidden text-base font-medium sm:block">{meeting.title}</h1>
          <button
            onClick={() => navigator.clipboard.writeText(meetingId)}
            className="hidden items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-glass hover:text-foreground sm:flex"
            title="Copy Meeting ID"
          >
            {meetingId.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")}
            <Copy className="h-3 w-3" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-1.5 rounded-lg bg-glass px-3 py-1.5 text-xs font-medium text-success sm:flex">
            <ShieldCheck className="h-4 w-4" />
            Encrypted
          </div>
        </div>
      </header>

      <main className="relative flex min-h-0 flex-1 flex-col p-4 pt-0">
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="relative min-h-[320px] flex-1 overflow-hidden rounded-2xl bg-black lg:min-h-0">
            {activeSpeaker && (
              <ParticipantTile
                participant={activeSpeaker}
                large
                stream={activeSpeaker.isSelf ? stream : null}
              />
            )}

            {otherParticipants.length > 0 && (
              <div className="absolute right-3 top-3 flex max-h-[calc(100%-1rem)] w-[160px] flex-col gap-2 overflow-y-auto lg:w-[200px]">
                {otherParticipants.map((p) => (
                  <ParticipantTile key={p.id} participant={p} stream={p.isSelf ? stream : null} />
                ))}
              </div>
            )}
          </div>

          {canUseMedia && !hasStream && (
            <MediaPermissionPrompt
              onEnable={() => void requestAccess()}
              isRequesting={isRequesting}
              error={mediaError}
            />
          )}

          {!canUseMedia && !session.isHost && (
            <p className="text-center text-sm text-muted-foreground">
              Waiting for the host to allow your microphone and camera.
            </p>
          )}

          <div className="mt-auto shrink-0 pt-2 pb-4">
            <MeetingControls
              micOn={micOn}
              cameraOn={cameraOn}
              micAllowed={Boolean(selfParticipant?.micAllowed || session.isHost)}
              cameraAllowed={Boolean(selfParticipant?.cameraAllowed || session.isHost)}
              sharing={sharing}
              recording={recording}
              participantsOpen={participantsOpen}
              chatOpen={chatOpen}
              unreadChat={unreadChat}
              participantCount={joinedParticipants.length}
              onToggleMic={handleToggleMic}
              onToggleCamera={handleToggleCamera}
              onToggleShare={() => setSharing(!sharing)}
              onToggleRecording={() => setRecording(!recording)}
              onToggleParticipants={() => setParticipantsOpen(!participantsOpen)}
              onToggleChat={() => {
                setChatOpen(!chatOpen);
                setUnreadChat(0);
              }}
              onMore={() => {}}
              onLeave={handleLeave}
            />
          </div>
        </div>

        {participantsOpen && (
          <div className="absolute inset-y-0 right-4 z-20 hidden w-[320px] py-0 lg:block">
            <ParticipantsPanel
              participants={participants}
              onClose={() => setParticipantsOpen(false)}
              meetingId={meetingId}
              inviteCode={meeting.inviteCode}
              meetingTitle={meeting.title}
              isHost={Boolean(session.isHost)}
              joinRequests={joinRequests as JoinRequest[]}
              onApproveRequest={(id) => approveMutation.mutate(id)}
              onDenyRequest={(id) => denyMutation.mutate(id)}
              onToggleMicPermission={(participantId, allowed) =>
                permissionMutation.mutate({ participantId, micAllowed: allowed })
              }
              onToggleCameraPermission={(participantId, allowed) =>
                permissionMutation.mutate({ participantId, cameraAllowed: allowed })
              }
            />
          </div>
        )}

        {chatOpen && (
          <div className="absolute inset-y-0 right-4 z-20 hidden w-[320px] py-0 lg:block">
            <aside className="glass-panel flex h-full w-full flex-col rounded-2xl bg-card/70 p-4">
              <div className="flex items-center justify-between gap-2 border-b border-glass-border pb-3">
                <h2 className="text-lg font-semibold tracking-tight">Meeting Chat</h2>
                <button
                  onClick={() => setChatOpen(false)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-glass hover:text-foreground"
                >
                  &times;
                </button>
              </div>
              <div className="flex flex-1 items-center justify-center py-4 text-sm text-muted-foreground">
                Chat is not available yet.
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
