import { useEffect, useRef, useState } from "react";
import { DeltaButton } from "@/components/ui/delta-button";
import { DeltaInput } from "@/components/ui/delta-input";

export interface ChatMessage {
  id: string;
  senderName: string;
  text: string;
  isSelf: boolean;
  sentAt: string;
}

export function MeetingChatPanel({
  messages,
  onSend,
  onClose,
}: {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  return (
    <aside className="glass-panel flex h-full w-full flex-col rounded-2xl bg-card/70">
      <div className="flex items-center justify-between gap-2 border-b border-glass-border px-4 py-3">
        <h2 className="text-lg font-semibold tracking-tight">Meeting Chat</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-glass hover:text-foreground"
          aria-label="Close chat"
        >
          &times;
        </button>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet. Say hello to everyone.</p>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={message.isSelf ? "text-right" : "text-left"}>
              <p className="text-xs font-medium text-muted-foreground">{message.senderName}</p>
              <p className="mt-1 inline-block rounded-xl bg-secondary px-3 py-2 text-sm">{message.text}</p>
            </div>
          ))
        )}
      </div>

      <form
        className="flex gap-2 border-t border-glass-border p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const text = draft.trim();
          if (!text) return;
          onSend(text);
          setDraft("");
        }}
      >
        <DeltaInput
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Type a message"
          aria-label="Chat message"
        />
        <DeltaButton type="submit">Send</DeltaButton>
      </form>
    </aside>
  );
}
