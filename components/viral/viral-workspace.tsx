"use client";

import {
  AlertCircle,
  Clapperboard,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import Script from "next/script";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { HookReviewCard } from "@/components/viral/hook-review-card";
import type { InstagramEmbedSdkState } from "@/components/viral/instagram-embed";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type {
  ViralReviewItem,
  ViralReviewPage,
  ViralReviewTiming,
} from "@/lib/viral/hook-review";

const ACTIVE_SECTION = ["hook-videos"];
const PAGE_SIZE = 12;

type ReviewPageResponse = ViralReviewPage & {
  message?: unknown;
  ok?: unknown;
};

export function ViralWorkspace() {
  const [items, setItems] = useState<Array<ViralReviewItem>>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"error" | "loading" | "ready">(
    "loading",
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [sdkRevision, setSdkRevision] = useState(0);
  const [sdkState, setSdkState] =
    useState<InstagramEmbedSdkState>("loading");
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);

  const loadFirstPage = useCallback(async (signal?: AbortSignal) => {
    try {
      const page = await fetchReviewPage(null, signal);
      setItems(page.items);
      setNextCursor(page.nextCursor);
      setLoadState("ready");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(
        error instanceof Error
          ? error.message
          : "Could not load the Explore review queue.",
      );
      setLoadState("error");
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current) return;

    loadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      const page = await fetchReviewPage(nextCursor);
      setItems((current) => mergeReviewItems(current, page.items));
      setNextCursor(page.nextCursor);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Could not load more Explore references.",
      );
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [nextCursor]);

  useEffect(() => {
    const controller = new AbortController();
    const frame = window.requestAnimationFrame(() => {
      void loadFirstPage(controller.signal);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      controller.abort();
    };
  }, [loadFirstPage]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !nextCursor || loadState !== "ready") return;

    if (!("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          void loadMore();
        }
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, loadState, nextCursor]);

  const reviewedCount = useMemo(
    () => items.filter((item) => item.timing !== null).length,
    [items],
  );

  function handleTimingSaved(referenceId: string, timing: ViralReviewTiming) {
    setItems((current) =>
      current.map((item) =>
        item.id === referenceId ? { ...item, timing } : item,
      ),
    );
  }

  return (
    <section className="min-h-dvh min-w-0 flex-1 bg-background px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <Script
        id="instagram-embed-sdk"
        src="https://www.instagram.com/embed.js"
        strategy="lazyOnload"
        onError={() => setSdkState("error")}
        onReady={() => {
          setSdkState("ready");
          setSdkRevision((revision) => revision + 1);
        }}
      />

      <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-7">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
              Private review queue
            </p>
            <h1 className="text-[32px] font-semibold tracking-[-0.035em] text-foreground-strong sm:text-[36px]">
              Explore
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted sm:text-[15px]">
              Watch each reference video and save the exact moment its opening
              hook ends. Every hook begins at 0 seconds.
            </p>
          </div>

          {loadState === "ready" ? (
            <div className="flex items-center gap-2" aria-label="Review progress">
              <Badge variant="outline">{items.length} loaded</Badge>
              <Badge variant={reviewedCount > 0 ? "success" : "draft"}>
                {reviewedCount} timed
              </Badge>
            </div>
          ) : null}
        </header>

        <ToggleGroup
          aria-label="Explore content sections"
          value={ACTIVE_SECTION}
          onValueChange={() => undefined}
          variant="outline"
          className="w-full justify-start overflow-x-auto border-b border-border pb-3 sm:w-fit sm:border-b-0 sm:pb-0"
        >
          <ToggleGroupItem value="hook-videos" aria-label="Hook Videos">
            Hook Videos
          </ToggleGroupItem>
          <ToggleGroupItem
            value="wall-of-text"
            aria-label="Wall of Text"
            disabled
          >
            Wall of Text
          </ToggleGroupItem>
          <ToggleGroupItem
            value="slideshows"
            aria-label="Slideshows"
            disabled
          >
            Slideshows
          </ToggleGroupItem>
        </ToggleGroup>

        {loadError && loadState === "ready" ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Some references could not be loaded</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : null}

        {sdkState === "error" && loadState === "ready" ? (
          <Alert variant="destructive" className="max-w-2xl">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Video previews could not load</AlertTitle>
            <AlertDescription>
              Instagram did not provide the video player. Check your connection
              or content-blocking settings, then refresh Explore.
            </AlertDescription>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => window.location.reload()}
              className="mt-2 w-fit"
            >
              <RefreshCw data-icon="inline-start" aria-hidden="true" />
              Refresh Explore
            </Button>
          </Alert>
        ) : null}

        {loadState === "loading" ? <ReviewGridSkeleton /> : null}

        {loadState === "error" ? (
          <Alert variant="destructive" className="max-w-2xl">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Explore could not load</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => {
                setLoadState("loading");
                setLoadError(null);
                void loadFirstPage();
              }}
              className="mt-2 w-fit"
            >
              <RefreshCw data-icon="inline-start" aria-hidden="true" />
              Try again
            </Button>
          </Alert>
        ) : null}

        {loadState === "ready" && items.length === 0 ? (
          <div className="min-h-[420px] rounded-xl border border-border bg-card shadow-card">
            <Empty className="min-h-[420px] border-0 px-6 py-12">
              <EmptyHeader>
                <EmptyMedia
                  variant="icon"
                  className="size-11 rounded-full bg-selected text-primary"
                >
                  <Clapperboard className="size-5" aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle className="text-base font-semibold text-foreground-strong">
                  No Hooks waiting for review
                </EmptyTitle>
                <EmptyDescription>
                  Newly imported hook videos will appear here when they are
                  ready for timing review.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : null}

        {loadState === "ready" && items.length > 0 ? (
          <div className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-2 xl:gap-6">
            {items.map((item) => (
              <HookReviewCard
                key={item.id}
                item={item}
                onTimingSaved={handleTimingSaved}
                sdkRevision={sdkRevision}
                sdkState={sdkState}
              />
            ))}
          </div>
        ) : null}

        <div ref={loadMoreSentinelRef} className="flex min-h-10 justify-center">
          {isLoadingMore ? (
            <div
              role="status"
              className="flex items-center gap-2 text-sm font-medium text-muted"
            >
              <LoaderCircle
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              Loading more references...
            </div>
          ) : nextCursor ? (
            <Button type="button" variant="outline" onClick={() => void loadMore()}>
              Load more
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ReviewGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2" aria-busy="true">
      {[0, 1].map((index) => (
        <div
          key={index}
          className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card"
        >
          <div className="bg-card-muted px-4 py-4 sm:px-5 sm:py-5">
            <Skeleton className="mx-auto aspect-[9/16] w-full max-w-[369px] rounded-[18px]" />
          </div>
          <div className="flex flex-col gap-4 border-t border-border px-4 py-5 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading the Explore Hook review queue.</span>
    </div>
  );
}

async function fetchReviewPage(
  cursor: string | null,
  signal?: AbortSignal,
): Promise<ViralReviewPage> {
  const token = await getCurrentUserIdToken();
  if (!token) {
    throw new Error("Your sign-in session is unavailable. Refresh and try again.");
  }

  const searchParams = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (cursor) searchParams.set("cursor", cursor);

  const response = await fetch(`/api/admin/viral/review?${searchParams}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  const data = (await response.json().catch(() => null)) as
    | ReviewPageResponse
    | null;

  if (!response.ok || data?.ok !== true || !Array.isArray(data.items)) {
    throw new Error(
      typeof data?.message === "string"
        ? data.message
        : "Could not load the Explore review queue.",
    );
  }

  return {
    items: data.items,
    nextCursor: typeof data.nextCursor === "string" ? data.nextCursor : null,
  };
}

function mergeReviewItems(
  current: Array<ViralReviewItem>,
  incoming: Array<ViralReviewItem>,
) {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return Array.from(byId.values());
}
