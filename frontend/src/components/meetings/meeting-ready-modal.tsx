import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";
import { DeltaButton } from "@/components/ui/delta-button";
import type { CreatedMeeting } from "@/lib/types";

export function MeetingReadyModal({
  meeting,
  title,
  primaryLabel,
  onPrimary,
  onDismiss,
  extraAction,
}: {
  meeting: CreatedMeeting;
  title: string;
  primaryLabel: string;
  onPrimary: () => void;
  onDismiss: () => void;
  extraAction?: { label: string; onClick: () => void };
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(meeting.inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const share = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title: meeting.title, url: meeting.inviteLink }).catch(() => {});
    } else {
      void copy();
    }
  };

  const prettyId = meeting.meetingId.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm"
      onClick={onDismiss}
    >
      <div
        className="glass-panel w-full max-w-md rounded-2xl bg-glass-strong p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Meeting ID: <span className="font-medium text-foreground">{prettyId}</span>
        </p>
        <p className="mt-1 truncate text-sm text-muted-foreground">{meeting.inviteLink}</p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <DeltaButton variant="glass" onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy Invite Link"}
          </DeltaButton>
          <DeltaButton variant="glass" onClick={share}>
            <Share2 className="h-4 w-4" />
            Share
          </DeltaButton>
          {extraAction && (
            <DeltaButton variant="glass" onClick={extraAction.onClick}>
              {extraAction.label}
            </DeltaButton>
          )}
        </div>

        <DeltaButton size="lg" block className="mt-4" onClick={onPrimary}>
          {primaryLabel}
        </DeltaButton>
      </div>
    </div>
  );
}
