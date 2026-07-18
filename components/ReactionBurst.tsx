"use client";

import { useEffect, useState } from "react";
import type { FloatingReaction, ReactionEmoji } from "@/lib/delight";

type BurstItem = FloatingReaction;

interface ReactionBurstProps {
  items: BurstItem[];
  onDone: (id: string) => void;
}

export default function ReactionBurst({ items, onDone }: ReactionBurstProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {items.map((item) => (
        <ReactionParticle key={item.id} item={item} onDone={onDone} />
      ))}
    </div>
  );
}

function ReactionParticle({
  item,
  onDone,
}: {
  item: BurstItem;
  onDone: (id: string) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDone(item.id), 1400);
    return () => window.clearTimeout(timer);
  }, [item.id, onDone]);

  return (
    <span
      className="animate-reaction-float absolute text-3xl drop-shadow-lg sm:text-4xl"
      style={{
        left: `${item.x}%`,
        bottom: item.from === "me" ? "28%" : "38%",
      }}
      aria-hidden
    >
      {item.emoji}
    </span>
  );
}

interface ReactionBarProps {
  enabled: boolean;
  onReact: (emoji: ReactionEmoji) => void;
}

export function ReactionBar({ enabled, onReact }: ReactionBarProps) {
  const [cooldown, setCooldown] = useState(false);

  if (!enabled) return null;

  return (
    <div className="absolute top-2 right-2 z-20 flex gap-0.5 rounded-lg border border-white/10 bg-ink/45 p-0.5 backdrop-blur-md sm:top-3 sm:right-3 sm:gap-1 sm:rounded-xl sm:p-1">
      {(["👋", "🔥", "😂", "👏", "❤️"] as const).map((emoji) => (
        <button
          key={emoji}
          type="button"
          disabled={cooldown}
          onClick={() => {
            if (cooldown) return;
            onReact(emoji);
            setCooldown(true);
            window.setTimeout(() => setCooldown(false), 450);
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md text-sm transition hover:bg-white/15 active:scale-95 disabled:opacity-50 sm:h-8 sm:w-8 sm:rounded-lg sm:text-base"
          aria-label={`Send ${emoji} reaction`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
