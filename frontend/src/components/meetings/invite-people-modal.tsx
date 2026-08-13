import { Copy, Mail, X } from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { DeltaButton } from "@/components/ui/delta-button";
import { DeltaInput } from "@/components/ui/delta-input";
import { api, inviteLinkFor } from "@/lib/api";

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
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const inviteLink = inviteLinkFor(meetingId, inviteCode);
  const formattedId = meetingId.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");

  const inviteMutation = useMutation({
    mutationFn: (address: string) => api.inviteToMeeting(meetingId, address),
    onSuccess: (result) => {
      const subject = encodeURIComponent(`Join ${meetingTitle} on Delta`);
      const body = encodeURIComponent(
        `Hi,\n\nYou're invited to join "${meetingTitle}" on Delta.\n\n1. Open this link:\n${result.inviteLink}\n\n2. Enter your name when prompted.\n\n3. Allow camera/mic if you want to use them (the host may need to approve first).\n\nMeeting ID (alternative): ${formattedId}`,
      );
      window.location.href = `mailto:${result.email}?subject=${subject}&body=${body}`;
      setEmail("");
    },
  });

  if (!open) return null;

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyId = async () => {
    await navigator.clipboard.writeText(meetingId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="glass-panel w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Invite People</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-glass hover:text-foreground"
            aria-label="Close invite modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-glass-border bg-glass/40 p-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">How your friend joins</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>Enter their email below and click Send Invite.</li>
            <li>Your mail app opens — send the email to them.</li>
            <li>They open the link, enter their name, and click Join.</li>
          </ol>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) inviteMutation.mutate(email.trim());
          }}
          className="flex flex-col gap-3"
        >
          <DeltaInput
            type="email"
            label="Friend's email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@gmail.com"
            icon={<Mail className="h-4 w-4" />}
            required
          />
          <DeltaButton type="submit" disabled={inviteMutation.isPending || !email.trim()}>
            {inviteMutation.isPending ? "Preparing..." : "Send Invite via Email"}
          </DeltaButton>
        </form>

        {inviteMutation.isError && (
          <p className="mt-3 text-sm text-destructive">
            {inviteMutation.error instanceof Error
              ? inviteMutation.error.message
              : "Could not send invite"}
          </p>
        )}

        <div className="mt-5 space-y-3">
          <div className="rounded-xl border border-glass-border bg-glass p-3">
            <p className="text-xs font-medium text-muted-foreground">Join link</p>
            <p className="mt-1 break-all text-sm">{inviteLink}</p>
            <DeltaButton variant="ghost" className="mt-2 w-full" onClick={handleCopyLink}>
              <Copy className="h-4 w-4" />
              {copied ? "Copied!" : "Copy link"}
            </DeltaButton>
          </div>

          <div className="rounded-xl border border-glass-border bg-glass p-3">
            <p className="text-xs font-medium text-muted-foreground">Meeting ID</p>
            <p className="mt-1 text-sm font-medium">{formattedId}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              They can also go to Join Meeting and paste this ID.
            </p>
            <DeltaButton variant="ghost" className="mt-2 w-full" onClick={handleCopyId}>
              <Copy className="h-4 w-4" />
              {copiedId ? "Copied!" : "Copy meeting ID"}
            </DeltaButton>
          </div>
        </div>
      </div>
    </div>
  );
}
