"use client";

import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { AUTOMATIC_CAROUSEL_CANDIDATE_COUNT } from "@/lib/carousel/automatic-candidate-count";
import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { cn } from "@/lib/utils";

type CarouselHistoryState = "error" | "idle" | "loading" | "ready";

type GeneratedCarouselSlide = {
  headline: string;
  renderedUrl: string | null;
  slideNumber: number;
  slideType: string | null;
  status: "failed" | "processing" | "ready";
  subtext: string | null;
};

type ReadyCarouselSlide = GeneratedCarouselSlide & { renderedUrl: string };

type GeneratedCarousel = {
  candidateIndex: number;
  carouselId: string;
  categorySlug: string | null;
  generationBatchId: string;
  projectId: string;
  readySlideCount: number;
  selectedAngle: string | null;
  slideCount: number;
  slides: GeneratedCarouselSlide[];
  status: "completed" | "failed" | "processing";
  thumbnailUrl: string | null;
  updatedAt: string;
};

type CarouselProfileFeed = {
  error?: string | null;
  id?: string;
  state: "failed" | "missing" | "preparing" | "ready";
};

type CarouselHistoryResponse =
  | {
      ok: true;
      carousels: GeneratedCarousel[];
      profile: CarouselProfileFeed;
    }
  | {
      ok: false;
      message: string;
    };

const HISTORY_POLL_INTERVAL_MS = 6_000;

export function TrendingWorkspace() {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const expandedProfileIds = useRef(new Set<string>());
  const [generatedCarousels, setGeneratedCarousels] = useState<
    GeneratedCarousel[]
  >([]);
  const [carouselHistoryError, setCarouselHistoryError] = useState<string | null>(
    null,
  );
  const [carouselHistoryState, setCarouselHistoryState] =
    useState<CarouselHistoryState>("idle");
  const [carouselProfile, setCarouselProfile] = useState<CarouselProfileFeed | null>(
    null,
  );
  const [carouselHistoryRefreshKey, setCarouselHistoryRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredGeneratedCarousels = useMemo(() => {
    const matchingCarousels = normalizedSearchQuery
      ? generatedCarousels.filter((carousel) =>
          [
            carousel.selectedAngle,
            carousel.categorySlug,
            ...carousel.slides.map((slide) => slide.headline),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(normalizedSearchQuery),
        )
      : generatedCarousels;

    return [...matchingCarousels].sort(
      (first, second) => first.candidateIndex - second.candidateIndex,
    );
  }, [generatedCarousels, normalizedSearchQuery]);
  const carouselFeedProfile: CarouselProfileFeed | null = user
    ? carouselProfile
    : { state: "missing" };
  const carouselFeedLoading =
    authLoading ||
    (Boolean(user) &&
      (carouselHistoryState === "idle" || carouselHistoryState === "loading"));
  const carouselSearchEmpty =
    Boolean(normalizedSearchQuery) &&
    generatedCarousels.length > 0 &&
    filteredGeneratedCarousels.length === 0;

  useEffect(() => {
    if (!user) {
      return;
    }

    const controller = new AbortController();
    let pollTimer: number | null = null;

    async function ensureAutomaticCandidates(
      profile: CarouselProfileFeed,
      carouselCount: number,
      idToken: string,
    ) {
      if (
        !profile.id ||
        profile.state === "failed" ||
        profile.state === "missing" ||
        carouselCount >= AUTOMATIC_CAROUSEL_CANDIDATE_COUNT ||
        expandedProfileIds.current.has(profile.id)
      ) {
        return;
      }

      expandedProfileIds.current.add(profile.id);

      try {
        const response = await fetch(
          "/api/business-profile/ensure-carousel-candidates",
          {
            headers: { Authorization: `Bearer ${idToken}` },
            method: "POST",
            signal: controller.signal,
          },
        );
        const data = (await response.json().catch(() => null)) as {
          message?: string;
          ok?: boolean;
        } | null;

        if (!response.ok || !data?.ok) {
          throw new Error(
            data?.message ?? "Could not prepare additional carousel ideas.",
          );
        }

        if (!controller.signal.aborted) {
          setCarouselHistoryRefreshKey((current) => current + 1);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Could not expand the automatic carousel batch:", error);
        }
      }
    }

    async function loadCarouselHistory() {
      setCarouselHistoryState("loading");
      setCarouselHistoryError(null);

      try {
        const idToken = await getCurrentUserIdToken();

        if (!idToken) {
          throw new Error("Sign in before viewing generated carousels.");
        }

        const response = await fetch("/api/carousel/history?limit=12", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${idToken}` },
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => null)) as
          | CarouselHistoryResponse
          | null;

        if (!response.ok || !data?.ok) {
          throw new Error(
            data && !data.ok
              ? data.message
              : "Generated carousels are unavailable.",
          );
        }

        if (controller.signal.aborted) {
          return;
        }

        setGeneratedCarousels(data.carousels);
        setCarouselProfile(data.profile);
        setCarouselHistoryState("ready");
        void ensureAutomaticCandidates(
          data.profile,
          data.carousels.length,
          idToken,
        );

        if (
          data.profile.state === "preparing" ||
          data.carousels.some((carousel) => carousel.status === "processing")
        ) {
          pollTimer = window.setTimeout(() => {
            setCarouselHistoryRefreshKey((current) => current + 1);
          }, HISTORY_POLL_INTERVAL_MS);
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setGeneratedCarousels([]);
        setCarouselProfile(null);
        setCarouselHistoryError(
          error instanceof Error
            ? error.message
            : "Generated carousels are unavailable.",
        );
        setCarouselHistoryState("error");
      }
    }

    void loadCarouselHistory();

    return () => {
      controller.abort();
      if (pollTimer) {
        window.clearTimeout(pollTimer);
      }
    };
  }, [carouselHistoryRefreshKey, user]);

  function openBusinessProfile() {
    const previewSuffix =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("preview") === "1"
        ? "?preview=1"
        : "";

    router.push(`/onboarding${previewSuffix}`);
  }

  async function retryCarouselPreparation() {
    setCarouselHistoryError(null);

    try {
      const idToken = await getCurrentUserIdToken();

      if (!idToken) {
        throw new Error("Sign in before retrying carousel preparation.");
      }

      const response = await fetch("/api/business-profile/retry", {
        headers: { Authorization: `Bearer ${idToken}` },
        method: "POST",
      });
      const data = (await response.json().catch(() => null)) as {
        message?: string;
        ok?: boolean;
      } | null;

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.message ?? "Could not retry carousel preparation.",
        );
      }

      setCarouselHistoryRefreshKey((current) => current + 1);
    } catch (error) {
      setCarouselHistoryError(
        error instanceof Error
          ? error.message
          : "Could not retry carousel preparation.",
      );
      setCarouselHistoryState("error");
    }
  }

  return (
    <section className="min-h-screen flex-1 bg-background px-4 py-5 text-foreground sm:px-7 lg:px-10 lg:py-7">
      <div className="mx-auto flex min-h-full max-w-7xl flex-col">
        <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-balance text-2xl font-semibold text-foreground-strong">
              Trending carousels
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
              Browse five-slide creative ideas prepared from your business profile.
            </p>
          </div>

          <label className="flex h-11 w-full items-center gap-2.5 rounded-md border border-border-strong bg-white px-3 text-sm text-muted transition-[border-color,box-shadow] focus-within:border-focus focus-within:ring-2 focus-within:ring-focus/15 sm:w-[280px]">
            <Search className="size-4 shrink-0 text-muted-subtle" aria-hidden="true" />
            <span className="sr-only">Search personalized carousels</span>
            <input
              type="search"
              name="carouselSearch"
              autoComplete="off"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search carousel ideas"
              className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-subtle"
            />
          </label>
        </header>

        <div className="flex flex-1 items-start py-7">
          <GeneratedCarouselGallery
            carousels={filteredGeneratedCarousels}
            error={carouselHistoryError}
            loading={carouselFeedLoading}
            profile={carouselFeedProfile}
            searchEmpty={carouselSearchEmpty}
            onCompleteProfile={openBusinessProfile}
            onRetryHistory={() =>
              setCarouselHistoryRefreshKey((current) => current + 1)
            }
            onRetryPreparation={() => void retryCarouselPreparation()}
          />
        </div>
      </div>
    </section>
  );
}

function GeneratedCarouselGallery({
  carousels,
  error,
  loading,
  onCompleteProfile,
  onRetryHistory,
  onRetryPreparation,
  profile,
  searchEmpty,
}: {
  carousels: GeneratedCarousel[];
  error: string | null;
  loading: boolean;
  onCompleteProfile: () => void;
  onRetryHistory: () => void;
  onRetryPreparation: () => void;
  profile: CarouselProfileFeed | null;
  searchEmpty: boolean;
}) {
  if (loading) {
    return <GeneratedCarouselFeedSkeleton />;
  }

  if (error) {
    return (
      <CarouselFeedState
        actionIcon="refresh"
        actionLabel="Try again"
        icon="failed"
        message={error}
        onAction={onRetryHistory}
        title="Could not load carousels"
      />
    );
  }

  if (profile?.state === "missing") {
    return (
      <CarouselFeedState
        actionLabel="Complete business profile"
        icon="missing"
        message="Complete your business profile to prepare personalized carousel ideas."
        onAction={onCompleteProfile}
        title="Business profile needed"
      />
    );
  }

  if (profile?.state === "failed") {
    return (
      <CarouselFeedState
        actionLabel="Retry preparation"
        icon="failed"
        message={profile.error ?? "Carousel preparation did not finish."}
        onAction={onRetryPreparation}
        title="Carousel preparation failed"
      />
    );
  }

  if (searchEmpty) {
    return (
      <CarouselFeedState
        icon="missing"
        message="Try a different carousel angle, category, or headline."
        title="No matching carousels"
      />
    );
  }

  if (carousels.length === 0) {
    return (
      <CarouselFeedState
        icon="preparing"
        message="Your personalized carousel ideas are being prepared."
        title="Preparing carousel ideas"
      />
    );
  }

  return (
    <GeneratedCarouselFeed
      carousels={carousels}
      onRetryPreparation={onRetryPreparation}
    />
  );
}

function GeneratedCarouselFeed({
  carousels,
  onRetryPreparation,
}: {
  carousels: GeneratedCarousel[];
  onRetryPreparation: () => void;
}) {
  const [activeSlideByCarouselId, setActiveSlideByCarouselId] = useState<
    Record<string, number>
  >({});

  function setActiveSlide(carouselId: string, nextIndex: number) {
    setActiveSlideByCarouselId((current) => ({
      ...current,
      [carouselId]: nextIndex,
    }));
  }

  return (
    <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
      {carousels.map((carousel) => {
        const readySlides = getReadySlides(carousel);
        const hasCompleteCreative =
          carousel.status === "completed" &&
          readySlides.length === carousel.slideCount;

        if (hasCompleteCreative) {
          const storedIndex = activeSlideByCarouselId[carousel.carouselId] ?? 0;
          const activeSlideIndex = Math.min(
            storedIndex,
            Math.max(readySlides.length - 1, 0),
          );

          return (
            <CompactCarouselCard
              key={carousel.carouselId}
              activeSlideIndex={activeSlideIndex}
              carousel={carousel}
              slides={readySlides}
              onActiveSlideChange={(nextIndex) =>
                setActiveSlide(carousel.carouselId, nextIndex)
              }
            />
          );
        }

        return (
          <CarouselLifecycleCard
            key={carousel.carouselId}
            carousel={carousel}
            onRetry={onRetryPreparation}
          />
        );
      })}
    </div>
  );
}

function CompactCarouselCard({
  activeSlideIndex,
  carousel,
  onActiveSlideChange,
  slides,
}: {
  activeSlideIndex: number;
  carousel: GeneratedCarousel;
  onActiveSlideChange: (nextIndex: number) => void;
  slides: ReadyCarouselSlide[];
}) {
  const title = getCarouselTitle(carousel);
  const activeSlide = slides[activeSlideIndex];
  const previousSlide = slides[(activeSlideIndex - 1 + slides.length) % slides.length];
  const nextSlide = slides[(activeSlideIndex + 1) % slides.length];

  function moveSlide(direction: number) {
    onActiveSlideChange(
      (activeSlideIndex + direction + slides.length) % slides.length,
    );
  }

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-white shadow-[0_8px_20px_rgb(9_9_11_/_0.06)]">
      <div className="relative isolate aspect-[11/10] overflow-hidden border-b border-border bg-card-muted">
        {slides.length > 1 ? (
          // Rendered Carousel slides are immutable CloudFront creative assets.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previousSlide.renderedUrl}
            alt=""
            aria-hidden="true"
            className="absolute left-[-12%] top-1/2 h-[84%] w-auto -translate-y-1/2 rounded-md object-cover opacity-45 shadow-[0_8px_16px_rgb(9_9_11_/_0.1)]"
          />
        ) : null}

        {slides.length > 1 ? (
          // Rendered Carousel slides are immutable CloudFront creative assets.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={nextSlide.renderedUrl}
            alt=""
            aria-hidden="true"
            className="absolute right-[-12%] top-1/2 h-[84%] w-auto -translate-y-1/2 rounded-md object-cover opacity-45 shadow-[0_8px_16px_rgb(9_9_11_/_0.1)]"
          />
        ) : null}

        <figure className="absolute left-1/2 top-1/2 z-10 h-[94%] max-w-[74%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-md bg-foreground-strong shadow-[0_10px_22px_rgb(9_9_11_/_0.16)]">
          {/* Rendered Carousel slides are immutable CloudFront creative assets. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeSlide.renderedUrl}
            alt={`${title}, slide ${activeSlide.slideNumber}`}
            className="size-full object-cover"
          />
        </figure>

        {slides.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => moveSlide(-1)}
              className="absolute left-3 top-1/2 z-20 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-border-strong bg-white/95 text-foreground-strong shadow-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
              aria-label={`Previous slide for ${title}`}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => moveSlide(1)}
              className="absolute right-3 top-1/2 z-20 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-border-strong bg-white/95 text-foreground-strong shadow-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
              aria-label={`Next slide for ${title}`}
            >
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>

      <div className="flex min-h-32 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="line-clamp-1 text-sm font-semibold text-foreground-strong">
              {title}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">
              {getSlideRoleLabel(activeSlide)}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
            Ready
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="shrink-0 text-xs font-medium text-muted">
              {activeSlideIndex + 1} / {slides.length}
            </span>
            <div className="flex min-w-0 items-center gap-1.5" aria-label={`${title} slides`}>
              {slides.map((slide, index) => (
                <button
                  key={slide.slideNumber}
                  type="button"
                  onClick={() => onActiveSlideChange(index)}
                  aria-label={`Show slide ${index + 1} for ${title}`}
                  aria-current={activeSlideIndex === index ? "true" : undefined}
                  className={cn(
                    "h-1.5 rounded-full transition-[width,background-color] motion-reduce:transition-none",
                    activeSlideIndex === index
                      ? "w-4 bg-foreground-strong"
                      : "w-1.5 bg-border-strong hover:bg-muted",
                  )}
                />
              ))}
            </div>
          </div>

          <span title="Generation from Trending is coming soon.">
            <button
              type="button"
              disabled
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border bg-card-muted px-3 text-xs font-semibold text-muted disabled:cursor-not-allowed disabled:opacity-80"
              aria-label="Generate carousel, coming soon"
            >
              <Sparkles className="size-3.5" aria-hidden="true" />
              Generate
            </button>
          </span>
        </div>
      </div>
    </article>
  );
}

function CarouselLifecycleCard({
  carousel,
  onRetry,
}: {
  carousel: GeneratedCarousel;
  onRetry: () => void;
}) {
  const isFailed = carousel.status === "failed";
  const title = getCarouselTitle(carousel);
  const lifecycleTitle = getLifecycleTitle(carousel);
  const Icon = isFailed ? CircleAlert : Loader2;

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-white shadow-[0_8px_20px_rgb(9_9_11_/_0.04)]">
      <div className="relative flex aspect-[11/10] items-center justify-center overflow-hidden border-b border-border bg-card-muted px-8 text-center">
        <div className="absolute left-[11%] top-1/2 h-[72%] w-[47%] -translate-y-1/2 -rotate-6 rounded-md border border-border bg-white/70" />
        <div className="absolute right-[11%] top-1/2 h-[72%] w-[47%] -translate-y-1/2 rotate-6 rounded-md border border-border bg-white/70" />
        <div className="relative z-10 flex aspect-[4/5] h-[88%] flex-col items-center justify-center rounded-md border border-border-strong bg-white px-7 shadow-[0_8px_18px_rgb(9_9_11_/_0.08)]">
          <Icon
            className={cn(
              "size-6 text-muted",
              !isFailed && "animate-spin motion-reduce:animate-none",
              isFailed && "text-error",
            )}
            aria-hidden="true"
          />
          <p className="mt-3 text-sm font-semibold text-foreground-strong">
            {lifecycleTitle}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted">
            {carousel.readySlideCount}/{carousel.slideCount} slides ready
          </p>
        </div>
      </div>

      <div className="flex min-h-32 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="line-clamp-1 text-sm font-semibold text-foreground-strong">
              {title}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">
              {isFailed
                ? "This creative did not finish rendering."
                : "This creative will appear here as its slides finish rendering."}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
              isFailed
                ? "bg-error/10 text-error"
                : "bg-foreground-strong/8 text-foreground-strong",
            )}
          >
            {isFailed ? "Failed" : "Preparing"}
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" aria-label="Carousel slide progress">
            {Array.from({ length: carousel.slideCount }, (_, index) => (
              <span
                key={index}
                className={cn(
                  "h-1.5 rounded-full",
                  index < carousel.readySlideCount
                    ? "w-4 bg-foreground-strong"
                    : "w-1.5 bg-border-strong",
                )}
              />
            ))}
          </div>

          {isFailed ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border-strong bg-white px-3 text-xs font-semibold text-foreground-strong transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Retry
            </button>
          ) : (
            <span title="Generation from Trending is coming soon.">
              <button
                type="button"
                disabled
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border bg-card-muted px-3 text-xs font-semibold text-muted disabled:cursor-not-allowed disabled:opacity-80"
                aria-label="Generate carousel, coming soon"
              >
                <Sparkles className="size-3.5" aria-hidden="true" />
                Generate
              </button>
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function CarouselFeedState({
  actionIcon = "sparkles",
  actionLabel,
  icon,
  message,
  onAction,
  title,
}: {
  actionIcon?: "refresh" | "sparkles";
  actionLabel?: string;
  icon: "failed" | "missing" | "preparing";
  message: string;
  onAction?: () => void;
  title: string;
}) {
  const Icon =
    icon === "failed" ? CircleAlert : icon === "preparing" ? Loader2 : Sparkles;
  const ActionIcon = actionIcon === "refresh" ? RefreshCw : Sparkles;

  return (
    <div className="flex min-h-[420px] w-full flex-col items-center justify-center px-6 text-center">
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-md",
          icon === "failed" ? "bg-error/10 text-error" : "bg-brand-soft text-primary",
        )}
      >
        <Icon
          className={cn(
            "size-5",
            icon === "preparing" && "animate-spin motion-reduce:animate-none",
          )}
          aria-hidden="true"
        />
      </span>
      <div>
        <h2 className="mt-5 text-xl font-semibold text-foreground-strong">
          {title}
        </h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted">{message}</p>
      </div>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-foreground-strong transition-[filter,transform] hover:brightness-95 active:translate-y-px active:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
        >
          <ActionIcon className="size-4" aria-hidden="true" />
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function GeneratedCarouselFeedSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading generated carousels"
      className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3"
    >
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="aspect-[4/5] animate-pulse rounded-lg border border-border bg-card-muted motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}

function getReadySlides(carousel: GeneratedCarousel): ReadyCarouselSlide[] {
  return carousel.slides
    .filter(
      (slide): slide is ReadyCarouselSlide =>
        slide.status === "ready" && Boolean(slide.renderedUrl),
    )
    .sort((first, second) => first.slideNumber - second.slideNumber);
}

function getCarouselTitle(carousel: GeneratedCarousel) {
  return (
    carousel.selectedAngle?.trim() ||
    titleCaseSlug(carousel.categorySlug) ||
    `Carousel idea ${carousel.candidateIndex + 1}`
  );
}

function getSlideRoleLabel(slide: GeneratedCarouselSlide) {
  const role = slide.slideType?.trim();

  if (!role) {
    return `Slide ${slide.slideNumber}`;
  }

  return `${titleCaseSlug(role)} - slide ${slide.slideNumber}`;
}

function getLifecycleTitle(carousel: GeneratedCarousel) {
  if (carousel.status === "failed") {
    return "Carousel generation failed";
  }

  if (
    carousel.slideCount > 1 &&
    carousel.readySlideCount >= carousel.slideCount - 1
  ) {
    return "Almost ready";
  }

  if (carousel.readySlideCount > 0) {
    return "Rendering slides";
  }

  if (carousel.selectedAngle) {
    return "Writing content";
  }

  return "Preparing carousel idea";
}

function titleCaseSlug(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}
