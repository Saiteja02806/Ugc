"use client";

import {
  CheckCircle2,
  LoaderCircle,
  MailCheck,
  RefreshCw,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ProductLogoMark } from "@/components/brand/product-logo";
import { buttonClassName } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import {
  getFirebaseAuthErrorMessage,
  resendVerificationEmail,
} from "@/lib/firebase/auth";

export default function VerifyEmailPage() {
  const router = useRouter();
  const { user, loading, refreshUser, signOut } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      router.replace("/sign-in");
      return;
    }

    if (user.emailVerified) {
      router.replace("/dashboard");
    }
  }, [loading, router, user]);

  async function handleRefreshVerification() {
    setIsRefreshing(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const refreshedUser = await refreshUser();

      if (refreshedUser?.emailVerified) {
        setStatusMessage("Email verified. Opening your workspace...");
        router.replace("/dashboard");
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
      const refreshedUser = await resendVerificationEmail();
      await refreshUser();

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
      router.replace("/sign-in");
    } catch (error) {
      setErrorMessage(getFirebaseAuthErrorMessage(error));
      setIsSigningOut(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-5 text-foreground sm:px-8">
      <header className="mx-auto flex h-20 max-w-6xl items-center justify-between">
        <Link href="/" className="flex items-center gap-3 font-bold">
          <ProductLogoMark className="h-8 w-12" sizes="52px" />
          <span>UGC Studio</span>
        </Link>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut || loading}
          className="text-sm font-bold text-muted transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSigningOut ? "Signing out..." : "Use another account"}
        </button>
      </header>

      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center pb-12">
        <div className="w-full max-w-md rounded-[2rem] bg-white/85 p-8 shadow-[0_24px_80px_rgb(15_23_42_/_0.08)] ring-1 ring-black/5 backdrop-blur">
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
              We sent a verification link to{" "}
              <span className="font-bold text-foreground">
                {user?.email ?? "your email"}
              </span>
              .
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
              {isRefreshing ? "Checking..." : "I verified my email"}
            </button>

            <button
              type="button"
              onClick={handleResendVerification}
              disabled={loading || isRefreshing || isResending}
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
              {isResending ? "Sending..." : "Resend verification email"}
            </button>
          </div>

          {statusMessage ? (
            <p className="mt-5 text-center text-sm font-semibold text-success">
              {statusMessage}
            </p>
          ) : null}

          {errorMessage ? (
            <p className="mt-5 text-center text-sm font-semibold text-error">
              {errorMessage}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
