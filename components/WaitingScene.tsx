"use client";

interface WaitingSceneProps {
  title: string;
  subtitle: string;
  queueLine?: string;
  tip?: string;
  waiting?: boolean;
}

export default function WaitingScene({
  title,
  subtitle,
  queueLine,
  tip,
  waiting = false,
}: WaitingSceneProps) {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden px-6 py-10 text-center">
      <div className="pointer-events-none absolute inset-0">
        <div className="waiting-orb waiting-orb-a" />
        <div className="waiting-orb waiting-orb-b" />
        <div className="waiting-orb waiting-orb-c" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {waiting ? (
          <div className="relative mx-auto mb-5 h-16 w-16">
            <span className="absolute inset-0 animate-ping rounded-full bg-signal/20" />
            <span className="absolute inset-2 animate-pulse-ring rounded-full border border-signal/40" />
            <span className="absolute inset-0 flex items-center justify-center rounded-full border border-white/15 bg-white/5">
              <span className="h-5 w-5 animate-spin-slow rounded-full border-2 border-white/20 border-t-signal" />
            </span>
          </div>
        ) : (
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-signal font-display text-xl font-bold text-white shadow-[0_16px_50px_rgba(225,29,72,0.4)]">
            S
          </div>
        )}

        <p className="font-display py-1 text-2xl font-bold leading-snug tracking-tight text-white sm:text-3xl">
          {title}
        </p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/55">
          {subtitle}
        </p>

        {waiting && queueLine && (
          <p className="mx-auto mt-5 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/75">
            <span className="h-1.5 w-1.5 animate-status-pulse rounded-full bg-amber-300" />
            {queueLine}
          </p>
        )}

        {waiting && tip && (
          <p className="mx-auto mt-4 max-w-xs text-xs leading-relaxed text-white/40">
            {tip}
          </p>
        )}
      </div>
    </div>
  );
}
