import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { ScheduleTimeline } from "@/components/dashboard/schedule-timeline";
import { RecentMeetings } from "@/components/dashboard/recent-meetings";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { MeetingCard } from "@/components/dashboard/meeting-card";
import { api } from "@/lib/api";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const { data: upcoming = [] } = useQuery({
    queryKey: ["upcoming-meetings"],
    queryFn: () => api.getUpcomingMeetings(),
  });

  const { data: recent = [] } = useQuery({
    queryKey: ["recent-meetings"],
    queryFn: () => api.getRecentMeetings(),
  });

  const { data: activity = [] } = useQuery({
    queryKey: ["activity"],
    queryFn: () => api.getActivity(),
  });

  // Pick the most imminent meeting, if any
  const nextMeeting = upcoming[0];
  const laterMeetings = upcoming.slice(1, 4);

  return (
    <AppShell title="Dashboard">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Main Content Area */}
        <div className="flex flex-col gap-5">
          <QuickActions />

          {/* Up Next & Activity */}
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold tracking-tight px-1">Up Next</h2>
              {nextMeeting ? (
                <MeetingCard meeting={nextMeeting} />
              ) : (
                <div className="glass-soft flex h-[160px] items-center justify-center rounded-2xl text-muted-foreground text-sm">
                  No upcoming meetings
                </div>
              )}

              {laterMeetings.length > 0 && (
                <div className="mt-2 space-y-3">
                  {laterMeetings.map((m) => (
                    <MeetingCard key={m.id} meeting={m} />
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 h-[300px]">
              <div className="h-full">
                <ActivityChart data={activity} />
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar Area */}
        <div className="flex flex-col gap-5">
          <div className="h-[400px]">
            <ScheduleTimeline meetings={upcoming} />
          </div>
          <div className="h-[340px]">
            <RecentMeetings items={recent} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
