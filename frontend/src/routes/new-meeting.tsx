import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { MediaPermissionPrompt } from "@/components/meetings/media-permission-prompt";
import { MediaPreview } from "@/components/meetings/media-preview";
import { ToggleRow } from "@/components/meetings/toggle-row";
import { DeltaInput, DeltaTextarea } from "@/components/ui/delta-input";
import { DeltaButton } from "@/components/ui/delta-button";
import { GlassCard } from "@/components/ui/glass-card";
import { MeetingReadyModal } from "@/components/meetings/meeting-ready-modal";
import { useLocalMedia } from "@/hooks/useLocalMedia";
import { api } from "@/lib/api";
import { displayNameFromUser, getStoredUser } from "@/lib/auth-storage";
import { setMeetingSession } from "@/lib/meeting-session";
import { Video } from "lucide-react";
import type { CreatedMeeting, JoinPolicy } from "@/lib/types";

export const Route = createFileRoute("/new-meeting")({
  ssr: false,
  component: NewMeeting,
});

function NewMeeting() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const hostName = displayNameFromUser(user, "Host");
  const [title, setTitle] = useState("Instant Meeting");
  const [description, setDescription] = useState("");
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [createdMeeting, setCreatedMeeting] = useState<CreatedMeeting | null>(null);
  const { stream, cameraOn, micOn, setCameraOn, setMicOn, requestAccess, hasStream, isRequesting, error: mediaError } = useLocalMedia(true, true);

  const joinPolicy: JoinPolicy = approvalRequired ? "approval_required" : "open";

  const createMeetingMutation = useMutation({
    mutationFn: () =>
      api.createInstantMeeting({
        title,
        description,
        host: hostName,
        cameraOn,
        micOn,
        joinPolicy,
      }),
    onSuccess: (data) => {
      setCreatedMeeting(data);
    },
  });

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    createMeetingMutation.mutate();
  };

  const [enterError, setEnterError] = useState("");

  const handleEnterMeeting = async () => {
    if (!createdMeeting) return;
    setEnterError("");
    try {
      const joined = await api.joinMeeting(createdMeeting.meetingId, hostName, { micOn, cameraOn });
      if (!joined.participantId || !joined.sessionToken) {
        setEnterError("Could not enter meeting. Please try again.");
        return;
      }

      setMeetingSession(createdMeeting.meetingId, {
        participantId: joined.participantId,
        displayName: hostName,
        isHost: true,
        sessionToken: joined.sessionToken,
      });

      navigate({
        to: "/meeting/$meetingId",
        params: { meetingId: createdMeeting.meetingId },
      });
    } catch (err) {
      setEnterError(err instanceof Error ? err.message : "Could not enter meeting.");
    }
  };

  return (
    <AppShell title="New Meeting">
      <div className="mx-auto max-w-4xl pt-4">
        <div className="grid gap-8 lg:grid-cols-2">
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

              <div className="rounded-xl border border-glass-border bg-glass/40 p-4">
                <ToggleRow
                  checked={approvalRequired}
                  onChange={setApprovalRequired}
                  label="Require host approval to join"
                />
                <p className="mt-2 text-sm text-muted-foreground">
                  {approvalRequired
                    ? "People who open your link will wait until you admit them."
                    : "Anyone with the link or meeting ID can join immediately."}
                </p>
              </div>

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
              {createMeetingMutation.isError && (
                <p className="text-sm text-destructive">
                  {createMeetingMutation.error instanceof Error
                    ? createMeetingMutation.error.message
                    : "Could not start meeting. Is the backend running?"}
                </p>
              )}
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
                name={hostName}
                cameraOn={cameraOn}
                micOn={micOn}
                stream={stream}
                onToggleCamera={() => setCameraOn(!cameraOn)}
                onToggleMic={() => setMicOn(!micOn)}
              />
            )}
          </div>
        </div>
      </div>

      {createdMeeting && (
        <>
          {enterError && (
            <p className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-destructive px-4 py-2 text-sm text-white">
              {enterError}
            </p>
          )}
          <MeetingReadyModal
            meeting={createdMeeting}
            title="Meeting Ready"
            primaryLabel="Enter Meeting"
            onPrimary={handleEnterMeeting}
            onDismiss={() => setCreatedMeeting(null)}
          />
        </>
      )}
    </AppShell>
  );
}
