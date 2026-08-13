import { Link } from "@tanstack/react-router";
import { CalendarClock, Link2, Share2, VideoIcon } from "lucide-react";

export function QuickActions() {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Link
        to="/new-meeting"
        className="group flex flex-col items-center justify-center gap-3 rounded-2xl bg-[#0e72ed] p-6 text-center text-white transition-transform hover:-translate-y-0.5 hover:bg-[#0b5cff]"
      >
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15">
          <VideoIcon className="h-7 w-7" />
        </span>
        <span>
          <span className="block text-lg font-semibold">New Meeting</span>
          <span className="block text-sm text-white/80">Start instantly</span>
        </span>
      </Link>

      <ActionCard to="/join" icon={<Link2 className="h-6 w-6" />} title="Join" subtitle="Meeting ID" />
      <ActionCard to="/schedule" icon={<CalendarClock className="h-6 w-6" />} title="Schedule" subtitle="Plan ahead" />
      <button
        type="button"
        onClick={() => void navigator.clipboard.writeText(window.location.origin)}
        className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-glass-border bg-glass p-6 text-center transition-colors hover:bg-glass-strong"
      >
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-glass text-foreground">
          <Share2 className="h-6 w-6" />
        </span>
        <span>
          <span className="block text-lg font-semibold">Share screen</span>
          <span className="block text-sm text-muted-foreground">Copy app link</span>
        </span>
      </button>
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
    <Link
      to={to}
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-glass-border bg-glass p-6 text-center transition-colors hover:bg-glass-strong"
    >
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-foreground">{icon}</span>
      <span>
        <span className="block text-lg font-semibold">{title}</span>
        <span className="block text-sm text-muted-foreground">{subtitle}</span>
      </span>
    </Link>
  );
}
