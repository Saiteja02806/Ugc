"use client";

import {
  AlertCircle,
  Clapperboard,
  LockKeyhole,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useBillingSubscription } from "@/components/billing/use-billing-subscription";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { ExploreHookVideo } from "@/lib/explore/hook-video-types";

type ExploreLoadState = "error" | "loading" | "ready";

type HookVideoResponse = {
  items?: unknown;
  message?: unknown;
  ok?: unknown;
  preview?: unknown;
};

type ExploreHookVideoLibrary = {
  items: Array<ExploreHookVideo>;
  preview: ExploreHookVideo | null;
};

export function ViralWorkspace() {
  const [items, setItems] = useState<Array<ExploreHookVideo>>([]);
  const [previewItem, setPreviewItem] = useState<ExploreHookVideo | null>(null);
  const [loadState, setLoadState] = useState<ExploreLoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const subscriptionQuery = useBillingSubscription();
  const isProUser = subscriptionQuery.data?.isActive === true;

  const loadHookVideos = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoadState("loading");
      setLoadError(null);
      const library = await fetchHookVideos(signal);
      setItems(library.items);
      setPreviewItem(library.preview);
      setLoadState("ready");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;

      setLoadError(
        error instanceof Error
          ? error.message
          : "Could not load the Explore Hook library.",
      );
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const frame = window.requestAnimationFrame(() => {
      void loadHookVideos(controller.signal);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      controller.abort();
    };
  }, [loadHookVideos]);

  return (
    <section className="min-h-dvh min-w-0 flex-1 bg-background px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-7">
        <header className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
            Explore
          </p>
          <h1 className="mt-2 text-[32px] font-semibold tracking-[-0.035em] text-foreground-strong sm:text-[36px]">
            Hook Videos
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted sm:text-[15px]">
            Watch proven Hook references, then bring one into AI Studio to create in your own style.
          </p>
        </header>

        {loadState === "loading" ? <HookVideoGridSkeleton /> : null}

        {loadState === "error" ? (
          <Alert variant="destructive" className="max-w-2xl">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Explore could not load</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => void loadHookVideos()}
              className="mt-2 w-fit"
            >
              <RefreshCw data-icon="inline-start" aria-hidden="true" />
              Try again
            </Button>
          </Alert>
        ) : null}

        {loadState === "ready" && items.length === 0 ? (
          <div className="min-h-[360px] rounded-xl border border-border bg-card shadow-card">
            <Empty className="min-h-[360px] border-0 px-6 py-12">
              <EmptyHeader>
                <EmptyMedia
                  variant="icon"
                  className="size-11 rounded-full bg-selected text-primary"
                >
                  <Clapperboard className="size-5" aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle className="text-base font-semibold text-foreground-strong">
                  No Hook videos yet
                </EmptyTitle>
                <EmptyDescription>
                  Hook videos will appear here after they are imported to Explore.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : null}

        {loadState === "ready" && items.length > 0 ? (
          isProUser ? (
            <div className="grid min-w-0 grid-cols-[repeat(auto-fill,minmax(220px,280px))] items-start justify-start gap-5">
              {items.map((item) => (
                <ExploreHookVideoCard key={item.id} item={item} />
              ))}
            </div>
          ) : previewItem ? (
            <ExploreProPreview
              checkingPlan={subscriptionQuery.isPending}
              item={previewItem}
              previewItems={items}
            />
          ) : (
            <Alert variant="destructive" className="max-w-2xl">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Explore preview is unavailable</AlertTitle>
              <AlertDescription>
                Refresh Explore to load the Pro preview.
              </AlertDescription>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => void loadHookVideos()}
                className="mt-2 w-fit"
              >
                <RefreshCw data-icon="inline-start" aria-hidden="true" />
                Try again
              </Button>
            </Alert>
          )
        ) : null}
      </div>
    </section>
  );
}

function ExploreProPreview({
  checkingPlan,
  item,
  previewItems,
}: {
  checkingPlan: boolean;
  item: ExploreHookVideo;
  previewItems: Array<ExploreHookVideo>;
}) {
  return (
    <section
      aria-label="Explore Pro preview"
      className="relative isolate overflow-hidden rounded-2xl border border-border bg-card px-4 py-8 shadow-card sm:px-8 sm:py-10"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden opacity-60"
      >
        <div className="grid min-w-[920px] grid-cols-4 gap-4 p-5 blur-[9px] sm:min-w-[1120px]">
          {previewItems.map((previewItem) => (
            <div
              key={previewItem.id}
              className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
            >
              <video
                aria-hidden="true"
                className="aspect-[9/16] w-full object-cover"
                muted
                playsInline
                preload="metadata"
                src={previewItem.videoUrl}
                tabIndex={-1}
              />
            </div>
          ))}
        </div>
        <div className="absolute inset-0 bg-background/55 backdrop-blur-[2px]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[560px] flex-col items-center">
        <div className="w-full max-w-[220px]">
          <ExploreHookVideoCard item={item} autoPlay />
        </div>

        <div className="mt-6 text-center sm:mt-7">
          <Badge variant="pro" className="mx-auto">
            <LockKeyhole data-icon="inline-start" aria-hidden="true" />
            Pro access
          </Badge>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-foreground-strong sm:text-[28px]">
            Turn a high-performing Hook into your next video.
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            This Hook performed well on Instagram. With Pro, you can watch the
            full library, select the right reference, and generate a version in
            your own style.
          </p>
          <ul className="mx-auto mt-4 w-fit space-y-2 text-left text-sm leading-5 text-foreground sm:text-[15px]">
            <li>Watch proven opening moments.</li>
            <li>Bring any Hook into AI Studio as your context.</li>
            <li>Generate, refine, and publish your own version.</li>
          </ul>
          {checkingPlan ? (
            <p className="mt-5 text-sm font-medium text-muted">
              Checking your plan…
            </p>
          ) : (
            <Link
              href="/pricing"
              className={buttonVariants({ size: "lg", className: "mt-5" })}
            >
              Upgrade to Pro
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

function ExploreHookVideoCard({
  item,
  autoPlay = false,
}: {
  item: ExploreHookVideo;
  autoPlay?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);

  function handlePlayToggle() {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      if (video.ended) {
        video.currentTime = 0;
      }

      void video.play().catch(() => {
        setIsPlaying(false);
      });
    } else {
      video.pause();
    }
  }

  return (
    <article className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-border-strong hover:shadow-md">
      <div className="relative aspect-[9/16] overflow-hidden bg-card-muted">
        <video
          ref={videoRef}
          aria-label="Explore Hook video"
          className="size-full object-cover"
          autoPlay={autoPlay}
          muted
          playsInline
          preload={autoPlay ? "auto" : "metadata"}
          src={item.videoUrl}
          onEnded={() => {
            setHasEnded(true);
            setIsPlaying(false);
          }}
          onPause={() => setIsPlaying(false)}
          onPlay={() => {
            setHasEnded(false);
            setIsPlaying(true);
          }}
        />
        <button
          type="button"
          onClick={handlePlayToggle}
          aria-label={
            isPlaying
              ? "Pause Hook video"
              : hasEnded
                ? "Replay Hook video"
                : "Play Hook video"
          }
          className={`absolute inset-0 flex items-center justify-center bg-black/0 transition-[background-color,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/90 hover:bg-black/10 ${
            autoPlay && isPlaying
              ? "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100"
              : "opacity-100"
          }`}
        >
          <span className="flex size-12 items-center justify-center rounded-full border border-white/70 bg-black/30 text-white shadow-sm backdrop-blur-sm transition-transform duration-150 group-hover:scale-105">
            {isPlaying ? (
              <Pause className="size-5" aria-hidden="true" />
            ) : (
              <Play className="ml-0.5 size-5 fill-current" aria-hidden="true" />
            )}
          </span>
        </button>
      </div>
      <div className="border-t border-border bg-card p-2">
        <Link
          href={getHookStudioHref(item)}
          className={buttonVariants({
            size: "lg",
            className: "w-full font-semibold",
          })}
        >
          <Sparkles data-icon="inline-start" className="size-3.5" aria-hidden="true" />
          Use This Hook
        </Link>
      </div>
    </article>
  );
}

function getHookStudioHref(item: ExploreHookVideo) {
  const params = new URLSearchParams({
    mode: "videos",
    refId: item.id,
    refType: "hook",
    sourceUrl: item.videoUrl,
  });

  return `/ai-studio?${params.toString()}`;
}

function HookVideoGridSkeleton() {
  return (
    <div
      className="grid grid-cols-[repeat(auto-fill,minmax(220px,280px))] items-start justify-start gap-5"
      aria-busy="true"
    >
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <div
          key={index}
          className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
        >
          <Skeleton className="aspect-[9/16] w-full rounded-none" />
          <div className="border-t border-border p-2">
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading Explore Hook videos.</span>
    </div>
  );
}

async function fetchHookVideos(
  signal?: AbortSignal,
): Promise<ExploreHookVideoLibrary> {
  const token = await getCurrentUserIdToken();
  if (!token) {
    throw new Error("Your sign-in session is unavailable. Refresh and try again.");
  }

  const response = await fetch("/api/explore/hook-videos", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  const data = (await response.json().catch(() => null)) as HookVideoResponse | null;

  if (!response.ok || data?.ok !== true || !Array.isArray(data.items)) {
    throw new Error(
      typeof data?.message === "string"
        ? data.message
        : "Could not load the Explore Hook library.",
    );
  }

  return {
    items: data.items.filter(isExploreHookVideo),
    preview: isExploreHookVideo(data.preview) ? data.preview : null,
  };
}

function isExploreHookVideo(value: unknown): value is ExploreHookVideo {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "videoUrl" in value &&
    typeof value.videoUrl === "string"
  );
}
