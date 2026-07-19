"use client";

import type { ReactNode, RefObject } from "react";
import DraggablePip from "@/components/DraggablePip";
import VideoBox from "@/components/VideoBox";

interface CallStageProps {
  localVideoRef: RefObject<HTMLVideoElement | null>;
  remoteVideoRef: RefObject<HTMLVideoElement | null>;
  connected: boolean;
  cameraOn: boolean;
  overlay?: ReactNode;
  children?: ReactNode;
}

/**
 * Platform-style 1:1 video call stage (WhatsApp / Zoom / FaceTime):
 * - Before connect: your camera fills the stage (preview)
 * - Connected: partner fills the stage; you move to a floating PIP
 * - Streams use object-cover + center so frames always fill their tiles
 */
export default function CallStage({
  localVideoRef,
  remoteVideoRef,
  connected,
  cameraOn,
  overlay,
  children,
}: CallStageProps) {
  return (
    <section className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-black shadow-[0_20px_50px_-24px_rgba(15,23,42,0.55)] sm:rounded-2xl">
      <div
        className={`absolute inset-0 overflow-hidden ${connected ? "stage-vignette" : ""}`}
      >
        {/* Main tile: partner when live, otherwise your preview */}
        {connected ? (
          <VideoBox
            videoRef={remoteVideoRef}
            fit="cover"
            muted
            className="absolute inset-0 rounded-none border-0 bg-black"
            videoClassName="object-[center_35%]"
            label="Stranger"
            labelClassName="rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium tracking-wide backdrop-blur-sm"
          />
        ) : (
          <VideoBox
            videoRef={localVideoRef}
            fit="cover"
            muted
            className="absolute inset-0 rounded-none border-0 bg-black"
            videoClassName="pointer-events-none -scale-x-100 object-[center_35%]"
          />
        )}

        {!cameraOn && !connected && (
          <div className="absolute inset-0 z-[1] flex items-center justify-center bg-black/80 text-sm font-medium text-white/70">
            Camera off
          </div>
        )}
      </div>

      {overlay}

      {/* Self view PIP — only while in a live call (main tile is already you before that) */}
      {connected && (
        <DraggablePip padding={12}>
          <div className="call-pip relative overflow-hidden rounded-2xl bg-black shadow-[0_8px_28px_rgba(0,0,0,0.55)] ring-2 ring-white/35">
            <VideoBox
              videoRef={localVideoRef}
              fit="cover"
              muted
              label="You"
              className="aspect-[3/4] h-28 w-auto sm:aspect-video sm:h-32 sm:w-52 md:h-36 md:w-60"
              videoClassName="pointer-events-none -scale-x-100 object-[center_35%]"
              labelClassName="bottom-1.5 left-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm"
            />
            {!cameraOn && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/85 text-[10px] font-semibold tracking-wide text-white/75">
                Camera off
              </div>
            )}
          </div>
        </DraggablePip>
      )}

      {children}
    </section>
  );
}
