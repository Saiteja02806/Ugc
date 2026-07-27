"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { ProductLogoMark } from "@/components/brand/product-logo";
import { useAuth } from "@/contexts/auth-context";

export default function SignInPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace(user.emailVerified ? "/dashboard" : "/verify-email");
    }
  }, [user, loading, router]);

  return (
    <main className="min-h-screen bg-background px-5 text-foreground sm:px-8">
      <header className="mx-auto flex h-20 max-w-6xl items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-control text-sm font-bold text-foreground transition hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ProductLogoMark className="h-9 w-9" sizes="44px" />
          <span>UGC Pilot</span>
        </Link>

        <Link
          href="/"
          className="rounded-control px-2 py-1.5 text-sm font-bold text-muted transition hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Back to home
        </Link>
      </header>

      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center pb-12">
        <div className="w-full max-w-[420px] rounded-[var(--radius-panel)] border border-border bg-card p-6 text-foreground shadow-floating sm:p-8">
          <div className="mb-7 text-center">
            <div
              className="mx-auto mb-5 h-1 w-14 rounded-full bg-primary"
              aria-hidden="true"
            />
            <p className="mb-3 text-sm font-bold text-primary">
              Welcome to UGC Pilot
            </p>
            <h1 className="text-3xl font-bold leading-tight tracking-normal text-foreground-strong">
              Sign in to create social videos
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              Continue with Google to access your workspace, saved brand
              context, and generated videos.
            </p>
          </div>

          <GoogleSignInButton />

          <p className="mt-6 text-center text-xs leading-5 text-muted">
            By continuing, you agree to the{" "}
            <Link
              className="rounded-sm font-bold text-primary transition hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              href="/terms"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              className="rounded-sm font-bold text-primary transition hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              href="/privacy"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
