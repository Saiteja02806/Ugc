"use client";

import {
  ArrowUpRight,
  CircleAlert,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { cn } from "@/lib/utils";

type CarouselHistoryState = "error" | "idle" | "loading" | "ready";

type GeneratedCarousel = {
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

export function TrendingWorkspace() {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
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
    if (!normalizedSearchQuery) {
      return generatedCarousels;
    }

    return generatedCarousels.filter((carousel) =>
      [carousel.selectedAngle, carousel.categorySlug]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearchQuery),
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
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => null)) as
          | CarouselHistoryResponse
          | null;

        if (!response.ok || !data?.ok) {
          const message =
            data && !data.ok
              ? data.message
              : "Generated carousels are unavailable.";
          throw new Error(message);
        }

        if (controller.signal.aborted) {
          return;
        }

        setGeneratedCarousels(data.carousels);
        setCarouselProfile(data.profile);
        setCarouselHistoryState("ready");

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
    const searchParams = new URLSearchParams(
      carousel.generationBatchId
        ? { generationBatchId: carousel.generationBatchId }
        : { carouselId: carousel.carouselId },
    );

    router.push(`/carousel?${searchParams.toString()}`);
  }

  return (
    <section className="min-h-screen flex-1 bg-background px-4 py-5 text-foreground sm:px-7 lg:px-10 lg:py-7">
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
            <Search
              className="size-4 shrink-0 text-muted-subtle"
              aria-hidden="true"
            />
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
    return <GeneratedCarouselSkeletons />;
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

  return (
    <div className="grid w-full grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
      {carousels.map((carousel) => (
        <article
          key={carousel.carouselId}
          className="overflow-hidden rounded-lg border border-border bg-white transition-colors hover:border-border-strong"
        >
          <button
            type="button"
            onClick={() => onOpen(carousel)}
            className="group block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
            aria-label={`Open ${getCarouselCardTitle(carousel)}`}
          >
            <div className="relative aspect-[4/5] bg-foreground-strong">
              {carousel.thumbnailUrl ? (
                // Rendered slides are immutable CloudFront assets and need no Next image transform.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={carousel.thumbnailUrl}
                  alt={carousel.selectedAngle ?? "Generated carousel preview"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-white/70">
                  {carousel.status === "failed" ? (
                    <CircleAlert
                      className="size-8"
                      aria-label="Carousel generation failed"
                    />
                  ) : (
                    <Loader2
                      className="size-8 animate-spin motion-reduce:animate-none"
                      aria-label="Carousel is rendering"
                    />
                  )}
                </div>
              )}
              <span
                className={cn(
                  "absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  carousel.status === "completed" &&
                    "bg-white text-foreground-strong",
                  carousel.status === "failed" && "bg-error text-white",
                  carousel.status === "processing" &&
                    "bg-foreground-strong text-white",
                )}
              >
                {getCarouselStatusLabel(carousel.status)}
              </span>
            </div>

            <div className="flex min-h-[88px] items-start justify-between gap-3 px-4 py-4">
              <div className="min-w-0">
                <p className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-foreground">
                  {getCarouselCardTitle(carousel)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {getCarouselCardMeta(carousel)}
                </p>
              </div>
              <span
                className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-border text-muted transition-colors group-hover:border-border-strong group-hover:bg-card-muted group-hover:text-foreground"
                aria-hidden="true"
              >
                <ArrowUpRight className="size-4" />
              </span>
            </div>
          </button>
        </article>
      ))}
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

function GeneratedCarouselSkeletons() {
  return (
    <div
      role="status"
      aria-label="Loading generated carousels"
      className="grid w-full grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 xl:grid-cols-3"
    >
      {[0, 1, 2].map((item) => (
        <div key={item} className="overflow-hidden rounded-lg border border-border bg-white">
          <div className="aspect-[4/5] animate-pulse bg-border motion-reduce:animate-none" />
          <div className="space-y-2 px-4 py-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-border motion-reduce:animate-none" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-border motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  );
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
