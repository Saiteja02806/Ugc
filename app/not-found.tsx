import { ArrowLeft, Compass } from "lucide-react";
import Link from "next/link";

import { ProductLogoMark } from "@/components/brand/product-logo";

export default function NotFound() {
  return (
    <main className="instagram-theme flex min-h-dvh items-center justify-center bg-background px-5 py-12 text-foreground">
      <section className="w-full max-w-lg rounded-[var(--radius-modal)] border border-border bg-card p-7 text-center shadow-floating sm:p-10">
        <ProductLogoMark
          className="mx-auto size-12 rounded-card bg-primary p-3"
          imageClassName="brightness-0 invert"
          sizes="48px"
        />
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.14em] text-primary">
          404 · Page not found
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-foreground-strong sm:text-4xl">
          This page isn’t here.
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted sm:text-base">
          The link may be outdated, or the page may have moved. Return to the
          workspace and keep creating.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-control bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to home
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-control border border-border-strong bg-card px-5 text-sm font-semibold text-foreground transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            <Compass className="size-4" aria-hidden="true" />
            Open workspace
          </Link>
        </div>
      </section>
    </main>
  );
}
