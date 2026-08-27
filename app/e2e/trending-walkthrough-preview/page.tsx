import { notFound } from "next/navigation";
import { LoaderCircle, Pencil, SlidersHorizontal } from "lucide-react";

import { TrendingFirstVisitWalkthrough } from "@/components/trending/trending-first-visit-walkthrough";

export default function TrendingWalkthroughPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex items-start justify-between gap-4 px-6 py-5 sm:px-8">
        <div>
          <h1 className="text-3xl font-semibold text-foreground-strong">Trending</h1>
          <p className="mt-1 text-sm text-muted">
            Explore Carousel, Hook, and Wall-of-text content made from your
            business profile.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            data-trending-adjust-control
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3.5 text-sm font-semibold text-foreground"
          >
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            Adjust
          </button>
          <button
            data-trending-edit-control
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3.5 text-sm font-semibold text-foreground"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            Edit
          </button>
        </div>
      </header>
      <section className="mt-3 flex min-h-0 flex-1 px-4 pb-4 sm:mt-4 sm:px-8 sm:pb-6">
        <div className="relative flex min-h-0 w-full flex-1 items-center" data-trending-feed-transition>
          <div className="flex min-w-0 flex-1 items-center justify-center">
            <div className="flex max-w-sm flex-col items-center text-center">
              <LoaderCircle
                aria-hidden="true"
                className="size-5 animate-spin text-primary motion-reduce:animate-none"
              />
              <p className="mt-3 text-sm font-semibold text-foreground-strong">
                Generating for you
              </p>
              <p className="mt-1.5 text-sm leading-6 text-muted">
                4 content pieces are being prepared. New content will appear
                here automatically.
              </p>
            </div>
          </div>
          <TrendingFirstVisitWalkthrough
            preview
            userId="e2e-walkthrough-preview"
          />
        </div>
      </section>
    </main>
  );
}
