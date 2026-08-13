import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { MediaPreview } from "@/components/meetings/media-preview";
import { DeltaInput } from "@/components/ui/delta-input";
import { DeltaButton } from "@/components/ui/delta-button";
import { GlassCard } from "@/components/ui/glass-card";
import { api } from "@/lib/api";
import { CURRENT_USER } from "@/lib/mock-data";
import { Link2 } from "lucide-react";

export const Route = createFileRoute("/join")({
  component: JoinMeeting,
});

function JoinMeeting() {
  const navigate = useNavigate();
  const [meetingId, setMeetingId] = useState("");
  const [name, setName] = useState(CURRENT_USER.name);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [error, setError] = useState("");

  const joinMutation = useMutation({
    mutationFn: (id: string) => api.joinMeeting(id, name),
    onSuccess: (data) => {
      if (data.ok) {
        navigate({
          to: "/meeting/$meetingId",
          params: { meetingId: data.meetingId },
        });
      } else {
        setError("Failed to join meeting. Please check the ID and try again.");
      }
    },
    onError: () => {
      setError("Meeting not found or you don't have permission to join.");
    },
  });

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Extract meeting ID if user pasted a full link
    let idToJoin = meetingId.trim();
    if (idToJoin.includes("/meeting/")) {
      idToJoin = idToJoin.split("/meeting/")[1] || "";
    }

    // Simple validation
    idToJoin = idToJoin.replace(/\D/g, "");
    if (idToJoin.length < 9) {
      setError("Please enter a valid 9-digit Meeting ID.");
      return;
    }

    joinMutation.mutate(idToJoin);
  };

  return (
    <AppShell title="Join Meeting">
      <div className="mx-auto max-w-4xl pt-4">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left Column: Form */}
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
                placeholder="e.g. 123 456 789 or delta.app/meeting/..."
                error={error}
                icon={<Link2 className="h-4 w-4" />}
                required
              />
              <DeltaInput
                label="Your Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="How you'll appear to others"
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

          {/* Right Column: Preview */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold tracking-tight">Audio & Video</h2>
            <MediaPreview
              name={name || "You"}
              cameraOn={cameraOn}
              micOn={micOn}
              onToggleCamera={() => setCameraOn(!cameraOn)}
              onToggleMic={() => setMicOn(!micOn)}
              statusLabel={joinMutation.isPending ? "Connecting..." : "Ready to join"}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
