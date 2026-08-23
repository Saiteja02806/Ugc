"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
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

export function LandingAuthAction({
  appearance,
  initialHasSession,
}: LandingAuthActionProps) {
  const { loading, user } = useAuth();
  const className = cn(
    "inline-flex h-10 items-center rounded-full text-sm font-semibold",
    appearance === "header"
      ? "shrink-0 px-4"
      : "w-full justify-start px-3",
  );

  const hasSession =
    Boolean(user) ||
    (loading && (initialHasSession || hasSessionCookie()));

  if (hasSession) {
    const needsEmailVerification = user && !user.emailVerified;

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
    <GoogleSignInButton
      appearance={appearance}
      label="Sign in with Google"
    />
  );
}

export function LandingAuthCta({
  className,
  initialHasSession,
}: LandingAuthCtaProps) {
  const { loading, user } = useAuth();

  const hasSession =
    Boolean(user) ||
    (loading && (initialHasSession || hasSessionCookie()));
  const needsEmailVerification = user && !user.emailVerified;
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
