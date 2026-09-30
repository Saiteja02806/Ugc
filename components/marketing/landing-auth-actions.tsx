"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

import { useAuth } from "@/contexts/auth-context";
import { hasAuthSessionCookie } from "@/lib/firebase/auth-session";
import { cn } from "@/lib/utils";

type LandingAuthActionProps = {
  appearance: "header" | "menu";
  initialHasSession: boolean;
};

type LandingAuthCtaProps = {
  className?: string;
  initialHasSession: boolean;
};

function hasSessionCookie(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  return hasAuthSessionCookie(document.cookie);
}

function subscribeToHydration() {
  return () => {};
}

function useHasHydrated() {
  return useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
}

function useLandingAuthState(initialHasSession: boolean) {
  const { loading, user } = useAuth();
  const hasHydrated = useHasHydrated();

  // The first client render must match the server-rendered marketing page.
  // Firebase restores the browser session after hydration, so reading it early
  // can otherwise replace the signed-out server markup during hydration.
  const hasSession = hasHydrated
    ? Boolean(user) ||
      (loading && (initialHasSession || hasSessionCookie()))
    : initialHasSession;

  return {
    hasSession,
    needsEmailVerification: hasHydrated && Boolean(user && !user.emailVerified),
  };
}

export function LandingAuthAction({
  appearance,
  initialHasSession,
}: LandingAuthActionProps) {
  const { hasSession, needsEmailVerification } = useLandingAuthState(
    initialHasSession,
  );
  const className = cn(
    "inline-flex h-10 items-center rounded-full text-sm font-semibold",
    appearance === "header"
      ? "shrink-0 px-4"
      : "w-full justify-start px-3",
  );

  if (hasSession) {
    return (
      <Link
        href={needsEmailVerification ? "/verify-email" : "/dashboard"}
        className={cn(
          className,
          "justify-center bg-primary text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          appearance === "menu" && "justify-start",
        )}
      >
        {needsEmailVerification ? "Verify email" : "Start Posting"}
      </Link>
    );
  }

  return (
    <Link href="/sign-in" className={cn(className,
      "justify-center border border-border bg-card text-foreground transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
      appearance === "menu" && "justify-start",
    )}>Sign in</Link>
  );
}

export function LandingAuthCta({
  className,
  initialHasSession,
}: LandingAuthCtaProps) {
  const { hasSession, needsEmailVerification } = useLandingAuthState(
    initialHasSession,
  );
  const href = needsEmailVerification
    ? "/verify-email"
    : hasSession
      ? "/dashboard"
      : "/sign-in";
  const label = needsEmailVerification
    ? "Verify email"
    : hasSession
      ? "Start Posting"
      : "Start Creating";

  return (
    <Link href={href} className={className}>
      {label}
      <ArrowRight
        className="ml-2 size-4 transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}
