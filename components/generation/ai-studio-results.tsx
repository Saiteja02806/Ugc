"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type AiStudioResultsStatus = {
  label: string;
  tone: "error" | "progress" | "neutral";
};

export function AiStudioResults({
  ariaLabel,
  children,
  emptyDescription,
  emptyTitle,
  failure,
  gridClassName,
  hasResults,
  loading = false,
  status,
  statusPlacement = "toolbar",
  scrollToLatestKey,
  toolbar,
}: {
  ariaLabel: string;
  children: ReactNode;
  emptyDescription?: string;
  emptyTitle?: string;
  failure?: ReactNode;
  gridClassName?: string;
  hasResults: boolean;
  loading?: boolean;
  status?: AiStudioResultsStatus | null;
  statusPlacement?: "toolbar" | "inline";
  scrollToLatestKey?: string | null;
  toolbar?: ReactNode;
}) {
  const resultsRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!scrollToLatestKey) return;
    const frame = window.requestAnimationFrame(() => {
      const results = resultsRef.current;
      if (results) results.scrollTop = results.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [scrollToLatestKey]);
  const showFailure = status?.tone === "error" && Boolean(failure) && !loading;
  const showStatusBadge =
    Boolean(status) &&
    !showFailure &&
    !(status?.tone === "progress" && statusPlacement === "inline" && hasResults) &&
    !(status?.tone === "progress" && !loading && !hasResults);

  return (
    <section
      ref={resultsRef}
      aria-label={ariaLabel}
      aria-busy={loading || status?.tone === "progress"}
      className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain"
    >
      {toolbar ? (
        <div className="sticky top-0 z-20 flex shrink-0 justify-end bg-background/90 px-1 pb-2 pt-1 backdrop-blur-sm">
          {toolbar}
        </div>
      ) : null}
      {showStatusBadge && status ? (
        <div
          className={cn(
            "sticky z-10 flex shrink-0 justify-start px-1 pb-2 pt-1",
            toolbar ? "top-12" : "top-0",
          )}
        >
          <Badge
            className="max-w-full whitespace-normal text-left leading-relaxed"
            variant={status.tone === "error" ? "destructive" : "secondary"}
            role={status.tone === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {status.tone === "progress" ? (
              <Loader2
                data-icon="inline-start"
                className="animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : status.tone === "error" ? (
              <AlertCircle data-icon="inline-start" aria-hidden="true" />
            ) : null}
            {status.label}
          </Badge>
        </div>
      ) : null}

      {showFailure && hasResults ? (
        <div className="mx-auto w-full max-w-2xl shrink-0 px-1 pb-5 pt-3">
          {failure}
        </div>
      ) : null}
      {loading ? (
        <div
          className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-8"
          role="status"
          aria-label={`Loading ${ariaLabel.toLowerCase()}`}
        >
          <Skeleton className="aspect-[9/16] w-[min(160px,20dvh)] rounded-xl" />
          <span className="text-xs text-muted">Loading your workspace…</span>
        </div>
      ) : hasResults ? (
        <div
          className={cn(
            "grid auto-rows-min grid-cols-1 gap-4 px-1 pb-8 pt-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4",
            gridClassName,
          )}
        >
          {children}
        </div>
      ) : showFailure ? (
        <div className="flex min-h-0 flex-1 flex-col px-1 py-8 sm:px-5">
          <div className="my-auto w-full max-w-xl shrink-0 self-center">{failure}</div>
        </div>
      ) : status?.tone === "progress" ? (
        <Empty
          className="min-h-0 flex-1 px-5 py-8"
          role="status"
          aria-live="polite"
        >
          <EmptyMedia variant="icon" className="size-11 rounded-xl">
            <Loader2
              className="size-5 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>{status.label}</EmptyTitle>
            <EmptyDescription>
              Your result is being prepared. You can keep this page open while
              it finishes.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Empty className="min-h-0 flex-1 px-5 py-8">
          <EmptyHeader>
            <EmptyTitle>{emptyTitle ?? "No generations yet"}</EmptyTitle>
            <EmptyDescription>
              {emptyDescription ??
                "Describe what you want to create below. Your results will appear here."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </section>
  );
}
