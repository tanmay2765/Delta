import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock, Globe } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { DeltaInput, DeltaTextarea, DeltaSelect } from "@/components/ui/delta-input";
import { DeltaButton } from "@/components/ui/delta-button";
import { GlassCard } from "@/components/ui/glass-card";
import { MeetingReadyModal } from "@/components/meetings/meeting-ready-modal";
import { ToggleRow } from "@/components/meetings/toggle-row";
import { api } from "@/lib/api";
import { displayNameFromUser, getStoredUser } from "@/lib/auth-storage";
import type { CreatedMeeting, JoinPolicy } from "@/lib/types";

export const Route = createFileRoute("/schedule")({
  component: ScheduleMeeting,
});

function ScheduleMeeting() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState<string>("10:00");
  const [duration, setDuration] = useState("60");
  const [timezone, setTimezone] = useState("America/New_York");
  const user = getStoredUser();
  const hostName = displayNameFromUser(user, "Host");
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [createdMeeting, setCreatedMeeting] = useState<CreatedMeeting | null>(null);

  const scheduleMutation = useMutation({
    mutationFn: () =>
      api.scheduleMeeting({
        title,
        description,
        host: hostName,
        date,
        startTime: time,
        durationMinutes: parseInt(duration, 10),
        timezone,
        joinPolicy: waitingRoom ? "approval_required" : "open",
      }),
    onSuccess: (data) => {
      setCreatedMeeting(data);
    },
  });

  const handleSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    scheduleMutation.mutate();
  };

  const handleDone = () => {
    setCreatedMeeting(null);
    navigate({ to: "/" });
  };

  return (
    <AppShell title="Schedule Meeting">
      <div className="mx-auto max-w-3xl pt-4 pb-12">
        <GlassCard className="p-6 md:p-8">
          <form onSubmit={handleSchedule} className="flex flex-col gap-8">
            <section>
              <h2 className="text-xl font-semibold tracking-tight mb-5">Basic Information</h2>
              <div className="flex flex-col gap-5">
                <DeltaInput
                  label="Meeting Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What is this meeting about?"
                  required
                />
                <DeltaTextarea
                  label="Description (Optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add an agenda or any other details"
                />
              </div>
            </section>

            <div className="h-px w-full bg-glass-border" />

            <section>
              <h2 className="text-xl font-semibold tracking-tight mb-5">Date & Time</h2>
              <div className="grid gap-5 md:grid-cols-2">
                <DeltaInput
                  type="date"
                  label="Date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  icon={<CalendarIcon className="h-4 w-4" />}
                  required
                />
                <DeltaInput
                  type="time"
                  label="Time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  icon={<Clock className="h-4 w-4" />}
                  required
                />
                <DeltaSelect
                  label="Duration"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="90">1 hour 30 minutes</option>
                  <option value="120">2 hours</option>
                </DeltaSelect>
                <DeltaSelect
                  label="Timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                >
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="Europe/London">London (GMT/BST)</option>
                  <option value="Europe/Paris">Central Europe (CET/CEST)</option>
                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                  <option value="Asia/Kolkata">India Standard Time (IST)</option>
                </DeltaSelect>
              </div>
            </section>

            <div className="h-px w-full bg-glass-border" />

            <section>
              <h2 className="text-xl font-semibold tracking-tight mb-5">Security Options</h2>
              <div className="flex flex-col gap-4">
                <ToggleRow
                  checked={waitingRoom}
                  onChange={setWaitingRoom}
                  label="Enable Waiting Room"
                />
                <p className="text-sm text-muted-foreground ml-15">
                  Only users admitted by the host can join the meeting.
                </p>
              </div>
            </section>

            <div className="mt-4 flex gap-3 justify-end border-t border-glass-border pt-6">
              <DeltaButton type="button" variant="ghost" onClick={() => navigate({ to: "/" })}>
                Cancel
              </DeltaButton>
              <DeltaButton
                type="submit"
                disabled={scheduleMutation.isPending || !title || !date || !time}
              >
                {scheduleMutation.isPending ? "Scheduling..." : "Schedule Meeting"}
              </DeltaButton>
            </div>
          </form>
        </GlassCard>
      </div>

      {createdMeeting && (
        <MeetingReadyModal
          meeting={createdMeeting}
          title="Meeting Scheduled"
          primaryLabel="Done"
          onPrimary={handleDone}
          onDismiss={handleDone}
          extraAction={{
            label: "Add to Calendar",
            onClick: () => {
              // Stub for Add to Calendar functionality
              alert("Added to calendar!");
            },
          }}
        />
      )}
    </AppShell>
  );
}
