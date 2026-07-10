"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
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

type GeneratedCarousel = {
  candidateIndex: number;
  carouselId: string;
  categorySlug: string | null;
  generationBatchId: string;
  projectId: string;
  readySlideCount: number;
  selectedAngle: string | null;
  slideCount: number;
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
const SWIPE_THRESHOLD_PX = 42;

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
  const [carouselProfile, setCarouselProfile] =
    useState<CarouselProfileFeed | null>(null);
  const [carouselHistoryRefreshKey, setCarouselHistoryRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredGeneratedCarousels = useMemo(() => {
    const matchingCarousels = normalizedSearchQuery
      ? generatedCarousels.filter((carousel) =>
          [carousel.selectedAngle, carousel.categorySlug]
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

  function openCarousel(carousel: GeneratedCarousel) {
    const searchParams = new URLSearchParams({
      generationBatchId: carousel.generationBatchId,
    });

    router.push(`/carousel?${searchParams.toString()}`);
  }

  return (
    <section className="min-h-screen flex-1 overflow-x-hidden bg-background px-4 py-5 text-foreground sm:px-7 lg:px-10 lg:py-7">
      <div className="mx-auto flex min-h-full max-w-7xl flex-col">
        <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-balance text-2xl font-semibold text-foreground-strong">
              Carousels
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
              Personalized carousel ideas prepared from your business profile.
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
              placeholder="Search carousels"
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
            onOpen={openCarousel}
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
  onOpen,
  onRetryHistory,
  onRetryPreparation,
  profile,
  searchEmpty,
}: {
  carousels: GeneratedCarousel[];
  error: string | null;
  loading: boolean;
  onCompleteProfile: () => void;
  onOpen: (carousel: GeneratedCarousel) => void;
  onRetryHistory: () => void;
  onRetryPreparation: () => void;
  profile: CarouselProfileFeed | null;
  searchEmpty: boolean;
}) {
  if (loading) {
    return <GeneratedCarouselCoverFlowSkeleton />;
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
        message="Try a different carousel angle or category."
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

  return <GeneratedCarouselCoverFlow carousels={carousels} onOpen={onOpen} />;
}

function GeneratedCarouselCoverFlow({
  carousels,
  onOpen,
}: {
  carousels: GeneratedCarousel[];
  onOpen: (carousel: GeneratedCarousel) => void;
}) {
  const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const activeIndex = Math.min(
    activeCarouselIndex,
    Math.max(carousels.length - 1, 0),
  );

  function moveCarousel(direction: number) {
    setActiveCarouselIndex(
      (currentIndex) =>
        (currentIndex + direction + carousels.length) % carousels.length,
    );
  }

  function handlePointerEnd(clientX: number) {
    if (dragStartX === null) {
      return;
    }

    const delta = clientX - dragStartX;
    setDragStartX(null);

    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) {
      return;
    }

    moveCarousel(delta > 0 ? -1 : 1);
  }

  return (
    <section
      aria-label="Personalized carousel ideas"
      className="relative min-h-[520px] w-full overflow-hidden rounded-lg border border-border bg-white px-2 py-6 sm:min-h-[min(610px,calc(100dvh-190px))] sm:px-8"
      onPointerCancel={() => setDragStartX(null)}
      onPointerDown={(event) => setDragStartX(event.clientX)}
      onPointerUp={(event) => handlePointerEnd(event.clientX)}
    >
      {carousels.length > 1 ? (
        <button
          type="button"
          onClick={() => moveCarousel(-1)}
          className="absolute left-3 top-1/2 z-40 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border-strong bg-white text-foreground transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 md:flex"
          aria-label="Previous carousel"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </button>
      ) : null}

      <div className="relative mx-auto flex h-[440px] w-full max-w-[940px] items-center justify-center sm:h-[min(540px,calc(100dvh-230px))]">
        {carousels.map((carousel, index) => {
          const offset = getCircularOffset(index, activeIndex, carousels.length);

          if (Math.abs(offset) > 2) {
            return null;
          }

          return (
            <GeneratedCarouselCoverFlowCard
              key={carousel.carouselId}
              active={offset === 0}
              carousel={carousel}
              offset={offset}
              onOpen={() => onOpen(carousel)}
            />
          );
        })}
      </div>

      {carousels.length > 1 ? (
        <button
          type="button"
          onClick={() => moveCarousel(1)}
          className="absolute right-3 top-1/2 z-40 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border-strong bg-white text-foreground transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 md:flex"
          aria-label="Next carousel"
        >
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      ) : null}

      {carousels.length > 1 ? (
        <div className="absolute inset-x-4 bottom-5 z-40 flex justify-center">
          <div className="flex max-w-full items-center gap-1.5 rounded-full bg-foreground-strong/82 px-3 py-2">
            {carousels.map((carousel, index) => (
              <button
                key={carousel.carouselId}
                type="button"
                onClick={() => setActiveCarouselIndex(index)}
                aria-label={`Show carousel ${index + 1}`}
                aria-current={activeIndex === index ? "true" : undefined}
                className={cn(
                  "h-2 rounded-full transition-[width,background-color] motion-reduce:transition-none",
                  activeIndex === index ? "w-5 bg-white" : "w-2 bg-white/45 hover:bg-white/70",
                )}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function GeneratedCarouselCoverFlowCard({
  active,
  carousel,
  offset,
  onOpen,
}: {
  active: boolean;
  carousel: GeneratedCarousel;
  offset: number;
  onOpen: () => void;
}) {
  const distance = Math.abs(offset);
  const scale = active ? 1 : distance === 1 ? 0.84 : 0.7;
  const opacity = active ? 1 : distance === 1 ? 0.72 : 0.3;
  const translateX = offset * 232;
  const zIndex = active ? 30 : 20 - distance;

  return (
    <article
      className="absolute aspect-[4/5] w-[min(80vw,390px)] overflow-hidden rounded-lg bg-foreground-strong text-white shadow-[0_12px_24px_rgb(9_9_11_/_0.2)] transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none"
      style={{
        opacity,
        transform: `translateX(${translateX}px) scale(${scale}) rotate(${offset * -2.5}deg)`,
        zIndex,
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        className="group relative block size-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-foreground-strong"
        aria-label={`Open ${getCarouselCardTitle(carousel)}`}
      >
        {carousel.thumbnailUrl ? (
          // Rendered slides are immutable CloudFront assets and need no Next image transform.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={carousel.thumbnailUrl}
            alt={carousel.selectedAngle ?? "Generated carousel preview"}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <ProcessingCarouselPreview carousel={carousel} />
        )}

        <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
        <span
          className={cn(
            "absolute left-5 top-5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
            carousel.status === "completed" && "bg-white text-foreground-strong",
            carousel.status === "failed" && "bg-error text-white",
            carousel.status === "processing" && "bg-foreground-strong/85 text-white",
          )}
        >
          {getCarouselStatusLabel(carousel.status)}
        </span>

        <div className="absolute inset-x-6 bottom-7 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="line-clamp-2 text-lg font-semibold leading-6 text-white drop-shadow-sm">
              {getCarouselCardTitle(carousel)}
            </p>
            <p className="mt-1 text-xs font-medium text-white/75">
              {getCarouselCardMeta(carousel)}
            </p>
          </div>
          {active ? (
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-md bg-white text-foreground-strong transition-transform group-hover:-translate-y-0.5"
              aria-hidden="true"
            >
              <ArrowUpRight className="size-4" />
            </span>
          ) : null}
        </div>
      </button>
    </article>
  );
}

function ProcessingCarouselPreview({ carousel }: { carousel: GeneratedCarousel }) {
  const Icon = carousel.status === "failed" ? CircleAlert : Loader2;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-foreground-strong px-10 text-center">
      <Icon
        className={cn(
          "size-8 text-white/70",
          carousel.status === "processing" && "animate-spin motion-reduce:animate-none",
          carousel.status === "failed" && "text-error",
        )}
        aria-hidden="true"
      />
      <p className="mt-4 text-balance text-lg font-semibold leading-6 text-white">
        {getCarouselCardTitle(carousel)}
      </p>
      <p className="mt-2 text-sm leading-5 text-white/65">
        {getCarouselCardMeta(carousel)}
      </p>
    </div>
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

function GeneratedCarouselCoverFlowSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading generated carousels"
      className="relative min-h-[520px] w-full overflow-hidden rounded-lg border border-border bg-white sm:min-h-[min(610px,calc(100dvh-190px))]"
    >
      <div className="absolute left-1/2 top-1/2 aspect-[4/5] w-[min(80vw,390px)] -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-lg bg-border motion-reduce:animate-none" />
    </div>
  );
}

function getCircularOffset(index: number, activeIndex: number, itemCount: number) {
  let offset = index - activeIndex;
  const midpoint = itemCount / 2;

  if (offset > midpoint) {
    offset -= itemCount;
  }

  if (offset < -midpoint) {
    offset += itemCount;
  }

  return offset;
}

function getCarouselStatusLabel(status: GeneratedCarousel["status"]) {
  if (status === "completed") {
    return "Ready";
  }

  if (status === "failed") {
    return "Failed";
  }

  return "Preparing";
}

function getCarouselCardTitle(carousel: GeneratedCarousel) {
  if (carousel.status === "completed") {
    return carousel.selectedAngle ?? "Generated carousel";
  }

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

function getCarouselCardMeta(carousel: GeneratedCarousel) {
  if (carousel.status === "failed") {
    return "Open to review details";
  }

  return `${carousel.readySlideCount}/${carousel.slideCount} slides ready`;
}
