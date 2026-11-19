"use client";

import { BlocksSpinner } from "@/components/ui/blocks-spinner";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";

const NavigationContext = createContext<((href: string) => "document" | "pending" | void) | null>(null);
export const NAVIGATION_RECOVERY_DELAY_MS = 15_000;

const isExploreHome = (pathname: string) => {
  const normalized = pathname === "/" ? "/" : pathname.replace(/\/$/, "");
  // The proxy mounts Explore at the public root while the address stays "/".
  return normalized === "/" || normalized === "/explore";
};

/** Recover an Explore landing-page link if client navigation never commits. */
export function WorkspaceNavigationFeedback({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<{ href: string; from: string; started: number; recoverWithDocument: boolean } | null>(null);
  const [slow, setSlow] = useState(false);
  const active = useRef<typeof pending>(null);
  const lastDocumentAttempt = useRef(0);
  const clear = useCallback(() => {
    active.current = null;
    setPending(null);
    setSlow(false);
  }, []);
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => { if (event.persisted) clear(); };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, [clear]);
  const start = useCallback((href: string) => {
    const destination = new URL(href, window.location.href);
    const from = window.location.pathname + window.location.search;
    if (destination.origin !== window.location.origin) return;
    if (destination.pathname + destination.search === from) {
      clear();
      return;
    }
    const openAnalytics = destination.pathname === "/analytics";
    if (active.current?.href === destination.href && active.current.from === from) {
      if (!openAnalytics) return;
      // A user may have cancelled a browser leave-page prompt. Allow an explicit
      // retry after the deadline without hiding recovery or moving that deadline.
      if (Date.now() - lastDocumentAttempt.current < NAVIGATION_RECOVERY_DELAY_MS) return "pending";
      lastDocumentAttempt.current = Date.now();
      return "document";
    }
    setSlow(false);
    const fromExplore = isExploreHome(window.location.pathname);
    const leavesExplore = !isExploreHome(destination.pathname);
    active.current = {
      href: destination.href,
      from,
      started: Date.now(),
      recoverWithDocument: !openAnalytics && fromExplore && leavesExplore,
    };
    setPending(active.current);
    if (openAnalytics) {
      lastDocumentAttempt.current = active.current.started;
      return "document";
    }
  }, [clear]);

  useEffect(() => {
    if (!pending) return;
    let attempted = false;
    const check = () => {
      if (active.current !== pending) return;
      // Also handles query-only routes and a different link winning the race.
      if (window.location.pathname + window.location.search !== pending.from) {
        clear();
      } else if (Date.now() - pending.started >= NAVIGATION_RECOVERY_DELAY_MS) {
        setSlow(true);
        if (pending.recoverWithDocument && !attempted &&
            document.visibilityState === "visible" && navigator.onLine) {
          attempted = true;
          window.location.assign(pending.href);
        }
      }
    };
    const timer = window.setInterval(check, 250);
    return () => window.clearInterval(timer);
  }, [pending, clear]);

  return <NavigationContext.Provider value={start}>
    {children}
    {pending ? <div role="status" aria-live="polite" className="instagram-theme fixed bottom-4 right-4 z-[var(--z-tooltip)] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card p-4 text-sm text-foreground shadow-floating">
      <p className="flex items-center gap-2"><BlocksSpinner aria-hidden="true" className="size-4 shrink-0" />{slow ? "This page is taking longer to open." : "Opening page…"}</p>
      {slow ? <><p className="mt-2 text-muted">You can open it separately and keep your current work here.</p>
        <a href={pending.href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-semibold text-primary underline">Open page in a new tab</a></> : null}
    </div> : null}
  </NavigationContext.Provider>;
}

export function WorkspaceLink({ onNavigate, href, prefetch, onPointerEnter, onPointerDown, onFocus, ...props }: ComponentProps<typeof Link>) {
  const start = useContext(NavigationContext);
  const pathname = usePathname();
  const [intentHref, setIntentHref] = useState<typeof href | null>(null);
  // Explore exposes many destinations at once. Warm only the link the user
  // approaches; keep every other screen's existing Next prefetch policy.
  const waitForIntent = (pathname === "/explore" || pathname === "/explore/") && intentHref !== href;
  return <Link {...props} href={href} prefetch={waitForIntent ? false : prefetch}
    onPointerEnter={event => { onPointerEnter?.(event); if (waitForIntent && !event.defaultPrevented) setIntentHref(href); }}
    onPointerDown={event => { onPointerDown?.(event); if (waitForIntent && !event.defaultPrevented) setIntentHref(href); }}
    onFocus={event => { onFocus?.(event); if (waitForIntent && !event.defaultPrevented) setIntentHref(href); }}
    onNavigate={event => {
    let cancelled = false;
    onNavigate?.({ preventDefault() { cancelled = true; event.preventDefault(); } });
    if (!cancelled && typeof href === "string") {
      const action = start?.(href);
      if (action === "pending" || action === "document") event.preventDefault();
      // An explicit Analytics click can use the browser even when the Next router is stalled.
      if (action === "document") window.location.assign(href);
    }
  }} />;
}
