"use client";

import type { ReactNode, RefObject } from "react";

interface VideoBoxProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  muted?: boolean;
  label?: string;
  placeholder?: boolean;
  placeholderContent?: ReactNode;
  /** cover crops; contain shows the full frame (use for remote on mobile↔desktop) */
  fit?: "cover" | "contain";
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
  const fitClass =
    fit === "contain"
      ? "object-contain object-center"
      : "object-cover object-center";

  return (
    <div className={`relative overflow-hidden bg-stage ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={`absolute inset-0 h-full w-full ${fitClass} ${placeholder ? "opacity-0" : "opacity-100"} ${videoClassName}`}
      />

      {placeholder && (
        <div className="absolute inset-0 z-[1]">
          {placeholderContent ?? (
            <div className="flex h-full w-full items-center justify-center bg-stage text-sm text-white/50">
              Waiting for stranger...
            </div>
          )}
        </div>
      )}

      {label && !placeholder && (
        <span
          className={`absolute bottom-2 left-2 z-[2] text-xs font-medium text-white ${labelClassName}`}
        >
          {label}
        </span>
      )}
    </div>
  );
}
