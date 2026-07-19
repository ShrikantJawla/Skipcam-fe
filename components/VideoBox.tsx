"use client";

import type { CSSProperties, ReactNode, RefObject } from "react";

interface VideoBoxProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  muted?: boolean;
  label?: string;
  placeholder?: boolean;
  placeholderContent?: ReactNode;
  /** cover crops to fill; contain keeps the full face visible across aspect ratios */
  fit?: "cover" | "contain";
  className?: string;
  videoClassName?: string;
  labelClassName?: string;
  style?: CSSProperties;
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
  style,
}: VideoBoxProps) {
  // Always center the stream. Cover fills the frame; contain letterboxes if needed.
  const fitClass =
    fit === "contain"
      ? "object-contain object-center"
      : "object-cover object-center";

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-stage ${className}`}
      style={style}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={`h-full w-full ${placeholder ? "invisible" : ""} ${videoClassName}`}
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
          className={`absolute bottom-2 left-2 text-xs font-medium text-white ${labelClassName}`}
        >
          {label}
        </span>
      )}
    </div>
  );
}
