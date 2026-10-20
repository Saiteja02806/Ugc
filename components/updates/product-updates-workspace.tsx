import { ArrowLeft, Check, CheckCircle2, CircleDotDashed } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  LATEST_PRODUCT_UPDATE,
  PRODUCT_UPDATES,
  type ProductUpdate,
} from "@/lib/updates/product-updates";

export function ProductUpdatesWorkspace() {
  const earlierUpdates = PRODUCT_UPDATES.slice(1);

  return (
    <section className="min-h-dvh min-w-0 flex-1 bg-background px-4 py-5 text-foreground sm:px-6 sm:py-7 lg:px-10 lg:py-10">
      <div className="mx-auto w-full max-w-[1120px]">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="group inline-flex h-9 items-center gap-2 rounded-control px-2 text-sm font-semibold text-muted transition-colors hover:bg-card-muted hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            <ArrowLeft
              className="size-4 transition-transform group-hover:-translate-x-0.5 motion-reduce:transform-none"
              aria-hidden="true"
            />
            Back to workspace
          </Link>
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-subtle">
            Release log
          </span>
        </header>

        <div className="mt-12 max-w-3xl sm:mt-16">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">
            Product updates
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.055em] text-foreground-strong sm:text-5xl lg:text-6xl">
            What’s new in UGC Pilot
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            A clear record of the improvements, fixes, and new tools that make
            creating and publishing content smoother.
          </p>
        </div>

        <section
          className="relative mt-10 overflow-hidden rounded-[var(--radius-modal)] border border-border bg-card shadow-card sm:mt-14"
          aria-labelledby="latest-release-title"
        >
          <div className="absolute inset-y-0 left-0 w-1 bg-success" aria-hidden="true" />
          <div className="grid min-w-0 gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-12 lg:p-10">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge variant="success" className="h-6 px-2.5 text-[11px] font-bold">
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  Fixed
                </Badge>
                <time
                  dateTime={LATEST_PRODUCT_UPDATE.releasedOn}
                  className="text-xs font-medium text-muted"
                >
                  Released {LATEST_PRODUCT_UPDATE.releasedOnLabel}
                </time>
              </div>
              <h2
                id="latest-release-title"
                className="mt-5 text-3xl font-black tracking-[-0.045em] text-foreground-strong sm:text-4xl"
              >
                Instagram connection, restored.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
                {LATEST_PRODUCT_UPDATE.details} You can now connect an account
                from your settings and continue to scheduling without getting
                stuck in the connection step.
              </p>
            </div>

            <div className="flex min-w-0 flex-col rounded-[var(--radius-card)] border border-success/25 bg-success/10 p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-success">
                Connection status
              </p>
              <p className="mt-3 text-xl font-bold tracking-[-0.025em] text-foreground-strong">
                Ready to connect
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Add or reconnect your professional Instagram account from
                Settings.
              </p>
              <Link
                href="/settings#instagram-publishing"
                className="mt-auto pt-5 text-sm font-bold text-primary transition-colors hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                Open connected accounts →
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-12 sm:mt-16" aria-labelledby="release-details-title">
          <div className="flex items-end justify-between gap-6 border-b border-border pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-subtle">
                Latest release
              </p>
              <h2
                id="release-details-title"
                className="mt-2 text-2xl font-black tracking-[-0.035em] text-foreground-strong"
              >
                Release details
              </h2>
            </div>
            <span className="hidden font-mono text-xs text-muted-subtle sm:inline">
              01 / 01
            </span>
          </div>

          <UpdateDetails update={LATEST_PRODUCT_UPDATE} />
        </section>

        <section className="mt-12 border-t border-border pt-8 sm:mt-16 sm:pt-10" aria-labelledby="update-history-title">
          <div className="flex items-center gap-3">
            <CircleDotDashed className="size-5 text-muted-subtle" aria-hidden="true" />
            <h2
              id="update-history-title"
              className="text-xl font-bold tracking-[-0.025em] text-foreground-strong"
            >
              Update history
            </h2>
          </div>

          {earlierUpdates.length ? (
            <div className="mt-6 divide-y divide-border rounded-[var(--radius-card)] border border-border bg-card">
              {earlierUpdates.map((update) => (
                <UpdateHistoryItem key={update.id} update={update} />
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-muted">
              You’re up to date. New releases will appear here as soon as they
              ship.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}

function UpdateDetails({ update }: { update: ProductUpdate }) {
  return (
    <article id={update.id} className="grid scroll-mt-8 gap-6 py-7 sm:grid-cols-[150px_minmax(0,1fr)] sm:py-9">
      <div>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-muted-subtle">
          {update.releasedOnLabel}
        </p>
        <Badge variant="success" className="mt-3">
          Fixed
        </Badge>
      </div>
      <div className="min-w-0">
        <h3 className="text-xl font-bold tracking-[-0.025em] text-foreground-strong">
          {update.title}
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          {update.summary}
        </p>
        <ul className="mt-5 grid gap-3">
          {update.highlights.map((highlight) => (
            <li key={highlight} className="flex items-start gap-3 text-sm leading-6 text-foreground">
              <span className="mt-1 flex size-4 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                <Check className="size-3 stroke-[3]" aria-hidden="true" />
              </span>
              <span>{highlight}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function UpdateHistoryItem({ update }: { update: ProductUpdate }) {
  return (
    <article id={update.id} className="grid gap-2 p-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6">
      <time dateTime={update.releasedOn} className="text-sm font-semibold text-muted">
        {update.releasedOnLabel}
      </time>
      <div>
        <p className="font-bold text-foreground-strong">{update.title}</p>
        <p className="mt-1 text-sm leading-6 text-muted">{update.summary}</p>
      </div>
    </article>
  );
}
