"use client";

import { ArrowUpRight, CheckCircle2, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { useAuth } from "@/contexts/auth-context";
import {
  LATEST_PRODUCT_UPDATE,
  shouldShowProductUpdateNotice,
} from "@/lib/updates/product-updates";

const PRODUCT_UPDATES_SEEN_STORAGE_KEY = "ugc-pilot.product-updates.last-seen";
const PRODUCT_UPDATES_CHANGE_EVENT = "ugc-pilot:product-updates-change";

export function ProductUpdatesCorner() {
  const pathname = usePathname();
  const { loading: isAuthLoading, user } = useAuth();
  const [isDismissedInSession, setIsDismissedInSession] = useState(false);
  const lastSeenUpdateId = useSyncExternalStore(
    subscribeToProductUpdatePreference,
    getLastSeenUpdateId,
    getServerLastSeenUpdateId,
  );
  const isVisible =
    !isAuthLoading &&
    Boolean(user) &&
    !isDismissedInSession &&
    lastSeenUpdateId !== LATEST_PRODUCT_UPDATE.id &&
    shouldShowProductUpdateNotice(
      LATEST_PRODUCT_UPDATE,
      user?.createdAt ?? null,
    ) &&
    pathname !== "/updates";

  if (!isVisible) {
    return null;
  }

  function markAsSeen() {
    try {
      window.localStorage.setItem(
        PRODUCT_UPDATES_SEEN_STORAGE_KEY,
        LATEST_PRODUCT_UPDATE.id,
      );
    } catch {
      // The notice remains usable when storage is unavailable.
    }

    window.dispatchEvent(new Event(PRODUCT_UPDATES_CHANGE_EVENT));
    setIsDismissedInSession(true);
  }

  return (
    <aside
      aria-labelledby="product-update-notice-title"
      className="fixed bottom-4 right-4 z-[var(--z-overlay)] w-[calc(100vw-2rem)] max-w-[360px] overflow-hidden rounded-[var(--radius-panel)] border border-success/30 bg-card/95 shadow-floating backdrop-blur-xl motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-300 sm:bottom-6 sm:right-6"
    >
      <div className="h-1 bg-success" aria-hidden="true" />
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-success">
              Issue corrected
            </p>
            <h2
              id="product-update-notice-title"
              className="mt-1 text-base font-bold tracking-[-0.02em] text-foreground-strong"
            >
              {LATEST_PRODUCT_UPDATE.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={markAsSeen}
            aria-label="Dismiss this product update"
            title="Dismiss"
            className="-mr-1 -mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-control text-muted-subtle transition-colors hover:bg-card-muted hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <p className="mt-3 pr-3 text-sm leading-6 text-muted">
          {LATEST_PRODUCT_UPDATE.details}
        </p>

        <Link
          href={`/updates#${LATEST_PRODUCT_UPDATE.id}`}
          onClick={markAsSeen}
          className="group mt-4 inline-flex items-center gap-1.5 rounded-control text-sm font-bold text-primary transition-colors hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          See the full update
          <ArrowUpRight
            className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none"
            aria-hidden="true"
          />
        </Link>
      </div>
    </aside>
  );
}

function getLastSeenUpdateId() {
  try {
    return window.localStorage.getItem(PRODUCT_UPDATES_SEEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function getServerLastSeenUpdateId() {
  // Keep the card out of the server-rendered shell; the browser will reveal it
  // only when this release has not been seen on the current device.
  return LATEST_PRODUCT_UPDATE.id;
}

function subscribeToProductUpdatePreference(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(PRODUCT_UPDATES_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(PRODUCT_UPDATES_CHANGE_EVENT, onStoreChange);
  };
}
