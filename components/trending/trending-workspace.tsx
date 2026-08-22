"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Check,
  CircleAlert,
  Clapperboard,
  Images,
  Loader2,
  RefreshCw,
  Save,
  ScanText,
  Sparkles,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  TransitionEvent as ReactTransitionEvent,
} from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { useAuth } from "@/contexts/auth-context";
import {
  CreativeDecisionActions,
  CreativeEditAction,
} from "@/components/trending/creative-card-actions";
import { PlatformSelectionModalLoading } from "@/components/social/platform-selection-modal-loading";
import type { SchedulePlatformContext } from "@/components/social/platform-selection-modal";
import { HookVideoCard } from "@/components/trending/hook-video-card";
import type { HookPreviewAudio } from "@/components/trending/hook-audio-preview";
import type { HookVideoScheduleSelection } from "@/components/trending/hook-video-schedule-drawer";
import {
  WallTextDetailView,
  type WallTextDetailActionState,
} from "@/components/trending/wall-text-detail-view";
import { WallTextOverlay } from "@/components/trending/wall-text-overlay";
import { WallTextAudioPreview } from "@/components/trending/wall-text-audio-preview";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
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
  excludeDismissedTrendingFeedItems,
  getTrendingFeedActiveItemIndex,
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
import { buildUserInfluencerId } from "@/lib/trending/hook-video-source-logic";
import type {
  HookInfluencerSummary,
  HookInfluencerVideoSummary,
} from "@/lib/trending/hook-video-types";
import type { TrendingCreativeEditRecord } from "@/lib/trending/creative-edit-contract";
import { cn } from "@/lib/utils";

const TrendingCreativeEditor = dynamic(
  () =>
    import("@/components/trending/trending-creative-editor").then(
      (module) => module.TrendingCreativeEditor,
    ),
  { loading: TrendingCreativeEditorLoading },
);

const HookVideoComposer = dynamic(
  () =>
    import("@/components/trending/hook-video-composer").then(
      (module) => module.HookVideoComposer,
    ),
  { loading: HookVideoComposerLoading },
);

const HookVideoScheduleDrawer = dynamic(
  () =>
    import("@/components/trending/hook-video-schedule-drawer").then(
      (module) => module.HookVideoScheduleDrawer,
    ),
  { loading: PlatformSelectionModalLoading },
);

const PlatformSelectionModal = dynamic(
  () =>
    import("@/components/social/platform-selection-modal").then(
      (module) => module.PlatformSelectionModal,
    ),
  { loading: PlatformSelectionModalLoading },
);

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

type TrendingHookComposition = {
  edit: TrendingCreativeEditRecord | null;
  item: TrendingHookVideoFeedItem;
};

type DeckDepth = 0 | 1 | 2;
type HookPreviewStatus = "error" | "loading" | "ready";

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

function TrendingCreativeEditorLoading() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      aria-live="polite"
      role="status"
    >
      <div className="flex w-full max-w-sm items-center gap-3 rounded-[var(--radius-panel)] border border-border bg-card px-5 py-4 text-sm font-semibold text-foreground shadow-card">
        <Loader2
          className="size-5 shrink-0 animate-spin text-primary motion-reduce:animate-none"
          aria-hidden="true"
        />
        Opening editor…
      </div>
    </div>
  );
}

function HookVideoComposerLoading() {
  return (
    <div
      aria-live="polite"
      className="flex min-h-[540px] items-center justify-center px-5 py-8"
      role="status"
    >
      <div className="flex items-center gap-3 rounded-[var(--radius-panel)] border border-border bg-card px-5 py-4 text-sm font-semibold text-foreground shadow-card">
        <Loader2
          className="size-5 shrink-0 animate-spin text-primary motion-reduce:animate-none"
          aria-hidden="true"
        />
        Opening Hook composer…
      </div>
    </div>
  );
}

export function TrendingWorkspace() {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const loadedFeedLocalDate = useRef<string | null>(null);
  const loadedFeedUserId = useRef<string | null>(null);
  const hookPreparationAttemptKey = useRef<string | null>(null);
  const wallTextPreparationAttemptKey = useRef<string | null>(null);
  const resolvedWallTextJobIds = useRef(new Set<string>());
  const [trendingItems, setTrendingItems] = useState<TrendingFeedItem[]>([]);
  const [headerActionsRoot, setHeaderActionsRoot] =
    useState<HTMLDivElement | null>(null);
  const [formatAvailability, setFormatAvailability] = useState<
    TrendingFeedProviderAvailability[]
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
  const [wallTextPreparationJobId, setWallTextPreparationJobId] =
    useState<string | null>(null);
  const wallTextPreparationJob = useBackgroundJob(wallTextPreparationJobId);

  const hasAuthenticatedUser = Boolean(user);
  const visibleTrendingItems = useMemo(
    () => (hasAuthenticatedUser ? trendingItems : []),
    [hasAuthenticatedUser, trendingItems],
  );
  const visibleCarouselHistoryError = user ? carouselHistoryError : null;
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
        setFormatAvailability(data.formatAvailability ?? []);
        setCarouselProfile(data.profile);
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
        setCarouselProfile(null);
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

  return (
    <section className="min-h-dvh flex-1 bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8 lg:py-8 xl:px-10">
      <div className="mx-auto flex min-h-full max-w-[1360px] flex-col">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-balance text-[32px] font-semibold leading-10 text-foreground-strong">
              Trending
            </h1>
            <p className="mt-1.5 max-w-2xl text-[15px] leading-[22px] text-muted">
              Explore Carousel, Hook, and Wall-of-text ideas made from your
              business profile.
            </p>
          </div>
          <div
            ref={setHeaderActionsRoot}
            className="flex shrink-0 items-center"
          />
        </header>

        <section className="mt-8 min-h-[560px]">
          <div className="flex min-h-[502px] items-start py-6 sm:py-7">
            <TrendingFeedGallery
              headerActionsRoot={headerActionsRoot}
              items={orderedTrendingItems}
              error={visibleCarouselHistoryError}
              loading={carouselFeedLoading}
              profile={carouselFeedProfile}
              onCompleteProfile={openBusinessProfile}
              onCarouselCompleted={() =>
                setCarouselHistoryRefreshKey((current) => current + 1)
              }
              onRetryHistory={() =>
                setCarouselHistoryRefreshKey((current) => current + 1)
              }
            />
          </div>
        </section>
      </div>
    </section>
  );
}

function TrendingFeedGallery({
  error,
  headerActionsRoot,
  items,
  loading,
  onCompleteProfile,
  onCarouselCompleted,
  onRetryHistory,
  profile,
}: {
  error: string | null;
  headerActionsRoot: HTMLDivElement | null;
  items: TrendingFeedItem[];
  loading: boolean;
  onCompleteProfile: () => void;
  onCarouselCompleted: () => void;
  onRetryHistory: () => void;
  profile: CarouselProfileFeed | null;
}) {
  if (loading) {
    return <TrendingPostSkeleton />;
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

  if (items.length === 0) {
    return <TrendingReadyEmptyState />;
  }

  return (
    <TrendingFeed
      headerActionsRoot={headerActionsRoot}
      items={items}
      onCarouselCompleted={onCarouselCompleted}
    />
  );
}

function TrendingReadyEmptyState() {
  return (
    <Empty role="status" className="min-h-[360px] text-foreground">
      <EmptyHeader>
        <EmptyTitle>You&apos;re all caught up</EmptyTitle>
        <EmptyDescription>
          Check back tomorrow for fresh daily hooks and carousel ideas.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function CarouselProfilePrompt({ onAction }: { onAction: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-6 py-14 text-center">
      <h2 className="text-lg font-semibold text-foreground-strong">
        Complete your profile
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        Add your business details to prepare personalized Carousel, Hook, and
        Wall-of-text ideas.
      </p>
      <button
        type="button"
        onClick={onAction}
        className="mt-5 inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-[8px] bg-primary px-4 text-sm font-semibold text-primary-foreground transition-[background-color,transform] hover:bg-primary-hover active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Sparkles className="size-4" aria-hidden="true" />
        Complete profile
      </button>
    </div>
  );
}

function TrendingFeed({
  headerActionsRoot,
  items,
  onCarouselCompleted,
}: {
  headerActionsRoot: HTMLDivElement | null;
  items: TrendingFeedItem[];
  onCarouselCompleted: () => void;
}) {
  const [activeSlideByCarouselId, setActiveSlideByCarouselId] = useState<
    Record<string, number>
  >({});
  const [hookComposition, setHookComposition] =
    useState<TrendingHookComposition | null>(null);

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
  function setActiveSlide(carouselId: string, nextIndex: number) {
    setActiveSlideByCarouselId((current) => ({
      ...current,
      [carouselId]: nextIndex,
    }));
  }

  if (hookComposition) {
    return (
      <TrendingHookComposer
        edit={hookComposition.edit}
        item={hookComposition.item}
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
          activeSlideByCarouselId={activeSlideByCarouselId}
          candidates={candidates}
          headerActionsRoot={headerActionsRoot}
          onActiveSlideChange={setActiveSlide}
          onCarouselCompleted={onCarouselCompleted}
          onHookCompose={(item, edit) => setHookComposition({ edit, item })}
        />
      ) : null}
    </div>
  );
}

function TrendingHookComposer({
  edit,
  item,
  onClose,
}: {
  edit: TrendingCreativeEditRecord | null;
  item: TrendingHookVideoFeedItem;
  onClose: () => void;
}) {
  const creative = item.creative;
  const hookEdit =
    edit?.content.format === "hook_video" ? edit.content : null;
  const editedSource = edit?.source ?? null;
  const influencerId = editedSource
    ? buildUserInfluencerId(editedSource.resolvedAssetId)
    : creative.influencerId;
  const sourceKind = editedSource ? "user" : creative.sourceKind;
  const videoId = editedSource?.resolvedAssetId ?? creative.videoId;
  const hookText = hookEdit?.hookText ?? creative.text.value;
  const [flowState, setFlowState] = useState<HookVideoFlowState>(() =>
    beginHookVideoComposition({
      hookText,
      influencerId,
      influencerVideoId: videoId,
      selectedHookId: item.creativeId,
      sourceKind,
      trimEnd: editedSource ? null : creative.trimEnd,
      trimStart: editedSource ? 0 : creative.trimStart,
    }),
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    editedSource?.resolvedAssetUrl ?? null,
  );
  const influencer: HookInfluencerSummary = {
    id: influencerId,
    name: editedSource?.resolvedAssetTitle ?? creative.influencerName,
    sourceKind,
    thumbnailUrl:
      editedSource?.resolvedThumbnailUrl ?? creative.thumbnailUrl,
    videoCount: 1,
  };
  const video: HookInfluencerVideoSummary = {
    durationSeconds:
      editedSource?.resolvedAssetDurationSeconds ??
      creative.sourceDurationSeconds,
    id: videoId,
    hookTextPlacement: null,
    influencerKey: null,
    influencerId,
    ratio: creative.aspectRatio,
    reactionType: null,
    sourceKind,
    thumbnailUrl:
      editedSource?.resolvedThumbnailUrl ?? creative.thumbnailUrl,
    title: editedSource?.resolvedAssetTitle ?? creative.title,
    trimEnd: editedSource ? null : creative.trimEnd,
    trimStart: editedSource ? 0 : creative.trimStart,
    visualGroup: null,
  };

  useEffect(() => {
    const controller = new AbortController();

    async function loadPreview() {
      if (editedSource) {
        setPreviewUrl(editedSource.resolvedAssetUrl);
        return;
      }

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
  }, [creative, editedSource]);

  return (
    <HookVideoComposer
      flowState={flowState}
      influencer={influencer}
      openingPreviewUrl={previewUrl}
      overlayFontSize={hookEdit?.fontSize ?? creative.text.fontSize}
      overlayLines={hookEdit?.lines ?? creative.text.lines}
      overlayPosition={hookEdit?.position}
      overlayTextColor={hookEdit?.textColor}
      video={video}
      onCommitted={async () => undefined}
      onClose={onClose}
      onStateChange={setFlowState}
    />
  );
}

function TrendingDeck({
  activeSlideByCarouselId,
  candidates,
  headerActionsRoot,
  onActiveSlideChange,
  onCarouselCompleted,
  onHookCompose,
}: {
  activeSlideByCarouselId: Record<string, number>;
  candidates: TrendingCandidate[];
  headerActionsRoot: HTMLDivElement | null;
  onActiveSlideChange: (carouselId: string, nextIndex: number) => void;
  onCarouselCompleted: () => void;
  onHookCompose: (
    item: TrendingHookVideoFeedItem,
    edit: TrendingCreativeEditRecord | null,
  ) => void;
}) {
  const swipeTimerRef = useRef<number | null>(null);
  const swipeCompletionRef = useRef<(() => void) | null>(null);
  const actionNoticeTimerRef = useRef<number | null>(null);
  const decisionLockRef = useRef(false);
  const dragStartXRef = useRef<number | null>(null);
  const dragXRef = useRef(0);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [optimisticallyDismissedItemIds, setOptimisticallyDismissedItemIds] =
    useState<Set<string>>(() => new Set());
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
  const [editorCandidate, setEditorCandidate] =
    useState<TrendingCandidate | null>(null);
  const [editByCreativeId, setEditByCreativeId] = useState<
    Record<string, TrendingCreativeEditRecord>
  >({});
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
  const [pendingDecisionItemId, setPendingDecisionItemId] = useState<
    string | null
  >(null);
  const [hookPreviewStatusByCreativeId, setHookPreviewStatusByCreativeId] =
    useState<Record<string, HookPreviewStatus>>({});
  const [exitDirection, setExitDirection] = useState<"left" | "right" | null>(
    null,
  );
  const visibleCandidates = useMemo(
    () =>
      excludeDismissedTrendingFeedItems(
        candidates,
        optimisticallyDismissedItemIds,
        (candidate) => candidate.item.id,
      ),
    [candidates, optimisticallyDismissedItemIds],
  );
  const activeItemIndex = getTrendingFeedActiveItemIndex(
    visibleCandidates,
    activeItemId,
    (candidate) => candidate.item.id,
  );
  const activeCandidate = visibleCandidates[activeItemIndex] ?? null;

  const activeHookPreviewStatus =
    activeCandidate?.format === "hook_video"
      ? hookPreviewStatusByCreativeId[activeCandidate.item.creativeId] ??
        "loading"
      : null;
  const title = activeCandidate
    ? getTrendingCandidateTitle(activeCandidate)
    : null;
  const deckSlots = getTrendingDeckSlots(
    visibleCandidates,
    activeItemIndex,
  );
  const handleHookPreviewStatusChange = useCallback(
    (creativeId: string, status: HookPreviewStatus) => {
      setHookPreviewStatusByCreativeId((current) =>
        current[creativeId] === status
          ? current
          : { ...current, [creativeId]: status },
      );
    },
    [],
  );
  useEffect(() => {
    if (!activeCandidate) {
      return;
    }

    const nextCandidate = visibleCandidates[activeItemIndex + 1];
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
    visibleCandidates,
    activeItemIndex,
  ]);

  useEffect(() => {
    const pendingEdits = Object.values(editByCreativeId).filter(
      (entry) =>
        entry.format === "carousel" &&
        (entry.renderState === "queued" || entry.renderState === "rendering"),
    );

    if (pendingEdits.length === 0) {
      return;
    }

    let stopped = false;

    async function refreshPendingEdits() {
      const refreshed = await Promise.all(
        pendingEdits.map((entry) =>
          loadTrendingCreativeEdit(entry).catch(() => null),
        ),
      );

      if (stopped) {
        return;
      }

      setEditByCreativeId((current) => {
        let changed = false;
        const next = { ...current };

        refreshed.forEach((entry) => {
          if (!entry) return;
          const previous = current[entry.creativeId];
          if (
            !previous ||
            previous.revision !== entry.revision ||
            previous.renderState !== entry.renderState ||
            previous.updatedAt !== entry.updatedAt
          ) {
            next[entry.creativeId] = entry;
            changed = true;
          }
        });

        return changed ? next : current;
      });
    }

    const timer = window.setInterval(() => void refreshPendingEdits(), 2_500);
    void refreshPendingEdits();

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [editByCreativeId]);

  useEffect(() => {
    if (
      !activeCandidate ||
      editByCreativeId[activeCandidate.item.creativeId]
    ) {
      return;
    }

    let stopped = false;
    const activeItem = activeCandidate.item;

    async function hydrateSavedEdit() {
      const savedEdit = await loadTrendingCreativeEditForItem(
        activeItem,
      ).catch(() => null);

      if (!stopped && savedEdit?.id) {
        setEditByCreativeId((current) => ({
          ...current,
          [savedEdit.creativeId]: savedEdit,
        }));
      }
    }

    void hydrateSavedEdit();

    return () => {
      stopped = true;
    };
  }, [activeCandidate, editByCreativeId]);

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

  function dismissCandidate(candidate: TrendingCandidate) {
    setOptimisticallyDismissedItemIds((current) => {
      if (current.has(candidate.item.id)) {
        return current;
      }

      const next = new Set(current);
      next.add(candidate.item.id);
      return next;
    });
  }

  function restoreCandidate(candidate: TrendingCandidate) {
    setOptimisticallyDismissedItemIds((current) => {
      if (!current.has(candidate.item.id)) {
        return current;
      }

      const next = new Set(current);
      next.delete(candidate.item.id);
      return next;
    });
  }

  function advancePastActiveItem(
    direction: "left" | "right",
    onTransitionComplete: () => void,
  ) {
    dragStartXRef.current = null;
    setIsDragging(false);
    swipeCompletionRef.current = onTransitionComplete;
    setExitDirection(direction);

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    swipeTimerRef.current = window.setTimeout(
      settleSwipeExit,
      reduceMotion ? 0 : SWIPE_EXIT_DURATION_MS + 120,
    );
  }

  function settleSwipeExit() {
    const completion = swipeCompletionRef.current;

    if (!completion) {
      return;
    }

    swipeCompletionRef.current = null;

    if (swipeTimerRef.current !== null) {
      window.clearTimeout(swipeTimerRef.current);
      swipeTimerRef.current = null;
    }

    // React batches the item advance and drag cleanup, so the retained outgoing
    // card is removed without ever receiving a transition back to the origin.
    completion();
    resetDrag();
  }

  function handleExitTransitionEnd(
    event: ReactTransitionEvent<HTMLElement>,
  ) {
    if (
      event.target === event.currentTarget &&
      event.propertyName === "transform" &&
      exitDirection
    ) {
      settleSwipeExit();
    }
  }

  function completeCandidateSwipe(direction: "left" | "right") {
    const started = requestCreativeDecision(
      direction === "left" ? "rejected" : "accepted",
    );

    if (!started) {
      resetDrag();
    }
  }

  function requestCreativeDecision(
    decision: "accepted" | "rejected",
  ) {
    if (
      !activeCandidate ||
      decisionLockRef.current ||
      exitDirection
    ) {
      return false;
    }

    const activeEdit = editByCreativeId[activeCandidate.item.creativeId];

    if (
      decision === "accepted" &&
      activeCandidate.format === "carousel" &&
      activeEdit &&
      (activeEdit.renderState === "queued" ||
        activeEdit.renderState === "rendering")
    ) {
      showActionNotice({
        message: "Your edited Carousel is still rendering. It will be ready shortly.",
      });
      return false;
    }

    if (
      decision === "accepted" &&
      activeCandidate.format === "carousel" &&
      activeEdit?.renderState === "failed"
    ) {
      showActionNotice({
        message:
          activeEdit.renderError ||
          "This edited Carousel could not render. Open Edit and save it again.",
      });
      return false;
    }

    if (
      decision === "accepted" &&
      activeCandidate.format === "hook_video" &&
      activeHookPreviewStatus !== "ready"
    ) {
      showActionNotice({
        message:
          activeHookPreviewStatus === "error"
            ? "Reload this Hook preview before accepting it."
            : "Wait for the Hook preview to finish loading before accepting it.",
      });
      return false;
    }

    const candidate = activeCandidate;
    const nextCandidateId =
      visibleCandidates[activeItemIndex + 1]?.item.id ?? null;
    const direction = decision === "accepted" ? "right" : "left";

    decisionLockRef.current = true;
    setPendingDecisionItemId(candidate.item.id);
    advancePastActiveItem(direction, () => {
      dismissCandidate(candidate);
      setActiveItemId(nextCandidateId);
      void commitCreativeDecision(candidate, decision);
    });
    return true;
  }

  async function commitCreativeDecision(
    candidate: TrendingCandidate,
    decision: "accepted" | "rejected",
  ) {
    try {
      await persistTrendingCreativeDecision(candidate.item, decision);
    } catch (error) {
      restoreCandidate(candidate);
      setActiveItemId(candidate.item.id);
      showActionNotice({
        message: getErrorMessage(
          error,
          "Could not save this decision. The creative was restored.",
        ),
      });
      decisionLockRef.current = false;
      setPendingDecisionItemId(null);
      return;
    }

    decisionLockRef.current = false;
    setPendingDecisionItemId(null);
    showActionNotice({
      message: decision === "accepted" ? "Accepted." : "Rejected.",
    });

    if (decision === "rejected") {
      onCarouselCompleted();
      return;
    }

    if (candidate.format === "hook_video") {
      onHookCompose(
        candidate.item,
        editByCreativeId[candidate.item.creativeId] ?? null,
      );
      return;
    }

    if (candidate.format === "wall_text") {
      setWallTextActionState({ status: "idle" });
      setWallTextCandidate(candidate);
      return;
    }

    setActionState({ status: "idle" });
    setActionCandidate(candidate);
  }

  function handleEditActiveCandidate() {
    if (!activeCandidate || decisionLockRef.current || exitDirection) {
      return;
    }

    setEditorCandidate(activeCandidate);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    const target = event.target as HTMLElement;

    if (
      exitDirection ||
      pendingDecisionItemId ||
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
      pendingDecisionItemId
    ) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      completeCandidateSwipe("left");
    } else if (event.key === "ArrowRight" || event.key === "Enter") {
      event.preventDefault();
      completeCandidateSwipe("right");
    } else if (event.key === "e" || event.key === "E") {
      event.preventDefault();
      handleEditActiveCandidate();
    }
  }

  const handleWindowKeyDown = useEffectEvent((event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputActive =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute("contenteditable") === "true";

      if (
        isInputActive ||
        editorCandidate ||
        actionCandidate ||
        wallTextCandidate ||
        decisionLockRef.current ||
        exitDirection ||
        pendingDecisionItemId ||
        !activeCandidate
      ) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        completeCandidateSwipe("left");
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        completeCandidateSwipe("right");
      } else if (event.key === "e" || event.key === "E") {
        event.preventDefault();
        handleEditActiveCandidate();
      }
  });

  useEffect(() => {
    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, []);

  async function handleSaveToLibrary() {
    if (!actionCandidate) {
      return;
    }

    setActionState({ status: "saving" });

    try {
      const result = await saveCarouselToLibrary(actionCandidate);
      await completeAcceptedCarouselWorkflow(actionCandidate, "saved");

      setActionCandidate(null);
      setActionState({ status: "idle" });
      showActionNotice({
        actionHref: "/avatars?tab=saved",
        actionLabel: "View Saved",
        message: result.created
          ? "Saved to Creative Assets."
          : "Already saved in Creative Assets.",
      });
      onCarouselCompleted();
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
        coverUrl:
          result.item.coverUrl ?? actionCandidate.slides[0]?.renderedUrl ?? null,
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
        actionHref: "/avatars?tab=saved",
        actionLabel: "View Saved",
        message: "Saved to Creative Assets. Video preparation has started.",
      });
      onCarouselCompleted();
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
    onCarouselCompleted();
  }

  const wallTextEdit = wallTextCandidate
    ? editByCreativeId[wallTextCandidate.item.creativeId] ?? null
    : null;
  const wallTextEditContent =
    wallTextEdit?.content.format === "wall_text"
      ? wallTextEdit.content
      : null;

  if (wallTextCandidate) {
    return (
      <section
        aria-label="Wall-text Reel preview"
        className="relative w-full"
      >
        <WallTextDetailView
          actionState={wallTextActionState}
          audioPreviewEnabled={!wallTextEdit}
          content={wallTextEditContent?.content}
          item={wallTextCandidate.item}
          layout={wallTextEditContent?.layout}
          textColor={wallTextEditContent?.textColor}
          previewUrl={wallTextEdit?.source?.resolvedAssetUrl}
          thumbnailUrl={wallTextEdit?.source?.resolvedThumbnailUrl}
          onBack={() => {
            if (!pendingWallTextScheduleCandidate) {
              setWallTextActionState({ status: "idle" });
              setWallTextCandidate(null);
              onCarouselCompleted();
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
                wallTextEditContent?.content.fullText ??
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
      {activeCandidate && headerActionsRoot
        ? createPortal(
            <CreativeEditAction
              disabled={Boolean(exitDirection || pendingDecisionItemId)}
              onEdit={handleEditActiveCandidate}
            />,
            headerActionsRoot,
          )
        : null}
      {activeCandidate ? (
        <>
          <div
            role="group"
            aria-roledescription="Trending content deck"
            aria-busy={Boolean(pendingDecisionItemId)}
            tabIndex={0}
            aria-label={`Trending content deck. Showing idea ${activeItemIndex + 1} of ${visibleCandidates.length}. Press left arrow to reject or right arrow to accept this creative.`}
            onKeyDown={handleDeckKeyDown}
            className="relative isolate mx-auto mt-3 h-[482px] w-full max-w-xl overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:mt-7"
          >
            <TrendingFormatPill
              candidate={activeCandidate}
              format={activeCandidate.format}
            />
            {[...deckSlots].reverse().map((slot) => (
              <TrendingDeckCard
                key={slot.candidate.item.id}
                activeSlideByCarouselId={activeSlideByCarouselId}
                candidate={slot.candidate}
                depth={slot.depth}
                edit={editByCreativeId[slot.candidate.item.creativeId] ?? null}
                dragX={slot.depth === 0 ? dragX : 0}
                exitDirection={slot.depth === 0 ? exitDirection : null}
                isDragging={slot.depth === 0 && isDragging}
                itemCount={visibleCandidates.length}
                itemIndex={slot.itemIndex}
                onActiveSlideChange={onActiveSlideChange}
                onHookPreviewStatusChange={handleHookPreviewStatusChange}
                onPointerCancel={cancelPointerInteraction}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishPointerInteraction}
                onExitTransitionEnd={handleExitTransitionEnd}
              />
            ))}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-4 z-20 rounded-full border border-success/70 bg-success/90 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-success-foreground"
              style={{
                opacity: Math.min(Math.max(dragX / SWIPE_THRESHOLD_PX, 0), 1),
              }}
            >
              Accept
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-4 top-4 z-20 rounded-full border border-error/70 bg-error/90 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-error-foreground"
              style={{
                opacity: Math.min(Math.max(-dragX / SWIPE_THRESHOLD_PX, 0), 1),
              }}
            >
              Reject
            </div>
            {pendingDecisionItemId ? (
              <div
                role="status"
                aria-live="polite"
                className="pointer-events-none absolute bottom-3 left-1/2 z-30 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-black/78 px-3 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-sm"
              >
                <Loader2
                  className="size-3.5 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
                Saving choice…
              </div>
            ) : null}
          </div>
          <CreativeDecisionActions
            acceptDisabled={activeHookPreviewStatus !== null && activeHookPreviewStatus !== "ready"}
            disabled={Boolean(exitDirection || pendingDecisionItemId)}
            onAccept={() => requestCreativeDecision("accepted")}
            onReject={() => requestCreativeDecision("rejected")}
          />
          <span className="sr-only" aria-live="polite">
            Showing {title}, idea {activeItemIndex + 1} of {visibleCandidates.length}
          </span>
        </>
      ) : (
        <TrendingReadyEmptyState />
      )}
      {actionCandidate ? (
        <CarouselActionDialog
          actionState={actionState}
          candidate={actionCandidate}
          onClose={() => {
            setActionState({ status: "idle" });
            setActionCandidate(null);
            onCarouselCompleted();
          }}
          onSaveToLibrary={handleSaveToLibrary}
          onSchedulePost={handleSchedulePost}
        />
      ) : null}
      {editorCandidate ? (
        <TrendingCreativeEditor
          item={editorCandidate.item}
          onClose={() => setEditorCandidate(null)}
          onSaved={(savedEdit) => {
            setEditByCreativeId((current) => ({
              ...current,
              [savedEdit.creativeId]: savedEdit,
            }));
            showActionNotice({
              message:
                savedEdit.format === "carousel" &&
                (savedEdit.renderState === "queued" ||
                  savedEdit.renderState === "rendering")
                  ? "Edit saved. Final Carousel slides are rendering."
                  : "Edit saved.",
            });
          }}
        />
      ) : null}
      {scheduleContext ? (
        <PlatformSelectionModal
          context={scheduleContext}
          open
          onConfirmed={async (submission) => {
            if (!scheduleContext || !pendingScheduleCandidate) {
              throw new Error(
                "Choose an Instagram carousel before scheduling.",
              );
            }

            await scheduleTrendingCarousel({
              candidate: pendingScheduleCandidate,
              context: scheduleContext,
              submission,
            });

            let completionWarning = false;

            try {
              await completeAcceptedCarouselWorkflow(
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
            onCarouselCompleted();
          }}
          onOpenChange={(open) => {
            if (!open) {
              setScheduleContext(null);
              setPendingScheduleCandidate(null);
            }
          }}
        />
      ) : null}
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
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-overlay px-4 py-5"
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
        className="flex h-[min(700px,calc(100vh-2.5rem))] w-full max-w-[960px] flex-col overflow-hidden rounded-[20px] border border-border bg-card text-foreground shadow-floating"
      >
        <div className="border-b border-border bg-card">
          <div className="flex items-start justify-between gap-4 px-5 py-5 sm:px-6">
            <div className="min-w-0">
              <h2
                id="carousel-action-dialog-title"
                className="text-xl font-semibold text-foreground-strong"
              >
                What would you like to do?
              </h2>
              <p className="mt-1 text-sm font-medium text-muted">Step 1 of 4</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="hidden rounded-full bg-card-muted px-2.5 py-1 text-xs font-semibold lowercase text-muted-subtle sm:inline-flex">
                esc
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="inline-flex size-9 items-center justify-center rounded-full text-muted-subtle transition hover:bg-card-muted hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="h-1 bg-card-muted">
            <div className="h-full w-1/4 bg-primary" />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="space-y-3">
            <CarouselActionOption
              ref={firstActionRef}
              description="Keep this carousel in Creative Assets"
              disabled={isBusy}
              icon={
                isSaving ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="size-5" aria-hidden="true" />
                )
              }
              label={isSaving ? "Saving..." : "Save to Creative Assets"}
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
              className="mt-4 rounded-md border border-error/35 bg-error/10 px-4 py-3 text-sm font-semibold text-error"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{actionState.message}</span>
                <button
                  type="button"
                  onClick={onSaveToLibrary}
                  className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-error px-3 text-xs font-semibold text-error-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/30"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : null}
          <p className="sr-only">Selected carousel: {title}</p>
        </div>

        <div className="border-t border-border bg-card px-5 py-5 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-muted transition hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-card"
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
        "group grid min-h-24 w-full grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-4 rounded-[12px] border bg-card-muted px-5 py-4 text-left transition-[background-color,border-color] hover:border-primary/50 hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-65",
        selected ? "border-primary/50 ring-2 ring-primary/15" : "border-border",
      )}
    >
      <span
        className={cn(
          "flex size-12 items-center justify-center rounded-full",
          selected ? "bg-selected text-primary" : "bg-card text-success",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-base font-semibold text-foreground-strong">
          {label}
        </span>
        <span className="mt-1 block text-sm font-medium leading-5 text-muted">
          {description}
        </span>
      </span>
      <Check
        className={cn(
          "size-4 text-muted-subtle opacity-0 transition group-hover:opacity-100",
          selected && "opacity-100 text-primary",
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
      className="fixed bottom-5 left-1/2 z-[var(--z-modal)] flex -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground-strong shadow-floating"
    >
      <span>{notice.message}</span>
      {notice.onAction && notice.actionLabel ? (
        <button
          type="button"
          onClick={() => void notice.onAction?.()}
          className="rounded-full bg-selected px-3 py-1 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {notice.actionLabel}
        </button>
      ) : notice.actionHref && notice.actionLabel ? (
        <Link
          href={notice.actionHref}
          className="rounded-full bg-selected px-3 py-1 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {notice.actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

function TrendingFormatPill({
  candidate,
  format,
}: {
  candidate?: TrendingCandidate | null;
  format?: TrendingCandidate["format"];
}) {
  const activeFormat = candidate?.format ?? format ?? "carousel";
  const isHook = activeFormat === "hook_video";
  const isWallText = activeFormat === "wall_text";

  const slideCount =
    candidate && candidate.format === "carousel"
      ? candidate.carousel.slideCount || candidate.slides.length || 5
      : 5;

  const label = isHook
    ? "Reel Hook"
    : isWallText
      ? "Wall-of-Text"
      : `Slideshow · ${slideCount} Slides`;

  const Icon = isHook ? Clapperboard : isWallText ? ScanText : Images;
  const colorBadge = isHook
    ? "border-blue-500/25 bg-card/95 text-blue-500 ring-1 ring-blue-500/10"
    : isWallText
      ? "border-purple-500/25 bg-card/95 text-purple-500 ring-1 ring-purple-500/10"
      : "border-primary/25 bg-card/95 text-primary ring-1 ring-primary/10";

  return (
    <div className="pointer-events-none absolute inset-x-0 top-1 z-40 flex h-[24px] items-center justify-center">
      <span
        data-trending-format-pill
        className={cn(
          "inline-flex h-[24px] items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-bold tracking-tight text-foreground-strong shadow-xs backdrop-blur-md",
          colorBadge,
        )}
      >
        <Icon className="size-3 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </span>
    </div>
  );
}

type TrendingDeckCardProps = {
  activeSlideByCarouselId: Record<string, number>;
  candidate: TrendingCandidate;
  depth: DeckDepth;
  dragX: number;
  edit: TrendingCreativeEditRecord | null;
  exitDirection: "left" | "right" | null;
  isDragging: boolean;
  itemCount: number;
  itemIndex: number;
  onActiveSlideChange: (carouselId: string, nextIndex: number) => void;
  onHookPreviewStatusChange: (
    creativeId: string,
    status: HookPreviewStatus,
  ) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onExitTransitionEnd: (event: ReactTransitionEvent<HTMLElement>) => void;
};

function TrendingDeckCard({
  candidate,
  edit,
  itemCount,
  itemIndex,
  onHookPreviewStatusChange,
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
          edit={edit}
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
          edit={edit}
          onPreviewStatusChange={onHookPreviewStatusChange}
          onPointerCancel={props.onPointerCancel}
          onPointerDown={props.onPointerDown}
          onPointerMove={props.onPointerMove}
          onPointerUp={props.onPointerUp}
          onExitTransitionEnd={props.onExitTransitionEnd}
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
          edit={edit}
          onPointerCancel={props.onPointerCancel}
          onPointerDown={props.onPointerDown}
          onPointerMove={props.onPointerMove}
          onPointerUp={props.onPointerUp}
          onExitTransitionEnd={props.onExitTransitionEnd}
        />
      );
  }
}

function TrendingHookDeckCard({
  candidate,
  depth,
  dragX,
  edit,
  exitDirection,
  isDragging,
  itemCount,
  itemIndex,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onExitTransitionEnd,
  onPreviewStatusChange,
}: {
  candidate: CompleteHookVideo;
  depth: DeckDepth;
  dragX: number;
  edit: TrendingCreativeEditRecord | null;
  exitDirection: "left" | "right" | null;
  isDragging: boolean;
  itemCount: number;
  itemIndex: number;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onExitTransitionEnd: (event: ReactTransitionEvent<HTMLElement>) => void;
  onPreviewStatusChange: (
    creativeId: string,
    status: HookPreviewStatus,
  ) => void;
}) {
  const isActive = depth === 0;
  const [previewRetryKey, setPreviewRetryKey] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HookPreviewAudio | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const creativeId = candidate.item.creativeId;
  const creative = candidate.item.creative;
  const editedContent =
    edit?.content.format === "hook_video" ? edit.content : null;
  const editedSource = edit?.source ?? null;
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
      setPreviewAudio(null);
      setPreviewLoading(true);
      setPreviewError(null);
      onPreviewStatusChange(creativeId, "loading");

      if (editedSource) {
        setPreviewUrl(editedSource.resolvedAssetUrl);
        return;
      }

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
          | {
              hookAudio?: HookPreviewAudio | null;
              ok: true;
              previewUrl: string;
            }
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
          setPreviewAudio(data.hookAudio ?? null);
          setPreviewUrl(`${data.previewUrl}?session=${Date.now()}`);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setPreviewUrl(null);
          setPreviewAudio(null);
          setPreviewLoading(false);
          setPreviewError(
            getErrorMessage(error, "Could not load this Hook preview."),
          );
          onPreviewStatusChange(creativeId, "error");
        }
      }
    }

    void loadPreview();

    return () => controller.abort();
  }, [
    creative,
    creativeId,
    editedSource,
    isActive,
    onPreviewStatusChange,
    previewRetryKey,
  ]);

  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-start justify-center pt-9"
      style={{ zIndex: deckStyle.zIndex }}
    >
      <article
        aria-label={`${creative.text.value}, Hook idea ${itemIndex + 1} of ${itemCount}`}
        aria-hidden={isActive ? undefined : "true"}
        className={cn(
          "w-[min(76vw,248px)] origin-center select-none overflow-visible transition-[opacity,transform] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none",
          isActive
            ? "pointer-events-auto cursor-grab active:cursor-grabbing"
            : "pointer-events-none",
        )}
        onPointerCancel={isActive ? onPointerCancel : undefined}
        onPointerDown={isActive ? onPointerDown : undefined}
        onPointerMove={isActive ? onPointerMove : undefined}
        onPointerUp={isActive ? onPointerUp : undefined}
        onTransitionEnd={isActive ? onExitTransitionEnd : undefined}
        style={cardStyle}
      >
        {edit ? (
          <div
            data-trending-edited-badge
            className="pointer-events-none absolute right-2.5 top-2.5 z-30 inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-card/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-500 shadow-sm backdrop-blur-md"
          >
            <Check className="size-2.5 stroke-[3]" aria-hidden="true" />
            <span>Edited</span>
          </div>
        ) : null}
        <HookVideoCard
          dragOffset={0}
          hookAudio={isActive ? previewAudio : null}
          hookFontSize={editedContent?.fontSize ?? creative.text.fontSize}
          hookLines={editedContent?.lines ?? creative.text.lines}
          hookPosition={editedContent?.position ?? creative.text.position}
          hookTextColor={editedContent?.textColor}
          hookText={editedContent?.hookText ?? creative.text.value}
          previewError={isActive ? previewError : null}
          previewLoading={isActive && previewLoading}
          previewUrl={isActive ? previewUrl : null}
          trimEnd={creative.trimEnd}
          trimStart={creative.trimStart}
          video={{
            durationSeconds:
              editedSource?.resolvedAssetDurationSeconds ??
              creative.sourceDurationSeconds,
            id: editedSource?.resolvedAssetId ?? creative.videoId,
            hookTextPlacement: null,
            influencerKey: null,
            influencerId: editedSource
              ? buildUserInfluencerId(editedSource.resolvedAssetId)
              : creative.influencerId,
            ratio: creative.aspectRatio,
            reactionType: null,
            sourceKind: editedSource ? "user" : creative.sourceKind,
            thumbnailUrl:
              editedSource?.resolvedThumbnailUrl ?? creative.thumbnailUrl,
            title: editedSource?.resolvedAssetTitle ?? creative.title,
            trimEnd: editedSource ? null : creative.trimEnd,
            trimStart: editedSource ? 0 : creative.trimStart,
            visualGroup: null,
          }}
          onPreviewError={() => {
            setPreviewUrl(null);
            setPreviewAudio(null);
            setPreviewLoading(false);
            setPreviewError("Could not load this Hook preview.");
            onPreviewStatusChange(creativeId, "error");
          }}
          onPreviewReady={() => {
            setPreviewLoading(false);
            setPreviewError(null);
            onPreviewStatusChange(creativeId, "ready");
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
  edit,
  exitDirection,
  isDragging,
  itemCount,
  itemIndex,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onExitTransitionEnd,
}: {
  candidate: CompleteWallText;
  depth: DeckDepth;
  dragX: number;
  edit: TrendingCreativeEditRecord | null;
  exitDirection: "left" | "right" | null;
  isDragging: boolean;
  itemCount: number;
  itemIndex: number;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onExitTransitionEnd: (event: ReactTransitionEvent<HTMLElement>) => void;
}) {
  const isActive = depth === 0;
  const videoRef = useRef<HTMLVideoElement>(null);
  const creative = candidate.item.creative;
  const editedContent =
    edit?.content.format === "wall_text" ? edit.content : null;
  const previewUrl = edit?.source?.resolvedAssetUrl ?? creative.previewUrl;
  const thumbnailUrl =
    edit?.source?.resolvedThumbnailUrl ?? creative.thumbnailUrl;
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
  }, [isActive, previewUrl]);

  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-start justify-center pt-9"
      style={{ zIndex: deckStyle.zIndex }}
    >
      <article
        aria-label={`${creative.title}, Wall-of-text idea ${itemIndex + 1} of ${itemCount}`}
        aria-hidden={isActive ? undefined : "true"}
        className={cn(
          "w-[min(76vw,248px)] origin-center select-none overflow-visible transition-[opacity,transform] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none",
          isActive
            ? "pointer-events-auto cursor-grab active:cursor-grabbing"
            : "pointer-events-none",
        )}
        onPointerCancel={isActive ? onPointerCancel : undefined}
        onPointerDown={isActive ? onPointerDown : undefined}
        onPointerMove={isActive ? onPointerMove : undefined}
        onPointerUp={isActive ? onPointerUp : undefined}
        onTransitionEnd={isActive ? onExitTransitionEnd : undefined}
        style={cardStyle}
      >
        {edit ? (
          <div
            data-trending-edited-badge
            className="pointer-events-none absolute right-2.5 top-2.5 z-30 inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-card/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-500 shadow-sm backdrop-blur-md"
          >
            <Check className="size-2.5 stroke-[3]" aria-hidden="true" />
            <span>Edited</span>
          </div>
        ) : null}
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
            src={previewUrl}
            poster={thumbnailUrl ?? undefined}
            autoPlay={isActive}
            muted
            playsInline
            preload={isActive ? "auto" : "metadata"}
            aria-hidden="true"
            className="pointer-events-none size-full object-cover"
          />
          <WallTextOverlay
            content={editedContent?.content ?? creative.text}
            layout={editedContent?.layout ?? creative.layout}
            textColor={editedContent?.textColor}
          />
          {!edit ? (
            <WallTextAudioPreview
              active={isActive}
              audio={creative.audio}
              videoRef={videoRef}
            />
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
  edit,
  exitDirection,
  isDragging,
  onActiveSlideChange,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onExitTransitionEnd,
}: {
  activeSlideByCarouselId: Record<string, number>;
  candidate: CompleteCarousel;
  carouselCount: number;
  carouselIndex: number;
  depth: DeckDepth;
  dragX: number;
  edit: TrendingCreativeEditRecord | null;
  exitDirection: "left" | "right" | null;
  isDragging: boolean;
  onActiveSlideChange: (carouselId: string, nextIndex: number) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onExitTransitionEnd: (event: ReactTransitionEvent<HTMLElement>) => void;
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
  const editedRenderedUrl =
    edit?.format === "carousel" && edit.renderState === "ready"
      ? edit.renderOutput?.slides.find(
          (slide) => slide.slideNumber === activeSlide?.slideNumber,
        )?.renderedUrl ?? null
      : null;
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
      className="pointer-events-none absolute inset-0 flex items-start justify-center pt-9"
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
        onTransitionEnd={isActive ? onExitTransitionEnd : undefined}
        style={cardStyle}
      >
        {edit ? (
          <div
            data-trending-edited-badge
            className="pointer-events-none absolute right-2.5 top-2.5 z-30 inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-card/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-500 shadow-sm backdrop-blur-md"
          >
            <Check className="size-2.5 stroke-[3]" aria-hidden="true" />
            <span>Edited</span>
          </div>
        ) : null}
        <div
          className={cn(
            "relative aspect-[4/5] overflow-hidden rounded-lg bg-card",
            isActive
              ? "shadow-[0_10px_18px_rgb(9_9_11_/_0.2)]"
              : "shadow-[0_6px_12px_rgb(9_9_11_/_0.14)]",
          )}
        >
          {/* Rendered Carousel slides are immutable Cloud Storage creative assets. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={editedRenderedUrl ?? activeSlide.renderedUrl}
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
                      ? "w-4 bg-primary"
                      : "w-1.5 bg-white/55 hover:bg-white",
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
        <TrendingPostSkeleton />
      ) : (
        <span
          className={cn(
            "flex size-11 items-center justify-center rounded-[8px]",
            icon === "failed"
              ? "bg-error/10 text-error"
              : "bg-selected text-primary",
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
      )}
      <div>
        <h2
          className={cn(
            "text-xl font-semibold text-foreground-strong",
            icon === "preparing" ? "mt-1" : "mt-5",
          )}
        >
          {title}
        </h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted">{message}</p>
      </div>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-[8px] bg-primary px-4 text-sm font-semibold text-primary-foreground transition-[background-color,transform] hover:bg-primary-hover active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ActionIcon className="size-4" aria-hidden="true" />
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function TrendingPostSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading trending content ideas"
      className="relative isolate mx-auto mt-3 h-[482px] w-full max-w-xl overflow-hidden sm:mt-7"
    >
      <div className="absolute inset-0 flex items-start justify-center pt-9">
        <Skeleton
          aria-hidden="true"
          className="aspect-[9/16] w-[min(76vw,248px)] rounded-lg border border-white/[0.04] bg-[#171717] opacity-80 shadow-[0_10px_18px_rgb(9_9_11_/_0.22)] motion-reduce:animate-none"
        />
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

async function completeAcceptedCarouselWorkflow(
  candidate: CompleteCarousel,
  action: "saved" | "scheduled",
) {
  const token = await getCurrentUserIdToken();

  if (!token) {
    throw new Error("Sign in before completing this Carousel workflow.");
  }

  const response = await fetch("/api/trending/feed/actions", {
    body: JSON.stringify({
      action,
      assignmentId: candidate.item.assignmentId,
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const data = (await response.json().catch(() => null)) as
    | { message?: string; ok: false }
    | { ok: true }
    | null;

  if (!response.ok || data?.ok !== true) {
    throw new Error(
      data?.ok === false && data.message
        ? data.message
        : "Could not complete this Carousel workflow.",
    );
  }
}

async function persistTrendingCreativeDecision(
  item: TrendingFeedItem,
  decision: "accepted" | "rejected",
) {
  const token = await getCurrentUserIdToken();

  if (!token) {
    throw new Error("Sign in before choosing a Trending creative.");
  }

  const response = await fetch("/api/trending/feed/decisions", {
    body: JSON.stringify({
      assignmentId: item.assignmentId,
      creativeId: item.creativeId,
      decision,
      format: item.format,
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const data = (await response.json().catch(() => null)) as
    | { error?: string; ok: false }
    | { decision: { decidedAt: string }; ok: true }
    | null;

  if (!response.ok || data?.ok !== true) {
    throw new Error(
      data?.ok === false && data.error
        ? data.error
        : "Could not save this creative decision.",
    );
  }
}

async function loadTrendingCreativeEdit(
  edit: TrendingCreativeEditRecord,
) {
  return loadTrendingCreativeEditScope({
    assignmentId: edit.assignmentId,
    creativeId: edit.creativeId,
    format: edit.format,
  });
}

async function loadTrendingCreativeEditForItem(item: TrendingFeedItem) {
  return loadTrendingCreativeEditScope({
    assignmentId: item.assignmentId,
    creativeId: item.creativeId,
    format: item.format,
  });
}

async function loadTrendingCreativeEditScope(scope: {
  assignmentId: string;
  creativeId: string;
  format: TrendingCreativeEditRecord["format"];
}) {
  const token = await getCurrentUserIdToken();

  if (!token) {
    throw new Error("Sign in before checking this Trending edit.");
  }

  const endpoint = [
    "/api/trending/creatives",
    encodeURIComponent(scope.format),
    encodeURIComponent(scope.creativeId),
    "edit",
  ].join("/");
  const response = await fetch(
    `${endpoint}?assignmentId=${encodeURIComponent(scope.assignmentId)}`,
    {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  const data = (await response.json().catch(() => null)) as
    | { edit: TrendingCreativeEditRecord; ok: true }
    | { error?: string; ok?: false }
    | null;

  if (!response.ok || data?.ok !== true) {
    throw new Error(
      data?.ok === false && data.error
        ? data.error
        : "Could not refresh this Trending edit.",
    );
  }

  return data.edit;
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
    | {
        ok: true;
        schedule: {
          status: string;
          targets: Array<{
            lastErrorMessage?: string | null;
            status: string;
          }>;
        };
      }
    | null;

  if (!response.ok || !data || data.ok !== true) {
    throw new Error(
      data?.ok === false && data.message
        ? data.message
        : "Could not schedule this Wall-of-text Reel.",
    );
  }

  const failedTarget = data.schedule.targets.find((target) =>
    ["action_required", "failed", "skipped"].includes(target.status),
  );

  if (
    data.schedule.status === "failed" ||
    data.schedule.status === "partially_failed" ||
    failedTarget
  ) {
    throw new Error(
      failedTarget?.lastErrorMessage ||
        "The schedule was saved, but one or more Instagram targets could not be scheduled. Open Scheduling to review it.",
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
