"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

type Position = { x: number; y: number };

function samePos(a: Position | null, b: Position | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y;
}

interface DraggablePipProps {
  children: ReactNode;
  className?: string;
  /** Padding from stage edges in px */
  padding?: number;
  /** Extra space reserved at the bottom (e.g. chat input) */
  bottomReserve?: number;
  /** Initial corner before the user drags */
  anchor?: "bottom-right" | "top-right";
}

export default function DraggablePip({
  children,
  className = "",
  padding = 12,
  bottomReserve = 0,
  anchor = "bottom-right",
}: DraggablePipProps) {
  const pipRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const [pos, setPos] = useState<Position | null>(null);

  const clampToParent = useCallback(
    (x: number, y: number): Position => {
      const el = pipRef.current;
      const parent = el?.parentElement;
      if (!el || !parent) return { x, y };

      const maxX = parent.clientWidth - el.offsetWidth - padding;
      const maxY =
        parent.clientHeight - el.offsetHeight - padding - bottomReserve;

      return {
        x: Math.min(Math.max(padding, x), Math.max(padding, maxX)),
        y: Math.min(Math.max(padding, y), Math.max(padding, maxY)),
      };
    },
    [padding, bottomReserve],
  );

  // Single observer — only updates state when x/y actually change (no render loop)
  useEffect(() => {
    const el = pipRef.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;

    let needsDock = true;

    const sync = () => {
      setPos((current) => {
        if (dragging.current && current) {
          const next = clampToParent(current.x, current.y);
          return samePos(current, next) ? current : next;
        }

        if (needsDock || current === null) {
          needsDock = false;
          const x = parent.clientWidth - el.offsetWidth - padding;
          const y =
            anchor === "top-right"
              ? padding
              : parent.clientHeight -
                el.offsetHeight -
                padding -
                bottomReserve;
          const next = clampToParent(x, y);
          return samePos(current, next) ? current : next;
        }

        const next = clampToParent(current.x, current.y);
        return samePos(current, next) ? current : next;
      });
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [anchor, bottomReserve, clampToParent, padding]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const el = pipRef.current;
    if (!el) return;

    dragging.current = true;
    const rect = el.getBoundingClientRect();
    dragOffset.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    el.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const parent = pipRef.current?.parentElement;
    if (!parent) return;

    const parentRect = parent.getBoundingClientRect();
    const next = clampToParent(
      event.clientX - parentRect.left - dragOffset.current.x,
      event.clientY - parentRect.top - dragOffset.current.y,
    );
    setPos((current) => (samePos(current, next) ? current : next));
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    pipRef.current?.releasePointerCapture(event.pointerId);
  };

  const fallbackCorner =
    anchor === "top-right"
      ? "right-3 top-14 sm:right-4 sm:top-4"
      : "right-3 bottom-3 sm:right-4 sm:bottom-4";

  return (
    <div
      ref={pipRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`absolute z-30 touch-none select-none ${pos === null ? fallbackCorner : ""} cursor-grab active:cursor-grabbing ${className}`}
      style={
        pos
          ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
          : undefined
      }
      title="Drag to move"
    >
      {children}
    </div>
  );
}
