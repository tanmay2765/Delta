import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";

const TABS = ["General", "Meeting", "Audio & Video", "Notifications"] as const;
type SettingsTab = (typeof TABS)[number];

const STORAGE_KEY = "delta_settings";

type SettingsState = {
  hdVideo: boolean;
  waitingRoom: boolean;
  noiseSuppression: boolean;
  autoMute: boolean;
  showPreview: boolean;
};

const DEFAULTS: SettingsState = {
  hdVideo: true,
  waitingRoom: false,
  noiseSuppression: true,
  autoMute: false,
  showPreview: true,
};

export const Route = createFileRoute("/settings")({
  ssr: false,
  component: SettingsPage,
});

function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>("General");
  const [settings, setSettings] = useState<SettingsState>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      // ignore
    }
  }, []);

  const update = (patch: Partial<SettingsState>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <AppShell title="Settings">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex flex-wrap gap-2 border-b border-glass-border pb-3">
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium",
                tab === item ? "bg-primary/20 text-primary-glow" : "text-muted-foreground hover:bg-glass",
              )}
            >
              {item}
            </button>
          ))}
        </div>

        <GlassCard className="p-0">
          {tab === "General" && (
            <SettingsSection title="General">
              <ToggleRow label="Show pre-meeting preview" description="Display camera preview before joining." value={settings.showPreview} onChange={(v) => update({ showPreview: v })} />
              <ToggleRow label="HD video" description="Send video in high definition when available." value={settings.hdVideo} onChange={(v) => update({ hdVideo: v })} />
            </SettingsSection>
          )}
          {tab === "Meeting" && (
            <SettingsSection title="Meeting">
              <ToggleRow label="Enable waiting room" description="Hold participants until the host admits them." value={settings.waitingRoom} onChange={(v) => update({ waitingRoom: v })} />
              <ToggleRow label="Mute on entry" description="Participants join with microphone muted." value={settings.autoMute} onChange={(v) => update({ autoMute: v })} />
            </SettingsSection>
          )}
          {tab === "Audio & Video" && (
            <SettingsSection title="Audio & Video">
              <ToggleRow label="Background noise removal" description="Reduce background noise from your microphone." value={settings.noiseSuppression} onChange={(v) => update({ noiseSuppression: v })} />
            </SettingsSection>
          )}
          {tab === "Notifications" && (
            <SettingsSection title="Notifications">
              <p className="px-6 py-8 text-sm text-muted-foreground">
                Notification preferences are stored locally for this demo. Connect email/push in a production deployment.
              </p>
            </SettingsSection>
          )}
        </GlassCard>
      </div>
    </AppShell>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="border-b border-glass-border px-6 py-4 text-lg font-semibold">{title}</h2>
      <div className="divide-y divide-glass-border">{children}</div>
    </section>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-6 py-5">
      <div>
        <p className="font-medium">{label}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          value ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform",
            value ? "left-[1.375rem]" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}
