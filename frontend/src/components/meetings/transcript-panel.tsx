import { Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { DeltaButton } from "@/components/ui/delta-button";
import type { ChatMessage } from "./meeting-chat-panel";

export function TranscriptPanel({
  messages,
  hostName,
  onClose,
}: {
  messages: ChatMessage[];
  hostName: string;
  onClose: () => void;
}) {
  const [summary, setSummary] = useState<string | null>(null);

  const transcriptLines = useMemo(() => {
    if (messages.length === 0) {
      return [
        {
          speaker: "Speaker 1",
          time: "00:00:01",
          text: "Welcome to the meeting. Delta AI transcript will capture spoken content when live captions are enabled.",
        },
      ];
    }
    return messages.map((m, i) => ({
      speaker: m.senderName,
      time: formatElapsed(i * 8),
      text: m.text,
    }));
  }, [messages]);

  const handleSummarize = () => {
    const joined = transcriptLines.map((l) => `${l.speaker}: ${l.text}`).join(" ");
    setSummary(
      joined.length > 20
        ? `Meeting summary: ${joined.slice(0, 220)}${joined.length > 220 ? "…" : ""}`
        : "Not enough transcript content yet. Keep talking or use chat — Delta AI will summarize once there is more to work with.",
    );
  };

  return (
    <aside className="flex h-full flex-col bg-white text-[#232333]">
      <header className="flex items-center justify-between border-b border-black/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          <Sparkles className="h-4 w-4 text-[#0e72ed]" />
          <h2 className="text-sm font-semibold">{hostName.split(" ")[0]}&apos;s transcript</h2>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-black/5" aria-label="Close transcript">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="no-scrollbar flex-1 space-y-4 overflow-y-auto p-4">
        {transcriptLines.map((line, idx) => (
          <article key={`${line.time}-${idx}`}>
            <div className="mb-1 flex items-center gap-2 text-xs text-black/50">
              <span className="font-medium text-black/70">{line.speaker}</span>
              <span>{line.time}</span>
            </div>
            <p className="text-sm leading-relaxed">{line.text}</p>
          </article>
        ))}

        {summary && (
          <div className="rounded-xl border border-[#0e72ed]/20 bg-[#0e72ed]/5 p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#0e72ed]">AI Summary</p>
            <p className="text-sm leading-relaxed">{summary}</p>
          </div>
        )}
      </div>

      <div className="border-t border-black/10 p-4">
        <DeltaButton className="w-full bg-[#0e72ed] hover:bg-[#0b5cff]" onClick={handleSummarize}>
          <Sparkles className="h-4 w-4" />
          Summarize meeting
        </DeltaButton>
      </div>
    </aside>
  );
}

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
