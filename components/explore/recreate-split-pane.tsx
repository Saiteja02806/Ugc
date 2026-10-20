"use client";

import { GripVertical } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { clampRecreateEditorWidth, recreateEditorDefault, recreateEditorMaximum, RECREATE_EDITOR_DEFAULT_MIN, RECREATE_EDITOR_MAX, RECREATE_EDITOR_MIN } from "@/lib/explore/recreate-pane-size";
import layout from "@/components/explore/recreate-layout.module.css";

type Drag = { pointerId: number; startX: number; startWidth: number; startRequestedWidth: number | null; handle: HTMLDivElement };

/** The generators stay mounted; only their surrounding layout changes size. */
export function RecreateSplitPane({ children }: { children: [ReactNode, ReactNode] }) {
  const editorId = useId();
  const helpId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useRef(0);
  const drag = useRef<Drag | null>(null);
  const frame = useRef<number | null>(null);
  const pendingWidth = useRef<number | null>(null);
  const [requestedWidth, setRequestedWidth] = useState<number | null>(null);
  const [defaultWidth, setDefaultWidth] = useState(RECREATE_EDITOR_DEFAULT_MIN);
  const [maximum, setMaximum] = useState(RECREATE_EDITOR_MAX);
  const [dragging, setDragging] = useState(false);
  const width = Math.min(requestedWidth ?? defaultWidth, maximum);

  const stopDrag = useCallback((cancelled = false) => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    const next = pendingWidth.current;
    pendingWidth.current = null;
    if (cancelled) setRequestedWidth(current.startRequestedWidth);
    else if (next !== null) setRequestedWidth(clampRecreateEditorWidth(next, containerWidth.current));
    setDragging(false);
    if (current.handle.hasPointerCapture(current.pointerId)) current.handle.releasePointerCapture(current.pointerId);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      containerWidth.current = entry.contentRect.width;
      setDefaultWidth(recreateEditorDefault(entry.contentRect.width));
      setMaximum(recreateEditorMaximum(entry.contentRect.width));
    });
    observer.observe(container);
    const desktop = window.matchMedia("(min-width: 1024px)");
    const cancel = () => stopDrag(true);
    const onBreakpoint = () => { if (!desktop.matches) cancel(); };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && drag.current) {
        event.preventDefault();
        cancel();
      }
    };
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", onEscape);
    desktop.addEventListener("change", onBreakpoint);
    return () => {
      observer.disconnect();
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", onEscape);
      desktop.removeEventListener("change", onBreakpoint);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      const current = drag.current;
      drag.current = null;
      if (current?.handle.hasPointerCapture(current.pointerId)) current.handle.releasePointerCapture(current.pointerId);
    };
  }, [stopDrag]);

  return <div ref={containerRef} className={layout.split} data-resizing={dragging || undefined}
    style={requestedWidth === null ? undefined : { "--recreate-editor-width": `${width}px` } as CSSProperties}>
    <div id={editorId} className={layout.editor}>{children[0]}</div>
    <div role="separator" tabIndex={0} aria-label="Resize editor and gallery" aria-orientation="vertical"
      aria-controls={editorId} aria-describedby={helpId} aria-valuemin={RECREATE_EDITOR_MIN} aria-valuemax={maximum}
      aria-valuenow={width} aria-valuetext={`Editor width ${width} pixels`} className={layout.divider}
      title="Drag to resize · Arrow keys to adjust · Enter to reset"
      onPointerDown={(event) => {
        if (event.button !== 0 || !event.isPrimary) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        containerWidth.current = containerRef.current?.getBoundingClientRect().width ?? 0;
        drag.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: width, startRequestedWidth: requestedWidth, handle: event.currentTarget };
        setDragging(true);
      }}
      onPointerMove={(event) => {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) return;
        pendingWidth.current = clampRecreateEditorWidth(current.startWidth + event.clientX - current.startX, containerWidth.current);
        if (frame.current !== null) return;
        frame.current = requestAnimationFrame(() => {
          frame.current = null;
          if (pendingWidth.current !== null) setRequestedWidth(pendingWidth.current);
        });
      }}
      onPointerUp={(event) => {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) return;
        pendingWidth.current = clampRecreateEditorWidth(current.startWidth + event.clientX - current.startX, containerWidth.current);
        stopDrag();
      }}
      onPointerCancel={(event) => { if (drag.current?.pointerId === event.pointerId) stopDrag(true); }}
      onLostPointerCapture={(event) => { if (drag.current?.pointerId === event.pointerId) stopDrag(true); }}
      onDoubleClick={() => setRequestedWidth(null)}
      onKeyDown={(event) => {
        if (drag.current) return;
        if (event.key === "Enter") {
          event.preventDefault();
          setRequestedWidth(null);
          return;
        }
        const step = event.shiftKey ? 40 : 16;
        const next = event.key === "ArrowLeft" ? width - step : event.key === "ArrowRight" ? width + step
          : event.key === "Home" ? RECREATE_EDITOR_MIN : event.key === "End" ? maximum : null;
        if (next === null) return;
        event.preventDefault();
        setRequestedWidth(clampRecreateEditorWidth(next, containerWidth.current));
      }}>
      <GripVertical aria-hidden="true" className={layout.grip} />
    </div>
    {children[1]}
    <p id={helpId} className="sr-only">Drag left or right to resize the editor and reference gallery. Use Left and Right arrow keys, Shift for larger steps, Home or End for the limits, and Enter to reset. Escape cancels a drag.</p>
  </div>;
}
