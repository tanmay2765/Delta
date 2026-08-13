import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, ShieldCheck, Users } from "lucide-react";
import { MeetingControls } from "@/components/meetings/meeting-controls";
import { ParticipantTile } from "@/components/meetings/participant-tile";
import { ParticipantsPanel } from "@/components/meetings/participants-panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api";
import { CURRENT_USER } from "@/lib/mock-data";
import type { Participant } from "@/lib/types";

export const Route = createFileRoute("/meeting/$meetingId")({
  component: MeetingRoom,
});

function MeetingRoom() {
  const { meetingId } = Route.useParams();
  const navigate = useNavigate();

  const { data: meeting, isLoading } = useQuery({
    queryKey: ["meeting", meetingId],
    queryFn: () => api.getMeeting(meetingId),
  });

  // Local device state
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [recording, setRecording] = useState(false);

  // UI state
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadChat, setUnreadChat] = useState(2); // Mock initial unread

  // Participants state (simulated)
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [timer, setTimer] = useState(0);

  // Initialize participants once meeting loads
  useEffect(() => {
    if (meeting) {
      // Make sure current user is in the list
      const hasCurrentUser = meeting.participants.some((p) => p.id === CURRENT_USER.id);
      let initialParticipants = [...meeting.participants];

      if (!hasCurrentUser) {
        initialParticipants = [
          {
            id: CURRENT_USER.id,
            name: CURRENT_USER.name,
            micOn,
            cameraOn,
            status: "joined",
            isHost: true,
          },
          ...initialParticipants,
        ];
      }

      setParticipants(initialParticipants);
    }
  }, [meeting]);

  // Sync my local state to the participants list for my tile
  useEffect(() => {
    setParticipants((prev) =>
      prev.map((p) =>
        p.id === CURRENT_USER.id ? { ...p, micOn, cameraOn, sharingScreen: sharing } : p,
      ),
    );
  }, [micOn, cameraOn, sharing]);

  // Meeting timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleLeave = () => {
    navigate({ to: "/" });
  };

  const toggleRemoteMic = (id: string) => {
    setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, micOn: !p.micOn } : p)));
  };

  const toggleRemoteCamera = (id: string) => {
    setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, cameraOn: !p.cameraOn } : p)));
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Joining meeting...</p>
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Meeting Not Found</h1>
          <p className="mt-2 text-muted-foreground">The meeting ID {meetingId} is invalid.</p>
          <button
            onClick={() => navigate({ to: "/" })}
            className="mt-6 rounded-lg bg-primary px-4 py-2 text-primary-foreground"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Active speaker logic (simple mock: just take the first one speaking, or host, or first)
  const joinedParticipants = participants.filter((p) => p.status === "joined");
  const activeSpeaker = joinedParticipants.find((p) => p.speaking) || joinedParticipants[0];
  const otherParticipants = joinedParticipants.filter((p) => p.id !== activeSpeaker?.id);

  return (
    <div className="ambient-bg flex min-h-screen flex-col">
      {/* Top Bar */}
      <header className="flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <StatusBadge tone="success" dot>
            {formatTime(timer)}
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

      {/* Main Content Area */}
      <main className="flex min-h-0 flex-1 gap-4 p-4 pt-0">
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          {/* Video Grid */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
            {/* Active Speaker / Main Stage */}
            {activeSpeaker && (
              <div className="relative flex-1 overflow-hidden rounded-2xl bg-black">
                <ParticipantTile participant={activeSpeaker} large />
              </div>
            )}

            {/* Sidebar / Grid for others */}
            {otherParticipants.length > 0 && (
              <div className="flex shrink-0 flex-row gap-2 overflow-x-auto lg:w-[280px] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">
                {otherParticipants.map((p) => (
                  <div key={p.id} className="w-[160px] shrink-0 lg:w-full">
                    <ParticipantTile participant={p} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Controls Container */}
          <div className="mt-auto shrink-0 pt-2 pb-4">
            <MeetingControls
              micOn={micOn}
              cameraOn={cameraOn}
              sharing={sharing}
              recording={recording}
              participantsOpen={participantsOpen}
              chatOpen={chatOpen}
              unreadChat={unreadChat}
              participantCount={joinedParticipants.length}
              onToggleMic={() => setMicOn(!micOn)}
              onToggleCamera={() => setCameraOn(!cameraOn)}
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

        {/* Side Panels */}
        {participantsOpen && (
          <div className="hidden shrink-0 lg:block lg:w-[320px]">
            <ParticipantsPanel
              participants={participants}
              onToggleMic={toggleRemoteMic}
              onToggleCamera={toggleRemoteCamera}
              onClose={() => setParticipantsOpen(false)}
              onInvite={() => {
                navigator.clipboard.writeText(`https://delta.app/meeting/${meetingId}`);
                alert("Invite link copied to clipboard");
              }}
            />
          </div>
        )}

        {chatOpen && (
          <div className="hidden shrink-0 lg:block lg:w-[320px]">
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
              <div className="flex-1 overflow-y-auto py-4 text-sm text-muted-foreground">
                <div className="flex flex-col gap-3">
                  <div className="rounded-lg bg-glass p-3">
                    <p className="font-medium text-foreground">Sarah Chen</p>
                    <p>Hi everyone! I've attached the slides.</p>
                  </div>
                  <div className="rounded-lg bg-glass p-3">
                    <p className="font-medium text-foreground">Mike Ross</p>
                    <p>Thanks Sarah, looking now.</p>
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t border-glass-border">
                <input
                  type="text"
                  placeholder="Type a message..."
                  className="w-full rounded-xl border border-glass-border bg-glass px-4 py-2.5 text-sm outline-none focus:border-primary/50"
                />
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
