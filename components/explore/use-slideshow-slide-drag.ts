"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from "react";

type Drag = { id: string; pointerId: number; handle: HTMLButtonElement; startX: number; startY: number; x: number; y: number; active: boolean; target: number | null };

/** Reorder only on drop; cancelled gestures never change the saved draft. */
export function useSlideshowSlideDrag({ ids, disabled, onMove }: {
  ids: readonly string[]; disabled: boolean; onMove: (from: string, to: string) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const session = useRef<Drag | null>(null);
  const [drag, setDrag] = useState<{ id: string; target: number | null } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const order = JSON.stringify(ids);
  const [context, setContext] = useState({ order, disabled });
  const dragging = Boolean(drag);

  if (context.order !== order || context.disabled !== disabled) {
    setContext({ order, disabled });
    if (drag) setDrag(null);
  }

  const clear = useCallback(() => {
    const current = session.current;
    session.current = null;
    if (current?.handle.hasPointerCapture(current.pointerId)) current.handle.releasePointerCapture(current.pointerId);
    setDrag(null);
  }, []);

  useEffect(() => {
    const current = session.current;
    session.current = null;
    if (current?.handle.hasPointerCapture(current.pointerId)) current.handle.releasePointerCapture(current.pointerId);
  }, [disabled, order]);
  useEffect(() => () => { session.current = null; }, []);

  const findTarget = useCallback((x: number, y: number) => {
    const rail = railRef.current;
    if (!rail) return null;
    const bounds = rail.getBoundingClientRect();
    if (y < bounds.top - 24 || y > bounds.bottom + 24 || x < bounds.left - 24 || x > bounds.right + 24) return null;
    const cards = [...rail.querySelectorAll<HTMLElement>("[data-slideshow-slide]")];
    let nearest: number | null = null, distance = Infinity;
    for (const [index, card] of cards.entries()) {
      const rect = card.getBoundingClientRect();
      if (rect.right <= bounds.left || rect.left >= bounds.right) continue;
      const nextDistance = Math.abs(x - (rect.left + rect.width / 2));
      if (nextDistance < distance) { nearest = index; distance = nextDistance; }
    }
    return nearest;
  }, []);

  // Keep scrolling while the pointer is held at a rail edge, including touch.
  useEffect(() => {
    if (!dragging || disabled) return;
    let frame = 0;
    const tick = () => {
      const current = session.current, rail = railRef.current;
      if (!current?.active || !rail) return;
      const bounds = rail.getBoundingClientRect();
      if (current.y >= bounds.top - 24 && current.y <= bounds.bottom + 24 && current.x >= bounds.left - 24 && current.x <= bounds.right + 24) {
        const before = rail.scrollLeft;
        const direction = current.x < bounds.left + 28 ? -1 : current.x > bounds.right - 28 ? 1 : 0;
        if (direction) rail.scrollLeft += direction * 12;
        if (rail.scrollLeft !== before) {
          current.target = findTarget(current.x, current.y);
          setDrag(previous => previous?.target === current.target ? previous : { id: current.id, target: current.target });
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [dragging, disabled, findTarget]);

  function finish(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const current = session.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const target = findTarget(event.clientX, event.clientY);
    clear();
    if (!cancelled && !disabled && current.active && target !== null && ids[target] && ids[target] !== current.id) {
      onMove(current.id, ids[target]);
      setAnnouncement(`Slide ${ids.indexOf(current.id) + 1} moved to position ${target + 1}.`);
    }
  }

  function handleProps(id: string) {
    return {
      onPointerDown(event: PointerEvent<HTMLButtonElement>) {
        if (disabled || !event.isPrimary || event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        session.current = { id, pointerId: event.pointerId, handle: event.currentTarget, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, active: false, target: ids.indexOf(id) };
      },
      onPointerMove(event: PointerEvent<HTMLButtonElement>) {
        const current = session.current;
        if (!current || current.pointerId !== event.pointerId || disabled) return;
        current.x = event.clientX; current.y = event.clientY;
        if (!current.active && Math.hypot(current.x - current.startX, current.y - current.startY) < 6) return;
        current.active = true; current.target = findTarget(current.x, current.y);
        setDrag(previous => previous?.id === id && previous.target === current.target ? previous : { id, target: current.target });
      },
      onPointerUp: finish,
      onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => finish(event, true),
      onLostPointerCapture() { if (session.current) clear(); },
      onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
        if (event.key === "Escape") { clear(); return; }
        if (disabled || session.current) return;
        const from = ids.indexOf(id);
        const to = event.key === "ArrowLeft" ? from - 1 : event.key === "ArrowRight" ? from + 1 : event.key === "Home" ? 0 : event.key === "End" ? ids.length - 1 : null;
        if (to === null) return;
        event.preventDefault();
        if (to >= 0 && to < ids.length && to !== from) { onMove(id, ids[to]); setAnnouncement(`Slide ${from + 1} moved to position ${to + 1}.`); }
      },
    };
  }

  return { railRef, drag, announcement, handleProps };
}
