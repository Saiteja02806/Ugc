"use client";

import {
  AlertCircle,
  Clapperboard,
  Images,
  LoaderCircle,
  RefreshCw,
  ScanText,
  Video,
} from "lucide-react";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

import { HookReviewCard } from "@/components/viral/hook-review-card";
import type { InstagramEmbedSdkState } from "@/components/viral/instagram-embed";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
} from "@/lib/viral/hook-review";

type ExploreSection = "hook-videos" | "wall-of-text" | "slideshows";

const SECTION_CONFIG: Record<
  ExploreSection,
  {
    backendSection: "hook_video" | "wall_of_text" | "slideshow";
    emptyDescription: string;
    emptyTitle: string;
    label: string;
    subtitle: string;
  }
> = {
  "hook-videos": {
    backendSection: "hook_video",
    emptyDescription: "Newly imported Hook videos will appear here automatically.",
    emptyTitle: "No Hook videos yet",
    label: "Hook Videos",
    subtitle: "Watch each reference video and find the hook you want to use.",
  },
  "wall-of-text": {
    backendSection: "wall_of_text",
    emptyDescription:
      "Newly imported Wall of Text references will appear here automatically.",
    emptyTitle: "No Wall of Text posts yet",
    label: "Wall of Text",
    subtitle:
      "Browse viral text overlay references and see how creators format on-screen copy.",
  },
  slideshows: {
    backendSection: "slideshow",
    emptyDescription:
      "Newly imported Slideshow carousel references will appear here automatically.",
    emptyTitle: "No Slideshow posts yet",
    label: "Slideshows",
    subtitle:
      "Explore viral multi-slide carousel posts and discover high-performing slide formats.",
  },
};

const PAGE_SIZE = 12;

type ReviewPageResponse = ViralReviewPage & {
  message?: unknown;
  ok?: unknown;
};

export function ViralWorkspace() {
  const [activeSection, setActiveSection] =
    useState<ExploreSection>("hook-videos");
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

  const currentSectionConfig = SECTION_CONFIG[activeSection];

  const loadFirstPage = useCallback(
    async (section: ExploreSection, signal?: AbortSignal) => {
      try {
        setLoadState("loading");
        setLoadError(null);
        const backendSection = SECTION_CONFIG[section].backendSection;
        const page = await fetchReviewPage(backendSection, null, signal);
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
    },
    [],
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current) return;

    loadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      const backendSection = SECTION_CONFIG[activeSection].backendSection;
      const page = await fetchReviewPage(backendSection, nextCursor);
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
  }, [activeSection, nextCursor]);

  useEffect(() => {
    const controller = new AbortController();
    const frame = window.requestAnimationFrame(() => {
      void loadFirstPage(activeSection, controller.signal);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      controller.abort();
    };
  }, [activeSection, loadFirstPage]);

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
        <header className="flex flex-col gap-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
                Private review queue
              </p>
              {loadState === "ready" && items.length > 0 ? (
                <span className="inline-flex items-center rounded-full bg-card-muted px-2.5 py-0.5 text-xs font-medium text-muted">
                  {items.length} {items.length === 1 ? "reference" : "references"}
                </span>
              ) : null}
            </div>
            <h1 className="text-[32px] font-semibold tracking-[-0.035em] text-foreground-strong sm:text-[36px]">
              Explore
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted sm:text-[15px]">
              {currentSectionConfig.subtitle}
            </p>
          </div>
        </header>

        <ToggleGroup
          aria-label="Explore content sections"
          value={[activeSection]}
          onValueChange={(val) => {
            const next = val[0] as ExploreSection | undefined;
            if (next && next !== activeSection) {
              setItems([]);
              setNextCursor(null);
              setActiveSection(next);
            }
          }}
          variant="outline"
          className="inline-flex w-fit max-w-full items-center gap-1 rounded-full border border-border bg-card-muted p-1 sm:w-fit"
        >
          <ToggleGroupItem
            value="hook-videos"
            aria-label="Hook Videos"
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold data-[state=on]:bg-card data-[state=on]:text-foreground-strong data-[state=on]:shadow-sm transition-[background-color,color,box-shadow]"
          >
            <Video className="size-3.5 text-primary" aria-hidden="true" />
            Hook Videos
          </ToggleGroupItem>
          <ToggleGroupItem
            value="wall-of-text"
            aria-label="Wall of Text"
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold data-[state=on]:bg-card data-[state=on]:text-foreground-strong data-[state=on]:shadow-sm transition-[background-color,color,box-shadow]"
          >
            <ScanText className="size-3.5 text-primary" aria-hidden="true" />
            Wall of Text
          </ToggleGroupItem>
          <ToggleGroupItem
            value="slideshows"
            aria-label="Slideshows"
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold data-[state=on]:bg-card data-[state=on]:text-foreground-strong data-[state=on]:shadow-sm transition-[background-color,color,box-shadow]"
          >
            <Images className="size-3.5 text-primary" aria-hidden="true" />
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
                void loadFirstPage(activeSection);
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
                  {currentSectionConfig.emptyTitle}
                </EmptyTitle>
                <EmptyDescription>
                  {currentSectionConfig.emptyDescription}
                </EmptyDescription>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void loadFirstPage(activeSection);
                  }}
                  className="mt-3 gap-1.5"
                >
                  <RefreshCw data-icon="inline-start" className="size-3.5" aria-hidden="true" />
                  Refresh queue
                </Button>
              </EmptyHeader>
            </Empty>
          </div>
        ) : null}

        {loadState === "ready" && items.length > 0 ? (
          <div className="grid min-w-0 grid-cols-[repeat(auto-fill,minmax(220px,290px))] items-start justify-start gap-x-5 gap-y-8">
            {items.map((item) => (
              <HookReviewCard
                key={item.id}
                item={item}
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
    <div
      className="grid grid-cols-[repeat(auto-fill,minmax(220px,290px))] items-start justify-start gap-x-5 gap-y-8"
      aria-busy="true"
    >
      {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
        <div
          key={index}
          className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm"
        >
          <Skeleton className="aspect-[9/16] w-full rounded-none" />
          <div className="border-t border-border bg-card p-2">
            <Skeleton className="h-7 w-full rounded-md" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading the Explore Hook review queue.</span>
    </div>
  );
}

async function fetchReviewPage(
  section: "hook_video" | "wall_of_text" | "slideshow",
  cursor: string | null,
  signal?: AbortSignal,
): Promise<ViralReviewPage> {
  const token = await getCurrentUserIdToken();
  if (!token) {
    throw new Error("Your sign-in session is unavailable. Refresh and try again.");
  }

  const searchParams = new URLSearchParams({
    limit: String(PAGE_SIZE),
    section,
  });
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
