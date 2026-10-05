"use client";

import { useCallback, useState } from "react";

export type ReviewedPost<T> = { id: string; value: T; decision: "liked" | "skipped" };

/** Visit-local viewing history. Browsing it never replays a durable decision. */
export function usePostReviewHistory<T>() {
  const [entries, setEntries] = useState<ReviewedPost<T>[]>([]);
  const [position, setPosition] = useState<number | null>(null);
  const currentPosition = position ?? entries.length;

  const remember = useCallback((entry: ReviewedPost<T>) => {
    setEntries((current) => [...current, entry].slice(-120));
    setPosition(null);
  }, []);
  const clear = useCallback(() => {
    setEntries([]);
    setPosition(null);
  }, []);
  const markLiked = useCallback((id: string) => {
    setEntries(current => current.map(entry => entry.id === id ? { ...entry, decision: "liked" } : entry));
  }, []);

  function previous() {
    if (currentPosition <= 0) return false;
    setPosition(currentPosition - 1);
    return true;
  }
  function next() {
    if (position === null) return false;
    setPosition(position + 1 < entries.length ? position + 1 : null);
    return true;
  }

  return {
    remember, clear, markLiked, previous, next, entries,
    active: position === null ? null : entries[position],
    preceding: entries[currentPosition - 1] ?? null,
    following: position === null ? [] : entries.slice(position + 1),
    browsing: position !== null,
    canGoBack: currentPosition > 0,
  };
}
