import { Bell, Download, LogOut, Mic, Moon, Search, Settings, Sun, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTheme } from "@/components/layout/theme-provider";
import { DeltaAvatar } from "@/components/ui/delta-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { clearAuth, displayNameFromUser, getStoredUser, type StoredUser } from "@/lib/auth-storage";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function Topbar({ title }: { title: string }) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  const displayName = displayNameFromUser(user, "Guest");
  const firstName = displayName.split(" ")[0];

  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 xl:flex xl:justify-between">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="truncate text-sm text-muted-foreground sm:text-lg">
          {greeting()}, {firstName}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search"
            aria-label="Search Delta"
            className="glass-soft h-11 w-56 rounded-full pl-11 pr-11 text-sm placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/30 xl:w-72"
          />
          <Mic className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="glass-soft grid h-11 w-11 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <button
          type="button"
          aria-label="Notifications"
          className="glass-soft relative grid h-11 w-11 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-primary" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2.5 rounded-full py-1 pr-1 transition-colors hover:bg-glass"
              aria-label="Account menu"
            >
              <DeltaAvatar name={displayName} size="md" />
              <span className="hidden text-sm font-medium sm:block">{displayName}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{displayName}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem disabled className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Install on desktop
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="flex items-center gap-2 text-destructive"
              onClick={() => {
                clearAuth();
                navigate({ to: "/" });
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
