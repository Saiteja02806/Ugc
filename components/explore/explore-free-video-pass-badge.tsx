"use client";

import { useEffect, useSyncExternalStore } from "react";

import { useAuth } from "@/contexts/auth-context";
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
  window.addEventListener(FREE_VIDEO_PASS_UPDATED_EVENT, onStoreChange);
  return () => {
    window.removeEventListener(FREE_VIDEO_PASS_UPDATED_EVENT, onStoreChange);
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
  const available = useSyncExternalStore(
    subscribeToFreeVideoPassCookie,
    hasFreeVideoPassActiveCookie,
    getServerFreeVideoPassSnapshot,
  );

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;

    const cookieActive = hasFreeVideoPassActiveCookie();
    const sessionKey = `ugc_fv_pass_checked:${uid}`;
    let alreadyChecked = false;
    try {
      alreadyChecked = sessionStorage.getItem(sessionKey) === "1";
    } catch {
      alreadyChecked = false;
    }

    if (!cookieActive && alreadyChecked) return;

    const controller = new AbortController();
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
            freeVideoPass?: { available?: boolean } | null;
            isActive?: boolean;
          };
        };
        if (controller.signal.aborted) return;
        try {
          sessionStorage.setItem(sessionKey, "1");
        } catch {
          // Ignore storage restrictions.
        }
        const passAvailable = Boolean(
          payload.subscription?.freeVideoPass?.available &&
            !payload.subscription?.isActive,
        );
        syncFreeVideoPassUiCookie(passAvailable);
      } catch {
        // Keep current state if network request is aborted or unavailable.
      }
    })();

    return () => controller.abort();
  }, [user?.uid]);

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
