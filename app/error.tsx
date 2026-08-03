"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { ProductLogoMark } from "@/components/brand/product-logo";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="instagram-theme flex min-h-dvh items-center justify-center bg-background px-5 py-12 text-foreground">
      <section className="w-full max-w-lg rounded-[var(--radius-modal)] border border-border bg-card p-7 text-center shadow-floating sm:p-10">
        <ProductLogoMark
          className="mx-auto size-12 rounded-card bg-primary p-3"
          imageClassName="brightness-0 invert"
          sizes="48px"
        />
        <span className="mx-auto mt-6 flex size-11 items-center justify-center rounded-card bg-error/10 text-error">
          <AlertTriangle className="size-5" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-[-0.035em] text-foreground-strong sm:text-4xl">
          Something interrupted this page.
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted sm:text-base">
          Your work has not been published. Try loading this screen again, or
          return to the workspace.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Button type="button" size="lg" onClick={() => unstable_retry()}>
            <RotateCcw data-icon="inline-start" aria-hidden="true" />
            Try again
          </Button>
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-border-strong bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            Back to workspace
          </Link>
        </div>
      </section>
    </main>
  );
}
