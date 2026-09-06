"use client";

import {
  AlertCircle,
  Clapperboard,
  FileText,
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
import type { ExploreVideoReference } from "@/lib/explore/hook-video-types";
import { cn } from "@/lib/utils";

type ExploreSection = "hook" | "wall_text";
type ExploreLoadState = "error" | "idle" | "loading" | "ready";

type ExploreVideoResponse = {
  items?: unknown;
  message?: unknown;
  ok?: unknown;
  preview?: unknown;
};

type ExploreVideoLibrary = {
  items: ExploreVideoReference[];
  preview: ExploreVideoReference | null;
};

type ExploreLibraryState = ExploreVideoLibrary & {
  error: string | null;
  loadState: ExploreLoadState;
};

type ExploreSectionConfig = {
  description: string;
  emptyDescription: string;
  emptyTitle: string;
  endpoint: string;
  label: string;
  previewDescription: string;
  previewFeatures: string[];
  previewTitle: string;
  referenceType: "hook" | "wall_text";
  videoLabel: string;
};

const EXPLORE_SECTION_CONFIG: Record<ExploreSection, ExploreSectionConfig> = {
  hook: {
    description:
      "Watch proven Hook references, then bring one into AI Studio to create in your own style.",
    emptyDescription: "Hook videos will appear here after they are imported to Explore.",
    emptyTitle: "No Hook videos yet",
    endpoint: "/api/explore/hook-videos",
    label: "Hook Videos",
    previewDescription:
      "This Hook performed well on Instagram. With Pro, you can watch the full library, select the right reference, and generate a version in your own style.",
    previewFeatures: [
      "Watch proven opening moments.",
      "Bring any Hook into AI Studio as your context.",
      "Generate, refine, and publish your own version.",
    ],
    previewTitle: "Turn a high-performing Hook into your next video.",
    referenceType: "hook",
    videoLabel: "Hook video",
  },
  wall_text: {
    description:
      "Study Wall of Text references, then recreate the format in AI Studio with your own reference image.",
    emptyDescription:
      "Wall of Text videos will appear here after they are imported to Explore.",
    emptyTitle: "No Wall of Text videos yet",
    endpoint: "/api/explore/wall-text-videos",
    label: "Wall of Text",
    previewDescription:
      "This Wall of Text reference shows a proven way to hold attention. With Pro, you can watch the complete library and create your own version.",
    previewFeatures: [
      "Study pacing and full-screen text treatments.",
      "Bring any Wall of Text reference into AI Studio.",
      "Recreate it in your own visual style.",
    ],
    previewTitle: "Turn a Wall of Text reference into your next video.",
    referenceType: "wall_text",
    videoLabel: "Wall of Text video",
  },
};

const INITIAL_LIBRARY_STATE: ExploreLibraryState = {
  error: null,
  items: [],
  loadState: "idle",
  preview: null,
};

// Keep the reference shelf dense and predictable on laptop workspaces. A
// 14-inch display can have less usable width than a 15.6-inch display once the
// persistent sidebar is visible, so auto-fill may unexpectedly drop to three
// cards. Four equal columns from the laptop breakpoint preserve the intended
// comparison rhythm without making phone cards too narrow.
const EXPLORE_VIDEO_GRID_CLASS_NAME =
  "grid min-w-0 w-full max-w-[1180px] grid-cols-1 items-start gap-3 min-[440px]:grid-cols-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4";

export function ViralWorkspace() {
  const [activeSection, setActiveSection] = useState<ExploreSection>("hook");
  const [libraries, setLibraries] = useState<
    Record<ExploreSection, ExploreLibraryState>
  >({
    hook: INITIAL_LIBRARY_STATE,
    wall_text: INITIAL_LIBRARY_STATE,
  });
  const subscriptionQuery = useBillingSubscription();
  const isProUser = subscriptionQuery.data?.isActive === true;
  const activeLibrary = libraries[activeSection];
  const config = EXPLORE_SECTION_CONFIG[activeSection];

  const loadVideos = useCallback(
    async (section: ExploreSection, signal?: AbortSignal) => {
      const sectionConfig = EXPLORE_SECTION_CONFIG[section];

      setLibraries((current) => ({
        ...current,
        [section]: {
          ...current[section],
          error: null,
          loadState: "loading",
        },
      }));

      try {
        const library = await fetchExploreVideos(sectionConfig.endpoint, signal);
        setLibraries((current) => ({
          ...current,
          [section]: {
            error: null,
            items: library.items,
            loadState: "ready",
            preview: library.preview,
          },
        }));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;

        setLibraries((current) => ({
          ...current,
          [section]: {
            ...current[section],
            error:
              error instanceof Error
                ? error.message
                : `Could not load the Explore ${sectionConfig.label} library.`,
            loadState: "error",
          },
        }));
      }
    },
    [],
  );

  useEffect(() => {
    if (activeLibrary.loadState !== "idle") return;

    const controller = new AbortController();
    const frame = window.requestAnimationFrame(() => {
      void loadVideos(activeSection, controller.signal);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      controller.abort();
    };
  }, [activeLibrary.loadState, activeSection, loadVideos]);

  return (
    <section className="min-h-dvh min-w-0 flex-1 bg-background px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-7">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">
              Explore Library
            </p>
            <h1 className="mt-2 text-[32px] font-semibold tracking-[-0.035em] text-foreground-strong sm:text-[36px]">
              {config.label}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted sm:text-[15px]">
              {config.description}
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Explore Library sections"
            className="inline-flex w-fit shrink-0 rounded-control border border-border bg-card p-1 sm:mt-1"
          >
            {(Object.keys(EXPLORE_SECTION_CONFIG) as ExploreSection[]).map(
              (section) => {
                const isActive = activeSection === section;
                const sectionConfig = EXPLORE_SECTION_CONFIG[section];

                return (
                  <button
                    key={section}
                    type="button"
                    role="tab"
                    aria-controls={`explore-${section}-panel`}
                    aria-selected={isActive}
                    onClick={() => setActiveSection(section)}
                    className={cn(
                      "min-h-9 rounded-[9px] px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted hover:bg-card-muted hover:text-foreground",
                    )}
                  >
                    {sectionConfig.label}
                  </button>
                );
              },
            )}
          </div>
        </header>

        <div
          id={`explore-${activeSection}-panel`}
          role="tabpanel"
          aria-label={config.label}
        >
          {activeLibrary.loadState === "idle" ||
          activeLibrary.loadState === "loading" ? (
            <ExploreVideoGridSkeleton />
          ) : null}

          {activeLibrary.loadState === "error" ? (
            <Alert variant="destructive" className="max-w-2xl">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Explore could not load</AlertTitle>
              <AlertDescription>{activeLibrary.error}</AlertDescription>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => void loadVideos(activeSection)}
                className="mt-2 w-fit"
              >
                <RefreshCw data-icon="inline-start" aria-hidden="true" />
                Try again
              </Button>
            </Alert>
          ) : null}

          {activeLibrary.loadState === "ready" &&
          activeLibrary.items.length === 0 ? (
            <ExploreVideoEmptyState section={activeSection} />
          ) : null}

          {activeLibrary.loadState === "ready" &&
          activeLibrary.items.length > 0 ? (
            isProUser ? (
              <div className={EXPLORE_VIDEO_GRID_CLASS_NAME}>
                {activeLibrary.items.map((item) => (
                  <ExploreVideoCard
                    key={item.id}
                    item={item}
                    section={activeSection}
                  />
                ))}
              </div>
            ) : activeLibrary.preview ? (
              <ExploreProPreview
                checkingPlan={subscriptionQuery.isPending}
                item={activeLibrary.preview}
                previewItems={activeLibrary.items}
                section={activeSection}
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
                  onClick={() => void loadVideos(activeSection)}
                  className="mt-2 w-fit"
                >
                  <RefreshCw data-icon="inline-start" aria-hidden="true" />
                  Try again
                </Button>
              </Alert>
            )
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ExploreVideoEmptyState({ section }: { section: ExploreSection }) {
  const config = EXPLORE_SECTION_CONFIG[section];
  const Icon = section === "hook" ? Clapperboard : FileText;

  return (
    <div className="min-h-[360px] rounded-xl border border-border bg-card shadow-card">
      <Empty className="min-h-[360px] border-0 px-6 py-12">
        <EmptyHeader>
          <EmptyMedia
            variant="icon"
            className="size-11 rounded-full bg-selected text-primary"
          >
            <Icon className="size-5" aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle className="text-base font-semibold text-foreground-strong">
            {config.emptyTitle}
          </EmptyTitle>
          <EmptyDescription>{config.emptyDescription}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}

function ExploreProPreview({
  checkingPlan,
  item,
  previewItems,
  section,
}: {
  checkingPlan: boolean;
  item: ExploreVideoReference;
  previewItems: ExploreVideoReference[];
  section: ExploreSection;
}) {
  const config = EXPLORE_SECTION_CONFIG[section];

  return (
    <section
      aria-label={`${config.label} Pro preview`}
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
          <ExploreVideoCard item={item} section={section} autoPlay />
        </div>

        <div className="mt-6 text-center sm:mt-7">
          <Badge variant="pro" className="mx-auto">
            <LockKeyhole data-icon="inline-start" aria-hidden="true" />
            Pro access
          </Badge>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-foreground-strong sm:text-[28px]">
            {config.previewTitle}
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            {config.previewDescription}
          </p>
          <ul className="mx-auto mt-4 w-fit space-y-2 text-left text-sm leading-5 text-foreground sm:text-[15px]">
            {config.previewFeatures.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
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

function ExploreVideoCard({
  item,
  section,
  autoPlay = false,
}: {
  item: ExploreVideoReference;
  section: ExploreSection;
  autoPlay?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const config = EXPLORE_SECTION_CONFIG[section];

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
          aria-label={`Explore ${config.videoLabel}`}
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
              ? `Pause ${config.videoLabel}`
              : hasEnded
                ? `Replay ${config.videoLabel}`
                : `Play ${config.videoLabel}`
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
          href={getExploreStudioHref(item, section)}
          className={buttonVariants({
            size: "lg",
            className: "w-full font-semibold",
          })}
        >
          <Sparkles data-icon="inline-start" className="size-3.5" aria-hidden="true" />
          Recreate
        </Link>
      </div>
    </article>
  );
}

function getExploreStudioHref(
  item: ExploreVideoReference,
  section: ExploreSection,
) {
  const params = new URLSearchParams({
    mode: "videos",
    exploreRecreate: "1",
    refId: item.id,
    refType: EXPLORE_SECTION_CONFIG[section].referenceType,
    sourceUrl: item.videoUrl,
  });

  return `/ai-studio?${params.toString()}`;
}

function ExploreVideoGridSkeleton() {
  return (
    <div className={EXPLORE_VIDEO_GRID_CLASS_NAME} aria-busy="true">
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
      <span className="sr-only">Loading Explore videos.</span>
    </div>
  );
}

async function fetchExploreVideos(
  endpoint: string,
  signal?: AbortSignal,
): Promise<ExploreVideoLibrary> {
  const token = await getCurrentUserIdToken();
  if (!token) {
    throw new Error("Your sign-in session is unavailable. Refresh and try again.");
  }

  const response = await fetch(endpoint, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  const data = (await response.json().catch(() => null)) as ExploreVideoResponse | null;

  if (!response.ok || data?.ok !== true || !Array.isArray(data.items)) {
    throw new Error(
      typeof data?.message === "string"
        ? data.message
        : "Could not load the Explore video library.",
    );
  }

  return {
    items: data.items.filter(isExploreVideoReference),
    preview: isExploreVideoReference(data.preview) ? data.preview : null,
  };
}

function isExploreVideoReference(value: unknown): value is ExploreVideoReference {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "videoUrl" in value &&
    typeof value.videoUrl === "string"
  );
}
