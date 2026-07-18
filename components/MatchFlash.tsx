"use client";

interface MatchFlashProps {
  show: boolean;
  momentNumber: number;
}

export default function MatchFlash({ show, momentNumber }: MatchFlashProps) {
  if (!show) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
      <div className="animate-match-flash absolute inset-0 bg-signal/15" />
      <div className="animate-rise rounded-2xl border border-white/15 bg-ink/70 px-6 py-5 text-center shadow-2xl backdrop-blur-xl">
        <p className="font-display text-2xl font-bold tracking-tight text-white">
          You’re connected
        </p>
        <p className="mt-1.5 text-sm text-white/65">
          {momentNumber > 0
            ? `Moment #${momentNumber} — make it count`
            : "Say hello. Keep it kind."}
        </p>
      </div>
    </div>
  );
}
