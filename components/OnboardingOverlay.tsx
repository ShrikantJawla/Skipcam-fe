"use client";

import { BRAND } from "@/lib/brand";

interface OnboardingOverlayProps {
  open: boolean;
  onComplete: () => void;
}

const TIPS = [
  {
    title: "Check your camera",
    body: "You’re about to meet someone live. Make sure your face is lit and centered.",
  },
  {
    title: "Be kind, stay curious",
    body: "No accounts. No profiles. Just a moment — treat it like meeting someone new in person.",
  },
  {
    title: "You’re in control",
    body: "Mute, hide your camera, skip, or report anytime. Your safety comes first.",
  },
] as const;

export default function OnboardingOverlay({
  open,
  onComplete,
}: OnboardingOverlayProps) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-ink/55 p-3 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="animate-rise max-h-[min(90dvh,640px)] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-surface text-ink shadow-2xl sm:rounded-3xl">
        <div className="border-b border-line px-4 py-3 sm:px-5 sm:py-4">
          <p className="font-display text-xs font-semibold tracking-[0.18em] text-signal uppercase">
            Welcome to {BRAND.name}
          </p>
          <h2 className="mt-1 font-display text-xl font-bold tracking-tight sm:text-2xl">
            Quick camera check
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            A few tips, then you’re free to connect.
          </p>
        </div>

        <ol className="space-y-3 px-4 py-4 sm:space-y-4 sm:px-5 sm:py-5">
          {TIPS.map((tip, index) => (
            <li key={tip.title} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-paper-deep font-display text-xs font-bold text-ink-soft">
                {index + 1}
              </span>
              <div>
                <p className="text-sm font-semibold">{tip.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
                  {tip.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="border-t border-line px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-4">
          <button
            type="button"
            onClick={onComplete}
            className="btn btn-primary w-full"
          >
            Looks good — continue
          </button>
        </div>
      </div>
    </div>
  );
}
