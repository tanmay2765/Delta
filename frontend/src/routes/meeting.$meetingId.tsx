import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Info, LayoutGrid, ShieldCheck } from "lucide-react";
import { MeetingControls } from "@/components/meetings/meeting-controls";
import { ParticipantTile } from "@/components/meetings/participant-tile";
import { ParticipantsPanel } from "@/components/meetings/participants-panel";
import { PreJoinModal } from "@/components/meetings/pre-join-modal";
import { FloatingReaction, ReactionPicker } from "@/components/meetings/reaction-picker";
import { MeetingChatPanel, type ChatMessage } from "@/components/meetings/meeting-chat-panel";
import { TranscriptPanel } from "@/components/meetings/transcript-panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { DeltaAvatar } from "@/components/ui/delta-avatar";
import { displayNameFromUser, getStoredUser } from "@/lib/auth-storage";
import { useLocalMedia } from "@/hooks/useLocalMedia";
import { useMeetingRealtime } from "@/hooks/useMeetingRealtime";
import { useWebRTCMesh, type SignalingMessage } from "@/hooks/useWebRTCMesh";
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
    sharing,
    startScreenShare,
    stopScreenShare,
  } = useLocalMedia(true, true);

  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const [galleryView, setGalleryView] = useState(false);
  const [preJoinSkipped, setPreJoinSkipped] = useState(false);
  const [floatingReaction, setFloatingReaction] = useState<string | null>(null);
  const [unreadChat, setUnreadChat] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
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

  const handleRemoved = useCallback(() => {
    stopStream();
    clearMeetingSession(meetingId);
    navigate({ to: "/" });
  }, [meetingId, navigate, stopStream]);

  const signalingHandlerRef = useRef<(message: SignalingMessage) => void>(() => {});

  const handleChatMessage = useCallback(
    (payload: { from: number; sender_name: string; text: string; sent_at: string }) => {
      const message: ChatMessage = {
        id: `${payload.from}-${payload.sent_at}`,
        senderName: payload.sender_name,
        text: payload.text,
        isSelf: payload.from === session?.participantId,
        sentAt: payload.sent_at,
      };
      setChatMessages((current) => [...current, message]);
      if (!chatOpen) {
        setUnreadChat((count) => count + 1);
      }
    },
    [chatOpen, session?.participantId],
  );

  const { sendSignaling, sendChatMessage, sendReaction } = useMeetingRealtime(
    meetingId,
    session,
    handleMeetingUpdate,
    handleMeetingEnded,
    (message) => signalingHandlerRef.current(message),
    handleChatMessage,
    (payload) => {
      setFloatingReaction(payload.emoji);
      window.setTimeout(() => setFloatingReaction(null), 2500);
    },
    handleRemoved,
  );

  const remoteParticipants = useMemo(
    () =>
      (meeting?.participants ?? [])
        .filter((participant) => participant.id !== String(session?.participantId))
        .map((participant) => ({ id: participant.id })),
    [meeting?.participants, session?.participantId],
  );

  const { remoteStreams, handleSignalingMessage } = useWebRTCMesh(
    session?.participantId,
    hasStream ? stream : null,
    remoteParticipants,
    sendSignaling,
  );

  useEffect(() => {
    signalingHandlerRef.current = (message) => {
      void handleSignalingMessage(message);
    };
  }, [handleSignalingMessage]);

  const { data: joinRequests = [] } = useQuery({
    queryKey: ["join-requests", meetingId],
    queryFn: () => {
      if (!session?.participantId || !session.sessionToken) {
        throw new Error("Missing host session");
      }
      return api.listJoinRequests(meetingId, session.participantId, session.sessionToken);
    },
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
    mutationFn: (requestId: number) => {
      if (!session?.participantId || !session.sessionToken) {
        throw new Error("Missing host session");
      }
      return api.approveJoinRequest(
        meetingId,
        requestId,
        session.participantId,
        session.sessionToken,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["join-requests", meetingId] });
    },
  });

  const denyMutation = useMutation({
    mutationFn: (requestId: number) => {
      if (!session?.participantId || !session.sessionToken) {
        throw new Error("Missing host session");
      }
      return api.denyJoinRequest(
        meetingId,
        requestId,
        session.participantId,
        session.sessionToken,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["join-requests", meetingId] });
    },
  });

  const muteAllMutation = useMutation({
    mutationFn: () => {
      if (!session?.participantId || !session.sessionToken) {
        throw new Error("Missing host session");
      }
      return api.muteAllParticipants(meetingId, session.participantId, session.sessionToken);
    },
  });

  const removeParticipantMutation = useMutation({
    mutationFn: (participantId: string) => {
      if (!session?.participantId || !session.sessionToken) {
        throw new Error("Missing host session");
      }
      return api.removeParticipant(
        meetingId,
        session.participantId,
        session.sessionToken,
        Number(participantId),
      );
    },
  });

  const handleLeave = async () => {
    stopStream();
    if (session?.participantId && session.sessionToken) {
      try {
        if (session.isHost) {
          await api.endMeeting(meetingId, session.participantId, session.sessionToken);
        } else {
          await api.leaveMeeting(meetingId, session.participantId, session.sessionToken);
        }
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

  useEffect(() => {
    if (canUseMedia && !hasStream && !preJoinSkipped) {
      void requestAccess();
    }
  }, [canUseMedia, hasStream, preJoinSkipped, requestAccess]);

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
    };
  });

  const joinedParticipants = participants.filter((p) => p.status !== "awaiting");
  const activeSpeaker =
    joinedParticipants.find((p) => p.isSelf) ||
    joinedParticipants.find((p) => p.isHost) ||
    joinedParticipants[0];
  const otherParticipants = joinedParticipants.filter((p) => p.id !== activeSpeaker?.id);

  const streamForParticipant = (participant: Participant) => {
    if (participant.isSelf) return stream;
    return remoteStreams.get(participant.id) ?? null;
  };

  const showPreJoin = canUseMedia && !hasStream && !preJoinSkipped && !isRequesting;
  const useGallery = galleryView || joinedParticipants.length >= 2;
  const user = getStoredUser();

  return (
    <div className="meeting-room flex h-dvh flex-col overflow-hidden">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4">
        <div className="flex min-w-0 items-center gap-2 text-sm text-white/90">
          <Info className="h-4 w-4 shrink-0 text-white/60" />
          <span className="truncate">{session.displayName}&apos;s Delta Meeting</span>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge tone="success" dot>
            {meeting.startedAt ? formatTime(timer) : "00:00"}
          </StatusBadge>
          <ShieldCheck className="h-4 w-4 text-green-500" />
          <button
            type="button"
            onClick={() => setGalleryView(!galleryView)}
            className="rounded-lg p-1.5 text-white/70 hover:bg-white/10"
            aria-label="Toggle gallery view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <DeltaAvatar name={displayNameFromUser(user, session.displayName)} size="sm" />
        </div>
      </header>

      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="relative min-h-0 flex-1 overflow-hidden bg-[#1a1a1a] p-2">
          {floatingReaction && <FloatingReaction emoji={floatingReaction} />}

          {useGallery ? (
            <div className="grid h-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {joinedParticipants.map((p) => (
                <ParticipantTile
                  key={p.id}
                  participant={{ ...p, speaking: p.id === activeSpeaker?.id }}
                  stream={streamForParticipant(p)}
                />
              ))}
            </div>
          ) : (
            <div className="relative h-full min-h-0">
              {activeSpeaker && (
                <ParticipantTile
                  participant={{ ...activeSpeaker, speaking: true }}
                  large
                  stream={streamForParticipant(activeSpeaker)}
                />
              )}
              {otherParticipants.length > 0 && (
                <div className="absolute right-2 top-2 flex max-h-[calc(100%-1rem)] w-[140px] flex-col gap-2 overflow-y-auto sm:w-[180px]">
                  {otherParticipants.map((p) => (
                    <ParticipantTile key={p.id} participant={p} stream={streamForParticipant(p)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {!canUseMedia && !session.isHost && (
            <p className="absolute inset-x-0 bottom-4 text-center text-sm text-white/60">
              Waiting for the host to allow your microphone and camera.
            </p>
          )}
        </div>

        <div className="relative shrink-0">
          <ReactionPicker
            open={reactOpen}
            onPick={(emoji) => sendReaction(emoji)}
            onClose={() => setReactOpen(false)}
          />
          <MeetingControls
            micOn={micOn}
            cameraOn={cameraOn}
            micAllowed={Boolean(selfParticipant?.micAllowed || session.isHost)}
            cameraAllowed={Boolean(selfParticipant?.cameraAllowed || session.isHost)}
            sharing={sharing}
            participantsOpen={participantsOpen}
            chatOpen={chatOpen}
            reactOpen={reactOpen}
            transcriptOpen={transcriptOpen}
            galleryView={galleryView}
            unreadChat={unreadChat}
            participantCount={joinedParticipants.length}
            isHost={Boolean(session.isHost)}
            onToggleMic={handleToggleMic}
            onToggleCamera={handleToggleCamera}
            onToggleShare={() => {
              if (sharing) void stopScreenShare();
              else void startScreenShare();
            }}
            onToggleParticipants={() => {
              setParticipantsOpen(!participantsOpen);
              setChatOpen(false);
              setTranscriptOpen(false);
            }}
            onToggleChat={() => {
              setChatOpen(!chatOpen);
              setParticipantsOpen(false);
              setTranscriptOpen(false);
              setUnreadChat(0);
            }}
            onToggleReact={() => setReactOpen(!reactOpen)}
            onToggleTranscript={() => {
              setTranscriptOpen(!transcriptOpen);
              setParticipantsOpen(false);
              setChatOpen(false);
            }}
            onToggleGallery={() => setGalleryView(!galleryView)}
            onEnd={handleLeave}
          />
        </div>

        {(participantsOpen || chatOpen || transcriptOpen) && (
          <div className="absolute inset-y-0 right-0 z-20 w-full max-w-[360px] border-l border-white/10 bg-[#2d2d2d] shadow-2xl">
            {participantsOpen && (
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
                onMuteAll={() => muteAllMutation.mutate()}
                onRemoveParticipant={(participantId) => removeParticipantMutation.mutate(participantId)}
              />
            )}
            {chatOpen && (
              <MeetingChatPanel
                messages={chatMessages}
                onSend={sendChatMessage}
                onClose={() => setChatOpen(false)}
              />
            )}
            {transcriptOpen && (
              <TranscriptPanel
                messages={chatMessages}
                hostName={session.displayName}
                onClose={() => setTranscriptOpen(false)}
              />
            )}
          </div>
        )}
      </main>

      <PreJoinModal
        open={showPreJoin}
        hostName={session.displayName}
        onEnableMedia={() => void requestAccess()}
        onContinueWithoutMedia={() => setPreJoinSkipped(true)}
        isRequesting={isRequesting}
        error={mediaError}
      />
    </div>
  );
}
