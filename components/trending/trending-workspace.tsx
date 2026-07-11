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
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from "react";
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

type CompleteCarousel = {
  carousel: GeneratedCarousel;
  slides: ReadyCarouselSlide[];
};

type StackRelativePosition = -2 | -1 | 0 | 1 | 2;

type VisibleCarouselSlot = {
  candidate: CompleteCarousel;
  carouselIndex: number;
  relativePosition: StackRelativePosition;
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
const STACK_COLLECTION_ORDER: StackRelativePosition[] = [0, -1, 1, -2, 2];
const STACK_CARD_STYLES: Record<
  StackRelativePosition,
  { opacity: number; scale: number; translateX: string; zIndex: number }
> = {
  [-2]: {
    opacity: 0.84,
    scale: 0.76,
    translateX: "clamp(-330px, -29vw, -118px)",
    zIndex: 3,
  },
  [-1]: {
    opacity: 0.96,
    scale: 0.88,
    translateX: "clamp(-176px, -15vw, -62px)",
    zIndex: 4,
  },
  0: {
    opacity: 1,
    scale: 1,
    translateX: "0px",
    zIndex: 5,
  },
  1: {
    opacity: 0.96,
    scale: 0.88,
    translateX: "clamp(62px, 15vw, 176px)",
    zIndex: 4,
  },
  2: {
    opacity: 0.84,
    scale: 0.76,
    translateX: "clamp(118px, 29vw, 330px)",
    zIndex: 3,
  },
};
const LOADING_STACK_PLACEHOLDERS = [
  { opacity: 0.72, scale: 0.88, translateX: "-112px", zIndex: 1 },
  { opacity: 1, scale: 1, translateX: "0px", zIndex: 3 },
  { opacity: 0.72, scale: 0.88, translateX: "112px", zIndex: 1 },
] as const;

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
  const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);

  const completeCarousels = carousels.flatMap<CompleteCarousel>((carousel) => {
    const slides = getReadySlides(carousel);
    const hasCompleteCreative =
      carousel.status === "completed" &&
      slides.length === carousel.slideCount;

    return hasCompleteCreative ? [{ carousel, slides }] : [];
  });
  const lifecycleCarousels = carousels.filter((carousel) => {
    const slides = getReadySlides(carousel);

    return !(
      carousel.status === "completed" &&
      slides.length === carousel.slideCount
    );
  });
  const processingCarousels = lifecycleCarousels.filter(
    (carousel) => carousel.status !== "failed",
  );
  const failedCarousels = lifecycleCarousels.filter(
    (carousel) => carousel.status === "failed",
  );

  function setActiveSlide(carouselId: string, nextIndex: number) {
    setActiveSlideByCarouselId((current) => ({
      ...current,
      [carouselId]: nextIndex,
    }));
  }

  return (
    <div className="w-full space-y-10">
      {completeCarousels.length > 0 ? (
        <CarouselCandidateStack
          activeCarouselIndex={activeCarouselIndex}
          activeSlideByCarouselId={activeSlideByCarouselId}
          candidates={completeCarousels}
          onActiveCarouselChange={setActiveCarouselIndex}
          onActiveSlideChange={setActiveSlide}
        />
      ) : null}

      {processingCarousels.length > 0 ? (
        <CarouselPreparationState
          carousels={processingCarousels}
          compact={completeCarousels.length > 0}
        />
      ) : null}

      {failedCarousels.length > 0 ? (
        <CarouselFailureState
          count={failedCarousels.length}
          onRetry={onRetryPreparation}
        />
      ) : null}
    </div>
  );
}

function CarouselCandidateStack({
  activeCarouselIndex,
  activeSlideByCarouselId,
  candidates,
  onActiveCarouselChange,
  onActiveSlideChange,
}: {
  activeCarouselIndex: number;
  activeSlideByCarouselId: Record<string, number>;
  candidates: CompleteCarousel[];
  onActiveCarouselChange: (carouselIndex: number) => void;
  onActiveSlideChange: (carouselId: string, nextIndex: number) => void;
}) {
  const lastCarouselIndex = candidates.length - 1;
  const safeActiveCarouselIndex = Math.min(
    Math.max(activeCarouselIndex, 0),
    lastCarouselIndex,
  );
  const activeCandidate = candidates[safeActiveCarouselIndex];
  const title = getCarouselTitle(activeCandidate.carousel);
  const storedActiveSlideIndex =
    activeSlideByCarouselId[activeCandidate.carousel.carouselId] ?? 0;
  const activeSlideIndex = Math.min(
    storedActiveSlideIndex,
    Math.max(activeCandidate.slides.length - 1, 0),
  );
  const activeSlide = activeCandidate.slides[activeSlideIndex];
  const visibleCarouselSlots = getVisibleCarouselSlots(
    candidates,
    safeActiveCarouselIndex,
  );

  return (
    <section aria-label="Personalized carousel ideas" className="w-full">
      <div className="relative isolate mx-auto mt-3 h-[365px] w-full max-w-6xl overflow-hidden sm:mt-8 sm:h-[425px] lg:mt-10 lg:h-[440px]">
        {visibleCarouselSlots.map((slot) => (
          <CarouselStackCard
            key={slot.candidate.carousel.carouselId}
            activeSlideByCarouselId={activeSlideByCarouselId}
            candidate={slot.candidate}
            carouselCount={candidates.length}
            carouselIndex={slot.carouselIndex}
            isActive={slot.carouselIndex === safeActiveCarouselIndex}
            relativePosition={slot.relativePosition}
            onActiveSlideChange={onActiveSlideChange}
            onSelect={() => onActiveCarouselChange(slot.carouselIndex)}
          />
        ))}
      </div>
      <CarouselStackSummary
        activeSlide={activeSlide}
        carouselCount={candidates.length}
        carouselIndex={safeActiveCarouselIndex}
        title={title}
      />
      <span className="sr-only" aria-live="polite">
        Showing {title}, idea {safeActiveCarouselIndex + 1} of {candidates.length}
      </span>
    </section>
  );
}

function CarouselStackCard({
  activeSlideByCarouselId,
  candidate,
  carouselCount,
  carouselIndex,
  isActive,
  onSelect,
  onActiveSlideChange,
  relativePosition,
}: {
  activeSlideByCarouselId: Record<string, number>;
  candidate: CompleteCarousel;
  carouselCount: number;
  carouselIndex: number;
  isActive: boolean;
  onActiveSlideChange: (carouselId: string, nextIndex: number) => void;
  onSelect: () => void;
  relativePosition: StackRelativePosition;
}) {
  const title = getCarouselTitle(candidate.carousel);
  const storedSlideIndex =
    activeSlideByCarouselId[candidate.carousel.carouselId] ?? 0;
  const activeSlideIndex = Math.min(
    storedSlideIndex,
    Math.max(candidate.slides.length - 1, 0),
  );
  const activeSlide = candidate.slides[activeSlideIndex];
  const stackStyle = STACK_CARD_STYLES[relativePosition];
  const cardStyle: CSSProperties = {
    opacity: stackStyle.opacity,
    transform: `translateX(${stackStyle.translateX}) scale(${stackStyle.scale})`,
  };

  function selectCard() {
    if (!isActive) {
      onSelect();
    }
  }

  function handleCardKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (isActive || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }

    event.preventDefault();
    onSelect();
  }

  function moveSlide(event: ReactMouseEvent<HTMLButtonElement>, direction: number) {
    event.stopPropagation();
    onActiveSlideChange(
      candidate.carousel.carouselId,
      (activeSlideIndex + direction + candidate.slides.length) %
        candidate.slides.length,
    );
  }

  function selectSlide(event: ReactMouseEvent<HTMLButtonElement>, nextIndex: number) {
    event.stopPropagation();
    onActiveSlideChange(candidate.carousel.carouselId, nextIndex);
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 flex items-center justify-center",
        Math.abs(relativePosition) === 2 && "hidden lg:flex",
      )}
      style={{ zIndex: stackStyle.zIndex }}
    >
      <article
        aria-label={`${title}, idea ${carouselIndex + 1} of ${carouselCount}`}
        className={cn(
          "pointer-events-auto w-[min(72vw,260px)] origin-center overflow-visible transition-[opacity,transform] duration-300 ease-out will-change-transform motion-reduce:transition-none sm:w-[min(48vw,300px)] lg:w-[min(30vw,320px)]",
          !isActive &&
            "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
        )}
        onClick={selectCard}
        onKeyDown={handleCardKeyDown}
        role={isActive ? undefined : "button"}
        style={cardStyle}
        tabIndex={isActive ? undefined : 0}
      >
        <div
          className={cn(
            "relative aspect-[4/5] overflow-hidden rounded-lg bg-foreground-strong ring-1 ring-black/10",
            isActive
              ? "shadow-[0_18px_36px_rgb(9_9_11_/_0.22)]"
              : "shadow-[0_12px_26px_rgb(9_9_11_/_0.16)]",
          )}
        >
          {/* Rendered Carousel slides are immutable CloudFront creative assets. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeSlide.renderedUrl}
            alt={isActive ? `${title}, slide ${activeSlide.slideNumber}` : ""}
            aria-hidden={isActive ? undefined : "true"}
            className="size-full object-contain"
          />

          {candidate.slides.length > 1 ? (
            <>
              <button
                type="button"
                onClick={(event) => moveSlide(event, -1)}
                className={cn(
                  "absolute left-3 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white transition-[background-color,transform] hover:scale-105 hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black motion-reduce:transition-none",
                  isActive ? "size-9" : "size-8",
                )}
                aria-label={`Previous slide for ${title}`}
              >
                <ArrowLeft className={isActive ? "size-4" : "size-3.5"} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={(event) => moveSlide(event, 1)}
                className={cn(
                  "absolute right-3 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white transition-[background-color,transform] hover:scale-105 hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black motion-reduce:transition-none",
                  isActive ? "size-9" : "size-8",
                )}
                aria-label={`Next slide for ${title}`}
              >
                <ArrowRight className={isActive ? "size-4" : "size-3.5"} aria-hidden="true" />
              </button>
            </>
          ) : null}

          <div
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1.5"
            aria-label={`${title} slides`}
          >
            {candidate.slides.map((slide, index) => (
              <button
                key={slide.slideNumber}
                type="button"
                onClick={(event) => selectSlide(event, index)}
                aria-label={`Show slide ${index + 1} for ${title}`}
                aria-current={activeSlideIndex === index ? "true" : undefined}
                className={cn(
                  "h-1.5 rounded-full transition-[width,background-color] motion-reduce:transition-none",
                  activeSlideIndex === index
                    ? "w-4 bg-white"
                    : "w-1.5 bg-white/45 hover:bg-white/80",
                )}
              />
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}

function CarouselStackSummary({
  activeSlide,
  carouselCount,
  carouselIndex,
  title,
}: {
  activeSlide: ReadyCarouselSlide;
  carouselCount: number;
  carouselIndex: number;
  title: string;
}) {
  return (
    <div className="mx-auto mt-5 flex w-full max-w-[480px] flex-col gap-3 px-4 sm:flex-row sm:items-start sm:justify-between sm:px-0">
      <div className="min-w-0">
        <p className="line-clamp-1 text-sm font-semibold text-foreground-strong">
          {title}
        </p>
        <p className="mt-1 text-xs leading-5 text-muted">
          {getSlideRoleLabel(activeSlide)} | Idea {carouselIndex + 1} of {carouselCount}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
          Ready
        </span>
        <span title="Generation from Trending is coming soon.">
          <button
            type="button"
            disabled
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card-muted px-2.5 text-xs font-semibold text-muted disabled:cursor-not-allowed disabled:opacity-80"
            aria-label="Generate carousel, coming soon"
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            Generate
          </button>
        </span>
      </div>
    </div>
  );
}

function getVisibleCarouselSlots(
  candidates: CompleteCarousel[],
  activeCarouselIndex: number,
): VisibleCarouselSlot[] {
  if (candidates.length === 0) {
    return [];
  }

  const usedCarouselIndexes = new Set<number>();
  const slots = STACK_COLLECTION_ORDER.flatMap<VisibleCarouselSlot>(
    (relativePosition) => {
      const carouselIndex = getWrappedCarouselIndex(
        activeCarouselIndex + relativePosition,
        candidates.length,
      );

      if (usedCarouselIndexes.has(carouselIndex)) {
        return [];
      }

      usedCarouselIndexes.add(carouselIndex);

      return [
        {
          candidate: candidates[carouselIndex],
          carouselIndex,
          relativePosition,
        },
      ];
    },
  );

  return slots.sort(
    (first, second) => first.relativePosition - second.relativePosition,
  );
}

function getWrappedCarouselIndex(index: number, length: number) {
  return ((index % length) + length) % length;
}

function CarouselPreparationState({
  carousels,
  compact,
}: {
  carousels: GeneratedCarousel[];
  compact: boolean;
}) {
  const readySlideCount = carousels.reduce(
    (total, carousel) => total + carousel.readySlideCount,
    0,
  );
  const slideCount = carousels.reduce(
    (total, carousel) => total + carousel.slideCount,
    0,
  );
  const progress =
    slideCount > 0
      ? Math.min(Math.max((readySlideCount / slideCount) * 100, 0), 100)
      : 0;
  const status = getPreparationTitle(carousels);
  const ideaLabel = carousels.length === 1 ? "idea" : "ideas";

  return (
    <section
      role="status"
      aria-live="polite"
      className={cn(
        "w-full",
        compact && "border-y border-border py-5",
      )}
    >
      {!compact ? <CarouselLoadingStackVisual /> : null}

      <div
        className={cn(
          "mx-auto flex max-w-2xl items-start gap-4",
          !compact && "mt-5 px-4",
        )}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-soft text-primary">
          <Loader2
            className="size-5 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div>
              <p className="text-sm font-semibold text-foreground-strong">
                {status}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                {carousels.length} personalized carousel {ideaLabel} in progress
              </p>
            </div>
            <span className="text-xs font-medium tabular-nums text-muted">
              {readySlideCount}/{slideCount} slides ready
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function CarouselLoadingStackVisual() {
  return (
    <div
      className="relative isolate mx-auto h-[320px] w-full max-w-2xl overflow-hidden"
      aria-hidden="true"
    >
      {LOADING_STACK_PLACEHOLDERS.map((placeholder, index) => (
        <div
          key={placeholder.translateX}
          className="absolute inset-0 flex items-center justify-center"
          style={{ zIndex: placeholder.zIndex }}
        >
          <div
            className="relative aspect-[4/5] w-[230px] origin-center overflow-hidden rounded-lg border border-border bg-card-muted shadow-[0_8px_18px_rgb(9_9_11_/_0.08)]"
            style={{
              opacity: placeholder.opacity,
              transform: `translateX(${placeholder.translateX}) scale(${placeholder.scale})`,
            }}
          >
            <div className="size-full animate-pulse bg-card-muted p-6 motion-reduce:animate-none">
              <div className="h-2.5 w-16 rounded-full bg-border-strong/70" />
              <div className="mt-28 space-y-2.5">
                <div className="h-3 w-4/5 rounded-full bg-border-strong/70" />
                <div className="h-3 w-full rounded-full bg-border-strong/70" />
                <div className="h-3 w-3/5 rounded-full bg-border-strong/70" />
              </div>
              {index === 1 ? (
                <div className="absolute bottom-5 left-1/2 h-1.5 w-20 -translate-x-1/2 rounded-full bg-border-strong/70" />
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CarouselFailureState({
  count,
  onRetry,
}: {
  count: number;
  onRetry: () => void;
}) {
  const ideaLabel = count === 1 ? "idea needs" : "ideas need";

  return (
    <section className="flex flex-col gap-4 border-y border-error/20 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-error/10 text-error">
          <CircleAlert className="size-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground-strong">
            {count} carousel {ideaLabel} attention
          </p>
          <p className="mt-1 text-xs leading-5 text-muted">
            The worker did not finish these carousel renders.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-border-strong bg-white px-3 text-xs font-semibold text-foreground-strong transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
      >
        <RefreshCw className="size-3.5" aria-hidden="true" />
        Retry generation
      </button>
    </section>
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
      className="w-full"
    >
      <CarouselLoadingStackVisual />
      <div className="mx-auto mt-5 flex max-w-2xl items-center gap-4 px-4">
        <div className="size-10 shrink-0 animate-pulse rounded-md bg-brand-soft motion-reduce:animate-none" />
        <div className="min-w-0 flex-1 animate-pulse space-y-2 motion-reduce:animate-none">
          <div className="h-3 w-44 rounded-full bg-border-strong/70" />
          <div className="h-2.5 w-64 max-w-full rounded-full bg-border" />
        </div>
      </div>
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

function getPreparationTitle(carousels: GeneratedCarousel[]) {
  if (
    carousels.some(
      (carousel) =>
        carousel.slideCount > 1 &&
        carousel.readySlideCount >= carousel.slideCount - 1,
    )
  ) {
    return "Almost ready";
  }

  if (carousels.some((carousel) => carousel.readySlideCount > 0)) {
    return "Rendering slides";
  }

  if (carousels.some((carousel) => carousel.selectedAngle)) {
    return "Writing carousel content";
  }

  return "Preparing carousel ideas";
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
