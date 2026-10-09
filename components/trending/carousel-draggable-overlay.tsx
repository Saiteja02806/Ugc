"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import {
  clampCarouselOverlayPosition,
  getCarouselOverlayContainment,
  type CarouselOverlayBounds,
  type CarouselOverlayGeometry,
  type CarouselOverlayPosition,
} from "../../lib/carousel/editor-text-containment";

const DEFAULT_BOUNDS: CarouselOverlayBounds = { minX: 0.1, maxX: 0.9, minY: 0.1, maxY: 0.9 };

// Include inline pill padding, outlines and text that overhangs its paragraph
// (such as a pasted unbroken word), not merely the wrapper's CSS width.
function measureOverlay(layer: HTMLDivElement): CarouselOverlayGeometry | null {
  const frame = layer.parentElement;
  if (!frame || frame.clientWidth <= 0 || frame.clientHeight <= 0) return null;
  const rect = layer.getBoundingClientRect();
  const centerX = (rect.left + rect.right) / 2;
  const centerY = (rect.top + rect.bottom) / 2;
  // A layout wrapper may be wider than its visible text. Counting its empty
  // horizontal space would wrongly reject otherwise safe 1:1 slides.
  let left = centerX;
  let right = centerX;
  let top = rect.top;
  let bottom = rect.bottom;
  const include = (value: DOMRect) => {
    if (!value.width && !value.height) return;
    left = Math.min(left, value.left);
    right = Math.max(right, value.right);
    top = Math.min(top, value.top);
    bottom = Math.max(bottom, value.bottom);
  };
  layer.querySelectorAll("*").forEach((element) => {
    if (!element.children.length) Array.from(element.getClientRects()).forEach(include);
  });
  const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (!node.textContent?.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    Array.from(range.getClientRects()).forEach(include);
  }
  const outlineBuffer = frame.clientWidth * 2 / 1080;
  return {
    frameWidth: frame.clientWidth, frameHeight: frame.clientHeight,
    left: centerX - left + outlineBuffer, right: right - centerX + outlineBuffer,
    top: centerY - top + outlineBuffer, bottom: bottom - centerY + outlineBuffer,
  };
}

export function CarouselDraggableOverlay({
  ariaLabel, bounds = DEFAULT_BOUNDS, children, enabled = true,
  format, onPositionChange, position, structureId,
}: {
  ariaLabel: string;
  bounds?: CarouselOverlayBounds;
  children: ReactNode;
  /** Saved renders are immutable: opening the editor must not move their text. */
  enabled?: boolean;
  format: "1:1" | "4:5";
  onPositionChange: (position: CarouselOverlayPosition) => void;
  position: CarouselOverlayPosition;
  structureId: "structure_1" | "structure_2";
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [geometry, setGeometry] = useState<CarouselOverlayGeometry | null>(null);

  useLayoutEffect(() => {
    const layer = layerRef.current;
    const frame = layer?.parentElement;
    if (!layer || !frame) return;
    let active = true;
    const measure = () => {
      if (!active) return;
      const next = measureOverlay(layer);
      setGeometry((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    // Observe both text growth and responsive viewport changes. Font loading
    // can change glyph extents even when the wrapper width remains fixed.
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(layer);
    // Measure edited copy before paint so the previous, smaller bounds cannot
    // briefly clip a newly enlarged block.
    measure();
    void document.fonts.ready.then(measure);
    document.fonts.addEventListener("loadingdone", measure);
    return () => {
      active = false;
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", measure);
    };
  }, [children]);

  const containment = geometry
    ? getCarouselOverlayContainment(geometry, structureId, format, bounds)
    : null;
  const overflow = enabled && containment?.fits === false;
  const displayPosition = !enabled || !containment
    ? position
    : containment.fits
      ? clampCarouselOverlayPosition(position, containment.bounds)
      : { x: 0.5, y: 0.5 };

  function moveTo(next: CarouselOverlayPosition) {
    if (!enabled) {
      // First interaction turns an immutable render into a live preview. Do
      // not use its invisible hit-target as if it were the actual text block.
      onPositionChange(clampCarouselOverlayPosition(next, bounds));
      return;
    }
    const layer = layerRef.current;
    const measured = layer ? measureOverlay(layer) : null;
    if (!measured) return;
    const current = getCarouselOverlayContainment(measured, structureId, format, bounds);
    if (!current.fits) return;
    onPositionChange(clampCarouselOverlayPosition(next, current.bounds));
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (overflow || (event.pointerType === "mouse" && event.button !== 0)) return;
    const frame = layerRef.current?.parentElement;
    if (!frame || frame.clientWidth <= 0 || frame.clientHeight <= 0) return;
    const rect = frame.getBoundingClientRect();
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragOffsetRef.current = {
      x: (event.clientX - rect.left - frame.clientLeft) / frame.clientWidth - displayPosition.x,
      y: (event.clientY - rect.top - frame.clientTop) / frame.clientHeight - displayPosition.y,
    };
    setDragging(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragging || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const frame = layerRef.current?.parentElement;
    if (!frame || frame.clientWidth <= 0 || frame.clientHeight <= 0) return;
    const rect = frame.getBoundingClientRect();
    event.preventDefault();
    event.stopPropagation();
    moveTo({
      x: (event.clientX - rect.left - frame.clientLeft) / frame.clientWidth - dragOffsetRef.current.x,
      y: (event.clientY - rect.top - frame.clientTop) / frame.clientHeight - dragOffsetRef.current.y,
    });
  }

  function finishPointer(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const delta = event.shiftKey ? 0.05 : 0.01;
    const offset = event.key === "ArrowLeft" ? { x: -delta, y: 0 }
      : event.key === "ArrowRight" ? { x: delta, y: 0 }
      : event.key === "ArrowUp" ? { x: 0, y: -delta }
      : event.key === "ArrowDown" ? { x: 0, y: delta } : null;
    if (!offset) return;
    event.preventDefault();
    event.stopPropagation();
    moveTo({ x: displayPosition.x + offset.x, y: displayPosition.y + offset.y });
  }

  return (
    <>
      <div
        ref={layerRef}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-disabled={overflow || undefined}
        data-carousel-text-overflow={overflow ? "true" : "false"}
        className={`absolute z-20 select-none outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        style={{ left: `${displayPosition.x * 100}%`, top: `${displayPosition.y * 100}%`, transform: "translate(-50%, -50%)", touchAction: "none" }}
        onPointerCancel={finishPointer}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
      {overflow ? (
        <p role="alert" className="absolute inset-x-2 bottom-2 z-30 rounded-md bg-card p-2 text-center text-xs text-foreground shadow-sm">
          This text block is too large for the slide. Shorten the text to fit.
        </p>
      ) : null}
    </>
  );
}
