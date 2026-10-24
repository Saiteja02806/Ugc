"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import styles from "./clip-trim-timeline.module.css";

/** Both handles share one source timeline; edits never submit a render. */
export function ClipTrimTimeline({ durationMs, startMs, endMs, timeMs = startMs, onChange, disabled = false }: {
  durationMs: number; startMs: number; endMs: number; timeMs?: number;
  onChange: (startMs: number, endMs: number) => void;
  disabled?: boolean;
}) {
  const track = useRef<HTMLDivElement | null>(null);
  const dragging = useRef<"start" | "end" | null>(null);
  const length = Math.max(1000, durationMs);
  const percent = (value: number) => Math.max(0, Math.min(100, value / length * 100));
  function change(handle: "start" | "end", value: number) {
    if (handle === "start") onChange(Math.max(0, Math.min(endMs - 1000, value)), endMs);
    else onChange(startMs, Math.min(length, Math.max(startMs + 1000, value)));
  }
  function valueAt(event: PointerEvent<HTMLDivElement>) {
    const bounds = track.current!.getBoundingClientRect();
    return Math.round(Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) * length / 100) * 100;
  }
  function begin(event: PointerEvent<HTMLDivElement>) {
    if (disabled || event.button !== 0 || !track.current) return;
    event.preventDefault();
    const handle = (event.target as HTMLElement).closest<HTMLElement>("[data-trim-handle]")?.dataset.trimHandle;
    const value = valueAt(event);
    dragging.current = handle === "start" || handle === "end" ? handle : Math.abs(value - startMs) <= Math.abs(value - endMs) ? "start" : "end";
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.querySelector<HTMLElement>(`[data-trim-handle="${dragging.current}"]`)?.focus({ preventScroll: true });
    change(dragging.current, value);
  }
  function key(event: KeyboardEvent<HTMLDivElement>, handle: "start" | "end") {
    if (disabled) return;
    const current = handle === "start" ? startMs : endMs;
    const step = event.shiftKey ? 1000 : 100;
    const value = event.key === "ArrowLeft" || event.key === "ArrowDown" ? current - step
      : event.key === "ArrowRight" || event.key === "ArrowUp" ? current + step
      : event.key === "Home" ? handle === "start" ? 0 : startMs + 1000
      : event.key === "End" ? handle === "start" ? endMs - 1000 : length : null;
    if (value === null) return;
    event.preventDefault(); change(handle, value);
  }
  return <div className={styles.timeline} aria-label="Clip trim timeline">
    <div ref={track} className={styles.track} onPointerDown={begin} onPointerMove={event => { if (!disabled && dragging.current) change(dragging.current, valueAt(event)); }}
      onPointerUp={() => { dragging.current = null; }} onPointerCancel={() => { dragging.current = null; }} onLostPointerCapture={() => { dragging.current = null; }}>
      <div className={styles.selection} style={{ left: `${percent(startMs)}%`, width: `${percent(endMs - startMs)}%` }} />
      <div className={styles.playhead} style={{ left: `${percent(timeMs)}%` }} />
      {(["start", "end"] as const).map(handle => <div key={handle} role="slider" tabIndex={disabled ? -1 : 0} aria-disabled={disabled} data-trim-handle={handle}
        aria-label={`Trim ${handle} handle`} aria-valuemin={handle === "start" ? 0 : (startMs + 1000) / 1000}
        aria-valuemax={handle === "start" ? (endMs - 1000) / 1000 : length / 1000} aria-valuenow={(handle === "start" ? startMs : endMs) / 1000}
        aria-valuetext={`${((handle === "start" ? startMs : endMs) / 1000).toFixed(1)} seconds`}
        className={styles.handle} style={{ left: `${percent(handle === "start" ? startMs : endMs)}%` }} onKeyDown={event => key(event, handle)}><span /></div>)}
    </div>
    <div className={styles.labels}><span>0s</span><span>Drag the handles to trim</span><span>{(length / 1000).toFixed(1)}s</span></div>
  </div>;
}
