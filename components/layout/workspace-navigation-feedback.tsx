"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";

const NavigationContext = createContext<((href: string) => void) | null>(null);
export const NAVIGATION_RECOVERY_DELAY_MS = 15_000;

/** Recover an Explore landing-page link if client navigation never commits. */
export function WorkspaceNavigationFeedback({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<{ href: string; from: string; started: number; recoverWithDocument: boolean } | null>(null);
  const [slow, setSlow] = useState(false);
  const start = useCallback((href: string) => {
    const destination = new URL(href, window.location.href);
    const from = window.location.pathname + window.location.search;
    if (destination.origin !== window.location.origin) return;
    if (destination.pathname + destination.search === from) {
      setPending(null);
      setSlow(false);
      return;
    }
    setSlow(false);
    const fromExplore = /^\/explore\/?$/.test(window.location.pathname);
    const leavesExplore = !/^\/explore\/?$/.test(destination.pathname);
    setPending({
      href: destination.href,
      from,
      started: Date.now(),
      recoverWithDocument: fromExplore && leavesExplore,
    });
  }, []);

  useEffect(() => {
    if (!pending) return;
    let attempted = false;
    const check = () => {
      // Also handles query-only routes and a different link winning the race.
      if (window.location.pathname + window.location.search !== pending.from) {
        setPending(null);
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
  }, [pending]);

  return <NavigationContext.Provider value={start}>
    {children}
    {pending ? <div role="status" aria-live="polite" className="instagram-theme fixed bottom-4 right-4 z-[var(--z-tooltip)] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card p-4 text-sm text-foreground shadow-floating">
      <p className="flex items-center gap-2"><LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin motion-reduce:animate-none" />{slow ? "This page is taking longer to open." : "Opening page…"}</p>
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
    if (!cancelled && typeof href === "string") start?.(href);
  }} />;
}
