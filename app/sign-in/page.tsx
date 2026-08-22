"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { ProductLogoMark } from "@/components/brand/product-logo";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth-context";
import { getPostSignInDestination } from "@/lib/billing/purchase-intent";

export default function SignInPage() {
  return (
    <main className="instagram-theme min-h-screen bg-background px-5 text-foreground sm:px-8">
      <Suspense fallback={null}>
        <SignInPostAuthRedirect />
      </Suspense>
      <header className="mx-auto flex h-20 max-w-6xl items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <ProductLogoMark
            className="size-9 rounded-control bg-primary p-2"
            imageClassName="brightness-0 invert"
            sizes="36px"
          />
          <span>UGC Pilot</span>
        </Link>

        <Link
          href="/"
          className="rounded-lg text-sm font-bold text-muted transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          Back to home
        </Link>
      </header>

      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center pb-12">
        <div className="relative w-full max-w-[420px] overflow-hidden rounded-3xl border border-border bg-card/95 p-7 shadow-floating backdrop-blur sm:p-8">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--instagram-orange),var(--instagram-rose),var(--instagram-violet),transparent)]"
          />
          <div className="mb-8 text-center">
            <Suspense fallback={<DefaultSignInContext />}>
              <SelectedPlanContext />
            </Suspense>
            <h1 className="text-balance text-3xl font-bold tracking-normal text-foreground">
              Sign in to your Instagram workspace
            </h1>
            <p className="mt-3 text-pretty text-sm leading-6 text-muted">
              Access your business profile, Trending, creative assets,
              and scheduled posts.
            </p>
          </div>

          <Suspense fallback={<GoogleSignInButton />}>
            <PurchaseAwareGoogleSignInButton />
          </Suspense>

          <p className="mt-6 text-center text-xs leading-5 text-muted-subtle">
            By continuing, you agree to the{" "}
            <Link className="font-bold text-primary" href="/terms">
              Terms
            </Link>{" "}
            and{" "}
            <Link className="font-bold text-primary" href="/privacy">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}

function SignInPostAuthRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace(
        user.emailVerified
          ? getPostSignInDestination(searchParams)
          : "/verify-email",
      );
    }
  }, [loading, router, searchParams, user]);

  return null;
}

function PurchaseAwareGoogleSignInButton() {
  const searchParams = useSearchParams();

  return (
    <GoogleSignInButton
      successPath={getPostSignInDestination(searchParams)}
    />
  );
}

function SelectedPlanContext() {
  const searchParams = useSearchParams();
  const selectedPlan = searchParams.get("plan");
  const isYearly = searchParams.get("billing") === "yearly";
  const planLabel =
    selectedPlan === "growth"
      ? `Growth Plan (${isYearly ? "$41/mo billed yearly" : "$49/mo"})`
      : selectedPlan === "starter"
        ? `Starter Plan (${isYearly ? "$24/mo billed yearly" : "$29/mo"})`
        : selectedPlan === "free"
          ? "Free Plan ($0)"
          : null;

  return planLabel ? (
    <div className="mb-3">
      <Badge
        variant="secondary"
        className="px-3 py-1 font-bold text-primary"
      >
        Selected: {planLabel}
      </Badge>
    </div>
  ) : (
    <DefaultSignInContext />
  );
}

function DefaultSignInContext() {
  return (
    <p className="mb-3 text-sm font-bold text-primary">
      Instagram content workspace
    </p>
  );
}
