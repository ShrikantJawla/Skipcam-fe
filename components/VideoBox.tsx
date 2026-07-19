"use client";

import type { ReactNode, RefObject } from "react";

interface VideoBoxProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  muted?: boolean;
  label?: string;
  placeholder?: boolean;
  placeholderContent?: ReactNode;
  /** cover fills the box; contain letterboxes */
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
        className={`block h-full w-full ${fitClass} ${placeholder ? "invisible" : ""} ${videoClassName}`}
      />

      {placeholder && (
        <div className="absolute inset-0">
          {placeholderContent ?? (
            <div className="flex h-full w-full items-center justify-center bg-stage text-sm text-white/50">
              Waiting for stranger...
            </div>
          )}
        </div>
      )}

      {label && !placeholder && (
        <span
          className={`absolute bottom-2 left-2 z-[1] text-xs font-medium text-white ${labelClassName}`}
        >
          {label}
        </span>
      )}
    </div>
  );
}
