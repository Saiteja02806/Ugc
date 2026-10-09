"use client";

import { Heart } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { getPostDragScrollTop, getPostDragSnapTop, isPostDoubleTap, isPostTap, POST_LIKE_FEEDBACK_MS, POST_TAP_MOVEMENT_PX, shouldSkipScrolledPost, type PostTap } from "@/lib/trending/post-interaction";
import { cn } from "@/lib/utils";
import styles from "./post-interaction-feed.module.css";

const CONTROL_SELECTOR = "button, a, input, textarea, select, [contenteditable=true], [data-deck-control]";

export function PostLikeHeart() {
  return <div data-post-like-heart aria-hidden="true"
    className={cn("pointer-events-none absolute inset-0 z-50 grid place-items-center", styles.feedback)}
    style={{ "--post-like-feedback-duration": `${POST_LIKE_FEEDBACK_MS}ms` } as CSSProperties}>
    <Heart fill="currentColor" strokeWidth={0} className={styles.heart} />
  </div>;
}

/** A small native scrolling window. Decisions are committed only after a user
 * scroll settles, then the parent advances its existing durable feed. */
type PostFeedItem = { id: string; content: ReactNode };

export function PostInteractionFeed({ items, previousItem, onPrevious, onLike, onSkip, onStart, disabled = false, liked = false, className, label }: {
  items: PostFeedItem[];
  previousItem?: PostFeedItem | null;
  onPrevious?: () => boolean;
  onLike: () => boolean;
  onSkip: () => boolean;
  onStart?: () => boolean;
  disabled?: boolean;
  liked?: boolean;
  className?: string;
  label: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const previousTap = useRef<PostTap | null>(null);
  const pointerStart = useRef<(PostTap & { pointerId: number }) | null>(null);
  const mouseDrag = useRef<{ pointerId: number; x: number; y: number; scrollTop: number; dragged: boolean;
    lastY: number; lastTime: number; velocity: number } | null>(null);
  const snapFrame = useRef<number | null>(null);
  const touchScrolling = useRef(false);
  const committingScroll = useRef(false);
  const ignoreDragClick = useRef(false);
  const userScroll = useRef(false);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentId = items[0]?.id;
  const hasPrevious = Boolean(previousItem && onPrevious);
  const callbacks = useRef({ onLike, onSkip, onPrevious, onStart, disabled, hasPrevious });
  useLayoutEffect(() => { callbacks.current = { onLike, onSkip, onPrevious, onStart, disabled, hasPrevious }; });

  function restingTop() {
    return callbacks.current.hasPrevious ? viewportRef.current?.clientHeight ?? 0 : 0;
  }

  const cancelSnap = useCallback((keepSnapPaused = false) => {
    if (snapFrame.current !== null) window.cancelAnimationFrame(snapFrame.current);
    snapFrame.current = null;
    if (viewportRef.current && !keepSnapPaused) delete viewportRef.current.dataset.postSettling;
  }, []);

  const clearMouseDrag = useCallback(() => {
    const drag = mouseDrag.current;
    mouseDrag.current = null;
    const viewport = viewportRef.current;
    if (!viewport) return;
    delete viewport.dataset.postMouseDown;
    delete viewport.dataset.postDragging;
    if (drag && viewport.hasPointerCapture(drag.pointerId)) viewport.releasePointerCapture(drag.pointerId);
  }, []);

  const cancelMouseDrag = useCallback(() => {
    cancelSnap();
    clearMouseDrag();
    pointerStart.current = null;
    previousTap.current = null;
    userScroll.current = false;
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    viewportRef.current?.scrollTo({ top: callbacks.current.hasPrevious ? viewportRef.current.clientHeight : 0, behavior: "instant" });
  }, [cancelSnap, clearMouseDrag]);

  useLayoutEffect(() => {
    previousTap.current = null;
    pointerStart.current = null;
    userScroll.current = false;
    touchScrolling.current = false;
    committingScroll.current = false;
    cancelSnap();
    clearMouseDrag();
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    // Going backward can retain the old active post as an upcoming DOM node.
    // Removing autoplay or making it inert does not stop existing playback.
    viewportRef.current?.querySelectorAll<HTMLMediaElement>("[inert] video, [inert] audio")
      .forEach((media) => media.pause());
    viewportRef.current?.scrollTo({ top: hasPrevious ? viewportRef.current.clientHeight : 0, behavior: "instant" });
    return () => {
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      cancelSnap();
      clearMouseDrag();
    };
  }, [currentId, hasPrevious, cancelSnap, clearMouseDrag]);

  useLayoutEffect(() => {
    // A completed scroll already shows the next post. Keep it there until the
    // parent retires the old item; resetting during that hand-off flashes it.
    if (disabled && !committingScroll.current) cancelMouseDrag();
  }, [disabled, cancelMouseDrag]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    let height = viewport.clientHeight;
    const observer = new ResizeObserver(() => {
      if (viewport.clientHeight !== height) {
        height = viewport.clientHeight;
        cancelMouseDrag();
      }
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [cancelMouseDrag]);

  useEffect(() => {
    const cancelOnBlur = () => { if (mouseDrag.current || snapFrame.current !== null) cancelMouseDrag(); };
    const cancelOutsideRelease = (event: globalThis.PointerEvent) => {
      if (mouseDrag.current?.pointerId === event.pointerId) cancelMouseDrag();
    };
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && (mouseDrag.current || snapFrame.current !== null)) {
        event.preventDefault();
        cancelMouseDrag();
      }
    };
    window.addEventListener("blur", cancelOnBlur);
    window.addEventListener("keydown", cancelOnEscape);
    window.addEventListener("pointerup", cancelOutsideRelease);
    window.addEventListener("pointercancel", cancelOutsideRelease);
    return () => {
      window.removeEventListener("blur", cancelOnBlur);
      window.removeEventListener("keydown", cancelOnEscape);
      window.removeEventListener("pointerup", cancelOutsideRelease);
      window.removeEventListener("pointercancel", cancelOutsideRelease);
    };
  }, [cancelMouseDrag]);

  function scheduleScrollSettlement() {
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    // scrollend can fire while a touch is still held, or be omitted when a
    // reversing gesture ends at the same boundary. Keep a fallback even in
    // browsers exposing scrollend; its native event still commits immediately.
    // settleScroll guards held gestures, animations, and duplicate decisions.
    scrollTimer.current = setTimeout(settleScroll, 160);
  }

  function snapToPost(top: number) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    // Do not briefly restore native snap between dragging and release motion:
    // the browser can queue a snap even if we pause it again in the same task.
    cancelSnap(true);
    viewport.dataset.postSettling = "true";
    const from = viewport.scrollTop;
    const distance = top - from;
    if (Math.abs(distance) < 1 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      viewport.scrollTo({ top, behavior: "instant" });
      delete viewport.dataset.postSettling;
      settleScroll();
      return;
    }
    const started = performance.now();
    const duration = Math.min(320, Math.max(180, 160 + Math.abs(distance) * 0.36));
    const animate = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      // Decelerate into the post without a bounce or a second reveal animation.
      viewport.scrollTo({ top: from + distance * (1 - (1 - progress) ** 4), behavior: "instant" });
      if (progress < 1) snapFrame.current = window.requestAnimationFrame(animate);
      else {
        snapFrame.current = null;
        delete viewport.dataset.postSettling;
        settleScroll();
      }
    };
    snapFrame.current = window.requestAnimationFrame(animate);
  }

  function armScroll() {
    cancelSnap();
    previousTap.current = null;
    if (callbacks.current.disabled || callbacks.current.onStart?.()) {
      userScroll.current = false;
      return;
    }
    userScroll.current = true;
    scheduleScrollSettlement();
  }

  function startPointer(event: PointerEvent<HTMLDivElement>) {
    cancelSnap();
    ignoreDragClick.current = false;
    if (!currentId || !event.isPrimary || event.button !== 0 ||
        (event.target as Element).closest(CONTROL_SELECTOR)) {
      previousTap.current = null;
      pointerStart.current = null;
      return;
    }
    if (callbacks.current.disabled || callbacks.current.onStart?.()) {
      previousTap.current = null;
      return;
    }
    userScroll.current = true;
    if (!(event.target as Element).closest("[data-post-like-target]")) {
      previousTap.current = null;
      pointerStart.current = null;
      return;
    }
    pointerStart.current = { itemId: currentId, x: event.clientX, y: event.clientY, time: event.timeStamp, pointerId: event.pointerId };
    if (event.pointerType === "mouse") {
      // Prevent native image/text dragging while preserving pointer-up taps.
      event.preventDefault();
      const viewport = event.currentTarget;
      viewport.focus({ preventScroll: true });
      mouseDrag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY,
        scrollTop: viewport.scrollTop, dragged: false, lastY: event.clientY, lastTime: event.timeStamp, velocity: 0 };
      viewport.dataset.postMouseDown = "true";
    }
  }

  function movePointer(event: PointerEvent<HTMLDivElement>) {
    const start = pointerStart.current;
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > POST_TAP_MOVEMENT_PX) {
      pointerStart.current = null;
      previousTap.current = null;
    }
    const drag = mouseDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (callbacks.current.disabled || event.buttons !== 1) { cancelMouseDrag(); return; }
    const elapsed = event.timeStamp - drag.lastTime;
    if (elapsed > 0) drag.velocity = elapsed > 100 ? 0 :
      drag.velocity * 0.4 + ((drag.lastY - event.clientY) / elapsed) * 0.6;
    drag.lastY = event.clientY;
    drag.lastTime = event.timeStamp;
    const dy = event.clientY - drag.y;
    if (!drag.dragged && (Math.abs(dy) <= POST_TAP_MOVEMENT_PX || Math.abs(dy) <= Math.abs(event.clientX - drag.x))) return;
    if (!drag.dragged) {
      drag.dragged = true;
      ignoreDragClick.current = true;
      pointerStart.current = null;
      previousTap.current = null;
      // Snap is suspended only during a mouse drag; touch keeps native scrolling.
      event.currentTarget.dataset.postDragging = "true";
      try { event.currentTarget.setPointerCapture(event.pointerId); }
      catch { cancelMouseDrag(); return; }
    }
    event.preventDefault();
    userScroll.current = true;
    event.currentTarget.scrollTo({ top: getPostDragScrollTop({ startScrollTop: drag.scrollTop,
      startY: drag.y, y: event.clientY, height: event.currentTarget.clientHeight,
      anchor: restingTop(), hasPrevious: callbacks.current.hasPrevious }), behavior: "instant" });
  }

  function finishPointer(event: PointerEvent<HTMLDivElement>) {
    const drag = mouseDrag.current;
    if (drag?.pointerId === event.pointerId) {
      const viewport = event.currentTarget;
      // A pause before release must not reuse the speed of an earlier movement.
      const velocity = event.timeStamp - drag.lastTime <= 100 ? drag.velocity : 0;
      const targetTop = getPostDragSnapTop(viewport.scrollTop, viewport.clientHeight, velocity, restingTop(), callbacks.current.hasPrevious);
      if (drag.dragged) viewport.dataset.postSettling = "true";
      clearMouseDrag();
      if (drag.dragged) {
        event.preventDefault();
        pointerStart.current = null;
        previousTap.current = null;
        userScroll.current = targetTop !== restingTop() && !callbacks.current.disabled;
        snapToPost(callbacks.current.disabled ? restingTop() : targetTop);
        return;
      }
    }
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || !currentId || start.pointerId !== event.pointerId || callbacks.current.disabled ||
        !(event.target as Element).closest("[data-post-like-target]") ||
        (event.target as Element).closest(CONTROL_SELECTOR) || Math.abs((viewportRef.current?.scrollTop ?? 0) - restingTop()) > 4) return;
    const tap = { itemId: currentId, x: event.clientX, y: event.clientY, time: event.timeStamp };
    if (!isPostTap(start, tap)) { previousTap.current = null; return; }
    userScroll.current = false;
    if (isPostDoubleTap(previousTap.current, tap)) {
      previousTap.current = null;
      userScroll.current = false;
      callbacks.current.onLike();
    } else previousTap.current = tap;
  }

  function settleScroll() {
    const viewport = viewportRef.current;
    if (!viewport || mouseDrag.current || touchScrolling.current || snapFrame.current !== null || committingScroll.current) return;
    const offset = viewport.scrollTop - restingTop();
    if (callbacks.current.hasPrevious && userScroll.current && !callbacks.current.disabled && offset <= -viewport.clientHeight * .8) {
      userScroll.current = false;
      committingScroll.current = true;
      if (!callbacks.current.onPrevious?.()) {
        committingScroll.current = false;
        snapToPost(restingTop());
      }
    } else if (shouldSkipScrolledPost({ scrollTop: offset, height: viewport.clientHeight,
      userInitiated: userScroll.current, disabled: callbacks.current.disabled })) {
      userScroll.current = false;
      committingScroll.current = true;
      if (!callbacks.current.onSkip()) {
        committingScroll.current = false;
        snapToPost(restingTop());
      }
    } else if (Math.abs(offset) < 1) {
      userScroll.current = false;
    } else if (!userScroll.current || callbacks.current.disabled) {
      viewport.scrollTo({ top: restingTop(), behavior: "instant" });
    }
  }

  return <div
    ref={viewportRef}
    data-post-interaction-feed
    data-post-has-previous={hasPrevious ? "true" : undefined}
    role="group"
    aria-label={label}
    aria-busy={disabled}
    tabIndex={0}
    className={cn("relative isolate rounded-[20px] outline-none", styles.viewport, className)}
    style={{ overflowY: disabled ? "hidden" : undefined }}
    onWheelCapture={armScroll}
    onTouchStartCapture={() => { touchScrolling.current = true; }}
    onTouchEndCapture={(event) => {
      touchScrolling.current = event.touches.length > 0;
      scheduleScrollSettlement();
    }}
    onTouchCancelCapture={() => {
      touchScrolling.current = false;
      previousTap.current = null;
      pointerStart.current = null;
      scheduleScrollSettlement();
    }}
    onPointerDownCapture={startPointer}
    onPointerMoveCapture={movePointer}
    onPointerUpCapture={finishPointer}
    onPointerCancelCapture={(event) => {
      if (mouseDrag.current?.pointerId === event.pointerId) cancelMouseDrag();
      else { pointerStart.current = null; previousTap.current = null; }
    }}
    onLostPointerCapture={(event) => {
      if (mouseDrag.current?.pointerId === event.pointerId) cancelMouseDrag();
    }}
    onDragStartCapture={(event) => { if (mouseDrag.current) event.preventDefault(); }}
    onClickCapture={(event) => {
      if (ignoreDragClick.current) {
        ignoreDragClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }
    }}
    onKeyDown={(event) => {
      if (event.target !== event.currentTarget || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "ArrowDown" || event.key === "PageDown" || event.key === " ") {
        event.preventDefault(); armScroll();
        if (userScroll.current) snapToPost(restingTop() + event.currentTarget.clientHeight);
      } else if (event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        if (!callbacks.current.hasPrevious) { previousTap.current = null; userScroll.current = false; return; }
        armScroll();
        if (userScroll.current && callbacks.current.hasPrevious) snapToPost(restingTop() - event.currentTarget.clientHeight);
      } else if (event.key === "Enter") {
        event.preventDefault(); callbacks.current.onLike();
      }
    }}
    onScroll={() => {
      previousTap.current = null;
      pointerStart.current = null;
      scheduleScrollSettlement();
    }}
    onScrollEnd={settleScroll}
  >
    {hasPrevious && previousItem ? <div key={`previous:${previousItem.id}`} data-post-history-item={previousItem.id} className={styles.post} aria-hidden="true" inert>
      {previousItem.content}
    </div> : null}
    {items.map((item, index) => <div key={item.id} data-post-feed-item={item.id} data-post-feed-active={index === 0 ? "true" : undefined} className={styles.post} aria-hidden={index > 0 ? true : undefined} inert={index > 0 ? true : undefined}>
      {item.content}
      {index === 0 && liked ? <PostLikeHeart /> : null}
    </div>)}
    {items.length === 1 ? <div className={styles.post} aria-hidden="true"><p className="px-6 text-center text-sm text-muted">You’ve reached the end of the ready posts.</p></div> : null}
  </div>;
}
