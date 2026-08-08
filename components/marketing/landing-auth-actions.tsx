"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import Link from "next/link";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

type LandingAuthActionProps = {
  appearance: "header" | "menu";
};

type LandingAuthCtaProps = {
  className?: string;
};

export function LandingAuthAction({ appearance }: LandingAuthActionProps) {
  const { loading, user } = useAuth();
  const className = cn(
    "inline-flex h-10 items-center rounded-full text-sm font-semibold",
    appearance === "header"
      ? "shrink-0 px-4"
      : "w-full justify-start px-3",
  );

  if (loading) {
    return <SessionCheckStatus className={className} />;
  }

  if (user) {
    const needsEmailVerification = !user.emailVerified;

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

export function LandingAuthCta({ className }: LandingAuthCtaProps) {
  const { loading, user } = useAuth();

  if (loading) {
    return <SessionCheckStatus className={className} />;
  }

  const needsEmailVerification = user && !user.emailVerified;
  const href = needsEmailVerification
    ? "/verify-email"
    : user
      ? "/dashboard"
      : "/sign-in";
  const label = needsEmailVerification ? "Verify email" : "Start Creating";

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

function SessionCheckStatus({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "inline-flex items-center justify-center gap-2 text-muted",
        className,
      )}
    >
      <LoaderCircle
        className="size-4 animate-spin motion-reduce:animate-none"
        aria-hidden="true"
      />
      <span>Checking session</span>
    </span>
  );
}
