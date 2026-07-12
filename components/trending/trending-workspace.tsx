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
  PointerEvent as ReactPointerEvent,
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

type DeckDepth = 0 | 1 | 2;

type CarouselDeckSlot = {
  candidate: CompleteCarousel;
  carouselIndex: number;
  depth: DeckDepth;
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
const SWIPE_THRESHOLD_PX = 90;
const SWIPE_EXIT_DURATION_MS = 220;
const MAX_ROTATION_DEGREES = 5;
const DECK_CARD_STYLES: Record<
  DeckDepth,
  { opacity: number; scale: number; translateY: number; zIndex: number }
> = {
  0: {
    opacity: 1,
    scale: 1,
    translateY: 0,
    zIndex: 3,
  },
  1: {
    opacity: 0.9,
    scale: 0.965,
    translateY: 12,
    zIndex: 2,
  },
  2: {
    opacity: 0.65,
    scale: 0.93,
    translateY: 24,
    zIndex: 1,
  },
};
const LOADING_STACK_PLACEHOLDERS = [
  { opacity: 0.65, scale: 0.93, translateY: 24, zIndex: 1 },
  { opacity: 0.9, scale: 0.965, translateY: 12, zIndex: 2 },
  { opacity: 1, scale: 1, translateY: 0, zIndex: 3 },
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
  const swipeTimerRef = useRef<number | null>(null);
  const dragStartXRef = useRef<number | null>(null);
  const dragXRef = useRef(0);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [exitDirection, setExitDirection] = useState<"left" | "right" | null>(
    null,
  );
  const lastCarouselIndex = candidates.length - 1;
  const safeActiveCarouselIndex = Math.min(
    Math.max(activeCarouselIndex, 0),
    lastCarouselIndex,
  );
  const activeCandidate = candidates[safeActiveCarouselIndex];
  const title = getCarouselTitle(activeCandidate.carousel);
  const deckSlots = getCarouselDeckSlots(
    candidates,
    safeActiveCarouselIndex,
  );
  const canGoPrevious = safeActiveCarouselIndex > 0;
  const canGoNext = safeActiveCarouselIndex < lastCarouselIndex;

  useEffect(() => {
    const nextCandidate = candidates[safeActiveCarouselIndex + 1];
    const nextSlideIndex = nextCandidate
      ? Math.min(
          activeSlideByCarouselId[nextCandidate.carousel.carouselId] ?? 0,
          Math.max(nextCandidate.slides.length - 1, 0),
        )
      : 0;
    const urls = [
      ...activeCandidate.slides.map((slide) => slide.renderedUrl),
      nextCandidate?.slides[nextSlideIndex]?.renderedUrl,
    ].filter((url): url is string => Boolean(url));

    urls.forEach((url) => {
      const image = new window.Image();
      image.decoding = "async";
      image.src = url;
      void image.decode().catch(() => undefined);
    });
  }, [
    activeCandidate,
    activeSlideByCarouselId,
    candidates,
    safeActiveCarouselIndex,
  ]);

  useEffect(
    () => () => {
      if (swipeTimerRef.current !== null) {
        window.clearTimeout(swipeTimerRef.current);
      }
    },
    [],
  );

  function resetDrag() {
    dragStartXRef.current = null;
    dragXRef.current = 0;
    setDragX(0);
    setIsDragging(false);
    setExitDirection(null);
  }

  function goToCarousel(nextIndex: number) {
    if (
      exitDirection ||
      nextIndex < 0 ||
      nextIndex > lastCarouselIndex ||
      nextIndex === safeActiveCarouselIndex
    ) {
      return;
    }

    resetDrag();
    onActiveCarouselChange(nextIndex);
  }

  function completeCarouselSwipe(direction: "left" | "right") {
    const nextIndex =
      direction === "left"
        ? safeActiveCarouselIndex + 1
        : safeActiveCarouselIndex - 1;

    if (nextIndex < 0 || nextIndex > lastCarouselIndex) {
      resetDrag();
      return;
    }

    dragStartXRef.current = null;
    setIsDragging(false);
    setExitDirection(direction);

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    swipeTimerRef.current = window.setTimeout(
      () => {
        swipeTimerRef.current = null;
        onActiveCarouselChange(nextIndex);
        resetDrag();
      },
      reduceMotion ? 0 : SWIPE_EXIT_DURATION_MS,
    );
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    const target = event.target as HTMLElement;

    if (
      exitDirection ||
      (event.pointerType === "mouse" && event.button !== 0) ||
      target.closest("[data-deck-control]")
    ) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartXRef.current = event.clientX;
    dragXRef.current = 0;
    setDragX(0);
    setIsDragging(true);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>) {
    if (!isDragging || dragStartXRef.current === null) {
      return;
    }

    const nextDragX = event.clientX - dragStartXRef.current;
    dragXRef.current = nextDragX;
    setDragX(nextDragX);
  }

  function finishPointerInteraction(event: ReactPointerEvent<HTMLElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!isDragging) {
      return;
    }

    if (dragXRef.current <= -SWIPE_THRESHOLD_PX) {
      completeCarouselSwipe("left");
      return;
    }

    if (dragXRef.current >= SWIPE_THRESHOLD_PX) {
      completeCarouselSwipe("right");
      return;
    }

    resetDrag();
  }

  function cancelPointerInteraction(event: ReactPointerEvent<HTMLElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    resetDrag();
  }

  function handleDeckKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || exitDirection) {
      return;
    }

    if (event.key === "ArrowLeft" && canGoPrevious) {
      event.preventDefault();
      goToCarousel(safeActiveCarouselIndex - 1);
    } else if (event.key === "ArrowRight" && canGoNext) {
      event.preventDefault();
      goToCarousel(safeActiveCarouselIndex + 1);
    }
  }

  return (
    <section aria-label="Personalized carousel ideas" className="w-full">
      <div
        role="group"
        aria-roledescription="carousel idea deck"
        tabIndex={0}
        aria-label={`Carousel idea deck. Showing idea ${safeActiveCarouselIndex + 1} of ${candidates.length}. Use left and right arrow keys to change ideas.`}
        onKeyDown={handleDeckKeyDown}
        className="relative isolate mx-auto mt-3 h-[410px] w-full max-w-xl overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 sm:mt-7"
      >
        {[...deckSlots].reverse().map((slot) => (
          <CarouselDeckCard
            key={slot.candidate.carousel.carouselId}
            activeSlideByCarouselId={activeSlideByCarouselId}
            candidate={slot.candidate}
            carouselCount={candidates.length}
            carouselIndex={slot.carouselIndex}
            depth={slot.depth}
            dragX={slot.depth === 0 ? dragX : 0}
            exitDirection={slot.depth === 0 ? exitDirection : null}
            isDragging={slot.depth === 0 && isDragging}
            onActiveSlideChange={onActiveSlideChange}
            onPointerCancel={cancelPointerInteraction}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishPointerInteraction}
          />
        ))}
      </div>
      <span className="sr-only" aria-live="polite">
        Showing {title}, idea {safeActiveCarouselIndex + 1} of {candidates.length}
      </span>
    </section>
  );
}

function CarouselDeckCard({
  activeSlideByCarouselId,
  candidate,
  carouselCount,
  carouselIndex,
  depth,
  dragX,
  exitDirection,
  isDragging,
  onActiveSlideChange,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  activeSlideByCarouselId: Record<string, number>;
  candidate: CompleteCarousel;
  carouselCount: number;
  carouselIndex: number;
  depth: DeckDepth;
  dragX: number;
  exitDirection: "left" | "right" | null;
  isDragging: boolean;
  onActiveSlideChange: (carouselId: string, nextIndex: number) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
}) {
  const isActive = depth === 0;
  const title = getCarouselTitle(candidate.carousel);
  const storedSlideIndex =
    activeSlideByCarouselId[candidate.carousel.carouselId] ?? 0;
  const activeSlideIndex = Math.min(
    storedSlideIndex,
    Math.max(candidate.slides.length - 1, 0),
  );
  const activeSlide = candidate.slides[activeSlideIndex];
  const deckStyle = DECK_CARD_STYLES[depth];
  const clampedRotation = Math.max(
    -MAX_ROTATION_DEGREES,
    Math.min(MAX_ROTATION_DEGREES, dragX / 28),
  );
  const translateX = exitDirection
    ? exitDirection === "left"
      ? "-115vw"
      : "115vw"
    : `${dragX}px`;
  const cardStyle: CSSProperties = {
    opacity: deckStyle.opacity,
    touchAction: isActive ? "pan-y" : undefined,
    transform: `translateX(${isActive ? translateX : "0px"}) translateY(${deckStyle.translateY}px) rotate(${isActive ? clampedRotation : 0}deg) scale(${deckStyle.scale})`,
    transition: isDragging ? "none" : undefined,
  };

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
      className="pointer-events-none absolute inset-0 flex items-start justify-center pt-1"
      style={{ zIndex: deckStyle.zIndex }}
    >
      <article
        aria-label={`${title}, idea ${carouselIndex + 1} of ${carouselCount}`}
        aria-hidden={isActive ? undefined : "true"}
        className={cn(
          "w-[min(86vw,300px)] origin-center select-none overflow-visible transition-[opacity,transform] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none sm:w-[300px]",
          isActive
            ? "pointer-events-auto cursor-grab active:cursor-grabbing"
            : "pointer-events-none",
        )}
        onPointerCancel={isActive ? onPointerCancel : undefined}
        onPointerDown={isActive ? onPointerDown : undefined}
        onPointerMove={isActive ? onPointerMove : undefined}
        onPointerUp={isActive ? onPointerUp : undefined}
        style={cardStyle}
      >
        <div
          className={cn(
            "relative aspect-[4/5] overflow-hidden rounded-lg bg-foreground-strong",
            isActive
              ? "shadow-[0_10px_18px_rgb(9_9_11_/_0.2)]"
              : "shadow-[0_6px_12px_rgb(9_9_11_/_0.14)]",
          )}
        >
          {/* Rendered Carousel slides are immutable CloudFront creative assets. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeSlide.renderedUrl}
            alt={isActive ? `${title}, slide ${activeSlide.slideNumber}` : ""}
            aria-hidden={isActive ? undefined : "true"}
            draggable={false}
            className="size-full pointer-events-none object-contain"
          />

          {isActive && candidate.slides.length > 1 ? (
            <>
              <button
                type="button"
                data-deck-control
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => moveSlide(event, -1)}
                className="absolute left-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white transition-[background-color,transform] hover:scale-105 hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black motion-reduce:transition-none"
                aria-label={`Previous slide for ${title}`}
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                data-deck-control
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => moveSlide(event, 1)}
                className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white transition-[background-color,transform] hover:scale-105 hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black motion-reduce:transition-none"
                aria-label={`Next slide for ${title}`}
              >
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            </>
          ) : null}

          {isActive ? (
            <div
              data-deck-control
              onPointerDown={(event) => event.stopPropagation()}
              className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1.5"
              aria-label={`${title} slides`}
            >
              {candidate.slides.map((slide, index) => (
                <button
                  key={slide.slideNumber}
                  type="button"
                  data-deck-control
                  onPointerDown={(event) => event.stopPropagation()}
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
          ) : null}
        </div>
      </article>
    </div>
  );
}

function getCarouselDeckSlots(
  candidates: CompleteCarousel[],
  activeCarouselIndex: number,
): CarouselDeckSlot[] {
  return ([0, 1, 2] as DeckDepth[]).flatMap((depth) => {
    const carouselIndex = activeCarouselIndex + depth;
    const candidate = candidates[carouselIndex];

    return candidate ? [{ candidate, carouselIndex, depth }] : [];
  });
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
      className="relative isolate mx-auto h-[390px] w-full max-w-xl overflow-hidden"
      aria-hidden="true"
    >
      {LOADING_STACK_PLACEHOLDERS.map((placeholder, index) => (
        <div
          key={placeholder.translateY}
          className="absolute inset-0 flex items-start justify-center pt-1"
          style={{ zIndex: placeholder.zIndex }}
        >
          <div
            className="relative aspect-[4/5] w-[min(86vw,280px)] origin-center overflow-hidden rounded-lg bg-card-muted shadow-[0_6px_12px_rgb(9_9_11_/_0.1)]"
            style={{
              opacity: placeholder.opacity,
              transform: `translateY(${placeholder.translateY}px) scale(${placeholder.scale})`,
            }}
          >
            <div className="size-full animate-pulse bg-card-muted p-6 motion-reduce:animate-none">
              <div className="h-2.5 w-16 rounded-full bg-border-strong/70" />
              <div className="mt-28 space-y-2.5">
                <div className="h-3 w-4/5 rounded-full bg-border-strong/70" />
                <div className="h-3 w-full rounded-full bg-border-strong/70" />
                <div className="h-3 w-3/5 rounded-full bg-border-strong/70" />
              </div>
              {index === LOADING_STACK_PLACEHOLDERS.length - 1 ? (
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
