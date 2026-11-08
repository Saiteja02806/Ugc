"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";

import { useBillingSubscription } from "@/components/billing/use-billing-subscription";
import { useAuth } from "@/contexts/auth-context";
import { freeVideoPassShowsRemainingGeneration } from "@/lib/billing/free-video-pass-badge";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { cn } from "@/lib/utils";

export const FREE_VIDEO_PASS_UI_COOKIE = "ugc_free_video_pass_active";
export const FREE_VIDEO_PASS_UPDATED_EVENT = "ugc:free-video-pass-updated";

export function hasFreeVideoPassActiveCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((part) => part.trim() === `${FREE_VIDEO_PASS_UI_COOKIE}=1`);
}

export function subscribeToFreeVideoPassCookie(
  onStoreChange: () => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const notify = () => onStoreChange();
  window.addEventListener(FREE_VIDEO_PASS_UPDATED_EVENT, notify);
  window.addEventListener("pageshow", notify);
  document.addEventListener("visibilitychange", notify);
  return () => {
    window.removeEventListener(FREE_VIDEO_PASS_UPDATED_EVENT, notify);
    window.removeEventListener("pageshow", notify);
    document.removeEventListener("visibilitychange", notify);
  };
}

export function getServerFreeVideoPassSnapshot(): boolean {
  return false;
}

export function syncFreeVideoPassUiCookie(available: boolean) {
  if (typeof document === "undefined") return;
  if (available) {
    document.cookie = `${FREE_VIDEO_PASS_UI_COOKIE}=1; Path=/; Max-Age=604800; SameSite=Lax`;
  } else {
    document.cookie = `${FREE_VIDEO_PASS_UI_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(FREE_VIDEO_PASS_UPDATED_EVENT, {
        detail: { available },
      }),
    );
  }
}

export function ExploreFreeVideoPassBadge({
  className,
}: {
  className?: string;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const subscription = useBillingSubscription();
  const cookieAvailable = useSyncExternalStore(
    subscribeToFreeVideoPassCookie,
    hasFreeVideoPassActiveCookie,
    getServerFreeVideoPassSnapshot,
  );

  const subShowsRemaining =
    !subscription.data?.isActive &&
    freeVideoPassShowsRemainingGeneration(
      subscription.data?.freeVideoPass,
      subscription.data?.isActive,
    );

  const available = cookieAvailable || subShowsRemaining;

  useEffect(() => {
    if (subShowsRemaining && !cookieAvailable) {
      syncFreeVideoPassUiCookie(true);
    }
  }, [subShowsRemaining, cookieAvailable]);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;

    const controller = new AbortController();
    let disposed = false;
    let lastRefresh = 0;

    const refresh = () => {
      if (disposed || document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastRefresh < 1000) return;
      lastRefresh = now;
      void (async () => {
        try {
          const token = await getCurrentUserIdToken(uid);
          if (!token || controller.signal.aborted) return;
          const response = await fetch("/api/billing/subscription", {
            cache: "no-store",
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          });
          if (!response.ok || controller.signal.aborted) return;
          const payload = (await response.json()) as {
            subscription?: {
              freeVideoPass?: { available?: boolean; status?: string } | null;
              isActive?: boolean;
            };
          };
          if (controller.signal.aborted) return;
          const show = freeVideoPassShowsRemainingGeneration(
            payload.subscription?.freeVideoPass,
            payload.subscription?.isActive,
          );
          syncFreeVideoPassUiCookie(show);
          const cached = queryClient.getQueryData<{
            freeVideoPass?: { available?: boolean; status?: string } | null;
            isActive?: boolean;
          }>(["billing-subscription", uid]);
          if (
            show !==
            freeVideoPassShowsRemainingGeneration(
              cached?.freeVideoPass,
              cached?.isActive,
            )
          ) {
            void queryClient.invalidateQueries({
              queryKey: ["billing-subscription", uid],
            });
          }
        } catch {
          // Keep the invite cookie until a successful read says the pass is used.
        }
      })();
    };

    refresh();
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      disposed = true;
      controller.abort();
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [queryClient, user?.uid]);

  if (!available) return null;

  return (
    <span
      role="status"
      aria-live="polite"
      data-free-video-pass-badge="available"
      className={cn(
        "relative mr-1.5 inline-flex h-8 shrink-0 items-center justify-center rounded-[10px] border border-border bg-card px-3 pb-1 text-[11px] font-semibold leading-none text-foreground-strong",
        className,
      )}
    >
      <span className="whitespace-nowrap">1 generation left</span>
      <span
        data-free-video-pass-tag="free"
        className="absolute -bottom-2 -right-2 inline-flex items-center justify-center rounded-full border border-dashed border-emerald-400/80 bg-[#0b1713] px-2 py-[2px] text-[8px] font-bold uppercase leading-none tracking-wider text-emerald-400 shadow-xs"
      >
        Free
      </span>
    </span>
  );
}
