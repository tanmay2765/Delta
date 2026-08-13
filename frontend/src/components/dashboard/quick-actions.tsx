import { Link } from "@tanstack/react-router";
import { CalendarClock, Link2, Sparkles, VideoIcon } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

export function QuickActions() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Link
        to="/new-meeting"
        className="glow-primary group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-rail p-5 transition-transform hover:-translate-y-0.5"
      >
        <span className="absolute right-4 top-4 grid h-7 w-7 place-items-center rounded-full bg-primary/20 text-primary-glow">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-glass text-primary-glow">
            <VideoIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-medium text-primary-glow">New Meeting</p>
            <p className="text-xl font-semibold tracking-tight">Join instantly</p>
          </div>
        </div>
      </Link>

      <ActionCard
        to="/join"
        icon={<Link2 className="h-5 w-5" />}
        title="Join Meeting"
        subtitle="Meeting ID"
      />
      <ActionCard
        to="/schedule"
        icon={<CalendarClock className="h-5 w-5" />}
        title="Schedule Meeting"
        subtitle="Plan future call"
      />
    </div>
  );
}

function ActionCard({
  to,
  icon,
  title,
  subtitle,
}: {
  to: "/join" | "/schedule";
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <GlassCard variant="soft" className="transition-colors hover:bg-glass-strong" as="div">
      <Link to={to} className="flex h-full items-center gap-4 p-5">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-glass text-foreground">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-lg font-semibold tracking-tight">{title}</span>
          <span className="block truncate text-sm text-muted-foreground">{subtitle}</span>
        </span>
      </Link>
    </GlassCard>
  );
}
