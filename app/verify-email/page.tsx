"use client";

import {
  CheckCircle2,
  LoaderCircle,
  MailCheck,
  RefreshCw,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { ProductLogoMark } from "@/components/brand/product-logo";
import { buttonClassName } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import {
  getFirebaseAuthErrorMessage,
  resendVerificationEmail,
} from "@/lib/firebase/auth";
import { getEmailSignInPath } from "@/lib/auth/email-policy";
import { getPostSignInDestination } from "@/lib/billing/purchase-intent";

export default function VerifyEmailPage() {
  return <Suspense fallback={<main className="min-h-screen bg-background" />}><VerifyEmailContent /></Suspense>;
}

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const intent = { plan: searchParams.get("plan") ?? undefined, billing: searchParams.get("billing") ?? undefined };
  const signInPath = getEmailSignInPath(intent);
  const successPath = getPostSignInDestination(searchParams);
  const { user, loading, refreshUser, signOut } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    searchParams.get("delivery") === "failed"
      ? "Your account was created, but we couldn't send the verification email. Request another below."
      : null,
  );
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (!resendCooldown) return;
    const timer = window.setTimeout(() => setResendCooldown((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      router.replace(signInPath);
      return;
    }

    if (user.emailVerified) {
      router.replace(successPath);
    }
  }, [loading, router, signInPath, successPath, user]);

  async function handleRefreshVerification() {
    setIsRefreshing(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const refreshedUser = await refreshUser();

      if (refreshedUser?.emailVerified) {
        setStatusMessage("Email verified. Opening your workspace…");
        router.replace(successPath);
        return;
      }

      setStatusMessage("Email is not verified yet.");
    } catch (error) {
      setErrorMessage(getFirebaseAuthErrorMessage(error));
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleResendVerification() {
    setIsResending(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const refreshedUser = await resendVerificationEmail(intent);
      await refreshUser();
      setResendCooldown(60);

      setStatusMessage(
        refreshedUser.emailVerified
          ? "Email is already verified."
          : "Verification email sent.",
      );
    } catch (error) {
      setErrorMessage(getFirebaseAuthErrorMessage(error));
    } finally {
      setIsResending(false);
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      await signOut();
      router.replace(signInPath);
    } catch (error) {
      setErrorMessage(getFirebaseAuthErrorMessage(error));
      setIsSigningOut(false);
    }
  }

  return (
    <main className="instagram-theme min-h-screen bg-background px-5 text-foreground sm:px-8">
      <header className="mx-auto flex h-20 max-w-6xl items-center justify-between">
        <Link href="/" className="flex items-center gap-3 font-bold">
          <ProductLogoMark className="h-8 w-12" sizes="52px" />
          <span>UGC Pilot</span>
        </Link>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut || loading}
          className="text-sm font-bold text-muted transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSigningOut ? "Signing out…" : "Use another account"}
        </button>
      </header>

      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center pb-12">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card/95 p-7 shadow-floating backdrop-blur sm:p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-primary">
              <MailCheck className="size-7" aria-hidden="true" />
            </div>
            <p className="mb-3 text-sm font-bold text-primary">
              Verify your email
            </p>
            <h1 className="text-3xl font-bold tracking-normal text-foreground">
              Check your inbox
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              Verify{" "}
              <span className="font-bold text-foreground">
                {user?.email ?? "your email"}
              </span>
              {" "}using the link in your inbox.
            </p>
          </div>

          <div className="grid gap-3">
            <button
              type="button"
              onClick={handleRefreshVerification}
              disabled={loading || isRefreshing || isResending}
              className={buttonClassName({
                className: "h-12 w-full gap-2 rounded-2xl",
              })}
            >
              {isRefreshing ? (
                <LoaderCircle
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <CheckCircle2 className="size-4" aria-hidden="true" />
              )}
              {isRefreshing ? "Checking…" : "I verified my email"}
            </button>

            <button
              type="button"
              onClick={handleResendVerification}
              disabled={loading || isRefreshing || isResending || resendCooldown > 0}
              className={buttonClassName({
                className: "h-12 w-full gap-2 rounded-2xl",
                variant: "secondary",
              })}
            >
              {isResending ? (
                <RefreshCw
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Send className="size-4" aria-hidden="true" />
              )}
              {isResending ? "Sending…" : resendCooldown ? `Resend in ${resendCooldown}s` : "Resend verification email"}
            </button>
          </div>

          {statusMessage ? (
            <p
              role="status"
              aria-live="polite"
              className="mt-5 text-center text-sm font-semibold text-success"
            >
              {statusMessage}
            </p>
          ) : null}

          {errorMessage ? (
            <p
              role="alert"
              className="mt-5 text-center text-sm font-semibold text-error"
            >
              {errorMessage}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
