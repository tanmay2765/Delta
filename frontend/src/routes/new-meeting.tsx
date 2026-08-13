import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { MediaPreview } from "@/components/meetings/media-preview";
import { DeltaInput, DeltaTextarea } from "@/components/ui/delta-input";
import { DeltaButton } from "@/components/ui/delta-button";
import { GlassCard } from "@/components/ui/glass-card";
import { MeetingReadyModal } from "@/components/meetings/meeting-ready-modal";
import { api } from "@/lib/api";
import { CURRENT_USER } from "@/lib/mock-data";
import { Video } from "lucide-react";
import type { CreatedMeeting } from "@/lib/types";

export const Route = createFileRoute("/new-meeting")({
  component: NewMeeting,
});

function NewMeeting() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("Instant Meeting");
  const [description, setDescription] = useState("");
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [createdMeeting, setCreatedMeeting] = useState<CreatedMeeting | null>(null);

  const createMeetingMutation = useMutation({
    mutationFn: () =>
      api.createInstantMeeting({
        title,
        description,
        host: CURRENT_USER.name,
        cameraOn,
        micOn,
      }),
    onSuccess: (data) => {
      setCreatedMeeting(data);
    },
  });

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    createMeetingMutation.mutate();
  };

  const handleEnterMeeting = () => {
    if (createdMeeting) {
      navigate({
        to: "/meeting/$meetingId",
        params: { meetingId: createdMeeting.meetingId },
      });
    }
  };

  return (
    <AppShell title="New Meeting">
      <div className="mx-auto max-w-4xl pt-4">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left Column: Form */}
          <GlassCard className="p-6">
            <h2 className="text-xl font-semibold tracking-tight mb-6">Meeting Details</h2>
            <form onSubmit={handleStart} className="flex flex-col gap-5">
              <DeltaInput
                label="Meeting Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Project Sync"
                required
              />
              <DeltaTextarea
                label="Description (Optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this meeting about?"
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
                  disabled={createMeetingMutation.isPending}
                >
                  <Video className="mr-2 h-4 w-4" />
                  {createMeetingMutation.isPending ? "Starting..." : "Start Meeting"}
                </DeltaButton>
              </div>
            </form>
          </GlassCard>

          {/* Right Column: Preview */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold tracking-tight">Audio & Video</h2>
            <MediaPreview
              name={CURRENT_USER.name}
              cameraOn={cameraOn}
              micOn={micOn}
              onToggleCamera={() => setCameraOn(!cameraOn)}
              onToggleMic={() => setMicOn(!micOn)}
            />
          </div>
        </div>
      </div>

      {createdMeeting && (
        <MeetingReadyModal
          meeting={createdMeeting}
          title="Meeting Ready"
          primaryLabel="Enter Meeting"
          onPrimary={handleEnterMeeting}
          onDismiss={() => setCreatedMeeting(null)}
        />
      )}
    </AppShell>
  );
}
