import { ArrowUpRight, Sparkles } from "lucide-react";
import Link from "next/link";

import { LATEST_PRODUCT_UPDATE } from "@/lib/updates/product-updates";

export function WorkspaceFooter() {
  return (
    <footer className="border-t border-border bg-card px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-brand-soft text-primary">
            <Sparkles className="size-4" aria-hidden="true" />
          </span>
          <p className="min-w-0 text-sm text-muted">
            <span className="font-semibold text-foreground-strong">
              Product updates
            </span>{" "}
            <span className="hidden sm:inline">· </span>
            <span className="block truncate sm:inline">
              {LATEST_PRODUCT_UPDATE.title}
            </span>
          </p>
        </div>
        <Link
          href={`/updates#${LATEST_PRODUCT_UPDATE.id}`}
          className="group inline-flex w-fit items-center gap-1.5 rounded-control px-2 py-1 text-sm font-semibold text-primary transition-colors hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          View updates
          <ArrowUpRight
            className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none"
            aria-hidden="true"
          />
        </Link>
      </div>
    </footer>
  );
}
