const REACTIONS = ["👍", "👏", "❤️", "😂", "😮", "🎉"] as const;

export function ReactionPicker({
  open,
  onPick,
  onClose,
}: {
  open: boolean;
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2">
      <div className="flex items-center gap-1 rounded-full border border-white/10 bg-[#2d2d2d] px-3 py-2 shadow-xl">
        {REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="grid h-9 w-9 place-items-center rounded-full text-xl hover:bg-white/10"
            onClick={() => {
              onPick(emoji);
              onClose();
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FloatingReaction({ emoji }: { emoji: string }) {
  return (
    <span className="pointer-events-none absolute bottom-16 left-1/2 animate-bounce text-4xl">
      {emoji}
    </span>
  );
}
