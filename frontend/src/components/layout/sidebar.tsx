import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Calendar, Home, LogOut, Settings, User, Users, Video } from "lucide-react";
import { DeltaLogo } from "@/components/ui/delta-logo";
import { clearAuth } from "@/lib/auth-storage";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/new-meeting", label: "New meeting", icon: Video },
  { to: "/schedule", label: "Schedule", icon: Calendar },
  { to: "/join", label: "Join", icon: Users },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="hidden w-[84px] shrink-0 flex-col items-center justify-between rounded-3xl bg-rail py-6 lg:flex">
      <div className="flex flex-col items-center gap-8">
        <Link to="/" aria-label="Delta home">
          <DeltaLogo size={38} />
        </Link>
        <nav className="flex flex-col items-center gap-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                aria-label={label}
                title={label}
                className={cn(
                  "grid h-11 w-11 place-items-center rounded-xl transition-colors",
                  active
                    ? "bg-primary/20 text-primary-glow"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
              </Link>
            );
          })}
        </nav>
      </div>

      <button
        type="button"
        onClick={() => {
          clearAuth();
          navigate({ to: "/" });
        }}
        aria-label="Reset session"
        title="Reset session"
        className="grid h-11 w-11 place-items-center rounded-full border border-glass-border text-sidebar-foreground/70 transition-colors hover:text-foreground"
      >
        <LogOut className="h-5 w-5" />
      </button>
    </aside>
  );
}

export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="glass-panel fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-2xl px-2 py-2 lg:hidden">
      {NAV_ITEMS.slice(0, 5).map(({ to, label, icon: Icon }) => {
        const active = pathname === to;
        return (
          <Link
            key={to}
            to={to}
            aria-label={label}
            className={cn(
              "grid h-11 w-11 place-items-center rounded-xl",
              active ? "bg-primary/20 text-primary-glow" : "text-muted-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
          </Link>
        );
      })}
    </nav>
  );
}
