import { Copy, Mail, Users, X } from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { DeltaButton } from "@/components/ui/delta-button";
import { DeltaInput } from "@/components/ui/delta-input";
import { api, inviteLinkFor } from "@/lib/api";
import { cn } from "@/lib/utils";

type InviteTab = "contacts" | "email" | "link";

export function InvitePeopleModal({
  open,
  onClose,
  meetingId,
  inviteCode,
  meetingTitle,
}: {
  open: boolean;
  onClose: () => void;
  meetingId: string;
  inviteCode: string;
  meetingTitle: string;
}) {
  const [tab, setTab] = useState<InviteTab>("email");
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const inviteLink = inviteLinkFor(meetingId, inviteCode);
  const formattedId = meetingId.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");
  const passcode = inviteCode.slice(0, 6).toUpperCase();

  const inviteMutation = useMutation({
    mutationFn: (address: string) => api.inviteToMeeting(meetingId, address),
    onSuccess: (result) => {
      const subject = encodeURIComponent(`Join ${meetingTitle} on Delta`);
      const body = encodeURIComponent(
        `Join "${meetingTitle}" on Delta Meet.\n\nLink: ${result.inviteLink}\nMeeting ID: ${formattedId}\nPasscode: ${passcode}`,
      );
      window.location.href = `mailto:${result.email}?subject=${subject}&body=${body}`;
      setEmail("");
    },
  });

  if (!open) return null;

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-[#2d2d2d] p-6 text-white shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Invite people to join meeting</h2>
            <p className="mt-1 text-sm text-white/60">{formattedId}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/10" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 flex gap-1 rounded-xl bg-[#1a1a1a] p-1">
          {([
            ["contacts", "Contacts", Users],
            ["email", "Email", Mail],
            ["link", "Copy link", Copy],
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm",
                tab === id ? "bg-white/15 text-white" : "text-white/60 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {tab === "contacts" && (
          <div className="rounded-xl border border-white/10 bg-[#1a1a1a] p-4 text-sm text-white/70">
            <p>No contacts synced yet. Use Email or Copy link to invite participants.</p>
          </div>
        )}

        {tab === "email" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) inviteMutation.mutate(email.trim());
            }}
            className="space-y-3"
          >
            <DeltaInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Choose from the list or type to search"
              icon={<Mail className="h-4 w-4" />}
              required
            />
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">
                Passcode: <strong className="text-white">{passcode}</strong>
              </span>
            </div>
            <div className="flex justify-end gap-2">
              <DeltaButton type="button" variant="ghost" onClick={onClose}>Cancel</DeltaButton>
              <DeltaButton type="submit" disabled={inviteMutation.isPending || !email.trim()}>Invite</DeltaButton>
            </div>
          </form>
        )}

        {tab === "link" && (
          <div className="space-y-3">
            <p className="break-all rounded-xl border border-white/10 bg-[#1a1a1a] p-3 text-sm">{inviteLink}</p>
            <div className="flex gap-2">
              <DeltaButton className="flex-1" onClick={handleCopyLink}>
                <Copy className="h-4 w-4" />
                {copied ? "Copied!" : "Copy URL"}
              </DeltaButton>
              <DeltaButton variant="ghost" onClick={onClose}>Cancel</DeltaButton>
            </div>
            <p className="text-xs text-white/50">Passcode: {passcode}</p>
          </div>
        )}
      </div>
    </div>
  );
}
