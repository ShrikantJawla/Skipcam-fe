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

interface DraggablePipProps {
  children: ReactNode;
  className?: string;
  /** Padding from stage edges in px */
  padding?: number;
}

export default function DraggablePip({
  children,
  className = "",
  padding = 12,
}: DraggablePipProps) {
  const pipRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);

  // null = use default bottom-right via CSS until first drag/layout
  const [pos, setPos] = useState<Position | null>(null);

  const clampToParent = useCallback(
    (x: number, y: number): Position => {
      const el = pipRef.current;
      const parent = el?.parentElement;
      if (!el || !parent) return { x, y };

      const maxX = parent.clientWidth - el.offsetWidth - padding;
      const maxY = parent.clientHeight - el.offsetHeight - padding;

      return {
        x: Math.min(Math.max(padding, x), Math.max(padding, maxX)),
        y: Math.min(Math.max(padding, y), Math.max(padding, maxY)),
      };
    },
    [padding],
  );

  // Place in bottom-right once sizes are known
  useEffect(() => {
    const el = pipRef.current;
    const parent = el?.parentElement;
    if (!el || !parent || pos !== null) return;

    const place = () => {
      setPos(
        clampToParent(
          parent.clientWidth - el.offsetWidth - padding,
          parent.clientHeight - el.offsetHeight - padding,
        ),
      );
    };

    place();

    const observer = new ResizeObserver(place);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [clampToParent, padding, pos]);

  // Keep inside bounds if the stage resizes after dragging
  useEffect(() => {
    if (pos === null) return;
    const el = pipRef.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;

    const onResize = () => {
      setPos((current) =>
        current ? clampToParent(current.x, current.y) : current,
      );
    };

    const observer = new ResizeObserver(onResize);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [clampToParent, pos]);

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
    setPos(next);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    pipRef.current?.releasePointerCapture(event.pointerId);
  };

  return (
    <div
      ref={pipRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`absolute z-20 touch-none select-none ${pos === null ? "right-3 bottom-3 sm:right-4 sm:bottom-4" : ""} cursor-grab active:cursor-grabbing ${className}`}
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
