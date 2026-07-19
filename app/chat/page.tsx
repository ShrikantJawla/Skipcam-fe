"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import ChatPanel from "@/components/ChatPanel";
import DraggablePip from "@/components/DraggablePip";
import MatchFlash from "@/components/MatchFlash";
import OnboardingOverlay from "@/components/OnboardingOverlay";
import ReactionBurst, { ReactionBar } from "@/components/ReactionBurst";
import VideoBox from "@/components/VideoBox";
import WaitingScene from "@/components/WaitingScene";
import { useWebRTC } from "@/hooks/useWebRTC";
import { BRAND } from "@/lib/brand";
import {
  QUEUE_LINES,
  REACTIONS,
  WAITING_TIPS,
  type FloatingReaction,
  type ReactionEmoji,
} from "@/lib/delight";
import { getMoments, recordMoment, type MomentsStats } from "@/lib/moments";
import { completeOnboarding, hasCompletedOnboarding } from "@/lib/onboarding";

const STATUS_COPY = {
  idle: "Camera ready",
  waiting: "Searching…",
  connecting: "Connecting…",
  connected: "In session",
} as const;

const STATUS_HINT = {
  idle: "Start matching when you’re ready.",
  waiting: "Stay on this page — a partner will join soon.",
  connecting: "Matched — setting up your private video line.",
  connected: "Mute, hide camera, chat, or skip anytime.",
} as const;

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function StatusDot({ status }: { status: keyof typeof STATUS_COPY }) {
  const color =
    status === "connected"
      ? "bg-emerald-400"
      : status === "waiting" || status === "connecting"
        ? "bg-amber-300 animate-status-pulse"
        : "bg-white/35";

  return <span className={`h-2 w-2 rounded-full ${color}`} />;
}

function ControlButton({
  label,
  active = false,
  danger = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-xl border text-sm transition sm:h-10 sm:w-10 ${
        danger
          ? "border-signal/30 bg-signal/10 text-signal hover:bg-signal/15"
          : active
            ? "border-ink/20 bg-ink text-white"
            : "border-line bg-paper text-ink-soft hover:border-ink/20 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export default function ChatPage() {
  const {
    localVideoRef,
    remoteVideoRef,
    status,
    messages,
    matchFlash,
    incomingReaction,
    micOn,
    cameraOn,
    cameraReady,
    connectionError,
    startMatching,
    nextPartner,
    sendMessage,
    sendReaction,
    toggleMic,
    toggleCamera,
    reportPartner,
    setOnConnected,
  } = useWebRTC();

  const [moments, setMoments] = useState<MomentsStats>({
    total: 0,
    streak: 0,
    lastDay: null,
  });
  const [flashMoment, setFlashMoment] = useState(0);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [queueIndex, setQueueIndex] = useState(0);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const chatEnabled = status === "connected";

  useEffect(() => {
    setMoments(getMoments());
    setShowOnboarding(!hasCompletedOnboarding());
  }, []);

  useEffect(() => {
    const onConnected = () => {
      const next = recordMoment();
      setMoments(next);
      setFlashMoment(next.total);
    };
    setOnConnected(onConnected);
    return () => setOnConnected(null);
  }, [setOnConnected]);

  useEffect(() => {
    if (status !== "connected") {
      setSessionSeconds(0);
      return;
    }
    const started = Date.now();
    const id = window.setInterval(() => {
      setSessionSeconds(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [status]);

  useEffect(() => {
    if (connectionError) setToast(connectionError);
  }, [connectionError]);

  useEffect(() => {
    if (status !== "waiting" && status !== "connecting") return;
    const tipTimer = window.setInterval(() => {
      setTipIndex((i) => (i + 1) % WAITING_TIPS.length);
    }, 4800);
    const queueTimer = window.setInterval(() => {
      setQueueIndex((i) => (i + 1) % QUEUE_LINES.length);
    }, 3200);
    return () => {
      window.clearInterval(tipTimer);
      window.clearInterval(queueTimer);
    };
  }, [status]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(id);
  }, [toast]);

  const pushReaction = useCallback(
    (emoji: ReactionEmoji, from: "me" | "stranger") => {
      const item: FloatingReaction = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        emoji,
        from,
        x: 28 + Math.random() * 44,
      };
      setReactions((current) => [...current.slice(-8), item]);
    },
    [],
  );

  useEffect(() => {
    if (!incomingReaction) return;
    if (!REACTIONS.includes(incomingReaction.emoji as ReactionEmoji)) return;
    pushReaction(incomingReaction.emoji as ReactionEmoji, "stranger");
  }, [incomingReaction, pushReaction]);

  const handleReact = (emoji: ReactionEmoji) => {
    pushReaction(emoji, "me");
    sendReaction(emoji);
  };

  const handleReport = () => {
    const ok = reportPartner("inappropriate");
    if (!ok) return;
    setToast("Thanks — report received");
    if (status === "connected") nextPartner();
  };

  const finishOnboarding = () => {
    completeOnboarding();
    setShowOnboarding(false);
  };

  return (
    <main className="session-shell relative flex h-dvh max-h-dvh flex-col overflow-hidden text-ink">
      <div className="mx-auto flex h-full w-full max-w-[1400px] flex-col px-2.5 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-3 lg:px-6">
        <header className="mb-1.5 flex shrink-0 items-center justify-between gap-2 sm:mb-2.5 sm:gap-3">
          <Link
            href="/"
            className="group flex min-w-0 items-center gap-2 sm:gap-2.5"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-signal font-display text-xs font-bold text-white shadow-sm transition group-hover:bg-signal-deep sm:h-9 sm:w-9 sm:rounded-xl sm:text-sm">
              Z
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-sm font-bold tracking-tight sm:text-base">
                {BRAND.name}
              </span>
              <span className="hidden truncate text-xs text-ink-soft sm:block">
                {moments.total > 0
                  ? `${moments.total} moment${moments.total === 1 ? "" : "s"} · streak ${moments.streak}`
                  : "Your next moment starts here"}
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-3">
            {moments.streak > 0 && (
              <div className="hidden items-center gap-1.5 rounded-lg border border-signal/20 bg-signal/5 px-2.5 py-1.5 text-xs font-semibold text-signal sm:flex">
                <span aria-hidden>✦</span>
                {moments.streak}-day streak
              </div>
            )}

            <div className="flex items-center gap-1.5 rounded-lg border border-line/80 bg-surface/90 px-2 py-1 text-[11px] font-medium text-ink-soft shadow-sm backdrop-blur sm:gap-2 sm:px-3 sm:py-1.5 sm:text-xs">
              <StatusDot status={status} />
              <span className="hidden sm:inline">{STATUS_COPY[status]}</span>
              <span className="sm:hidden">
                {status === "connected"
                  ? "Live"
                  : status === "waiting" || status === "connecting"
                    ? "Wait"
                    : "Ready"}
              </span>
              {status === "connected" && (
                <span className="tabular-nums text-ink">
                  {formatDuration(sessionSeconds)}
                </span>
              )}
            </div>

            <Link
              href="/"
              className="btn btn-secondary px-2.5! py-1.5! text-xs sm:px-3! sm:py-2! sm:text-sm"
            >
              Leave
            </Link>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(150px,30%)] gap-1.5 sm:gap-2.5 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-none xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-h-0 flex-col gap-1.5 sm:gap-2">
            <section className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-ink/10 bg-stage shadow-[0_20px_50px_-24px_rgba(15,23,42,0.55)] sm:rounded-2xl">
              <div
                className={`absolute inset-0 flex items-center justify-center overflow-hidden rounded-xl bg-black [container-type:size] sm:rounded-2xl ${status === "connected" ? "stage-vignette" : ""}`}
              >
                {/* 16:9 = 960×540 — scales to fit stage on mobile & desktop */}
                <VideoBox
                  videoRef={remoteVideoRef}
                  label="Stranger"
                  fit="contain"
                  placeholder={status !== "connected"}
                  placeholderContent={
                    <div className="h-full w-full bg-black" />
                  }
                  className="rounded-none border-0 bg-black"
                  style={{
                    aspectRatio: "4 / 3",
                    // width: "min(100cqw, 960px, calc(100cqh * 16 / 9))",
                    // height: "auto",
                  }}
                  labelClassName="rounded-md bg-black/50 px-2 py-1 text-[11px] backdrop-blur-sm"
                />
              </div>

              {status !== "connected" && (
                <div className="absolute inset-0 z-20 rounded-xl sm:rounded-2xl">
                  <WaitingScene
                    waiting={status === "waiting" || status === "connecting"}
                    title={
                      status === "connecting"
                        ? "Connecting"
                        : status === "waiting"
                          ? "Finding someone"
                          : BRAND.name
                    }
                    subtitle={
                      status === "connecting"
                        ? "Matched — opening your private video line…"
                        : status === "waiting"
                          ? "Stay here — a partner will join as soon as someone’s ready."
                          : cameraReady
                            ? "Your camera is live. Connect when you’re ready."
                            : "Allow camera access to begin."
                    }
                    queueLine={
                      status === "waiting" ? QUEUE_LINES[queueIndex] : undefined
                    }
                    tip={
                      status === "waiting" || status === "connecting"
                        ? WAITING_TIPS[tipIndex]
                        : undefined
                    }
                  />
                </div>
              )}

              <DraggablePip padding={10}>
                {/* WhatsApp-style self view: small portrait PIP */}
                <div className="relative overflow-hidden rounded-2xl ring-2 ring-white/30 shadow-[0_12px_30px_rgba(0,0,0,0.45)] transition hover:ring-white/50">
                  <VideoBox
                    videoRef={localVideoRef}
                    muted
                    label="You"
                    fit="contain"
                    style={{ aspectRatio: 4 / 3 }}
                    className="h-16 w-auto sm:h-36 md:h-40"
                    videoClassName="pointer-events-none -scale-x-100"
                    labelClassName="bottom-1 left-1 rounded bg-black/55 px-1.5 py-0.5 text-[9px] backdrop-blur-sm sm:bottom-1.5 sm:left-1.5 sm:text-[10px]"
                  />
                  {!cameraOn && (
                    <div className="absolute inset-0 flex items-center justify-center bg-ink/85 text-[9px] font-semibold tracking-wide text-white/70 sm:text-[10px]">
                      OFF
                    </div>
                  )}
                </div>
              </DraggablePip>

              {status === "connected" && (
                <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 rounded-md bg-black/45 px-2 py-1 text-[10px] font-semibold tracking-[0.14em] text-white backdrop-blur-md sm:top-3 sm:left-3 sm:px-2.5 sm:text-[11px]">
                  <span className="h-1.5 w-1.5 animate-status-pulse rounded-full bg-emerald-400" />
                  LIVE
                </div>
              )}

              <ReactionBar enabled={chatEnabled} onReact={handleReact} />
              <ReactionBurst
                items={reactions}
                onDone={(id) =>
                  setReactions((current) => current.filter((r) => r.id !== id))
                }
              />
              <MatchFlash show={matchFlash} momentNumber={flashMoment} />

              {toast && (
                <div className="absolute top-3 left-1/2 z-30 -translate-x-1/2 rounded-lg border border-white/10 bg-ink/80 px-3 py-2 text-xs font-medium text-white backdrop-blur-md">
                  {toast}
                </div>
              )}
            </section>

            <div className="flex shrink-0 items-center justify-between gap-2 rounded-xl border border-line/80 bg-surface px-2 py-2 shadow-sm sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-2.5">
              <div className="flex items-center gap-1 sm:gap-1.5">
                {/* <ControlButton
                  label={micOn ? "Mute microphone" : "Unmute microphone"}
                  active={!micOn}
                  onClick={toggleMic}
                >
                  {micOn ? <MicIcon /> : <MicOffIcon />}
                </ControlButton>
                <ControlButton
                  label={cameraOn ? "Turn camera off" : "Turn camera on"}
                  active={!cameraOn}
                  onClick={toggleCamera}
                >
                  {cameraOn ? <CamIcon /> : <CamOffIcon />}
                </ControlButton> */}
                {status === "connected" && (
                  <ControlButton
                    label="Report user"
                    danger
                    onClick={handleReport}
                  >
                    <FlagIcon />
                  </ControlButton>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {status === "idle" && (
                  <button
                    type="button"
                    onClick={startMatching}
                    disabled={!cameraReady || showOnboarding}
                    className="btn btn-primary min-w-24 px-4! py-2! text-sm disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-28 sm:px-5! sm:py-2.5!"
                  >
                    Connect
                  </button>
                )}

                {(status === "waiting" ||
                  status === "connecting" ||
                  status === "connected") && (
                  <button
                    type="button"
                    onClick={nextPartner}
                    className="btn btn-primary min-w-20 px-4! py-2! text-sm sm:min-w-24 sm:px-5! sm:py-2.5!"
                  >
                    Next
                  </button>
                )}
              </div>
            </div>

            <p className="hidden text-xs text-ink-soft lg:block">
              {STATUS_HINT[status]}
            </p>
          </div>

          <div className="min-h-0 overflow-hidden">
            <ChatPanel
              messages={messages}
              enabled={chatEnabled}
              onSend={sendMessage}
            />
          </div>
        </div>
      </div>

      <OnboardingOverlay open={showOnboarding} onComplete={finishOnboarding} />
    </main>
  );
}

function MicIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z" />
      <path d="M19 11a7 7 0 0 1-14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="m2 2 20 20" />
      <path d="M12 3a3 3 0 0 1 3 3v3" />
      <path d="M9 9v3a3 3 0 0 0 5.1 2.1" />
      <path d="M19 11a7 7 0 0 1-10.6 5.95" />
      <path d="M12 18v3" />
    </svg>
  );
}

function CamIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="3" y="7" width="13" height="10" rx="2" />
      <path d="m16 10 5-3v10l-5-3" />
    </svg>
  );
}

function CamOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="m2 2 20 20" />
      <path d="M7 7H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h9" />
      <path d="m16 12 5-3v7.5" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M5 21V4" />
      <path d="M5 4h11l-1.5 3.5L16 11H5" />
    </svg>
  );
}
