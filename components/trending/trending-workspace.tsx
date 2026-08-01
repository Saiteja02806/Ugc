"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Check,
  CircleAlert,
  Library,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/contexts/auth-context";
import {
  PlatformSelectionModal,
  type SchedulePlatformContext,
} from "@/components/social/platform-selection-modal";
import { HookVideoCard } from "@/components/trending/hook-video-card";
import { HookVideoComposer } from "@/components/trending/hook-video-composer";
import { CreativeAssetsVideoPicker } from "@/components/trending/creative-assets-video-picker";
import {
  HookVideoScheduleDrawer,
  type HookVideoScheduleSelection,
} from "@/components/trending/hook-video-schedule-drawer";
import {
  WallTextDetailView,
  type WallTextDetailActionState,
} from "@/components/trending/wall-text-detail-view";
import { WallTextOverlay } from "@/components/trending/wall-text-overlay";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { useBackgroundJob } from "@/lib/jobs/background-job-client";
import {
  createAndPublishCarouselSchedule,
  type CarouselScheduleSubmission,
} from "@/lib/scheduling/carousel-scheduling-client";
import {
  compareTrendingFeedItems,
  createCarouselTrendingFeedProvider,
  isPreviewReadyCarousel,
  type TrendingCarouselCreative,
  type TrendingCarouselFeedItem,
  type TrendingCarouselSlide,
  type TrendingCarouselSourceRecord,
  type TrendingFeedItem,
  type TrendingFeedProviderAvailability,
  type TrendingHookVideoFeedItem,
  type TrendingWallTextFeedItem,
} from "@/lib/trending/feed-items";
import {
  beginHookVideoComposition,
  type HookVideoFlowState,
} from "@/lib/trending/hook-video-flow";
import type {
  HookInfluencerSummary,
  HookInfluencerVideoSummary,
} from "@/lib/trending/hook-video-types";
import type { TrendingVideoSourceFormat } from "@/lib/trending/video-source-selection";
import { cn } from "@/lib/utils";

type CarouselHistoryState = "error" | "idle" | "loading" | "ready";
type TrendingDailyFeedState =
  | "caught_up"
  | "exhausted"
  | "preparing"
  | "ready";

type GeneratedCarouselSlide = TrendingCarouselSlide;

type ReadyCarouselSlide = GeneratedCarouselSlide & { renderedUrl: string };

type GeneratedCarousel = TrendingCarouselCreative;

type CompleteCarousel = {
  carousel: GeneratedCarousel;
  format: "carousel";
  item: TrendingCarouselFeedItem;
  slides: ReadyCarouselSlide[];
};

type CompleteHookVideo = {
  format: "hook_video";
  item: TrendingHookVideoFeedItem;
};

type CompleteWallText = {
  format: "wall_text";
  item: TrendingWallTextFeedItem;
};

type TrendingCandidate =
  | CompleteCarousel
  | CompleteHookVideo
  | CompleteWallText;

type DeckDepth = 0 | 1 | 2;

type TrendingDeckSlot = {
  candidate: TrendingCandidate;
  itemIndex: number;
  depth: DeckDepth;
};

type CarouselProfileFeed = {
  error?: string | null;
  id?: string;
  profileVersion?: number;
  state: "failed" | "missing" | "preparing" | "ready";
};

type CarouselHistoryResponse =
  | {
      ok: true;
      carousels: TrendingCarouselSourceRecord[];
      entitlement: {
        dailyCarouselLimit: number;
        planKey: string;
      } | null;
      feed: {
        assignedCount: number;
        id: string;
        localDate: string;
        pendingSlotCount: number;
        state: TrendingDailyFeedState;
        timezone: string;
      } | null;
      formatAvailability?: TrendingFeedProviderAvailability[];
      items?: TrendingFeedItem[];
      profile: CarouselProfileFeed;
    }
  | {
      ok: false;
      message: string;
    };

type LibraryCarouselItem = {
  coverUrl: string | null;
  id: string;
  slideCount: number;
  slides: Array<{
    renderedUrl: string;
    slideNumber: number;
  }>;
  sourceId: string;
  title: string;
};

type SaveCarouselLibraryResponse =
  | {
      created: boolean;
      item: LibraryCarouselItem;
      ok: true;
    }
  | {
      message: string;
      ok: false;
    };

type SavedWallTextDraft = {
  assignmentId: string;
  id: string;
  renderError: string | null;
  renderedMediaAssetId: string | null;
  renderedVideoUrl: string | null;
  renderStatus: "not_requested" | "queued" | "rendering" | "ready" | "failed";
  text: {
    text: string;
  };
};

type SavedWallTextDraftResponse =
  | {
      draft: SavedWallTextDraft;
      jobId?: string;
      ok: true;
    }
  | {
      error?: string;
      ok?: false;
    };

type CompleteTrendingActionResponse =
  | {
      assignment: {
        completedAt: string | null;
        id: string;
        state: string;
      };
      ok: true;
    }
  | {
      message: string;
      ok: false;
    };

type TrendingCompletionAction = "saved" | "scheduled" | "skipped";

type CarouselActionState =
  | {
      status: "idle";
    }
  | {
      message?: string;
      status: "saving" | "scheduling";
    }
  | {
      message: string;
      status: "error";
    };

type CarouselActionNotice = {
  actionHref?: string;
  actionLabel?: string;
  message: string;
  onAction?: () => void | Promise<void>;
};

const HISTORY_POLL_INTERVAL_MS = 6_000;
const HISTORY_REPAIR_POLL_INTERVAL_MS = 60_000;
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
  const loadedFeedLocalDate = useRef<string | null>(null);
  const loadedFeedUserId = useRef<string | null>(null);
  const hookPreparationAttemptKey = useRef<string | null>(null);
  const wallTextPreparationAttemptKey = useRef<string | null>(null);
  const resolvedWallTextJobIds = useRef(new Set<string>());
  const [trendingItems, setTrendingItems] = useState<TrendingFeedItem[]>([]);
  const [formatAvailability, setFormatAvailability] = useState<
    TrendingFeedProviderAvailability[]
  >([]);
  const [carouselSources, setCarouselSources] = useState<
    TrendingCarouselSourceRecord[]
  >([]);
  const [carouselHistoryError, setCarouselHistoryError] = useState<string | null>(
    null,
  );
  const [carouselHistoryState, setCarouselHistoryState] =
    useState<CarouselHistoryState>("idle");
  const [carouselProfile, setCarouselProfile] = useState<CarouselProfileFeed | null>(
    null,
  );
  const [dailyFeedState, setDailyFeedState] =
    useState<TrendingDailyFeedState | null>(null);
  const [carouselHistoryRefreshKey, setCarouselHistoryRefreshKey] = useState(0);
  const [wallTextPreparationJobId, setWallTextPreparationJobId] =
    useState<string | null>(null);
  const wallTextPreparationJob = useBackgroundJob(wallTextPreparationJobId);

  const hasAuthenticatedUser = Boolean(user);
  const visibleTrendingItems = useMemo(
    () => (hasAuthenticatedUser ? trendingItems : []),
    [hasAuthenticatedUser, trendingItems],
  );
  const visibleCarouselSources = useMemo(
    () => (hasAuthenticatedUser ? carouselSources : []),
    [carouselSources, hasAuthenticatedUser],
  );
  const visibleCarouselHistoryError = user ? carouselHistoryError : null;
  const visibleDailyFeedState = user ? dailyFeedState : null;
  const orderedTrendingItems = useMemo(
    () => [...visibleTrendingItems].sort(compareTrendingFeedItems),
    [visibleTrendingItems],
  );
  const carouselFeedProfile: CarouselProfileFeed | null = user
    ? carouselProfile
    : { state: "missing" };
  const carouselFeedLoading =
    authLoading ||
    (Boolean(user) &&
      (carouselHistoryState === "idle" || carouselHistoryState === "loading"));

  useEffect(() => {
    if (!user) {
      return;
    }

    const userId = user.uid;
    const controller = new AbortController();
    let pollTimer: number | null = null;

    async function loadCarouselHistory() {
      const isInitialUserLoad = loadedFeedUserId.current !== userId;

      if (isInitialUserLoad) {
        setTrendingItems([]);
        setFormatAvailability([]);
        setCarouselSources([]);
        setCarouselHistoryState("loading");
      }
      setCarouselHistoryError(null);

      try {
        const idToken = await getCurrentUserIdToken();

        if (!idToken) {
          throw new Error("Sign in before viewing generated carousels.");
        }

        const timezone =
          Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        const response = await fetch(
          `/api/trending/feed?timezone=${encodeURIComponent(timezone)}`,
          {
            cache: "no-store",
            headers: { Authorization: `Bearer ${idToken}` },
            signal: controller.signal,
          },
        );
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

        if (
          data.feed?.localDate &&
          data.feed.localDate !== getBrowserLocalDate()
        ) {
          setCarouselHistoryRefreshKey((current) => current + 1);
          return;
        }

        setTrendingItems(
          data.items ??
            createCarouselTrendingFeedProvider(data.carousels).items,
        );
        setCarouselSources(data.carousels);
        setFormatAvailability(data.formatAvailability ?? []);
        setCarouselProfile(data.profile);
        setDailyFeedState(data.feed?.state ?? null);
        loadedFeedLocalDate.current = data.feed?.localDate ?? null;
        loadedFeedUserId.current = userId;
        setCarouselHistoryState("ready");

        if ((data.feed?.pendingSlotCount ?? 0) > 0) {
          pollTimer = window.setTimeout(() => {
            setCarouselHistoryRefreshKey((current) => current + 1);
          },
          data.feed?.state === "preparing"
            ? HISTORY_POLL_INTERVAL_MS
            : HISTORY_REPAIR_POLL_INTERVAL_MS);
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setTrendingItems([]);
        setFormatAvailability([]);
        setCarouselSources([]);
        setCarouselProfile(null);
        setDailyFeedState(null);
        setCarouselHistoryError(
          toCarouselDisplayCopy(
            error instanceof Error
              ? error.message
              : "Generated carousels are unavailable.",
          ),
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

  useEffect(() => {
    const hookAvailability = formatAvailability.find(
      (format) => format.format === "hook_video",
    );
    const profileId = carouselProfile?.id;
    const profileVersion = carouselProfile?.profileVersion;

    if (
      !user ||
      carouselHistoryState !== "ready" ||
      !profileId ||
      !profileVersion ||
      hookAvailability?.state !== "unavailable"
    ) {
      return;
    }

    const attemptKey = `${user.uid}:${profileId}:${profileVersion}`;

    if (hookPreparationAttemptKey.current === attemptKey) {
      return;
    }

    hookPreparationAttemptKey.current = attemptKey;
    const controller = new AbortController();
    let preparationCompleted = false;

    async function prepareHookIdeas() {
      try {
        const idToken = await getCurrentUserIdToken();

        if (!idToken) {
          return;
        }

        for (let attempt = 0; attempt < 60; attempt += 1) {
          const response = await fetch(
            "/api/trending/hook-videos/feed/prepare",
            {
              headers: { Authorization: `Bearer ${idToken}` },
              method: "POST",
              signal: controller.signal,
            },
          );
          const data = (await response.json().catch(() => null)) as {
            error?: string;
            ok?: boolean;
            status?: "processing" | "queued" | "ready";
          } | null;

          if (!response.ok || data?.ok !== true) {
            throw new Error(
              data?.error ?? "Could not prepare Hook ideas.",
            );
          }

          if (data.status === "ready") {
            if (!controller.signal.aborted) {
              preparationCompleted = true;
              setCarouselHistoryRefreshKey(
                (current) => current + 1,
              );
            }
            return;
          }

          await waitForHookPreparationPoll(controller.signal);
        }

        throw new Error(
          "Hook ideas are still being reviewed. Refresh Trending shortly.",
        );
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Could not prepare unified Instagram Reel ideas:", error);
        }
      }
    }

    void prepareHookIdeas();

    return () => {
      controller.abort();

      if (
        !preparationCompleted &&
        hookPreparationAttemptKey.current === attemptKey
      ) {
        hookPreparationAttemptKey.current = null;
      }
    };
  }, [
    carouselHistoryState,
    carouselProfile,
    formatAvailability,
    user,
  ]);

  useEffect(() => {
    const wallTextAvailability = formatAvailability.find(
      (format) => format.format === "wall_text",
    );
    const profileId = carouselProfile?.id;
    const profileVersion = carouselProfile?.profileVersion;

    if (
      !user ||
      carouselHistoryState !== "ready" ||
      !profileId ||
      !profileVersion ||
      wallTextAvailability?.state !== "unavailable"
    ) {
      return;
    }

    const attemptKey = `${user.uid}:${profileId}:${profileVersion}`;

    if (wallTextPreparationAttemptKey.current === attemptKey) {
      return;
    }

    wallTextPreparationAttemptKey.current = attemptKey;
    const controller = new AbortController();
    let preparationCompleted = false;

    async function prepareWallTextIdeas() {
      try {
        const idToken = await getCurrentUserIdToken();

        if (!idToken) {
          return;
        }

        const response = await fetch(
          "/api/trending/wall-text/feed/prepare",
          {
            headers: { Authorization: `Bearer ${idToken}` },
            method: "POST",
            signal: controller.signal,
          },
        );
        const data = (await response.json().catch(() => null)) as {
          error?: string;
          jobId?: string;
          ok?: boolean;
        } | null;

        if (!response.ok || data?.ok !== true) {
          throw new Error(
            data?.error ?? "Could not prepare Wall-of-text ideas.",
          );
        }

        if (!controller.signal.aborted) {
          preparationCompleted = true;
          if (data.jobId) {
            setWallTextPreparationJobId(data.jobId);
          }

          if (response.status === 200) {
            setCarouselHistoryRefreshKey((current) => current + 1);
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(
            "Could not prepare unified Wall-of-text ideas:",
            error,
          );
        }
      }
    }

    void prepareWallTextIdeas();

    return () => {
      controller.abort();

      if (
        !preparationCompleted &&
        wallTextPreparationAttemptKey.current === attemptKey
      ) {
        wallTextPreparationAttemptKey.current = null;
      }
    };
  }, [
    carouselHistoryState,
    carouselProfile,
    formatAvailability,
    user,
  ]);

  useEffect(() => {
    const job = wallTextPreparationJob.data;

    if (
      !job ||
      job.status !== "completed" ||
      resolvedWallTextJobIds.current.has(job.id)
    ) {
      return;
    }

    resolvedWallTextJobIds.current.add(job.id);

    async function refreshCompletedWallTextJob() {
      await Promise.resolve();
      setCarouselHistoryRefreshKey((current) => current + 1);
    }

    void refreshCompletedWallTextJob();
  }, [wallTextPreparationJob.data]);

  useEffect(() => {
    if (!user) {
      loadedFeedLocalDate.current = null;
      loadedFeedUserId.current = null;
      hookPreparationAttemptKey.current = null;
      wallTextPreparationAttemptKey.current = null;
      return;
    }

    let midnightTimer: number | null = null;

    function refreshAfterLocalDateChange() {
      if (
        document.visibilityState !== "hidden" &&
        loadedFeedLocalDate.current !== getBrowserLocalDate()
      ) {
        setCarouselHistoryRefreshKey((current) => current + 1);
      }
    }

    function scheduleMidnightRefresh() {
      const now = new Date();
      const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        1,
      );

      midnightTimer = window.setTimeout(() => {
        refreshAfterLocalDateChange();
        scheduleMidnightRefresh();
      }, Math.max(nextMidnight.getTime() - now.getTime(), 1_000));
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshAfterLocalDateChange();
      }
    }

    window.addEventListener("focus", refreshAfterLocalDateChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    scheduleMidnightRefresh();

    return () => {
      window.removeEventListener("focus", refreshAfterLocalDateChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (midnightTimer) {
        window.clearTimeout(midnightTimer);
      }
    };
  }, [user]);

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
        toCarouselDisplayCopy(
          error instanceof Error
            ? error.message
            : "Could not retry carousel preparation.",
        ),
      );
      setCarouselHistoryState("error");
    }
  }

  return (
    <section className="min-h-dvh flex-1 bg-[#1F1F1F] px-4 py-6 text-[#F5F3F0] sm:px-6 lg:px-8 lg:py-8 xl:px-10">
      <div className="mx-auto flex min-h-full max-w-[1360px] flex-col">
        <header>
          <div className="min-w-0">
            <h1 className="text-balance text-[32px] font-semibold leading-10 text-[#F5F3F0]">
              Trending
            </h1>
            <p className="mt-1.5 max-w-2xl text-[15px] leading-[22px] text-[#B9B5AF]">
              Explore Carousel, Hook, and Wall-of-text ideas made from your
              business profile.
            </p>
          </div>

        </header>

        <section className="mt-8 min-h-[560px]">
          <div className="flex min-h-[502px] items-start py-6 sm:py-7">
            <TrendingFeedGallery
              carouselSources={visibleCarouselSources}
              items={orderedTrendingItems}
              error={visibleCarouselHistoryError}
              feedState={visibleDailyFeedState}
              loading={carouselFeedLoading}
              profile={carouselFeedProfile}
              onCompleteProfile={openBusinessProfile}
              onCarouselCompleted={() =>
                setCarouselHistoryRefreshKey((current) => current + 1)
              }
              onRetryHistory={() =>
                setCarouselHistoryRefreshKey((current) => current + 1)
              }
              onRetryPreparation={() => void retryCarouselPreparation()}
            />
          </div>
        </section>
      </div>
    </section>
  );
}

function TrendingFeedGallery({
  carouselSources,
  error,
  feedState,
  items,
  loading,
  onCompleteProfile,
  onCarouselCompleted,
  onRetryHistory,
  onRetryPreparation,
  profile,
}: {
  carouselSources: TrendingCarouselSourceRecord[];
  error: string | null;
  feedState: TrendingDailyFeedState | null;
  items: TrendingFeedItem[];
  loading: boolean;
  onCompleteProfile: () => void;
  onCarouselCompleted: () => void;
  onRetryHistory: () => void;
  onRetryPreparation: () => void;
  profile: CarouselProfileFeed | null;
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
        title="Could not load ideas"
      />
    );
  }

  if (profile?.state === "missing") {
    return <CarouselProfilePrompt onAction={onCompleteProfile} />;
  }

  if (profile?.state === "failed" && items.length === 0) {
    return (
      <CarouselFeedState
        actionLabel="Retry preparation"
        icon="failed"
        message={toCarouselDisplayCopy(
          profile.error ?? "Carousel preparation did not finish.",
        )}
        onAction={onRetryPreparation}
        title="Carousel preparation failed"
      />
    );
  }

  if (items.length === 0 && carouselSources.length === 0) {
    if (feedState === "caught_up") {
      return (
        <CarouselFeedState
          icon="missing"
          message="You have finished every idea that was available in today's feed."
          title="You're caught up for today"
        />
      );
    }

    if (feedState === "exhausted" || feedState === "ready") {
      return (
        <CarouselFeedState
          icon="missing"
          message="No ready ideas remain for today. New ideas will appear after more content is prepared."
          title="No ready ideas"
        />
      );
    }

    return (
      <CarouselFeedState
        icon="preparing"
        message="Your personalized content ideas are being prepared."
        title="Preparing ideas"
      />
    );
  }

  return (
    <TrendingFeed
      carouselSources={carouselSources}
      items={items}
      onCarouselCompleted={onCarouselCompleted}
      onRetryPreparation={onRetryPreparation}
    />
  );
}

function CarouselProfilePrompt({ onAction }: { onAction: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-6 py-14 text-center">
      <h2 className="text-lg font-semibold text-[#F5F3F0]">
        Complete your profile
      </h2>
      <p className="mt-2 text-sm leading-6 text-[#B9B5AF]">
        Add your business details to prepare personalized Carousel, Hook, and
        Wall-of-text ideas.
      </p>
      <button
        type="button"
        onClick={onAction}
        className="mt-5 inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-[8px] bg-[#E16540] px-4 text-sm font-semibold text-[#1F1F1F] transition-[background-color,transform] hover:bg-[#EA7654] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E16540] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1F1F1F]"
      >
        <Sparkles className="size-4" aria-hidden="true" />
        Complete profile
      </button>
    </div>
  );
}

function TrendingFeed({
  carouselSources,
  items,
  onCarouselCompleted,
  onRetryPreparation,
}: {
  carouselSources: TrendingCarouselSourceRecord[];
  items: TrendingFeedItem[];
  onCarouselCompleted: () => void;
  onRetryPreparation: () => void;
}) {
  const [activeSlideByCarouselId, setActiveSlideByCarouselId] = useState<
    Record<string, number>
  >({});
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [hookComposition, setHookComposition] =
    useState<TrendingHookVideoFeedItem | null>(null);
  const [sourcePickerFormat, setSourcePickerFormat] =
    useState<TrendingVideoSourceFormat | null>(null);

  const candidates = items.flatMap<TrendingCandidate>((item) => {
    if (item.format === "hook_video") {
      return [{ format: "hook_video", item }];
    }

    if (item.format === "wall_text") {
      return [{ format: "wall_text", item }];
    }

    if (item.format !== "carousel") {
      return [];
    }

    const carousel = item.creative;
    const slides = getReadySlides(carousel);

    return carousel.status === "completed" &&
      slides.length === carousel.slideCount
      ? [{ carousel, format: "carousel", item, slides }]
      : [];
  });
  const lifecycleCarousels = carouselSources.filter(
    (carousel) => !isPreviewReadyCarousel(carousel),
  );
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

  if (hookComposition) {
    return (
      <TrendingHookComposer
        item={hookComposition}
        onClose={() => {
          setHookComposition(null);
          onCarouselCompleted();
        }}
      />
    );
  }

  return (
    <div className="flex w-full flex-col gap-10">
      {candidates.length > 0 ? (
        <TrendingDeck
          activeItemIndex={activeItemIndex}
          activeSlideByCarouselId={activeSlideByCarouselId}
          candidates={candidates}
          onActiveItemChange={setActiveItemIndex}
          onActiveSlideChange={setActiveSlide}
          onCarouselCompleted={onCarouselCompleted}
          onChooseVideoSource={setSourcePickerFormat}
          onHookCompose={setHookComposition}
        />
      ) : null}

      {processingCarousels.length > 0 ? (
        <CarouselPreparationState
          carousels={processingCarousels}
          compact={candidates.length > 0}
        />
      ) : null}

      {failedCarousels.length > 0 ? (
        <CarouselFailureState
          count={failedCarousels.length}
          onRetry={onRetryPreparation}
        />
      ) : null}

      {sourcePickerFormat ? (
        <CreativeAssetsVideoPicker
          format={sourcePickerFormat}
          open
          onOpenChange={(open) => {
            if (!open) {
              setSourcePickerFormat(null);
            }
          }}
          onSelectionSaved={() => {
            setSourcePickerFormat(null);
            onCarouselCompleted();
          }}
        />
      ) : null}
    </div>
  );
}

function TrendingHookComposer({
  item,
  onClose,
}: {
  item: TrendingHookVideoFeedItem;
  onClose: () => void;
}) {
  const creative = item.creative;
  const [flowState, setFlowState] = useState<HookVideoFlowState>(() =>
    beginHookVideoComposition({
      hookText: creative.text.value,
      influencerId: creative.influencerId,
      influencerVideoId: creative.videoId,
      selectedHookId: item.creativeId,
      sourceKind: creative.sourceKind,
      trimEnd: creative.trimEnd,
      trimStart: creative.trimStart,
    }),
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const influencer: HookInfluencerSummary = {
    id: creative.influencerId,
    name: creative.influencerName,
    sourceKind: creative.sourceKind,
    thumbnailUrl: creative.thumbnailUrl,
    videoCount: 1,
  };
  const video: HookInfluencerVideoSummary = {
    durationSeconds: creative.sourceDurationSeconds,
    id: creative.videoId,
    influencerKey: null,
    influencerId: creative.influencerId,
    ratio: creative.aspectRatio,
    reactionType: null,
    sourceKind: creative.sourceKind,
    thumbnailUrl: creative.thumbnailUrl,
    title: creative.title,
    trimEnd: creative.trimEnd,
    trimStart: creative.trimStart,
    visualGroup: null,
  };

  useEffect(() => {
    const controller = new AbortController();

    async function loadPreview() {
      try {
        const token = await getCurrentUserIdToken();

        if (!token) {
          return;
        }

        const response = await fetch(creative.previewSessionEndpoint, {
          body: JSON.stringify({
            influencerId: creative.influencerId,
            sourceKind: creative.sourceKind,
          }),
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          method: "POST",
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => null)) as
          | { ok: true; previewUrl: string }
          | { ok?: false }
          | null;

        if (
          response.ok &&
          data?.ok === true &&
          !controller.signal.aborted
        ) {
          setPreviewUrl(`${data.previewUrl}?session=${Date.now()}`);
        }
      } catch {
        if (!controller.signal.aborted) {
          setPreviewUrl(null);
        }
      }
    }

    void loadPreview();

    return () => controller.abort();
  }, [creative]);

  return (
    <HookVideoComposer
      flowState={flowState}
      influencer={influencer}
      openingPreviewUrl={previewUrl}
      overlayFontSize={creative.text.fontSize}
      video={video}
      onCommitted={() =>
        completeTrendingHookAction(item, "selected")
      }
      onClose={onClose}
      onStateChange={setFlowState}
    />
  );
}

function TrendingDeck({
  activeItemIndex,
  activeSlideByCarouselId,
  candidates,
  onActiveItemChange,
  onActiveSlideChange,
  onCarouselCompleted,
  onChooseVideoSource,
  onHookCompose,
}: {
  activeItemIndex: number;
  activeSlideByCarouselId: Record<string, number>;
  candidates: TrendingCandidate[];
  onActiveItemChange: (itemIndex: number) => void;
  onActiveSlideChange: (carouselId: string, nextIndex: number) => void;
  onCarouselCompleted: () => void;
  onChooseVideoSource: (format: TrendingVideoSourceFormat) => void;
  onHookCompose: (item: TrendingHookVideoFeedItem) => void;
}) {
  const swipeTimerRef = useRef<number | null>(null);
  const actionNoticeTimerRef = useRef<number | null>(null);
  const dragStartXRef = useRef<number | null>(null);
  const dragXRef = useRef(0);
  const [actionCandidate, setActionCandidate] =
    useState<CompleteCarousel | null>(null);
  const [wallTextCandidate, setWallTextCandidate] =
    useState<CompleteWallText | null>(null);
  const [wallTextActionState, setWallTextActionState] =
    useState<WallTextDetailActionState>({ status: "idle" });
  const [pendingWallTextScheduleCandidate, setPendingWallTextScheduleCandidate] =
    useState<CompleteWallText | null>(null);
  const [pendingWallTextDraft, setPendingWallTextDraft] =
    useState<SavedWallTextDraft | null>(null);
  const [actionNotice, setActionNotice] = useState<CarouselActionNotice | null>(
    null,
  );
  const [actionState, setActionState] = useState<CarouselActionState>({
    status: "idle",
  });
  const [scheduleContext, setScheduleContext] =
    useState<SchedulePlatformContext | null>(null);
  const [pendingScheduleCandidate, setPendingScheduleCandidate] =
    useState<CompleteCarousel | null>(null);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingSkipItemId, setPendingSkipItemId] = useState<string | null>(
    null,
  );
  const [exitDirection, setExitDirection] = useState<"left" | "right" | null>(
    null,
  );
  const lastItemIndex = candidates.length - 1;
  const safeActiveItemIndex = Math.min(
    Math.max(activeItemIndex, 0),
    lastItemIndex,
  );
  const activeCandidate = candidates[safeActiveItemIndex];
  const title = getTrendingCandidateTitle(activeCandidate);
  const deckSlots = getTrendingDeckSlots(
    candidates,
    safeActiveItemIndex,
  );
  useEffect(() => {
    const nextCandidate = candidates[safeActiveItemIndex + 1];
    const nextSlideIndex =
      nextCandidate?.format === "carousel"
      ? Math.min(
          activeSlideByCarouselId[nextCandidate.carousel.carouselId] ?? 0,
          Math.max(nextCandidate.slides.length - 1, 0),
        )
      : 0;
    const urls = [
      ...(activeCandidate.format === "carousel"
        ? activeCandidate.slides.map((slide) => slide.renderedUrl)
        : []),
      nextCandidate?.format === "carousel"
        ? nextCandidate.slides[nextSlideIndex]?.renderedUrl
        : null,
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
    safeActiveItemIndex,
  ]);

  useEffect(
    () => () => {
      if (swipeTimerRef.current !== null) {
        window.clearTimeout(swipeTimerRef.current);
      }

      if (actionNoticeTimerRef.current !== null) {
        window.clearTimeout(actionNoticeTimerRef.current);
      }
    },
    [],
  );

  function showActionNotice(notice: CarouselActionNotice) {
    if (actionNoticeTimerRef.current !== null) {
      window.clearTimeout(actionNoticeTimerRef.current);
    }

    setActionNotice(notice);
    actionNoticeTimerRef.current = window.setTimeout(() => {
      actionNoticeTimerRef.current = null;
      setActionNotice(null);
    }, notice.actionHref || notice.onAction ? 6200 : 2400);
  }

  function resetDrag() {
    dragStartXRef.current = null;
    dragXRef.current = 0;
    setDragX(0);
    setIsDragging(false);
    setExitDirection(null);
  }

  function advancePastActiveItem(
    direction: "left" | "right",
    onTransitionComplete?: () => void,
  ) {
    const nextIndex = safeActiveItemIndex + 1;

    if (
      !onTransitionComplete &&
      (nextIndex < 0 || nextIndex > lastItemIndex)
    ) {
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
        if (!onTransitionComplete) {
          onActiveItemChange(nextIndex);
        }
        resetDrag();
        onTransitionComplete?.();
      },
      reduceMotion ? 0 : SWIPE_EXIT_DURATION_MS,
    );
  }

  function completeCandidateSwipe(direction: "left" | "right") {
    if (direction === "right") {
      resetDrag();

      if (activeCandidate.format === "hook_video") {
        handleSelectHook();
        return;
      }

      if (activeCandidate.format === "wall_text") {
        void handleSelectWallText();
        return;
      }

      setActionState({ status: "idle" });
      setActionCandidate(activeCandidate);
      return;
    }

    void handleSkipActiveCandidate();
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    const target = event.target as HTMLElement;

    if (
      exitDirection ||
      pendingSkipItemId ||
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
      completeCandidateSwipe("left");
      return;
    }

    if (dragXRef.current >= SWIPE_THRESHOLD_PX) {
      completeCandidateSwipe("right");
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
    if (
      event.target !== event.currentTarget ||
      exitDirection ||
      pendingSkipItemId
    ) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      completeCandidateSwipe("left");
    } else if (event.key === "ArrowRight" || event.key === "Enter") {
      event.preventDefault();
      completeCandidateSwipe("right");
    }
  }

  async function handleSkipActiveCandidate() {
    if (!activeCandidate || pendingSkipItemId) {
      return;
    }

    if (!activeCandidate.item.assignmentId) {
      advancePastActiveItem("left");
      return;
    }

    setPendingSkipItemId(activeCandidate.item.id);
    const skippedCandidate = activeCandidate;

    try {
      // Preserve the released drag position while persistence completes. Resetting
      // here makes the card snap back to the user before its committed exit.
      if (activeCandidate.format === "carousel") {
        await completeTrendingCarouselAction(activeCandidate, "skipped");
      } else if (activeCandidate.format === "hook_video") {
        await completeTrendingHookAction(activeCandidate.item, "skipped");
      } else {
        await completeTrendingWallTextAction(
          activeCandidate.item,
          "skipped",
        );
      }

      showActionNotice(
        skippedCandidate.format === "wall_text"
          ? {
              actionLabel: "Undo",
              message: "Wall-text idea skipped.",
              onAction: async () => {
                try {
                  await completeTrendingWallTextAction(
                    skippedCandidate.item,
                    "restored",
                  );
                  showActionNotice({
                    message: "Wall-text idea restored.",
                  });
                  onCarouselCompleted();
                } catch (error) {
                  showActionNotice({
                    message: getErrorMessage(
                      error,
                      "Could not restore this Wall-text idea.",
                    ),
                  });
                }
              },
            }
          : { message: "Skipped." },
      );
      advancePastActiveItem("left", onCarouselCompleted);
    } catch (error) {
      resetDrag();
      showActionNotice({
        message: getErrorMessage(error, "Could not skip this idea."),
      });
    } finally {
      setPendingSkipItemId(null);
    }
  }

  async function handleSaveToLibrary() {
    if (!actionCandidate) {
      return;
    }

    setActionState({ status: "saving" });

    try {
      const result = await saveCarouselToLibrary(actionCandidate);

      await completeTrendingCarouselAction(actionCandidate, "saved");
      setActionCandidate(null);
      setActionState({ status: "idle" });
      showActionNotice({
        actionHref: "/library?tab=content",
        actionLabel: "View Library",
        message: result.created ? "Saved to Library." : "Already in Library.",
      });
      advancePastActiveItem("right", onCarouselCompleted);
    } catch (error) {
      setActionState({
        message: getErrorMessage(error, "Could not save this carousel."),
        status: "error",
      });
    }
  }

  async function handleSchedulePost() {
    if (!actionCandidate) {
      return;
    }

    setActionState({ status: "scheduling" });

    try {
      const result = await saveCarouselToLibrary(actionCandidate);
      setPendingScheduleCandidate(actionCandidate);
      setActionCandidate(null);
      setActionState({ status: "idle" });
      setScheduleContext({
        assignmentId: actionCandidate.item.assignmentId,
        carouselId: actionCandidate.carousel.carouselId,
        coverUrl: actionCandidate.slides[0]?.renderedUrl ?? null,
        idempotencyKey: `trending-carousel-schedule:${actionCandidate.item.assignmentId}`,
        libraryItemId: result.item.id,
        returnTo: "trending",
        title: getCarouselTitle(actionCandidate.carousel),
      });
    } catch (error) {
      setActionState({
        message: getErrorMessage(error, "Could not prepare this carousel for scheduling."),
        status: "error",
      });
    }
  }

  function handleSelectHook() {
    if (
      activeCandidate.format !== "hook_video" ||
      pendingSkipItemId
    ) {
      return;
    }

    // Opening the composer is reversible. The assignment is completed only
    // after the reviewed composition is saved or scheduled successfully.
    onHookCompose(activeCandidate.item);
  }

  async function handleSelectWallText() {
    if (
      activeCandidate.format !== "wall_text" ||
      pendingSkipItemId
    ) {
      return;
    }

    setWallTextActionState({ status: "idle" });
    setWallTextCandidate(activeCandidate);
  }

  async function handleSaveWallText() {
    if (!wallTextCandidate) {
      return;
    }

    setWallTextActionState({ status: "saving" });

    try {
      await saveWallTextDraft(wallTextCandidate.item);
      setWallTextCandidate(null);
      setWallTextActionState({ status: "idle" });
      showActionNotice({
        actionHref: "/library?tab=posts",
        actionLabel: "View Content",
        message: "Saved to Content. Reel preparation is queued.",
      });
      advancePastActiveItem("right", onCarouselCompleted);
    } catch (error) {
      setWallTextActionState({
        message: getErrorMessage(
          error,
          "Could not save this Wall-of-text video.",
        ),
        status: "error",
      });
    }
  }

  async function handleScheduleWallText() {
    if (!wallTextCandidate) {
      return;
    }

    setWallTextActionState({ status: "scheduling" });

    try {
      const draft = await saveWallTextDraft(wallTextCandidate.item);
      setPendingWallTextDraft(draft);
      setPendingWallTextScheduleCandidate(wallTextCandidate);
      setWallTextActionState({ status: "idle" });
    } catch (error) {
      setWallTextActionState({
        message: getErrorMessage(
          error,
          "Could not prepare this Wall-of-text video for scheduling.",
        ),
        status: "error",
      });
    }
  }

  async function confirmWallTextSchedule(
    selection: HookVideoScheduleSelection,
  ) {
    const candidate = pendingWallTextScheduleCandidate;
    const currentDraft = pendingWallTextDraft;

    if (!candidate || !currentDraft) {
      throw new Error("Choose a Wall-of-text video before scheduling.");
    }

    const readyDraft =
      currentDraft.renderStatus === "ready" &&
      currentDraft.renderedMediaAssetId
        ? currentDraft
        : await waitForWallTextRender(currentDraft.assignmentId);

    if (!readyDraft.renderedMediaAssetId) {
      throw new Error("The Wall-of-text Reel is not ready to schedule yet.");
    }

    await createWallTextSchedule({
      candidate,
      draft: readyDraft,
      selection,
    });

    setPendingWallTextDraft(null);
    setPendingWallTextScheduleCandidate(null);
    setWallTextCandidate(null);
    setWallTextActionState({ status: "idle" });
    showActionNotice({
      actionHref: "/scheduling",
      actionLabel: "View schedule",
      message: "Wall-text Reel scheduled.",
    });
    advancePastActiveItem("right", onCarouselCompleted);
  }

  if (wallTextCandidate) {
    return (
      <section
        aria-label="Wall-text Reel preview"
        className="relative w-full"
      >
        <WallTextDetailView
          actionState={wallTextActionState}
          item={wallTextCandidate.item}
          onBack={() => {
            if (!pendingWallTextScheduleCandidate) {
              setWallTextActionState({ status: "idle" });
              setWallTextCandidate(null);
            }
          }}
          onSave={handleSaveWallText}
          onSchedule={handleScheduleWallText}
        />
        {pendingWallTextScheduleCandidate ? (
          <HookVideoScheduleDrawer
            summary={{
              backgroundTitle:
                pendingWallTextScheduleCandidate.item.creative.title,
              kind: "wall_text",
              text:
                pendingWallTextScheduleCandidate.item.creative.text.fullText,
            }}
            onClose={() => {
              setPendingWallTextDraft(null);
              setPendingWallTextScheduleCandidate(null);
            }}
            onConfirm={confirmWallTextSchedule}
          />
        ) : null}
      </section>
    );
  }

  return (
    <section aria-label="Trending content ideas" className="relative w-full">
      <div
        role="group"
        aria-roledescription="Trending content deck"
        tabIndex={0}
        aria-label={`Trending content deck. Showing idea ${safeActiveItemIndex + 1} of ${candidates.length}. Press left arrow to skip or right arrow to use this idea.`}
        onKeyDown={handleDeckKeyDown}
        className="relative isolate mx-auto mt-3 h-[410px] w-full max-w-xl overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E16540] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1F1F1F] sm:mt-7"
      >
        {[...deckSlots].reverse().map((slot) => (
          <TrendingDeckCard
            key={slot.candidate.item.id}
            activeSlideByCarouselId={activeSlideByCarouselId}
            candidate={slot.candidate}
            depth={slot.depth}
            dragX={slot.depth === 0 ? dragX : 0}
            exitDirection={slot.depth === 0 ? exitDirection : null}
            isDragging={slot.depth === 0 && isDragging}
            itemCount={candidates.length}
            itemIndex={slot.itemIndex}
            onActiveSlideChange={onActiveSlideChange}
            onPointerCancel={cancelPointerInteraction}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishPointerInteraction}
          />
        ))}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-4 z-20 rounded-full border border-[#46B879]/65 bg-[#173326]/90 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#73D5A2]"
          style={{
            opacity: Math.min(Math.max(dragX / SWIPE_THRESHOLD_PX, 0), 1),
          }}
        >
          Use
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-4 z-20 rounded-full border border-[#E15A5A]/65 bg-[#3A2020]/90 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#F08383]"
          style={{
            opacity: Math.min(Math.max(-dragX / SWIPE_THRESHOLD_PX, 0), 1),
          }}
        >
          Skip
        </div>
      </div>
      <div
        className={cn(
          "mx-auto mt-4 flex w-full items-center gap-3",
          activeCandidate.format === "carousel"
            ? "max-w-[320px]"
            : "max-w-[470px]",
        )}
      >
        {activeCandidate.format !== "carousel" ? (
          <button
            type="button"
            onClick={() => onChooseVideoSource(activeCandidate.format)}
            disabled={Boolean(exitDirection || pendingSkipItemId)}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-control border border-border-strong bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Library className="size-4" aria-hidden="true" />
            Choose
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void handleSkipActiveCandidate()}
          disabled={Boolean(exitDirection || pendingSkipItemId)}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-control border border-border-strong bg-card px-4 text-sm font-semibold text-muted transition-colors hover:bg-card-muted hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="size-4" aria-hidden="true" />
          Skip
        </button>
        <button
          type="button"
          onClick={() => completeCandidateSwipe("right")}
          disabled={Boolean(exitDirection || pendingSkipItemId)}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check className="size-4" aria-hidden="true" />
          Use
        </button>
      </div>
      <span className="sr-only" aria-live="polite">
        Showing {title}, idea {safeActiveItemIndex + 1} of {candidates.length}
      </span>
      {actionCandidate ? (
        <CarouselActionDialog
          actionState={actionState}
          candidate={actionCandidate}
          onClose={() => {
            setActionState({ status: "idle" });
            setActionCandidate(null);
          }}
          onSaveToLibrary={handleSaveToLibrary}
          onSchedulePost={handleSchedulePost}
        />
      ) : null}
      <PlatformSelectionModal
        context={scheduleContext}
        open={Boolean(scheduleContext)}
        onConfirmed={async (submission) => {
          if (!scheduleContext || !pendingScheduleCandidate) {
            throw new Error("Choose an Instagram carousel before scheduling.");
          }

          await scheduleTrendingCarousel({
            candidate: pendingScheduleCandidate,
            context: scheduleContext,
            submission,
          });

          let completionWarning = false;

          try {
            await completeTrendingCarouselAction(
              pendingScheduleCandidate,
              "scheduled",
            );
          } catch {
            completionWarning = true;
          }

          setScheduleContext(null);
          setPendingScheduleCandidate(null);
          showActionNotice({
            actionHref: "/scheduling",
            actionLabel: "View schedule",
            message: completionWarning
              ? "Carousel scheduled. Trending may need a refresh."
              : "Carousel scheduled.",
          });
          advancePastActiveItem("right", onCarouselCompleted);
        }}
        onOpenChange={(open) => {
          if (!open) {
            setScheduleContext(null);
            setPendingScheduleCandidate(null);
          }
        }}
      />
      {actionNotice ? <CarouselActionToast notice={actionNotice} /> : null}
    </section>
  );
}

function CarouselActionDialog({
  actionState,
  candidate,
  onClose,
  onSaveToLibrary,
  onSchedulePost,
}: {
  actionState: CarouselActionState;
  candidate: CompleteCarousel;
  onClose: () => void;
  onSaveToLibrary: () => void | Promise<void>;
  onSchedulePost: () => void | Promise<void>;
}) {
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const title = getCarouselTitle(candidate.carousel);
  const isSaving = actionState.status === "saving";
  const isScheduling = actionState.status === "scheduling";
  const isBusy = isSaving || isScheduling;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousBodyOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    firstActionRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.removeEventListener("keydown", handleKeyDown);

      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [onClose]);

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/45 px-4 py-5"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="carousel-action-dialog-title"
        className="flex h-[min(700px,calc(100vh-2.5rem))] w-full max-w-[960px] flex-col overflow-hidden rounded-[20px] border border-[#383838] bg-[#292929] text-[#F5F3F0] shadow-[0_28px_90px_rgb(0_0_0_/_0.48)]"
      >
        <div className="border-b border-[#383838] bg-[#292929]">
          <div className="flex items-start justify-between gap-4 px-5 py-5 sm:px-6">
            <div className="min-w-0">
              <h2
                id="carousel-action-dialog-title"
                className="text-xl font-semibold text-[#F5F3F0]"
              >
                What would you like to do?
              </h2>
              <p className="mt-1 text-sm font-medium text-[#B9B5AF]">Step 1 of 4</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="hidden rounded-full bg-[#242424] px-2.5 py-1 text-xs font-semibold lowercase text-[#8D8984] sm:inline-flex">
                esc
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="inline-flex size-9 items-center justify-center rounded-full text-[#8D8984] transition hover:bg-[#242424] hover:text-[#F5F3F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E16540] focus-visible:ring-offset-2 focus-visible:ring-offset-[#292929]"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="h-1 bg-[#242424]">
            <div className="h-full w-1/4 bg-[#E16540]" />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="space-y-3">
            <CarouselActionOption
              ref={firstActionRef}
              description="Save this carousel for later"
              disabled={isBusy}
              icon={
                isSaving ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="size-5" aria-hidden="true" />
                )
              }
              label={isSaving ? "Saving..." : "Save to Library"}
              selected
              onClick={onSaveToLibrary}
            />
            <CarouselActionOption
              description="Post or schedule to your platforms"
              disabled={isBusy}
              icon={
                isScheduling ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                ) : (
                  <CalendarCheck className="size-5" aria-hidden="true" />
                )
              }
              label={isScheduling ? "Preparing..." : "Schedule Post"}
              onClick={onSchedulePost}
            />
          </div>
          {actionState.status === "error" ? (
            <div
              role="alert"
              className="mt-4 rounded-md border border-[#E15A5A]/35 bg-[#E15A5A]/10 px-4 py-3 text-sm font-semibold text-[#E15A5A]"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{actionState.message}</span>
                <button
                  type="button"
                  onClick={onSaveToLibrary}
                  className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-[#E15A5A] px-3 text-xs font-semibold text-[#1F1F1F] transition hover:bg-[#E15A5A]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E15A5A]/30"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : null}
          <p className="sr-only">Selected carousel: {title}</p>
        </div>

        <div className="border-t border-[#383838] bg-[#292929] px-5 py-5 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-[#B9B5AF] transition hover:text-[#F5F3F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E16540] focus-visible:ring-offset-2 focus-visible:ring-offset-[#292929]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

type CarouselActionOptionProps = {
  description: string;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void | Promise<void>;
  selected?: boolean;
};

const CarouselActionOption = forwardRef<
  HTMLButtonElement,
  CarouselActionOptionProps
>(function CarouselActionOption(
  {
    description,
    disabled = false,
    icon,
    label,
    onClick,
    selected = false,
  },
  ref,
) {
  return (
    <button
      type="button"
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group grid min-h-24 w-full grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-4 rounded-[12px] border bg-[#242424] px-5 py-4 text-left transition-[background-color,border-color] hover:border-[#744231] hover:bg-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E16540] focus-visible:ring-offset-2 focus-visible:ring-offset-[#292929] disabled:cursor-not-allowed disabled:opacity-65",
        selected ? "border-[#744231] ring-2 ring-[#E16540]/15" : "border-[#383838]",
      )}
    >
      <span
        className={cn(
          "flex size-12 items-center justify-center rounded-full",
          selected ? "bg-[#3A2721] text-[#E16540]" : "bg-[#242424] text-[#46B879]",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-base font-semibold text-[#F5F3F0]">
          {label}
        </span>
        <span className="mt-1 block text-sm font-medium leading-5 text-[#B9B5AF]">
          {description}
        </span>
      </span>
      <Check
        className={cn(
          "size-4 text-[#8D8984] opacity-0 transition group-hover:opacity-100",
          selected && "opacity-100 text-[#E16540]",
        )}
        aria-hidden="true"
      />
    </button>
  );
});

function CarouselActionToast({ notice }: { notice: CarouselActionNotice }) {
  return (
    <div
      role="status"
      className="fixed bottom-5 left-1/2 z-[var(--z-modal)] flex -translate-x-1/2 items-center gap-3 rounded-full border border-[#383838] bg-[#292929] px-4 py-2 text-sm font-semibold text-[#F5F3F0] shadow-[0_18px_45px_rgb(0_0_0_/_0.38)]"
    >
      <span>{notice.message}</span>
      {notice.onAction && notice.actionLabel ? (
        <button
          type="button"
          onClick={() => void notice.onAction?.()}
          className="rounded-full bg-[#3A2721] px-3 py-1 text-xs font-bold text-[#E16540] transition-colors hover:bg-[#E16540] hover:text-[#1F1F1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E16540]"
        >
          {notice.actionLabel}
        </button>
      ) : notice.actionHref && notice.actionLabel ? (
        <Link
          href={notice.actionHref}
          className="rounded-full bg-[#3A2721] px-3 py-1 text-xs font-bold text-[#E16540] transition-colors hover:bg-[#E16540] hover:text-[#1F1F1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E16540]"
        >
          {notice.actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

type TrendingDeckCardProps = {
  activeSlideByCarouselId: Record<string, number>;
  candidate: TrendingCandidate;
  depth: DeckDepth;
  dragX: number;
  exitDirection: "left" | "right" | null;
  isDragging: boolean;
  itemCount: number;
  itemIndex: number;
  onActiveSlideChange: (carouselId: string, nextIndex: number) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
};

function TrendingDeckCard({
  candidate,
  itemCount,
  itemIndex,
  ...props
}: TrendingDeckCardProps) {
  switch (candidate.format) {
    case "carousel":
      return (
        <CarouselDeckCard
          {...props}
          candidate={candidate}
          carouselCount={itemCount}
          carouselIndex={itemIndex}
        />
      );
    case "hook_video":
      return (
        <TrendingHookDeckCard
          candidate={candidate}
          depth={props.depth}
          dragX={props.dragX}
          exitDirection={props.exitDirection}
          isDragging={props.isDragging}
          itemCount={itemCount}
          itemIndex={itemIndex}
          onPointerCancel={props.onPointerCancel}
          onPointerDown={props.onPointerDown}
          onPointerMove={props.onPointerMove}
          onPointerUp={props.onPointerUp}
        />
      );
    case "wall_text":
      return (
        <TrendingWallTextDeckCard
          candidate={candidate}
          depth={props.depth}
          dragX={props.dragX}
          exitDirection={props.exitDirection}
          isDragging={props.isDragging}
          itemCount={itemCount}
          itemIndex={itemIndex}
          onPointerCancel={props.onPointerCancel}
          onPointerDown={props.onPointerDown}
          onPointerMove={props.onPointerMove}
          onPointerUp={props.onPointerUp}
        />
      );
  }
}

function TrendingHookDeckCard({
  candidate,
  depth,
  dragX,
  exitDirection,
  isDragging,
  itemCount,
  itemIndex,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  candidate: CompleteHookVideo;
  depth: DeckDepth;
  dragX: number;
  exitDirection: "left" | "right" | null;
  isDragging: boolean;
  itemCount: number;
  itemIndex: number;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
}) {
  const isActive = depth === 0;
  const [previewRetryKey, setPreviewRetryKey] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const creative = candidate.item.creative;
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

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const controller = new AbortController();

    async function loadPreview() {
      setPreviewLoading(true);
      setPreviewError(null);

      try {
        const token = await getCurrentUserIdToken();

        if (!token) {
          throw new Error("Sign in before previewing Hook ideas.");
        }

        const response = await fetch(creative.previewSessionEndpoint, {
          body: JSON.stringify({
            influencerId: creative.influencerId,
            sourceKind: creative.sourceKind,
          }),
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          method: "POST",
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => null)) as
          | { ok: true; previewUrl: string }
          | { error?: string; ok?: false }
          | null;

        if (!response.ok || data?.ok !== true) {
          throw new Error(
            data?.ok === false && data.error
              ? data.error
              : "Could not load this Hook preview.",
          );
        }

        if (!controller.signal.aborted) {
          setPreviewUrl(`${data.previewUrl}?session=${Date.now()}`);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setPreviewUrl(null);
          setPreviewError(
            getErrorMessage(error, "Could not load this Hook preview."),
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setPreviewLoading(false);
        }
      }
    }

    void loadPreview();

    return () => controller.abort();
  }, [creative, isActive, previewRetryKey]);

  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-start justify-center pt-1"
      style={{ zIndex: deckStyle.zIndex }}
    >
      <article
        aria-label={`${creative.text.value}, Hook idea ${itemIndex + 1} of ${itemCount}`}
        aria-hidden={isActive ? undefined : "true"}
        className={cn(
          "w-[min(72vw,230px)] origin-center select-none overflow-visible transition-[opacity,transform] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none",
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
        <HookVideoCard
          dragOffset={0}
          hookFontSize={creative.text.fontSize}
          hookLines={creative.text.lines}
          hookText={creative.text.value}
          previewError={isActive ? previewError : null}
          previewLoading={isActive && previewLoading}
          previewUrl={isActive ? previewUrl : null}
          trimEnd={creative.trimEnd}
          trimStart={creative.trimStart}
          video={{
            durationSeconds: creative.sourceDurationSeconds,
            id: creative.videoId,
            influencerKey: null,
            influencerId: creative.influencerId,
            ratio: creative.aspectRatio,
            reactionType: null,
            sourceKind: creative.sourceKind,
            thumbnailUrl: creative.thumbnailUrl,
            title: creative.title,
            trimEnd: creative.trimEnd,
            trimStart: creative.trimStart,
            visualGroup: null,
          }}
          onPreviewError={() => {
            setPreviewUrl(null);
            setPreviewLoading(false);
            setPreviewError("Could not load this Hook preview.");
          }}
          onRetryPreview={() => setPreviewRetryKey((current) => current + 1)}
        />
      </article>
    </div>
  );
}

function TrendingWallTextDeckCard({
  candidate,
  depth,
  dragX,
  exitDirection,
  isDragging,
  itemCount,
  itemIndex,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  candidate: CompleteWallText;
  depth: DeckDepth;
  dragX: number;
  exitDirection: "left" | "right" | null;
  isDragging: boolean;
  itemCount: number;
  itemIndex: number;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
}) {
  const isActive = depth === 0;
  const videoRef = useRef<HTMLVideoElement>(null);
  const creative = candidate.item.creative;
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
  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (!isActive) {
      video.pause();
      return;
    }

    video.currentTime = 0;
    void video.play().catch(() => undefined);
  }, [creative.previewUrl, isActive]);

  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-start justify-center pt-1"
      style={{ zIndex: deckStyle.zIndex }}
    >
      <article
        aria-label={`${creative.title}, Wall-of-text idea ${itemIndex + 1} of ${itemCount}`}
        aria-hidden={isActive ? undefined : "true"}
        className={cn(
          "w-[min(72vw,230px)] origin-center select-none overflow-visible transition-[opacity,transform] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none",
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
            "relative aspect-[9/16] overflow-hidden rounded-lg bg-[#171717]",
            isActive
              ? "shadow-[0_10px_18px_rgb(9_9_11_/_0.28)]"
              : "shadow-[0_6px_12px_rgb(9_9_11_/_0.18)]",
          )}
        >
          <video
            ref={videoRef}
            src={creative.previewUrl}
            poster={creative.thumbnailUrl ?? undefined}
            autoPlay={isActive}
            muted
            playsInline
            preload={isActive ? "auto" : "metadata"}
            aria-hidden="true"
            className="pointer-events-none size-full object-cover"
          />
          <WallTextOverlay
            content={creative.text}
            layout={creative.layout}
          />
          {isActive ? (
            <button
              type="button"
              data-deck-control
              aria-label="Replay Wall-text preview"
              title="Replay"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                const video = videoRef.current;

                if (!video) {
                  return;
                }

                video.currentTime = 0;
                void video.play().catch(() => undefined);
              }}
              className="absolute bottom-2 right-2 z-10 inline-flex size-9 items-center justify-center rounded-full border border-white/15 bg-black/72 text-white transition-colors hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </article>
    </div>
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
          "w-[min(78vw,270px)] origin-center select-none overflow-visible transition-[opacity,transform] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none sm:w-[270px]",
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
            "relative aspect-[4/5] overflow-hidden rounded-lg bg-[#292929]",
            isActive
              ? "shadow-[0_10px_18px_rgb(9_9_11_/_0.2)]"
              : "shadow-[0_6px_12px_rgb(9_9_11_/_0.14)]",
          )}
        >
          {/* Rendered Carousel slides are immutable Cloud Storage creative assets. */}
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
                      ? "w-4 bg-[#E16540]"
                      : "w-1.5 bg-[#B9B5AF]/55 hover:bg-[#B9B5AF]",
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

function getTrendingDeckSlots(
  candidates: TrendingCandidate[],
  activeItemIndex: number,
): TrendingDeckSlot[] {
  return ([0, 1, 2] as DeckDepth[]).flatMap((depth) => {
    const itemIndex = activeItemIndex + depth;
    const candidate = candidates[itemIndex];

    return candidate ? [{ candidate, itemIndex, depth }] : [];
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
        compact && "border-y border-[#383838] py-5",
      )}
    >
      {!compact ? <CarouselLoadingStackVisual /> : null}

      <div
        className={cn(
          "mx-auto flex max-w-2xl items-start gap-4",
          !compact && "mt-5 px-4",
        )}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-[#3A2721] text-[#E16540]">
          <Loader2
            className="size-5 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div>
              <p className="text-sm font-semibold text-[#F5F3F0]">
                {status}
              </p>
              <p className="mt-1 text-xs leading-5 text-[#B9B5AF]">
                {carousels.length} personalized carousel {ideaLabel} in progress
              </p>
            </div>
            <span className="text-xs font-medium tabular-nums text-[#B9B5AF]">
              {readySlideCount}/{slideCount} slides ready
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#383838]">
            <div
              className="h-full rounded-full bg-[#E16540] transition-[width] duration-500 motion-reduce:transition-none"
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
      className="relative isolate mx-auto h-[348px] w-full max-w-lg overflow-hidden"
      aria-hidden="true"
    >
      {LOADING_STACK_PLACEHOLDERS.map((placeholder, index) => (
        <div
          key={placeholder.translateY}
          className="absolute inset-0 flex items-start justify-center pt-1"
          style={{ zIndex: placeholder.zIndex }}
        >
          <div
            className="relative aspect-[4/5] w-[min(76vw,252px)] origin-center overflow-hidden rounded-[12px] border border-[#383838] bg-[#292929] shadow-[0_18px_45px_rgb(0_0_0_/_0.26)]"
            style={{
              opacity: placeholder.opacity,
              transform: `translateY(${placeholder.translateY}px) scale(${placeholder.scale})`,
            }}
          >
            <div className="size-full p-5">
              <Skeleton className="h-2.5 w-16 rounded-full bg-[#383838]" />
              <Skeleton className="mt-5 h-[150px] w-full rounded-[8px] bg-[#303030]" />
              <div className="mt-5 flex flex-col gap-2.5">
                <Skeleton className="h-3 w-4/5 rounded-full bg-[#383838]" />
                <Skeleton className="h-3 w-full rounded-full bg-[#383838]" />
                <Skeleton className="h-3 w-3/5 rounded-full bg-[#383838]" />
              </div>
              {index === LOADING_STACK_PLACEHOLDERS.length - 1 ? (
                <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-1.5">
                  {[0, 1, 2, 3, 4].map((dot) => (
                    <span
                      key={dot}
                      className={cn(
                        "size-1.5 rounded-full",
                        dot === 0 ? "bg-[#E16540]" : "bg-[#494949]",
                      )}
                    />
                  ))}
                </div>
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
    <section className="flex flex-col gap-4 border-y border-[#E15A5A]/25 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-[#E15A5A]/10 text-[#E15A5A]">
          <CircleAlert className="size-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-semibold text-[#F5F3F0]">
            {count} carousel {ideaLabel} attention
          </p>
          <p className="mt-1 text-xs leading-5 text-[#B9B5AF]">
            The worker did not finish these carousel renders.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[8px] border border-[#383838] bg-[#242424] px-3 text-xs font-semibold text-[#F5F3F0] transition-colors hover:bg-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E16540] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1F1F1F]"
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
      {icon === "preparing" ? (
        <CarouselLoadingStackVisual />
      ) : (
        <span
          className={cn(
            "flex size-11 items-center justify-center rounded-[8px]",
            icon === "failed"
              ? "bg-[#E15A5A]/10 text-[#E15A5A]"
              : "bg-[#3A2721] text-[#E16540]",
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
      )}
      <div>
        <h2
          className={cn(
            "text-xl font-semibold text-[#F5F3F0]",
            icon === "preparing" ? "mt-1" : "mt-5",
          )}
        >
          {title}
        </h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-[#B9B5AF]">{message}</p>
      </div>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-[8px] bg-[#E16540] px-4 text-sm font-semibold text-[#1F1F1F] transition-[background-color,transform] hover:bg-[#EA7654] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E16540] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1F1F1F]"
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
      aria-label="Loading trending content ideas"
      className="w-full"
    >
      <CarouselLoadingStackVisual />
      <div className="mx-auto mt-4 flex max-w-sm items-center gap-3 px-4">
        <Skeleton className="size-10 shrink-0 rounded-[8px] bg-[#3A2721]" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-44 max-w-full rounded-full bg-[#494949]" />
          <Skeleton className="h-2.5 w-64 max-w-full rounded-full bg-[#383838]" />
        </div>
      </div>
    </div>
  );
}

async function saveCarouselToLibrary(candidate: CompleteCarousel) {
  const token = await getCurrentUserIdToken();

  if (!token) {
    throw new Error("Sign in before saving to Library.");
  }

  const response = await fetch("/api/library/carousels", {
    body: JSON.stringify({
      carouselId: candidate.carousel.carouselId,
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const data = (await response.json().catch(() => null)) as
    | SaveCarouselLibraryResponse
    | null;

  if (!response.ok || data?.ok !== true) {
    throw new Error(
      data?.ok === false
        ? data.message
        : "Could not save this carousel to Library.",
    );
  }

  return data;
}

async function completeTrendingCarouselAction(
  candidate: CompleteCarousel,
  action: TrendingCompletionAction,
) {
  const assignmentId = candidate.item.assignmentId;

  if (!assignmentId) {
    return;
  }

  const token = await getCurrentUserIdToken();

  if (!token) {
    throw new Error("Sign in before updating this Instagram carousel.");
  }

  const response = await fetch("/api/trending/feed/actions", {
    body: JSON.stringify({
      action,
      assignmentId,
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const data = (await response.json().catch(() => null)) as
    | CompleteTrendingActionResponse
    | null;

  if (!response.ok || data?.ok !== true) {
    throw new Error(
      data?.ok === false
        ? data.message
        : "Could not update this Instagram carousel.",
    );
  }
}

async function completeTrendingHookAction(
  item: TrendingHookVideoFeedItem,
  action: "selected" | "skipped",
) {
  const token = await getCurrentUserIdToken();

  if (!token) {
    throw new Error("Sign in before updating this Instagram Reel idea.");
  }

  const response = await fetch("/api/trending/hook-videos/feed/actions", {
    body: JSON.stringify({
      action,
      assignmentId: item.assignmentId,
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const data = (await response.json().catch(() => null)) as
    | { error?: string; ok: false }
    | { ok: true }
    | null;

  if (!response.ok || data?.ok !== true) {
    throw new Error(
      data?.ok === false && data.error
        ? data.error
        : "Could not update this Instagram Reel idea.",
    );
  }
}

async function completeTrendingWallTextAction(
  item: TrendingWallTextFeedItem,
  action: "restored" | "selected" | "skipped",
) {
  const token = await getCurrentUserIdToken();

  if (!token) {
    throw new Error("Sign in before updating this Wall-of-text idea.");
  }

  const response = await fetch("/api/trending/wall-text/feed/actions", {
    body: JSON.stringify({
      action,
      assignmentId: item.assignmentId,
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const data = (await response.json().catch(() => null)) as
    | { error?: string; ok: false }
    | { ok: true }
    | null;

  if (!response.ok || data?.ok !== true) {
    throw new Error(
      data?.ok === false && data.error
        ? data.error
        : "Could not update this Wall-of-text idea.",
    );
  }
}

async function saveWallTextDraft(item: TrendingWallTextFeedItem) {
  const token = await getCurrentUserIdToken();

  if (!token) {
    throw new Error("Sign in before saving this Wall-of-text video.");
  }

  const response = await fetch("/api/trending/wall-text/drafts", {
    body: JSON.stringify({
      assignmentId: item.assignmentId,
    }),
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const data = (await response.json().catch(() => null)) as
    | SavedWallTextDraftResponse
    | null;

  if (!response.ok || !data || data.ok !== true) {
    throw new Error(
      data?.ok === false && data.error
        ? data.error
        : "Could not save this Wall-of-text video.",
    );
  }

  return data.draft;
}

async function getSavedWallTextDraft(assignmentId: string) {
  const token = await getCurrentUserIdToken();

  if (!token) {
    throw new Error("Sign in before checking this Wall-of-text video.");
  }

  const response = await fetch(
    `/api/trending/wall-text/drafts?assignmentId=${encodeURIComponent(assignmentId)}`,
    {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const data = (await response.json().catch(() => null)) as
    | SavedWallTextDraftResponse
    | null;

  if (!response.ok || !data || data.ok !== true) {
    throw new Error(
      data?.ok === false && data.error
        ? data.error
        : "Could not check this Wall-of-text video.",
    );
  }

  return data.draft;
}

async function waitForWallTextRender(assignmentId: string) {
  const maximumAttempts = 45;

  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    const draft = await getSavedWallTextDraft(assignmentId);

    if (draft.renderStatus === "ready" && draft.renderedMediaAssetId) {
      return draft;
    }

    if (draft.renderStatus === "failed") {
      throw new Error(
        draft.renderError ||
          "The Wall-of-text Reel could not be prepared. Save it again to retry.",
      );
    }

    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 2_000);
    });
  }

  throw new Error(
    "The Reel is still preparing. It is saved in Content, so you can schedule it there when it is ready.",
  );
}

async function createWallTextSchedule(params: {
  candidate: CompleteWallText;
  draft: SavedWallTextDraft;
  selection: HookVideoScheduleSelection;
}) {
  const mediaAssetId = params.draft.renderedMediaAssetId;

  if (!mediaAssetId) {
    throw new Error("The Wall-of-text Reel is not ready to schedule.");
  }

  const token = await getCurrentUserIdToken();

  if (!token) {
    throw new Error("Sign in before scheduling this Wall-of-text Reel.");
  }

  const response = await fetch("/api/schedules", {
    body: JSON.stringify({
      caption: "",
      idempotencyKey: [
        "wall-text-schedule",
        params.draft.assignmentId,
        params.selection.scheduledDate,
        params.selection.scheduledTime,
        params.selection.timezone,
      ].join(":"),
      metadata: {
        mediaMode: "single_video",
        scheduledVideoId: mediaAssetId,
        scheduledVideoSourceType: "wall_text_render",
        wallTextAssignmentId: params.draft.assignmentId,
        wallTextCreativeId: params.draft.id,
      },
      scheduledDate: params.selection.scheduledDate,
      scheduledTime: params.selection.scheduledTime,
      source: {
        id: mediaAssetId,
        kind: "media_asset",
      },
      targets: params.selection.targets.map((target) => ({
        connectionId: target.connectionId,
        platform: target.platform,
        settings: target.settings,
      })),
      timezone: params.selection.timezone,
      title: params.candidate.item.creative.title,
    }),
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const data = (await response.json().catch(() => null)) as
    | { message?: string; ok?: false }
    | { ok: true }
    | null;

  if (!response.ok || !data || data.ok !== true) {
    throw new Error(
      data?.ok === false && data.message
        ? data.message
        : "Could not schedule this Wall-of-text Reel.",
    );
  }
}

async function scheduleTrendingCarousel(params: {
  candidate: CompleteCarousel;
  context: SchedulePlatformContext;
  submission: CarouselScheduleSubmission;
}) {
  const assignmentId = params.candidate.item.assignmentId;

  if (!assignmentId) {
    throw new Error("Refresh Trending before scheduling this carousel.");
  }

  return createAndPublishCarouselSchedule({
    assignmentId,
    carouselId: params.context.carouselId,
    idempotencyKey: params.context.idempotencyKey,
    libraryItemId: params.context.libraryItemId,
    sourceSurface: "trending",
    submission: params.submission,
    title: getCarouselTitle(params.candidate.carousel),
  });
}

function getErrorMessage(error: unknown, fallback: string) {
  return toCarouselDisplayCopy(
    error instanceof Error && error.message ? error.message : fallback,
  );
}

function toCarouselDisplayCopy(message: string) {
  return message
    .replace(/\bTrending slideshows\b/g, "Instagram carousels")
    .replace(/\bTrending slideshow\b/g, "Instagram carousel")
    .replace(/\bTrending carousels\b/g, "Instagram carousels")
    .replace(/\bTrending carousel\b/g, "Instagram carousel")
    .replace(/\bgenerated slideshows\b/g, "generated carousels")
    .replace(/\bGenerated slideshows\b/g, "Generated carousels")
    .replace(/\bslideshow ideas\b/g, "carousel ideas")
    .replace(/\bSlideshow ideas\b/g, "Carousel ideas")
    .replace(/\bslideshow preparation\b/g, "carousel preparation")
    .replace(/\bSlideshow preparation\b/g, "Carousel preparation")
    .replace(/\bslideshows\b/g, "carousels")
    .replace(/\bSlideshows\b/g, "Carousels")
    .replace(/\bslideshow\b/g, "carousel")
    .replace(/\bSlideshow\b/g, "Carousel");
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

function getTrendingCandidateTitle(candidate: TrendingCandidate) {
  if (candidate.format === "carousel") {
    return getCarouselTitle(candidate.carousel);
  }

  if (candidate.format === "hook_video") {
    return candidate.item.creative.text.value;
  }

  return candidate.item.creative.title;
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

function getBrowserLocalDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return year && month && day
    ? `${year}-${month}-${day}`
    : new Date().toISOString().slice(0, 10);
}

function waitForHookPreparationPoll(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", handleAbort);
      resolve();
    }, 2_000);
    const handleAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };

    signal.addEventListener("abort", handleAbort, { once: true });
  });
}
