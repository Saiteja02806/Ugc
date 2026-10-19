"use client";

import { useEffect, useState } from "react";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { isRecoverableTrendingReview, type ReviewedTrendingCandidate } from "@/lib/trending/reviewed-feed-candidate";
import type { ReviewedPost } from "@/lib/trending/post-review-history";

export function useQuotaReviewRecovery(userId: string | null, feedId: string | undefined,
  recover: (entries: ReviewedPost<ReviewedTrendingCandidate>[]) => void) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ key: "", loading: false, error: false, unavailable: 0 });
  const key = `${userId ?? ""}:${feedId ?? ""}:${attempt}`;
  useEffect(() => {
    if (!userId || !feedId) return;
    const controller = new AbortController();
    async function load() {
      try {
        let before: number | null = null;
        let unavailable = 0;
        do {
          const token = await getCurrentUserIdToken();
          if (controller.signal.aborted) return;
          if (!token) throw new Error("Sign in to recover previous posts.");
          const query = new URLSearchParams({ feedId: feedId! });
          if (before !== null) query.set("before", String(before));
          const response = await fetch(`/api/trending/feed/history?${query}`, {
            cache: "no-store", headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]),
          });
          const data = await response.json();
          if (controller.signal.aborted) return;
          if (!response.ok || !data?.ok || data.feedId !== feedId || !Array.isArray(data.entries) ||
            data.entries.some((entry: ReviewedPost<unknown>) => !entry || !isRecoverableTrendingReview(entry.value) ||
              entry.id !== entry.value.item.id || !Number.isSafeInteger(entry.position) || !Number.isFinite(entry.reviewedAt) ||
              !["liked", "skipped"].includes(entry.decision)) ||
            (data.nextBefore !== null && (!Number.isSafeInteger(data.nextBefore) || data.nextBefore < 0 ||
              (before !== null && data.nextBefore >= before)))) throw new Error("Could not recover earlier posts.");
          recover(data.entries);
          unavailable += data.unavailableCount ?? 0;
          before = data.nextBefore;
        } while (before !== null);
        setState({ key, loading: false, error: false, unavailable });
      } catch {
        if (!controller.signal.aborted) setState({ key, loading: false, error: true, unavailable: 0 });
      }
    }
    void load();
    return () => controller.abort();
  }, [userId, feedId, key, attempt, recover]);
  return { ...(state.key === key ? state : { loading: Boolean(userId && feedId), error: false, unavailable: 0 }),
    retry: () => setAttempt(value => value + 1) };
}
