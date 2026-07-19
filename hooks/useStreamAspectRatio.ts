"use client";

import { useEffect, useState, type RefObject } from "react";

/** Reads the real videoWidth/videoHeight from a playing MediaStream. */
export function useStreamAspectRatio(
  videoRef: RefObject<HTMLVideoElement | null>,
  fallback = 16 / 9,
) {
  const [aspectRatio, setAspectRatio] = useState(fallback);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const read = () => {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w > 0 && h > 0) setAspectRatio(w / h);
    };

    read();
    video.addEventListener("loadedmetadata", read);
    video.addEventListener("resize", read);
    const interval = window.setInterval(read, 500);

    return () => {
      video.removeEventListener("loadedmetadata", read);
      video.removeEventListener("resize", read);
      window.clearInterval(interval);
    };
  }, [videoRef]);

  return aspectRatio;
}
