"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import {
  moveWallTextEditBox,
  resizeWallTextEditBox,
  WALL_TEXT_EDIT_MAX_WIDTH,
  WALL_TEXT_EDIT_MIN_WIDTH,
} from "@/lib/trending/wall-text-editor-layout";
import type { TrendingWallTextLayout, WallTextNormalizedBox } from "@/lib/trending/wall-text-types";

type BoxControlProps = {
  layout: TrendingWallTextLayout;
  onBoxChange: (box: WallTextNormalizedBox) => void;
};
type Action = "move" | "left" | "right";
type Gesture = {
  action: Action;
  pointerId: number;
  x: number;
  y: number;
  layout: TrendingWallTextLayout;
};

export function WallTextEditOverlay({ children, layout, onBoxChange }: BoxControlProps & { children: ReactNode }) {
  const layerRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const box = layout.textBox;

  function finish(cancel = false) {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    if (cancel && gesture) onBoxChange(gesture.layout.textBox);
    if (gesture && layerRef.current?.hasPointerCapture(gesture.pointerId)) {
      layerRef.current.releasePointerCapture(gesture.pointerId);
    }
    setAction(null);
  }

  useEffect(() => {
    const handleBlur = () => {
      const gesture = gestureRef.current;
      gestureRef.current = null;
      if (gesture && layerRef.current?.hasPointerCapture(gesture.pointerId)) {
        layerRef.current.releasePointerCapture(gesture.pointerId);
      }
      setAction(null);
    };
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, []);

  function begin(event: PointerEvent<HTMLElement>, nextAction: Action) {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    if (gestureRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus();
    layerRef.current?.setPointerCapture(event.pointerId);
    gestureRef.current = { action: nextAction, pointerId: event.pointerId, x: event.clientX, y: event.clientY, layout };
    setAction(nextAction);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    const frame = layerRef.current?.parentElement?.getBoundingClientRect();
    if (!gesture || gesture.pointerId !== event.pointerId || !frame?.width || !frame.height) return;
    event.preventDefault();
    const dx = (event.clientX - gesture.x) / frame.width;
    const dy = (event.clientY - gesture.y) / frame.height;
    const start = gesture.layout.textBox;
    onBoxChange(gesture.action === "move"
      ? moveWallTextEditBox(gesture.layout, start.x + dx, start.y + dy)
      : resizeWallTextEditBox(gesture.layout, start.width + (gesture.action === "left" ? -dx : dx),
        gesture.action === "left" ? "right" : "left"));
  }

  function handleMoveKey(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 0.05 : 0.01;
    const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
    if (!dx && !dy) return;
    event.preventDefault();
    onBoxChange(moveWallTextEditBox(layout, box.x + dx, box.y + dy));
  }

  function handleResizeKey(event: KeyboardEvent<HTMLButtonElement>, edge: "left" | "right") {
    const step = event.shiftKey ? 0.05 : 0.01;
    const width = event.key === "Home" ? WALL_TEXT_EDIT_MIN_WIDTH
      : event.key === "End" ? WALL_TEXT_EDIT_MAX_WIDTH
      : event.key === "ArrowLeft" || event.key === "ArrowDown" ? box.width - step
      : event.key === "ArrowRight" || event.key === "ArrowUp" ? box.width + step : null;
    if (width === null) return;
    event.preventDefault();
    event.stopPropagation();
    onBoxChange(resizeWallTextEditBox(layout, width, edge === "left" ? "right" : "left"));
  }

  return (
    <div
      ref={layerRef}
      className="absolute z-30 -translate-x-1/2 -translate-y-1/2 select-none"
      style={{ left: `${(box.x + box.width / 2) * 100}%`, top: `${(box.y + box.height / 2) * 100}%`, width: `${box.width * 100}cqw`, touchAction: "none" }}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => { if (gestureRef.current?.pointerId === event.pointerId) finish(); }}
      onPointerCancel={(event) => { if (gestureRef.current?.pointerId === event.pointerId) finish(true); }}
      onLostPointerCapture={(event) => { if (gestureRef.current?.pointerId === event.pointerId) finish(); }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && gestureRef.current) {
          event.preventDefault();
          event.stopPropagation();
          finish(true);
        }
      }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label="Move Wall-of-text copy"
        className="flex items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-white"
        style={{ minHeight: `${box.height * 100 * 16 / 9}cqw`, cursor: action === "move" ? "grabbing" : "grab" }}
        onPointerDown={(event) => begin(event, "move")}
        onKeyDown={handleMoveKey}
      >
        {children}
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-sm border border-dashed border-white/65" />
      {(["left", "right"] as const).map((edge) => (
        <button
          key={edge}
          type="button"
          role="slider"
          aria-label={`Text width — ${edge} handle`}
          aria-orientation="horizontal"
          aria-valuemin={WALL_TEXT_EDIT_MIN_WIDTH * 100}
          aria-valuemax={Math.round(resizeWallTextEditBox(layout, WALL_TEXT_EDIT_MAX_WIDTH, edge === "left" ? "right" : "left").width * 100)}
          aria-valuenow={Math.round(box.width * 100)}
          aria-valuetext={`${Math.round(box.width * 100)}% of video width`}
          title="Drag to change text width"
          className="absolute top-1/2 flex h-12 w-10 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-white"
          style={{ [edge]: 0, transform: `translateX(${edge === "left" ? "-50%" : "50%"})` }}
          onPointerDown={(event) => begin(event, edge)}
          onKeyDown={(event) => handleResizeKey(event, edge)}
        >
          <span aria-hidden="true" className="h-7 w-1 rounded-full bg-white shadow-[0_0_0_1px_#000,0_1px_4px_#000]" />
        </button>
      ))}
    </div>
  );
}

export function WallTextWidthControl({ id, layout, onBoxChange }: BoxControlProps & { id: string }) {
  const percentage = Math.round(layout.textBox.width * 100);
  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="range"
        aria-label="Text width"
        min={WALL_TEXT_EDIT_MIN_WIDTH * 100}
        max={WALL_TEXT_EDIT_MAX_WIDTH * 100}
        step={1}
        value={percentage}
        onChange={(event) => onBoxChange(resizeWallTextEditBox(layout, event.target.valueAsNumber / 100))}
        className="h-6 w-full cursor-pointer accent-primary"
      />
      <output htmlFor={id} className="w-10 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{percentage}%</output>
    </div>
  );
}
