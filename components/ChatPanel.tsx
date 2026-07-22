"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage } from "@/hooks/useWebRTC";
import { ICEBREAKERS } from "@/lib/delight";

interface ChatPanelProps {
  messages: ChatMessage[];
  enabled: boolean;
  onSend: (text: string) => void;
  /** panel = desktop side chat; overlay = mobile live-call chat */
  variant?: "panel" | "overlay";
}

function formatTime(at: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(at);
}

function pickIcebreakers(seed: number) {
  const start = seed % ICEBREAKERS.length;
  return [
    ICEBREAKERS[start],
    ICEBREAKERS[(start + 2) % ICEBREAKERS.length],
    ICEBREAKERS[(start + 4) % ICEBREAKERS.length],
  ];
}

const OVERLAY_TTL_MS = 5000;
const OVERLAY_MAX_VISIBLE = 4;

export default function ChatPanel({
  messages,
  enabled,
  onSend,
  variant = "panel",
}: ChatPanelProps) {
  const isOverlay = variant === "overlay";
  const [draft, setDraft] = useState("");
  const [usedBreakers, setUsedBreakers] = useState<string[]>([]);
  const [promptSeed, setPromptSeed] = useState(0);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [liveIds, setLiveIds] = useState<Set<string>>(() => new Set());
  const ttlTimers = useRef<Map<string, number>>(new Map());
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const prompts = useMemo(
    () => pickIcebreakers(promptSeed || 1),
    [promptSeed],
  );

  const visibleMessages = isOverlay
    ? messages.filter((m) => liveIds.has(m.id)).slice(-OVERLAY_MAX_VISIBLE)
    : messages;

  useEffect(() => {
    if (!enabled) {
      setUsedBreakers([]);
      return;
    }
    setPromptSeed(Date.now());
    setUsedBreakers([]);
  }, [enabled]);

  useEffect(() => {
    if (!isOverlay) {
      setLiveIds((prev) => (prev.size === 0 ? prev : new Set()));
      for (const t of ttlTimers.current.values()) window.clearTimeout(t);
      ttlTimers.current.clear();
      return;
    }

    for (const message of messages) {
      if (ttlTimers.current.has(message.id)) continue;

      setLiveIds((prev) => {
        if (prev.has(message.id)) return prev;
        const next = new Set(prev);
        next.add(message.id);
        return next;
      });

      const timer = window.setTimeout(() => {
        setLiveIds((prev) => {
          if (!prev.has(message.id)) return prev;
          const next = new Set(prev);
          next.delete(message.id);
          return next;
        });
        ttlTimers.current.delete(message.id);
      }, OVERLAY_TTL_MS);

      ttlTimers.current.set(message.id, timer);
    }
  }, [isOverlay, messages]);

  useEffect(() => {
    return () => {
      for (const t of ttlTimers.current.values()) window.clearTimeout(t);
      ttlTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [liveIds, messages.length]);

  useEffect(() => {
    if (enabled && !isOverlay) inputRef.current?.focus();
  }, [enabled, isOverlay]);

  useEffect(() => {
    if (!isOverlay) return;
    const vv = window.visualViewport;
    if (!vv) return;

    const sync = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardInset((prev) => (prev === inset ? prev : inset));
    };

    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, [isOverlay]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !enabled) return;
    onSend(text);
    setDraft("");
  };

  const sendBreaker = (text: string) => {
    if (!enabled || usedBreakers.includes(text)) return;
    onSend(text);
    setUsedBreakers((current) => [...current, text]);
  };

  const showBreakers = enabled && messages.length === 0;

  // —— WhatsApp-style live call overlay (mobile) ——
  if (isOverlay) {
    return (
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col justify-end"
        style={{
          paddingBottom: `calc(${keyboardInset}px + max(0.5rem, env(safe-area-inset-bottom, 0px)))`,
        }}
      >
        {/* Soft fade into video so bubbles never look hard-clipped */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-14 top-auto h-40 bg-linear-to-t from-black/50 via-black/15 to-transparent"
          aria-hidden
        />

        <div
          ref={listRef}
          className="relative z-1 flex max-h-[38dvh] flex-col justify-end gap-2 overflow-y-auto overscroll-contain px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {visibleMessages.map((message) => {
            const mine = message.from === "me";
            return (
              <div
                key={message.id}
                className={`live-chat-bubble flex w-full ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[14px] leading-snug break-words whitespace-pre-wrap shadow-[0_4px_18px_rgba(0,0,0,0.35)] ${
                    mine
                      ? "rounded-br-md bg-signal text-white"
                      : "rounded-bl-md bg-white/92 text-ink"
                  }`}
                >
                  {message.text}
                </div>
              </div>
            );
          })}
        </div>

        {showBreakers && (
          <div className="pointer-events-auto relative z-1 flex gap-2 overflow-x-auto px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {prompts.slice(0, 2).map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => sendBreaker(prompt)}
                disabled={usedBreakers.includes(prompt)}
                className="max-w-[70vw] shrink-0 truncate rounded-full border border-white/25 bg-black/50 px-3.5 py-2 text-left text-[12px] text-white backdrop-blur-md disabled:opacity-40"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="pointer-events-auto relative z-1 px-3 pb-1 pt-1"
        >
          <div className="flex items-center gap-2 rounded-full border border-white/20 bg-black/60 py-1 pr-1 pl-4 shadow-[0_8px_28px_rgba(0,0,0,0.45)] backdrop-blur-md">
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={!enabled}
              maxLength={500}
              enterKeyHint="send"
              autoComplete="off"
              placeholder={enabled ? "Type a message" : "Waiting…"}
              className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] text-white outline-none placeholder:text-white/45 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!enabled || !draft.trim()}
              aria-label="Send message"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-signal text-white transition enabled:active:scale-95 disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/35"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 translate-x-px"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M22 2 11 13" />
                <path d="m22 2-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-line/80 bg-surface/95 shadow-[0_1px_0_rgba(17,24,39,0.04)] backdrop-blur-sm sm:rounded-2xl">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line/80 px-3 py-2 sm:gap-3 sm:px-4 sm:py-3">
        <div className="min-w-0">
          <p className="font-display text-sm font-bold tracking-tight text-ink">
            Messages
          </p>
          <p className="mt-0.5 hidden truncate text-xs text-ink-soft sm:block">
            {enabled
              ? "Private to this session"
              : "Unlocks when you’re connected"}
          </p>
        </div>
        <span
          className={`inline-flex h-6 items-center rounded-md px-2 text-[10px] font-semibold tracking-wide sm:h-7 sm:text-[11px] ${
            enabled
              ? "bg-emerald-50 text-emerald-700"
              : "bg-paper-deep text-ink-soft"
          }`}
        >
          {enabled ? "Open" : "Idle"}
        </span>
      </header>

      <div
        ref={listRef}
        className="chat-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2.5 sm:space-y-3 sm:px-4 sm:py-4"
      >
        {messages.length === 0 ? (
          <div className="flex h-full min-h-0 flex-col items-center justify-center px-2 text-center">
            <div className="mb-2 hidden h-10 w-10 items-center justify-center rounded-xl bg-paper-deep font-display text-sm font-bold text-ink-soft sm:mb-3 sm:flex">
              Aa
            </div>
            <p className="text-xs font-medium text-ink sm:text-sm">
              {enabled ? "Break the silence" : "Chat is standing by"}
            </p>
            <p className="mt-1 hidden max-w-60 text-xs leading-relaxed text-ink-soft sm:block">
              {enabled
                ? "Tap a starter below, or type your own opener."
                : "Connect with someone to send text while you’re on video."}
            </p>

            {showBreakers && (
              <div className="mt-2 flex w-full flex-col gap-1.5 sm:mt-4 sm:gap-2">
                {prompts.slice(0, 2).map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendBreaker(prompt)}
                    disabled={usedBreakers.includes(prompt)}
                    className="rounded-xl border border-line bg-paper px-2.5 py-2 text-left text-[11px] leading-snug text-ink transition hover:border-signal/40 hover:bg-signal/5 disabled:opacity-40 sm:px-3 sm:py-2.5 sm:text-xs"
                  >
                    {prompt}
                  </button>
                ))}
                {prompts.slice(2).map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendBreaker(prompt)}
                    disabled={usedBreakers.includes(prompt)}
                    className="hidden rounded-xl border border-line bg-paper px-3 py-2.5 text-left text-xs leading-snug text-ink transition hover:border-signal/40 hover:bg-signal/5 disabled:opacity-40 sm:block"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((message) => {
            const mine = message.from === "me";
            return (
              <div
                key={message.id}
                className={`animate-message-in flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] ${mine ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed break-words whitespace-pre-wrap shadow-sm ${
                      mine
                        ? "rounded-br-md bg-signal text-white"
                        : "rounded-bl-md bg-paper-deep text-ink"
                    }`}
                  >
                    {message.text}
                  </div>
                  <p
                    className={`mt-1 px-1 text-[10px] tracking-wide text-ink-soft ${
                      mine ? "text-right" : "text-left"
                    }`}
                  >
                    {mine ? "You" : "Stranger"} · {formatTime(message.at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="shrink-0 border-t border-line/80 bg-paper/40 p-2 sm:p-3"
      >
        <div className="flex items-end gap-2 rounded-xl border border-line bg-surface p-1 shadow-sm transition focus-within:border-signal/40 focus-within:ring-2 focus-within:ring-signal/10 sm:p-1.5">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={!enabled}
            maxLength={500}
            placeholder={
              enabled ? "Write a message…" : "Waiting for a match…"
            }
            className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm text-ink outline-none placeholder:text-ink-soft/70 disabled:cursor-not-allowed disabled:opacity-50 sm:px-2.5 sm:py-2"
          />
          <button
            type="submit"
            disabled={!enabled || !draft.trim()}
            aria-label="Send message"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-signal text-white transition hover:bg-signal-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-soft sm:h-9 sm:w-9"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M22 2 11 13" />
              <path d="m22 2-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </form>
    </aside>
  );
}
