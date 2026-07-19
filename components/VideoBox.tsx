"use client";

import {
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

interface VideoBoxProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  muted?: boolean;
  label?: string;
  placeholder?: boolean;
  placeholderContent?: ReactNode;
  /**
   * cover — crop to fill (PIP)
   * contain — full frame, letterbox
   * fill — full face (contain) + blurred cover behind (best for mobile↔desktop)
   */
  fit?: "cover" | "contain" | "fill";
  className?: string;
  videoClassName?: string;
  labelClassName?: string;
}

export default function VideoBox({
  videoRef,
  muted = false,
  label,
  placeholder = false,
  placeholderContent,
  fit = "cover",
  className = "",
  videoClassName = "",
  labelClassName = "",
}: VideoBoxProps) {
  const blurRef = useRef<HTMLVideoElement>(null);
  const useFill = fit === "fill";

  const fitClass =
    fit === "cover"
      ? "object-cover object-center"
      : "object-contain object-center";

  // Keep blurred backdrop on the same MediaStream as the main remote video
  useEffect(() => {
    if (!useFill || placeholder) return;

    const main = videoRef.current;
    const blur = blurRef.current;
    if (!main || !blur) return;

    const sync = () => {
      const stream = main.srcObject;
      if (!stream) return;
      if (blur.srcObject !== stream) {
        blur.srcObject = stream;
      }
      blur.muted = true;
      void blur.play().catch(() => {});
    };

    sync();
    main.addEventListener("loadedmetadata", sync);
    main.addEventListener("play", sync);
    const timer = window.setInterval(sync, 800);

    return () => {
      main.removeEventListener("loadedmetadata", sync);
      main.removeEventListener("play", sync);
      window.clearInterval(timer);
    };
  }, [useFill, placeholder, videoRef]);

  return (
    <div className={`relative overflow-hidden bg-stage ${className}`}>
      {useFill && !placeholder && (
        <video
          ref={blurRef}
          autoPlay
          playsInline
          muted
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover object-center opacity-80 blur-2xl"
        />
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={`${useFill ? "absolute inset-0 z-[1]" : "relative block"} h-full w-full ${fitClass} ${placeholder ? "invisible" : ""} ${videoClassName}`}
      />

      {placeholder && (
        <div className="absolute inset-0 z-[2]">
          {placeholderContent ?? (
            <div className="flex h-full w-full items-center justify-center bg-stage text-sm text-white/50">
              Waiting for stranger...
            </div>
          )}
        </div>
      )}

      {label && !placeholder && (
        <span
          className={`absolute bottom-2 left-2 z-[3] text-xs font-medium text-white ${labelClassName}`}
        >
          {label}
        </span>
      )}
    </div>
  );
}
