"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BRAND } from "@/lib/brand";
import { playSoftTap } from "@/lib/sounds";

const FACES = [
  {
    src: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1600&q=80",
    alt: "People in conversation",
    focus: "object-[center_25%]",
  },
  {
    src: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1600&q=80",
    alt: "Friends talking together",
    focus: "object-center",
  },
  {
    src: "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1600&q=80",
    alt: "People around a table",
    focus: "object-[center_40%]",
  },
] as const;

const STEPS = [
  {
    step: "01",
    title: "Connect",
    body: "Open your camera and join the pool.",
  },
  {
    step: "02",
    title: "Talk",
    body: "A private peer-to-peer line, live.",
  },
  {
    step: "03",
    title: "Skip",
    body: "Next anytime. Fresh face in seconds.",
  },
] as const;

export default function HomeClient() {
  const [faceIndex, setFaceIndex] = useState(0);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;

    const id = window.setInterval(() => {
      setFaceIndex((i) => (i + 1) % FACES.length);
    }, 4200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;

    function onMove(e: PointerEvent) {
      const x = (e.clientX / window.innerWidth - 0.5) * 14;
      const y = (e.clientY / window.innerHeight - 0.5) * 10;
      setParallax({ x, y });
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const leftFace = FACES[faceIndex];
  const rightFace = FACES[(faceIndex + 1) % FACES.length];

  return (
    <div className="bg-paper text-ink">
      {/* Hero — dual-frame composition = the product idea */}
      <section className="relative min-h-[100svh] overflow-hidden bg-ink">
        <div
          className="absolute inset-0 will-change-transform"
          style={{
            transform: `translate3d(${parallax.x * -0.35}px, ${parallax.y * -0.35}px, 0) scale(1.04)`,
          }}
        >
          {/* Left frame — you */}
          <div className="absolute inset-y-0 left-0 w-[52%] overflow-hidden">
            <Image
              key={`L-${leftFace.src}`}
              src={leftFace.src}
              alt={leftFace.alt}
              fill
              priority
              sizes="55vw"
              className={`home-face-swap object-cover ${leftFace.focus}`}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-ink/35 via-transparent to-transparent" />
          </div>

          {/* Right frame — stranger */}
          <div className="absolute inset-y-0 right-0 w-[52%] overflow-hidden">
            <Image
              key={`R-${rightFace.src}`}
              src={rightFace.src}
              alt={rightFace.alt}
              fill
              sizes="55vw"
              className={`home-face-swap object-cover ${rightFace.focus}`}
            />
            <div className="absolute inset-0 bg-gradient-to-l from-ink/35 via-transparent to-transparent" />
          </div>

          {/* Skip seam — the cut between two live frames */}
          <div
            className="home-skip-seam pointer-events-none absolute inset-y-0 left-1/2 z-10 w-px -translate-x-1/2"
            aria-hidden
          />
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-ink/20" />
        <div className="home-hero-grain absolute inset-0" aria-hidden />

        <div className="relative z-20 mx-auto flex min-h-[100svh] w-full max-w-6xl flex-col px-5 py-5 sm:px-8 sm:py-6 lg:px-10">
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-signal font-display text-sm font-bold text-white">
                S
              </span>
              <span className="font-display text-lg font-bold tracking-tight text-white">
                {BRAND.name}
              </span>
            </div>
            <Link
              href="/chat"
              onClick={() => playSoftTap()}
              className="btn btn-primary !px-4 !py-2 text-sm"
            >
              Connect
            </Link>
          </nav>

          <div className="flex flex-1 flex-col justify-end pb-12 pt-28 sm:pb-16">
            <p
              className="home-brand-letters font-display text-[clamp(4.5rem,16vw,9rem)] leading-[0.82] font-extrabold tracking-tight text-white"
              aria-label={BRAND.name}
            >
              {BRAND.name.split("").map((letter, i) => (
                <span
                  key={`${letter}-${i}`}
                  style={{ animationDelay: `${i * 45}ms` }}
                >
                  {letter}
                </span>
              ))}
            </p>

            <p className="animate-rise-delay mt-5 max-w-md text-base leading-relaxed text-white/80 sm:text-lg">
              {BRAND.tagline}. No accounts. Just a live face — and Next when
              you&apos;re done.
            </p>

            <div className="animate-rise-delay-2 mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/chat"
                onClick={() => playSoftTap()}
                className="btn btn-primary"
              >
                Connect now
              </Link>
              <a
                href="#how"
                onClick={() => playSoftTap()}
                className="rounded-lg px-4 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white"
              >
                How it works
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* How it works — big typographic beats */}
      <section
        id="how"
        className="relative overflow-hidden px-5 py-16 sm:px-8 sm:py-24 lg:px-10"
      >
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold tracking-[0.18em] text-signal uppercase">
            How it works
          </p>
          <h2 className="mt-3 max-w-xl font-display text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
            The whole app is three moves.
          </h2>

          <ol className="mt-12 divide-y divide-line border-y border-line">
            {STEPS.map((item, index) => {
              const open = activeStep === index;
              return (
                <li key={item.step}>
                  <button
                    type="button"
                    onClick={() => {
                      playSoftTap();
                      setActiveStep(index);
                    }}
                    onMouseEnter={() => setActiveStep(index)}
                    className="home-beat group flex w-full items-start gap-4 py-6 text-left sm:gap-8 sm:py-8"
                    aria-expanded={open}
                  >
                    <span className="mt-2 font-display text-xs font-semibold tracking-[0.2em] text-ink/30 sm:mt-4">
                      {item.step}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`font-display block font-extrabold tracking-tight transition-colors duration-200 ${
                          open ? "text-signal" : "text-ink"
                        } text-[clamp(2.4rem,8vw,5.5rem)] leading-[0.9]`}
                      >
                        {item.title}
                      </span>
                      <span
                        className={`mt-3 block max-w-md overflow-hidden text-sm leading-relaxed text-ink-soft transition-all duration-300 sm:text-base ${
                          open
                            ? "max-h-24 opacity-100"
                            : "max-h-0 opacity-0 sm:max-h-24 sm:opacity-70"
                        }`}
                      >
                        {item.body}
                      </span>
                    </span>
                    <span
                      className={`mt-3 hidden font-display text-sm font-semibold tracking-wide transition sm:mt-6 sm:block ${
                        open ? "text-signal" : "text-ink/20"
                      }`}
                    >
                      {open ? "●" : "○"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Closing — full-bleed face */}
      <section className="relative min-h-[75svh] overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=2200&q=80"
          alt="Two people laughing together"
          fill
          sizes="100vw"
          className="object-cover object-[center_30%]"
        />
        <div className="absolute inset-0 bg-ink/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/50 to-transparent" />

        <div className="relative z-10 mx-auto flex min-h-[75svh] w-full max-w-6xl flex-col justify-end px-5 py-14 sm:px-8 sm:py-20 lg:px-10">
          <p className="font-display text-[clamp(2.8rem,10vw,6rem)] leading-[0.9] font-extrabold tracking-tight text-white">
            Meet.
            <br />
            <span className="text-signal">Skip.</span>
            <br />
            Repeat.
          </p>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-white/75 sm:text-base">
            A private video line between two people. No profiles. No feed. Just
            the next face.
          </p>
          <div className="mt-8">
            <Link
              href="/chat"
              onClick={() => playSoftTap()}
              className="btn btn-primary"
            >
              Start a session
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line bg-paper">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-9 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink font-display text-xs font-bold text-white">
              S
            </span>
            <div>
              <p className="font-display text-sm font-bold text-ink">
                {BRAND.name}
              </p>
              <p className="text-xs text-ink-soft">{BRAND.tagline}</p>
            </div>
          </div>
          <Link
            href="/chat"
            onClick={() => playSoftTap()}
            className="text-sm font-semibold text-ink transition hover:text-signal"
          >
            Connect →
          </Link>
        </div>
      </footer>
    </div>
  );
}
