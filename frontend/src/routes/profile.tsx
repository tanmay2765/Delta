import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { DeltaButton } from "@/components/ui/delta-button";
import { GlassCard } from "@/components/ui/glass-card";
import { DeltaAvatar } from "@/components/ui/delta-avatar";
import { DeltaInput } from "@/components/ui/delta-input";
import {
  clearAuth,
  displayNameFromUser,
  getStoredUser,
  getToken,
  updateStoredUser,
} from "@/lib/auth-storage";
import { api } from "@/lib/api";
import { LogOut } from "lucide-react";

export const Route = createFileRoute("/profile")({
  ssr: false,
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const [authReady, setAuthReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [cachedUser, setCachedUser] = useState<ReturnType<typeof getStoredUser>>(null);

  useEffect(() => {
    const storedToken = getToken();
    setToken(storedToken);
    setCachedUser(getStoredUser());
    setAuthReady(true);

    if (!storedToken) {
      navigate({ to: "/login", search: { redirect: "/profile" } });
    }
  }, [navigate]);

  const {
    data: profile,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.getMe(),
    enabled: authReady && Boolean(token),
    retry: false,
  });

  const [editingField, setEditingField] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState("");

  const updateMutation = useMutation({
    mutationFn: api.updateProfile,
    onSuccess: (user) => {
      updateStoredUser(user);
      setCachedUser(user);
      setEditingField(null);
    },
  });

  useEffect(() => {
    if (!isError || !error || !("status" in error) || error.status !== 401) return;
    clearAuth();
    navigate({ to: "/login", search: { redirect: "/profile" } });
  }, [isError, error, navigate]);

  if (!authReady) {
    return (
      <AppShell title="Profile">
        <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
          Loading profile...
        </div>
      </AppShell>
    );
  }

  if (!token) {
    return null;
  }

  const activeProfile = profile ?? cachedUser;

  if (!activeProfile) {
    return (
      <AppShell title="Profile">
        <div className="mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center gap-4 text-center">
          <p className="text-muted-foreground">
            {isLoading
              ? "Loading profile..."
              : isError
                ? error instanceof Error
                  ? error.message
                  : "Could not load profile."
                : "Profile unavailable."}
          </p>
          {isError && (
            <DeltaButton onClick={() => void refetch()}>Try again</DeltaButton>
          )}
        </div>
      </AppShell>
    );
  }

  const displayName = displayNameFromUser(activeProfile);

  const startEdit = (field: string, current: string) => {
    setEditingField(field);
    setDraftValue(current);
  };

  const saveField = (field: string) => {
    if (field === "phone" && !draftValue.trim()) {
      updateMutation.mutate({ phone: null });
      return;
    }
    updateMutation.mutate({ [field]: draftValue.trim() } as Parameters<typeof api.updateProfile>[0]);
  };

  return (
    <AppShell title="Profile">
      <div className="mx-auto max-w-3xl pt-4 pb-12">
        <GlassCard className="overflow-hidden p-0">
          <div className="border-b border-glass-border px-6 py-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-5">
                <DeltaAvatar name={displayName} size="xl" />
                <div>
                  <h2 className="text-2xl font-semibold">{displayName}</h2>
                  <p className="text-sm text-muted-foreground">{activeProfile.email}</p>
                </div>
              </div>
              <button
                type="button"
                className="text-sm font-medium text-primary hover:text-primary-glow"
                onClick={() => startEdit("full_name", activeProfile.full_name)}
              >
                Edit
              </button>
            </div>
          </div>

          <section className="px-6 py-5">
            <h3 className="mb-4 text-lg font-semibold">Personal information</h3>
            <div className="divide-y divide-glass-border rounded-xl border border-glass-border">
              <ProfileRow
                label="Phone"
                value={activeProfile.phone ?? "Not set"}
                actionLabel={activeProfile.phone ? "Edit" : "Add"}
                onAction={() => startEdit("phone", activeProfile.phone ?? "")}
              />
              <ProfileRow
                label="Language"
                value={activeProfile.language ?? "English"}
                actionLabel="Edit"
                onAction={() => startEdit("language", activeProfile.language ?? "English")}
              />
              <ProfileRow
                label="Time zone"
                value={activeProfile.timezone ?? "Asia/Kolkata"}
                actionLabel="Edit"
                onAction={() => startEdit("timezone", activeProfile.timezone ?? "Asia/Kolkata")}
              />
              <ProfileRow
                label="Date format"
                value={activeProfile.date_format ?? "mm/dd/yyyy"}
                actionLabel="Edit"
                onAction={() => startEdit("date_format", activeProfile.date_format ?? "mm/dd/yyyy")}
              />
              <ProfileRow
                label="Time format"
                value={
                  activeProfile.time_format === "24h"
                    ? "Use 24-hour time"
                    : "Use 12-hour time (Example: 02:00 PM)"
                }
                actionLabel="Edit"
                onAction={() => startEdit("time_format", activeProfile.time_format ?? "12h")}
              />
            </div>
          </section>

          <div className="border-t border-glass-border px-6 py-5">
            <DeltaButton variant="danger" onClick={() => {
              clearAuth();
              navigate({ to: "/login" });
            }}>
              <LogOut className="h-4 w-4" />
              Sign out
            </DeltaButton>
          </div>
        </GlassCard>
      </div>

      {editingField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl bg-card p-6">
            <h3 className="text-lg font-semibold capitalize">
              {editingField === "phone" && !activeProfile.phone ? "Add" : "Edit"} {editingField.replace("_", " ")}
            </h3>
            <div className="mt-4">
              {editingField === "time_format" ? (
                <select
                  value={draftValue}
                  onChange={(e) => setDraftValue(e.target.value)}
                  className="glass-soft h-11 w-full rounded-xl px-3 text-sm"
                >
                  <option value="12h">Use 12-hour time</option>
                  <option value="24h">Use 24-hour time</option>
                </select>
              ) : editingField === "timezone" ? (
                <select
                  value={draftValue}
                  onChange={(e) => setDraftValue(e.target.value)}
                  className="glass-soft h-11 w-full rounded-xl px-3 text-sm"
                >
                  <option value="Asia/Kolkata">(GMT+5:30) Mumbai, Kolkata, New Delhi</option>
                  <option value="America/New_York">(GMT-5:00) Eastern Time</option>
                  <option value="America/Los_Angeles">(GMT-8:00) Pacific Time</option>
                  <option value="Europe/London">(GMT+0:00) London</option>
                </select>
              ) : (
                <DeltaInput
                  value={draftValue}
                  onChange={(e) => setDraftValue(e.target.value)}
                  placeholder={
                    editingField === "phone" ? "+91 98765 43210" : "Enter value"
                  }
                />
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <DeltaButton variant="ghost" onClick={() => setEditingField(null)}>
                Cancel
              </DeltaButton>
              <DeltaButton
                onClick={() => saveField(editingField)}
                disabled={updateMutation.isPending}
              >
                Save
              </DeltaButton>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function ProfileRow({
  label,
  value,
  actionLabel,
  onAction,
}: {
  label: string;
  value: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)_auto] items-center gap-4 px-4 py-4">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
      <button
        type="button"
        onClick={onAction}
        className="text-sm font-medium text-primary hover:text-primary-glow"
      >
        {actionLabel}
      </button>
    </div>
  );
}
