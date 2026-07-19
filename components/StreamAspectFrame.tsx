"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useStreamAspectRatio } from "@/hooks/useStreamAspectRatio";

interface StreamAspectFrameProps {
  /** Video whose native width/height define the frame (local or remote stream). */
  videoRef: RefObject<HTMLVideoElement | null>;
  children: ReactNode;
  className?: string;
  fallbackAspect?: number;
}

/**
 * Centers a frame sized to the stream’s real aspect ratio so remote shows the
 * same framing/distance as the sender’s local preview — not the viewer’s screen.
 */
export default function StreamAspectFrame({
  videoRef,
  children,
  className = "",
  fallbackAspect = 16 / 9,
}: StreamAspectFrameProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const aspectRatio = useStreamAspectRatio(videoRef, fallbackAspect);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;

    const update = () => {
      const pw = el.clientWidth;
      const ph = el.clientHeight;
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
  }, [aspectRatio]);

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
