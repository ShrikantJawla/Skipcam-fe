"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useStreamAspectRatio } from "@/hooks/useStreamAspectRatio";

interface StreamAspectFrameProps {
  /** Video whose native width/height define the frame (local or remote stream). */
  videoRef: RefObject<HTMLVideoElement | null>;
  children: ReactNode;
  className?: string;
  fallbackAspect?: number;
  /** Force a display aspect (e.g. 9/16 for vertical). */
  forceAspect?: number;
  /**
   * How much of the stage the frame uses (0–1).
   * Lower = more zoomed out / more padding around the video.
   */
  frameScale?: number;
}

/**
 * Centers a frame for the stream. Defaults to the stream’s real aspect ratio;
 * can force vertical and shrink the frame for a zoomed-out look.
 */
export default function StreamAspectFrame({
  videoRef,
  children,
  className = "",
  fallbackAspect = 9 / 16,
  forceAspect,
  frameScale = 0.88,
}: StreamAspectFrameProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const streamAspect = useStreamAspectRatio(videoRef, fallbackAspect);
  const aspectRatio = forceAspect ?? streamAspect;
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;

    const update = () => {
      const pw = el.clientWidth * frameScale;
      const ph = el.clientHeight * frameScale;
      if (pw <= 0 || ph <= 0) return;

      let width = pw;
      let height = width / aspectRatio;
      if (height > ph) {
        height = ph;
        width = height * aspectRatio;
      }
      setSize({ width, height });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspectRatio, frameScale]);

  return (
    <div
      ref={parentRef}
      className={`absolute inset-0 flex items-center justify-center ${className}`}
    >
      <div
        className="relative overflow-hidden"
        style={
          size.width > 0
            ? { width: size.width, height: size.height }
            : { width: "100%", height: "100%" }
        }
      >
        {children}
      </div>
    </div>
  );
}
