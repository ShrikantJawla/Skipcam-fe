"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** Same rule as camera constraints: mobile portrait → 9:16, otherwise 16:9. */
function getScreenAspectRatio() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isMobileScreen = Math.min(width, height) < 768;
  const isPortrait = height >= width;
  return isMobileScreen && isPortrait ? 9 / 16 : 16 / 9;
}

interface ScreenAspectFrameProps {
  children: ReactNode;
  className?: string;
}

/**
 * Centers a frame that matches the screen aspect ratio inside its parent.
 * Video fills the frame with object-cover/center — no off-center crop.
 */
export default function ScreenAspectFrame({
  children,
  className = "",
}: ScreenAspectFrameProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;

    const update = () => {
      const pw = el.clientWidth;
      const ph = el.clientHeight;
      if (pw <= 0 || ph <= 0) return;

      const ar = getScreenAspectRatio();
      let width = pw;
      let height = width / ar;
      if (height > ph) {
        height = ph;
        width = height * ar;
      }
      setSize({ width, height });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("orientationchange", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", update);
    };
  }, []);

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
