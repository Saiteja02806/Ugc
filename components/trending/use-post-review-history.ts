"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  emptyPostReviewState, getPostReviewHistoryKey, mergePostReviewHistory,
  parsePostReviewHistory, POST_REVIEW_LIMIT, serializePostReviewHistory,
  type PostReviewPersistence, type PostReviewState, type ReviewedPost,
} from "@/lib/trending/post-review-history";

export type { ReviewedPost } from "@/lib/trending/post-review-history";

/** Browsing never replays a decision. Demos stay visit-local; owned Trending can recover. */
export function usePostReviewHistory<T>(persistence?: PostReviewPersistence<T>) {
  const ownerId = persistence?.ownerId ?? null;
  const [state, setState] = useState(() => ({
    ownerId, ready: !ownerId, unavailable: false, ...emptyPostReviewState<T>(),
  }));
  const currentRef = useRef(state);
  const persistenceRef = useRef(persistence);
  useLayoutEffect(() => { persistenceRef.current = persistence; });

  useLayoutEffect(() => {
    let recovered = emptyPostReviewState<T>();
    let unavailable = false;
    if (ownerId && persistenceRef.current) {
      try {
        recovered = parsePostReviewHistory(window.localStorage.getItem(getPostReviewHistoryKey(ownerId)), persistenceRef.current);
      } catch { unavailable = true; }
    }
    const next = { ownerId, ready: true, unavailable, ...recovered };
    currentRef.current = next;
    setState(next);
  }, [ownerId]);

  const update = useCallback((change: (current: PostReviewState<T>) => PostReviewState<T>) => {
    const current = currentRef.current;
    // An old account's callback cannot mutate or expose a newly selected account.
    if (current.ownerId !== ownerId || !current.ready) return false;
    const config = persistenceRef.current;
    let base: PostReviewState<T> = current;
    let unavailable = current.unavailable;
    if (ownerId && config) {
      try {
        base = mergePostReviewHistory(parsePostReviewHistory(window.localStorage.getItem(getPostReviewHistoryKey(ownerId)), config), current);
      } catch { unavailable = true; }
    }
    const changed = change(base);
    const next = { ...changed, ownerId, ready: true, unavailable };
    if (ownerId) {
      try {
        // Write in the action, before navigation/reload can unmount the component.
        window.localStorage.setItem(getPostReviewHistoryKey(ownerId), serializePostReviewHistory(changed, ownerId));
        next.unavailable = false;
      } catch { next.unavailable = true; }
    }
    currentRef.current = next;
    setState(next);
    return true;
  }, [ownerId]);

  const remember = useCallback((entry: ReviewedPost<T>) => {
    update(current => ({ entries: [...current.entries.filter(previous => previous.id !== entry.id),
      { ...entry, reviewedAt: Date.now() }].slice(-POST_REVIEW_LIMIT), activeId: null }));
  }, [update]);
  const clear = useCallback(() => { update(emptyPostReviewState<T>); }, [update]);
  const markLiked = useCallback((id: string) => {
    update(current => ({ ...current, entries: current.entries.map(entry => entry.id === id ? { ...entry, decision: "liked" } : entry) }));
  }, [update]);

  const visible = state.ownerId === ownerId ? state : { ...emptyPostReviewState<T>(), ready: false, unavailable: false };
  const position = visible.activeId === null ? -1 : visible.entries.findIndex(entry => entry.id === visible.activeId);
  const currentPosition = position < 0 ? visible.entries.length : position;

  function previous() {
    let moved = false;
    update(current => {
      const index = current.activeId === null ? current.entries.length : current.entries.findIndex(entry => entry.id === current.activeId);
      if (index <= 0) return current;
      moved = true;
      return { ...current, activeId: current.entries[index - 1].id };
    });
    return moved;
  }
  function next() {
    let moved = false;
    update(current => {
      if (current.activeId === null) return current;
      const index = current.entries.findIndex(entry => entry.id === current.activeId);
      moved = true;
      return { ...current, activeId: current.entries[index + 1]?.id ?? null };
    });
    return moved;
  }

  return {
    remember, clear, markLiked, previous, next, entries: visible.entries,
    active: position < 0 ? null : visible.entries[position],
    preceding: visible.entries[currentPosition - 1] ?? null,
    following: position < 0 ? [] : visible.entries.slice(position + 1),
    browsing: position >= 0, canGoBack: currentPosition > 0,
    ready: visible.ready, persistenceUnavailable: visible.unavailable,
  };
}
