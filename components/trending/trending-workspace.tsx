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
  SlidersHorizontal,
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
  type BillingSubscription,
  useBillingSubscription,
} from "@/components/billing/use-billing-subscription";
import {
  CreativeDecisionActions,
  CreativeEditAction,
} from "@/components/trending/creative-card-actions";
import { PlatformSelectionModalLoading } from "@/components/social/platform-selection-modal-loading";
import type { SchedulePlatformContext } from "@/components/social/platform-selection-modal";
import { HookVideoCard } from "@/components/trending/hook-video-card";
import type { HookPreviewAudio } from "@/components/trending/hook-audio-preview";
import type {
  HookVideoScheduleSelection,
} from "@/components/trending/hook-video-schedule-drawer";
import type { WallTextDetailActionState } from "@/components/trending/wall-text-detail-view";
import { WallTextOverlay } from "@/components/trending/wall-text-overlay";
import { WallTextAudioPreview } from "@/components/trending/wall-text-audio-preview";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import {
  createAndPublishCarouselSchedule,
  type CarouselScheduleSubmission,
} from "@/lib/scheduling/carousel-scheduling-client";
import { createWallTextScheduleRequest } from "@/lib/trending/wall-text-scheduling-contract";
import {
  getTrendingDecisionOutboxKey,
  parseTrendingDecisionOutbox,
  removeTrendingDecisionOutboxEntry,
  type TrendingDecisionOutboxEntry,
  upsertTrendingDecisionOutboxEntry,
} from "@/lib/trending/decision-outbox";
import {
  compareTrendingFeedItems,
  createCarouselTrendingFeedProvider,
  excludeDecidedTrendingFeedItems,
  excludeDismissedTrendingFeedItems,
  getTrendingFeedActiveItemIndex,
  type TrendingCarouselCreative,
  type TrendingCarouselFeedItem,
  type TrendingCarouselSlide,
  type TrendingCarouselSourceRecord,
  type TrendingFeedItem,
  type TrendingHookVideoFeedItem,
  type TrendingWallTextFeedItem,
} from "@/lib/trending/feed-items";
import {
  beginHookVideoComposition,
  type HookVideoFlowState,
} from "@/lib/trending/hook-video-flow";
import { buildUserInfluencerId } from "@/lib/trending/hook-video-source-logic";
import { getHookPreviewRenewalDelay } from "@/lib/trending/hook-preview-renewal";
import type {
  HookInfluencerSummary,
  HookInfluencerVideoSummary,
} from "@/lib/trending/hook-video-types";
import type { TrendingCreativeEditRecord } from "@/lib/trending/creative-edit-contract";
import { cn } from "@/lib/utils";

import skeletonStyles from "./trending-post-skeleton.module.css";

const TrendingCreativeEditor = dynamic(
  () =>
    import("@/components/trending/trending-creative-editor").then(
      (module) => module.TrendingCreativeEditor,
    ),
  { loading: TrendingCreativeEditorLoading },
);

const TrendingContentMixDialog = dynamic(
  () =>
    import("@/components/trending/trending-content-mix-dialog").then(
      (module) => module.TrendingContentMixDialog,
    ),
  { loading: TrendingContentMixDialogLoading },
);

const TrendingFirstVisitWalkthrough = dynamic(
  () =>
    import("@/components/trending/trending-first-visit-walkthrough").then(
      (module) => module.TrendingFirstVisitWalkthrough,
    ),
  { ssr: false },
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
  | "failed"
  | "preparing"
  | "ready";

type TrendingFeedProgress = {
  completedCount: number;
  pendingSlotCount: number;
  remainingCount: number;
};

type TrendingFeedFailure = {
  code: "hook_generation_restart_required" | "hook_source_unavailable";
  message: string;
};

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

type TrendingDeckPresentation = "centered" | "video_peek";

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
        completedCount: number;
        failure?: TrendingFeedFailure | null;
        id: string;
        localDate: string;
        pendingSlotCount: number;
        remainingCount: number;
        state: TrendingDailyFeedState;
        timezone: string;
      } | null;
      items?: TrendingFeedItem[];
      profile: CarouselProfileFeed;
      upgradeRequired?: boolean;
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

type SavedWallTextDraftResponse =
  | {
      draft: {
        assignmentId: string;
      };
      jobId?: string;
      ok: true;
    }
  | {
      error?: string;
      ok?: false;
    };

type WallTextPendingScheduleResponse =
  | {
      ok: true;
      schedule: {
        id: string;
      };
    }
  | {
      message?: string;
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
  tone?: "success";
};

function getSmartPreparingPollInterval(attemptCount: number): number {
  if (attemptCount <= 2) return 2_000;
  if (attemptCount <= 4) return 3_500;
  if (attemptCount <= 7) return 6_000;
  if (attemptCount <= 10) return 10_000;
  // Once the normal worker latency window has elapsed, continue checking at
  // the same cadence as the server recovery scanner. This avoids a permanent
  // spinner while avoiding a tight request loop during a provider outage.
  return 60_000;
}

const TRENDING_FEED_REQUEST_TIMEOUT_MS = 20_000;

class TrendingFeedRequestError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "TrendingFeedRequestError";
  }
}

type TrendingTrialPill = {
  href: string;
  label: string;
  title: string;
};

function getTrendingTrialPill(
  subscription: BillingSubscription | undefined,
): TrendingTrialPill | null {
  if (
    !subscription ||
    subscription.isActive ||
    subscription.planKey !== "free"
  ) {
    return null;
  }

  if (subscription.trial.status === "active") {
    if (subscription.trial.contentDaysRemaining > 0) {
      const daysRemaining = subscription.trial.daysRemaining;
      return {
        href: "/settings#subscription-billing",
        label: `Free \u00b7 ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left`,
        title: "View your free-trial details",
      };
    }

    return {
      href: "/pricing",
      label: "Free \u00b7 Content used",
      title: "Your free-trial content is used. Upgrade to keep creating.",
    };
  }

  if (subscription.trial.status === "expired") {
    return {
      href: "/pricing",
      label: "Trial ended \u00b7 Upgrade",
      title: "Your free trial has ended. Upgrade to keep creating.",
    };
  }

  return null;
}

function isRetryableTrendingFeedStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

const DECISION_OUTBOX_RETRY_MIN_MS = 2_000;
const DECISION_OUTBOX_RETRY_MAX_MS = 30_000;
const decisionOutboxMemoryFallback = new Map<
  string,
  TrendingDecisionOutboxEntry[]
>();
const SWIPE_THRESHOLD_PX = 90;
const SWIPE_EXIT_DURATION_MS = 220;
const MAX_ROTATION_DEGREES = 5;
const CAROUSEL_REVIEW_CARD_WIDTH_CLASS =
  "w-[min(78vw,270px,calc((100dvh-348px)*0.8))]";
const VERTICAL_REVIEW_CARD_WIDTH_CLASS =
  "w-[min(76vw,230px,calc((100dvh-348px)*0.5625))]";
const CAROUSEL_REVIEW_CARD_FRAME_CLASS =
  `${CAROUSEL_REVIEW_CARD_WIDTH_CLASS} aspect-[4/5]`;
const VERTICAL_REVIEW_CARD_FRAME_CLASS =
  `${VERTICAL_REVIEW_CARD_WIDTH_CLASS} aspect-[9/16]`;
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
    opacity: 0.82,
    scale: 0.965,
    translateY: -24,
    zIndex: 2,
  },
  2: {
    opacity: 0.58,
    scale: 0.93,
    translateY: -44,
    zIndex: 1,
  },
};
const VIDEO_PEEK_CARD_STYLES: Record<
  DeckDepth,
  { opacity: number; scale: number; translateX: number; translateY: number; zIndex: number }
> = {
  0: {
    opacity: 1,
    scale: 1,
    translateX: 0,
    translateY: 0,
    zIndex: 3,
  },
  1: {
    opacity: 0.7,
    scale: 0.965,
    translateX: 12,
    translateY: 4,
    zIndex: 1,
  },
  2: {
    opacity: 0,
    scale: 0.93,
    translateX: 24,
    translateY: 8,
    zIndex: 0,
  },
};

function getTrendingDeckCardState(depth: DeckDepth) {
  return depth === 0 ? "active" : depth === 1 ? "next" : "preload";
}

function getTrendingDeckCardPresentation({
  depth,
  dragX,
  exitDirection,
  isDragging,
  presentation = "centered",
}: {
  depth: DeckDepth;
  dragX: number;
  exitDirection: "left" | "right" | null;
  isDragging: boolean;
  presentation?: TrendingDeckPresentation;
}): CSSProperties {
  const isActive = depth === 0;
  const deckStyles =
    presentation === "video_peek" ? VIDEO_PEEK_CARD_STYLES : DECK_CARD_STYLES;
  const deckStyle = deckStyles[depth];
  const promotedStyle =
    depth === 0
      ? deckStyle
      : deckStyles[(depth - 1) as DeckDepth];
  const revealProgress = isActive
    ? 0
    : Math.min(Math.abs(dragX) / SWIPE_THRESHOLD_PX, 1);
  const opacity = interpolateDeckValue(
    deckStyle.opacity,
    promotedStyle.opacity,
    revealProgress,
  );
  const scale = interpolateDeckValue(
    deckStyle.scale,
    promotedStyle.scale,
    revealProgress,
  );
  const translateY = interpolateDeckValue(
    deckStyle.translateY,
    promotedStyle.translateY,
    revealProgress,
  );
  const clampedRotation = Math.max(
    -MAX_ROTATION_DEGREES,
    Math.min(MAX_ROTATION_DEGREES, dragX / 28),
  );
  const inactiveTranslateX =
    presentation === "video_peek" ? VIDEO_PEEK_CARD_STYLES[depth].translateX : 0;
  const promotedTranslateX =
    presentation === "video_peek" && !isActive
      ? VIDEO_PEEK_CARD_STYLES[(depth - 1) as DeckDepth].translateX
      : 0;
  const translateX = isActive
    ? exitDirection
      ? exitDirection === "left"
        ? "-115vw"
        : "115vw"
      : `${dragX}px`
    : `${interpolateDeckValue(
        inactiveTranslateX,
        promotedTranslateX,
        revealProgress,
      )}px`;

  return {
    opacity,
    touchAction: isActive ? "pan-y" : undefined,
    transform: `translateX(${translateX}) translateY(${translateY}px) rotate(${isActive ? clampedRotation : 0}deg) scale(${scale})`,
    transition: isDragging ? "none" : undefined,
  };
}

function interpolateDeckValue(
  start: number,
  end: number,
  progress: number,
) {
  return start + (end - start) * progress;
}

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

function TrendingContentMixDialogLoading() {
  return (
    <div
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
      role="status"
    >
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-4 text-sm font-semibold text-foreground">
        <Loader2
          className="size-4 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        Opening Adjust…
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

function useTrendingDecisionOutbox(userId: string | null) {
  const flushingRef = useRef(false);
  const flushRef = useRef<() => Promise<void>>(async () => undefined);
  const retryDelayRef = useRef(DECISION_OUTBOX_RETRY_MIN_MS);
  const retryTimerRef = useRef<number | null>(null);

  const flush = useCallback(async () => {
    if (!userId || flushingRef.current) {
      return;
    }

    const entries = readPendingDecisionEntries(userId);

    if (entries.length === 0) {
      retryDelayRef.current = DECISION_OUTBOX_RETRY_MIN_MS;
      return;
    }

    flushingRef.current = true;
    let failed = false;

    for (const entry of entries) {
      try {
        await persistTrendingDecisionOutboxEntry(entry);
        writePendingDecisionEntries(
          userId,
          removeTrendingDecisionOutboxEntry(
            readPendingDecisionEntries(userId),
            entry.assignmentId,
          ),
        );
        retryDelayRef.current = DECISION_OUTBOX_RETRY_MIN_MS;
      } catch (error) {
        failed = true;
        console.warn(
          "A Trending decision is queued for automatic retry:",
          error,
        );
      }
    }

    flushingRef.current = false;

    if (readPendingDecisionEntries(userId).length === 0) {
      window.queueMicrotask(() => void flushRef.current());
      return;
    }

    if (failed) {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
      }

      const retryDelay = retryDelayRef.current;
      retryDelayRef.current = Math.min(
        retryDelay * 2,
        DECISION_OUTBOX_RETRY_MAX_MS,
      );
      retryTimerRef.current = window.setTimeout(() => {
        retryTimerRef.current = null;
        void flushRef.current();
      }, retryDelay);
      return;
    }

    window.queueMicrotask(() => void flushRef.current());
  }, [userId]);

  useEffect(() => {
    flushRef.current = flush;
    void flush();

    function handleOnline() {
      retryDelayRef.current = DECISION_OUTBOX_RETRY_MIN_MS;
      void flushRef.current();
    }

    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);

      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [flush]);

  return useCallback(
    (entry: TrendingDecisionOutboxEntry) => {
      if (!userId) {
        return;
      }

      writePendingDecisionEntries(
        userId,
        upsertTrendingDecisionOutboxEntry(
          readPendingDecisionEntries(userId),
          entry,
        ),
      );
      void flushRef.current();
    },
    [userId],
  );
}

type TrendingFeedMemoryCache = {
  cachedAt: number;
  failure: TrendingFeedFailure | null;
  feedProgress: TrendingFeedProgress | null;
  feedState: TrendingDailyFeedState | null;
  items: TrendingFeedItem[];
  localDate: string;
  profile: CarouselProfileFeed | null;
  upgradeRequired: boolean;
  userId: string;
};

let inMemoryTrendingFeed: TrendingFeedMemoryCache | null = null;

export function getInMemoryTrendingFeed(userId: string, localDate: string) {
  if (
    inMemoryTrendingFeed &&
    inMemoryTrendingFeed.userId === userId &&
    inMemoryTrendingFeed.localDate === localDate
  ) {
    return inMemoryTrendingFeed;
  }
  return null;
}

export function TrendingWorkspace() {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const subscriptionQuery = useBillingSubscription();
  const currentBrowserLocalDate = getBrowserLocalDate();
  const existingMemoryCache = user
    ? getInMemoryTrendingFeed(user.uid, currentBrowserLocalDate)
    : null;
  const trendingFeedSessionKey = `${user?.uid ?? "signed-out"}:${currentBrowserLocalDate}`;

  const loadedFeedLocalDate = useRef<string | null>(
    existingMemoryCache ? existingMemoryCache.localDate : null,
  );
  const loadedFeedUserId = useRef<string | null>(
    existingMemoryCache ? existingMemoryCache.userId : null,
  );
  const loadedFeedFailed = useRef(false);
  const preparingPollAttemptsRef = useRef(0);
  const [trendingItems, setTrendingItems] = useState<TrendingFeedItem[]>(() => {
    if (existingMemoryCache && user) {
      const pendingDecisionAssignmentIds = getPendingDecisionAssignmentIds(
        user.uid,
      );
      return existingMemoryCache.items.filter(
        (item) => !pendingDecisionAssignmentIds.has(item.assignmentId),
      );
    }
    return [];
  });
  const [presentedTrendingFeedSessionKey, setPresentedTrendingFeedSessionKey] = useState(
    () => {
      if (!existingMemoryCache || !user) {
        return null;
      }

      const pendingDecisionAssignmentIds = getPendingDecisionAssignmentIds(
        user.uid,
      );
      return existingMemoryCache.items.some(
        (item) => !pendingDecisionAssignmentIds.has(item.assignmentId),
      )
        ? `${user.uid}:${currentBrowserLocalDate}`
        : null;
    },
  );
  const hasPresentedTrendingFeed =
    presentedTrendingFeedSessionKey === trendingFeedSessionKey;
  const [trendingFeedState, setTrendingFeedState] =
    useState<TrendingDailyFeedState | null>(() => {
      return existingMemoryCache ? existingMemoryCache.feedState : null;
    });
  const [trendingFeedProgress, setTrendingFeedProgress] =
    useState<TrendingFeedProgress | null>(() => {
      return existingMemoryCache ? existingMemoryCache.feedProgress : null;
    });
  const [trendingFeedFailure, setTrendingFeedFailure] =
    useState<TrendingFeedFailure | null>(() => {
      return existingMemoryCache?.failure ?? null;
    });
  const [trendingUpgradeRequired, setTrendingUpgradeRequired] = useState(
    () => existingMemoryCache?.upgradeRequired ?? false,
  );
  const [headerActionsRoot, setHeaderActionsRoot] =
    useState<HTMLDivElement | null>(null);
  const [contentMixOpen, setContentMixOpen] = useState(false);
  const [carouselHistoryError, setCarouselHistoryError] = useState<string | null>(
    null,
  );
  const [carouselHistoryState, setCarouselHistoryState] =
    useState<CarouselHistoryState>(() => {
      return existingMemoryCache ? "ready" : "idle";
    });
  const [carouselProfile, setCarouselProfile] = useState<CarouselProfileFeed | null>(() => {
    return existingMemoryCache ? existingMemoryCache.profile : null;
  });
  const [carouselHistoryRefreshKey, setCarouselHistoryRefreshKey] = useState(0);
  const retryFailedFeedRef = useRef(false);
  const persistDecision = useTrendingDecisionOutbox(user?.uid ?? null);
  const enqueueDecision = useCallback(
    (entry: TrendingDecisionOutboxEntry) => {
      const decidedAssignmentIds = new Set([entry.assignmentId]);

      // The Hook composer replaces the deck while a user chooses or uploads a
      // demo. Keep this removal in the parent feed state, so closing that
      // composer cannot recreate the deck with cards the user already swiped.
      setTrendingItems((current) =>
        excludeDecidedTrendingFeedItems(
          current,
          decidedAssignmentIds,
          (item) => item.assignmentId,
        ),
      );
      const activeMemoryFeed = inMemoryTrendingFeed;
      if (activeMemoryFeed && activeMemoryFeed.userId === user?.uid) {
        inMemoryTrendingFeed = {
          ...activeMemoryFeed,
          items: excludeDecidedTrendingFeedItems(
            activeMemoryFeed.items,
            decidedAssignmentIds,
            (item) => item.assignmentId,
          ),
        };
      }
      setTrendingFeedProgress((current) =>
        current
          ? {
              ...current,
              completedCount: current.completedCount + 1,
              remainingCount: Math.max(current.remainingCount - 1, 0),
            }
          : current,
      );
      persistDecision(entry);
    },
    [persistDecision, user?.uid],
  );

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
  const trialPill = getTrendingTrialPill(subscriptionQuery.data);

  useEffect(() => {
    if (!user) {
      return;
    }

    const userId = user.uid;
    const controller = new AbortController();
    let pollTimer: number | null = null;

    function scheduleFeedRefresh(delayMs: number) {
      if (pollTimer !== null) {
        window.clearTimeout(pollTimer);
      }

      pollTimer = window.setTimeout(() => {
        if (
          !controller.signal.aborted &&
          (typeof document === "undefined" || document.visibilityState === "visible")
        ) {
          setCarouselHistoryRefreshKey((current) => current + 1);
        }
      }, delayMs);
    }

    async function loadCarouselHistory() {
      const currentLocalDate = getBrowserLocalDate();
      const validMemoryCache = getInMemoryTrendingFeed(userId, currentLocalDate);
      const isInitialUserLoad =
        !validMemoryCache && loadedFeedUserId.current !== userId;
      const isNewLocalDate =
        loadedFeedLocalDate.current !== null &&
        loadedFeedLocalDate.current !== currentLocalDate;

      if (isInitialUserLoad || isNewLocalDate || loadedFeedFailed.current) {
        setTrendingItems([]);
        setPresentedTrendingFeedSessionKey(null);
        setTrendingFeedFailure(null);
        setTrendingFeedState(null);
        setTrendingFeedProgress(null);
        setTrendingUpgradeRequired(false);
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
        const retryFailed = retryFailedFeedRef.current;
        retryFailedFeedRef.current = false;
        const feedSearchParams = new URLSearchParams({ timezone });
        if (retryFailed) {
          feedSearchParams.set("retryFailed", "1");
        }
        const requestController = new AbortController();
        let requestTimedOut = false;
        const abortRequest = () => requestController.abort();
        const requestTimeout = window.setTimeout(() => {
          requestTimedOut = true;
          requestController.abort();
        }, TRENDING_FEED_REQUEST_TIMEOUT_MS);
        controller.signal.addEventListener("abort", abortRequest, { once: true });

        let response: Response;
        let data: CarouselHistoryResponse | null;

        try {
          response = await fetch(
            `/api/trending/feed?${feedSearchParams.toString()}`,
            {
              cache: "no-store",
              headers: { Authorization: `Bearer ${idToken}` },
              signal: requestController.signal,
            },
          );
          data = (await response.json().catch(() => null)) as
            | CarouselHistoryResponse
            | null;
        } catch (error) {
          if (requestTimedOut) {
            throw new TrendingFeedRequestError(
              "The Trending feed request timed out. Retrying…",
              true,
            );
          }

          throw error;
        } finally {
          window.clearTimeout(requestTimeout);
          controller.signal.removeEventListener("abort", abortRequest);
        }

        if (!response.ok || !data?.ok) {
          throw new TrendingFeedRequestError(
            data && !data.ok
              ? data.message
              : "Generated carousels are unavailable.",
            !data || isRetryableTrendingFeedStatus(response.status),
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

        const receivedItems =
          data.items ??
          createCarouselTrendingFeedProvider(data.carousels).items;
        const pendingDecisionAssignmentIds = getPendingDecisionAssignmentIds(
          userId,
        );
        const pendingLocalDecisionCount = receivedItems.reduce(
          (count, item) =>
            count +
            (pendingDecisionAssignmentIds.has(item.assignmentId) ? 1 : 0),
          0,
        );
        const nextVisibleItems = receivedItems.filter(
          (item) => !pendingDecisionAssignmentIds.has(item.assignmentId),
        );
        setTrendingItems(nextVisibleItems);
        if (nextVisibleItems.length > 0) {
          setPresentedTrendingFeedSessionKey(`${userId}:${currentLocalDate}`);
        }
        setTrendingFeedFailure(data.feed?.failure ?? null);
        setTrendingFeedState(data.feed?.state ?? null);
        setTrendingUpgradeRequired(Boolean(data.upgradeRequired));
        const nextFeedProgress = data.feed
          ? {
              completedCount:
                data.feed.completedCount + pendingLocalDecisionCount,
              pendingSlotCount: data.feed.pendingSlotCount,
              remainingCount: Math.max(
                data.feed.remainingCount - pendingLocalDecisionCount,
                0,
              ),
            }
          : null;
        setTrendingFeedProgress(nextFeedProgress);
        loadedFeedFailed.current =
          data.feed?.state === "failed" && nextVisibleItems.length === 0;
        if (loadedFeedFailed.current) {
          setCarouselHistoryError(
            data.feed?.failure?.message ??
              "The complete daily pack could not be prepared. Try again to restart the failed work.",
          );
        }
        setCarouselProfile(data.profile);
        loadedFeedLocalDate.current = data.feed?.localDate ?? null;
        loadedFeedUserId.current = userId;
        setCarouselHistoryState("ready");

        inMemoryTrendingFeed = {
          cachedAt: Date.now(),
          failure: data.feed?.failure ?? null,
          feedProgress: nextFeedProgress,
          feedState: data.feed?.state ?? null,
          items: receivedItems,
          localDate: data.feed?.localDate ?? getBrowserLocalDate(),
          profile: data.profile,
          upgradeRequired: Boolean(data.upgradeRequired),
          userId,
        };

        if ((data.feed?.pendingSlotCount ?? 0) > 0) {
          preparingPollAttemptsRef.current += 1;
          scheduleFeedRefresh(
            getSmartPreparingPollInterval(preparingPollAttemptsRef.current),
          );
        } else {
          preparingPollAttemptsRef.current = 0;
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        if (!validMemoryCache) {
          setTrendingItems([]);
          setTrendingFeedFailure(null);
          setTrendingFeedState(null);
          setTrendingFeedProgress(null);
          setTrendingUpgradeRequired(false);
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

        const retryable =
          error instanceof TrendingFeedRequestError
            ? error.retryable
            : error instanceof TypeError;

        if (retryable) {
          preparingPollAttemptsRef.current += 1;
          scheduleFeedRefresh(
            getSmartPreparingPollInterval(preparingPollAttemptsRef.current),
          );
        }
      }
    }

    void loadCarouselHistory();

    function handleVisibilityChange() {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        preparingPollAttemptsRef.current = 0;
        setCarouselHistoryRefreshKey((current) => current + 1);
      }
    }

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      controller.abort();
      if (pollTimer) {
        window.clearTimeout(pollTimer);
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [carouselHistoryRefreshKey, user]);

  useEffect(() => {
    if (!user) {
      loadedFeedLocalDate.current = null;
      loadedFeedUserId.current = null;
      loadedFeedFailed.current = false;
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
    const params = new URLSearchParams();
    if (
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("preview") === "1"
    ) {
      params.set("preview", "1");
    }

    const query = params.toString();
    router.push(`/onboarding${query ? `?${query}` : ""}`);
  }

  return (
    <section className="min-h-dvh flex-1 bg-background px-4 py-4 text-foreground sm:px-6 lg:px-8 lg:py-5 xl:px-10">
      <div className="mx-auto flex min-h-[calc(100dvh-2rem)] max-w-[1360px] flex-col lg:min-h-[calc(100dvh-2.5rem)]">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="text-balance text-[30px] font-semibold leading-9 text-foreground-strong sm:text-[32px] sm:leading-10">
                Trending
              </h1>
              {trialPill ? (
                <Link
                  href={trialPill.href}
                  title={trialPill.title}
                  className="inline-flex h-6 items-center rounded-full border border-primary/25 bg-primary/[0.08] px-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/[0.15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {trialPill.label}
                </Link>
              ) : null}
            </div>
            <p className="mt-1 max-w-2xl text-[14px] leading-[20px] text-muted sm:text-[15px] sm:leading-[22px]">
              Explore Carousel, Hook, and Wall-of-text content made from your
              business profile.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              data-trending-adjust-control
              type="button"
              variant="creative-edit"
              size="creative-edit"
              aria-label="Adjust Trending content mix"
              title="Adjust content mix"
              disabled={authLoading || !user}
              onClick={() => setContentMixOpen(true)}
              className="group transition-all duration-200 hover:border-primary/40 hover:bg-primary/[0.06] hover:text-primary active:scale-[0.98]"
            >
              <SlidersHorizontal
                data-icon="inline-start"
                aria-hidden="true"
              />
              <span>Adjust</span>
            </Button>
            <div ref={setHeaderActionsRoot} className="flex items-center" />
          </div>
        </header>

        <section className="mt-3 flex min-h-0 flex-1 sm:mt-4">
          <div
            className="relative flex min-h-0 w-full flex-1 items-center py-2 sm:py-3"
            data-trending-feed-transition
          >
            <div className="min-w-0 flex-1">
              <TrendingFeedGallery
                key={trendingFeedSessionKey}
                enqueueDecision={enqueueDecision}
                failure={trendingFeedFailure}
                headerActionsRoot={headerActionsRoot}
                hasPresentedFeed={hasPresentedTrendingFeed}
                items={orderedTrendingItems}
                error={visibleCarouselHistoryError}
                loading={carouselFeedLoading}
                pendingSlotCount={trendingFeedProgress?.pendingSlotCount ?? 0}
                preparing={trendingFeedState === "preparing"}
                remainingCount={trendingFeedProgress?.remainingCount ?? 0}
                profile={carouselFeedProfile}
                upgradeRequired={trendingUpgradeRequired}
                onCompleteProfile={openBusinessProfile}
                onRetryHistory={() => {
                  retryFailedFeedRef.current = trendingFeedState === "failed";
                  setCarouselHistoryState("loading");
                  setCarouselHistoryRefreshKey((current) => current + 1);
                }}
              />
            </div>
            {user?.uid ? (
              <TrendingFirstVisitWalkthrough
                key={user.uid}
                userId={user.uid}
              />
            ) : null}
          </div>
        </section>
        {contentMixOpen ? (
          <TrendingContentMixDialog
            open
            onApplied={(applied) => {
              if (applied === "today") {
                setCarouselHistoryRefreshKey((current) => current + 1);
              }
            }}
            onOpenChange={setContentMixOpen}
          />
        ) : null}
      </div>
    </section>
  );
}

function TrendingFeedGallery({
  enqueueDecision,
  error,
  failure,
  headerActionsRoot,
  hasPresentedFeed,
  items,
  loading,
  pendingSlotCount,
  preparing,
  remainingCount,
  onCompleteProfile,
  onRetryHistory,
  profile,
  upgradeRequired,
}: {
  enqueueDecision: (entry: TrendingDecisionOutboxEntry) => void;
  error: string | null;
  failure: TrendingFeedFailure | null;
  headerActionsRoot: HTMLDivElement | null;
  hasPresentedFeed: boolean;
  items: TrendingFeedItem[];
  loading: boolean;
  pendingSlotCount: number;
  preparing: boolean;
  remainingCount: number;
  onCompleteProfile: () => void;
  onRetryHistory: () => void;
  profile: CarouselProfileFeed | null;
  upgradeRequired: boolean;
}) {
  const showSkeleton = loading;
  // A right swipe records the decision and removes its card immediately. Keep
  // the already-presented review shell alive for this user/day so the accepted
  // Carousel or Wall action dialog can paint even when that was the final
  // ready card.
  const retainingReviewShell = hasPresentedFeed && items.length === 0;
  const shouldRenderFeed = items.length > 0 || hasPresentedFeed;

  if (!retainingReviewShell && !loading && error && items.length === 0) {
    return (
      <TrendingFeedFailureState
        failure={failure}
        fallbackMessage={error}
        onRetry={onRetryHistory}
      />
    );
  }

  if (!retainingReviewShell && !loading && profile?.state === "missing") {
    return <CarouselProfilePrompt onAction={onCompleteProfile} />;
  }

  if (!retainingReviewShell && !showSkeleton && items.length === 0 && upgradeRequired) {
    return <TrendingUpgradeRequiredEmptyState />;
  }

  if (
    !retainingReviewShell &&
    !showSkeleton &&
    items.length === 0 &&
    (preparing || pendingSlotCount > 0)
  ) {
    return <TrendingPreparingEmptyState pendingSlotCount={pendingSlotCount} />;
  }

  if (
    !retainingReviewShell &&
    !showSkeleton &&
    items.length === 0 &&
    remainingCount > 0
  ) {
    return <TrendingIncompleteEmptyState onRetry={onRetryHistory} />;
  }

  if (!retainingReviewShell && !showSkeleton && items.length === 0) {
    return <TrendingReadyEmptyState />;
  }

  return (
    <div data-trending-feed-transition className="relative grid w-full">
      <div
        aria-hidden={showSkeleton ? undefined : "true"}
        className={cn(
          "col-start-1 row-start-1 transition-opacity duration-200 ease-linear motion-reduce:transition-none",
          showSkeleton ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <TrendingPostSkeleton active={showSkeleton} />
      </div>
      <div
        aria-hidden={showSkeleton ? "true" : undefined}
        inert={showSkeleton ? true : undefined}
        className={cn(
          "col-start-1 row-start-1 transition-opacity duration-200 ease-linear motion-reduce:transition-none",
          showSkeleton ? "pointer-events-none opacity-0" : "opacity-100",
        )}
      >
        {shouldRenderFeed ? (
          <TrendingFeed
            enqueueDecision={enqueueDecision}
            failure={failure}
            headerActionsRoot={headerActionsRoot}
            items={items}
            pendingSlotCount={pendingSlotCount}
            remainingCount={remainingCount}
            onRetry={onRetryHistory}
            upgradeRequired={upgradeRequired}
          />
        ) : null}
      </div>
    </div>
  );
}

function TrendingIncompleteEmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <CarouselFeedState
      actionIcon="refresh"
      actionLabel="Try again"
      icon="failed"
      message="We could not prepare every daily content piece yet. Try again to continue the missing work."
      onAction={onRetry}
      title="More content is still due"
    />
  );
}

function TrendingFeedFailureState({
  failure,
  fallbackMessage,
  onRetry,
}: {
  failure: TrendingFeedFailure | null;
  fallbackMessage?: string;
  onRetry: () => void;
}) {
  const restartRequired =
    failure?.code === "hook_generation_restart_required";

  return (
    <CarouselFeedState
      actionIcon="refresh"
      actionLabel={
        restartRequired ? "Generate Hook videos" : "Try again"
      }
      icon="failed"
      message={
        failure?.message ??
        fallbackMessage ??
        "We could not prepare every daily content piece yet. Try again to continue the missing work."
      }
      onAction={onRetry}
      title={restartRequired ? "Hook videos are ready to generate" : "More content is still due"}
    />
  );
}

function TrendingUpgradeRequiredEmptyState() {
  return (
    <Empty role="status" className="min-h-[360px] text-foreground">
      <EmptyHeader>
        <EmptyTitle>Your free trial has ended</EmptyTitle>
        <EmptyDescription>
          Upgrade to generate the remaining daily content pieces.
        </EmptyDescription>
      </EmptyHeader>
      <Link
        href="/pricing"
        className="mt-5 inline-flex h-10 items-center justify-center rounded-[8px] bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        View plans
      </Link>
    </Empty>
  );
}

function TrendingPreparingEmptyState({
  pendingSlotCount,
}: {
  pendingSlotCount: number;
}) {
  const remainingLabel =
    pendingSlotCount > 0
      ? `${pendingSlotCount} ${pendingSlotCount === 1 ? "piece" : "pieces"} of content ${pendingSlotCount === 1 ? "is" : "are"}`
      : "Your remaining content is";

  return (
    <Empty role="status" className="min-h-[360px] text-foreground">
      <EmptyHeader>
        <Loader2
          aria-hidden="true"
          className="mx-auto size-5 animate-spin text-primary motion-reduce:animate-none"
        />
        <EmptyTitle>Generating for you</EmptyTitle>
        <EmptyDescription>
          {remainingLabel} being prepared. New content will appear here
          automatically.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function TrendingReadyEmptyState() {
  return (
    <Empty role="status" className="min-h-[360px] text-foreground">
      <EmptyHeader>
        <EmptyTitle>You&apos;re all caught up</EmptyTitle>
        <EmptyDescription>
          Check back tomorrow for fresh daily hooks and carousel content.
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
        Wall-of-text content.
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
  enqueueDecision,
  failure,
  headerActionsRoot,
  items,
  pendingSlotCount,
  remainingCount,
  onRetry,
  upgradeRequired,
}: {
  enqueueDecision: (entry: TrendingDecisionOutboxEntry) => void;
  failure: TrendingFeedFailure | null;
  headerActionsRoot: HTMLDivElement | null;
  items: TrendingFeedItem[];
  pendingSlotCount: number;
  remainingCount: number;
  onRetry: () => void;
  upgradeRequired: boolean;
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

  function moveActiveSlide(
    carouselId: string,
    direction: -1 | 1,
    slideCount: number,
  ) {
    if (slideCount < 2) {
      return;
    }

    setActiveSlideByCarouselId((current) => {
      const currentIndex = Math.min(
        current[carouselId] ?? 0,
        Math.max(slideCount - 1, 0),
      );

      return {
        ...current,
        [carouselId]: (currentIndex + direction + slideCount) % slideCount,
      };
    });
  }

  if (hookComposition) {
    return (
      <TrendingHookComposer
        edit={hookComposition.edit}
        item={hookComposition.item}
        onClose={() => {
          setHookComposition(null);
        }}
      />
    );
  }

  return (
    <div className="flex w-full flex-col gap-10">
      <TrendingDeck
        activeSlideByCarouselId={activeSlideByCarouselId}
        candidates={candidates}
        enqueueDecision={enqueueDecision}
        failure={failure}
        headerActionsRoot={headerActionsRoot}
        pendingSlotCount={pendingSlotCount}
        remainingCount={remainingCount}
        onRetry={onRetry}
        upgradeRequired={upgradeRequired}
        onActiveSlideChange={setActiveSlide}
        onActiveSlideMove={moveActiveSlide}
        onHookCompose={(item, edit) => setHookComposition({ edit, item })}
      />
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
  const [previewRenewAt, setPreviewRenewAt] = useState<number | null>(null);
  const previewSessionEndpoint = creative.previewSessionEndpoint;
  const previewInfluencerId = creative.influencerId;
  const previewSourceKind = creative.sourceKind;
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
        setPreviewRenewAt(null);
        setPreviewUrl(editedSource.resolvedAssetUrl);
        return;
      }

      try {
        const token = await getCurrentUserIdToken();

        if (!token) {
          return;
        }

        const response = await fetch(previewSessionEndpoint, {
          body: JSON.stringify({
            influencerId: previewInfluencerId,
            sourceKind: previewSourceKind,
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
          | { expiresAt: string; ok: true; previewUrl: string }
          | { ok?: false }
          | null;

        if (
          response.ok &&
          data?.ok === true &&
          !controller.signal.aborted
        ) {
          setPreviewRenewAt(
            Date.now() + getHookPreviewRenewalDelay(data.expiresAt),
          );
          setPreviewUrl(data.previewUrl);
        }
      } catch {
        if (!controller.signal.aborted) {
          setPreviewRenewAt(null);
          setPreviewUrl(null);
        }
      }
    }

    void loadPreview();

    return () => controller.abort();
  }, [
    editedSource,
    previewInfluencerId,
    previewSessionEndpoint,
    previewSourceKind,
  ]);

  useEffect(() => {
    if (editedSource || previewRenewAt === null) {
      return;
    }

    const controller = new AbortController();
    const renewalTimer = window.setTimeout(
      () => {
        async function renewPreviewSession() {
          try {
            const token = await getCurrentUserIdToken();

            if (!token) {
              throw new Error("Sign in before previewing Hook content.");
            }

            const response = await fetch(previewSessionEndpoint, {
              body: JSON.stringify({
                influencerId: previewInfluencerId,
                sourceKind: previewSourceKind,
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
              | { expiresAt: string; ok: true }
              | { ok?: false }
              | null;

            if (!response.ok || data?.ok !== true) {
              throw new Error("Could not renew this Hook preview.");
            }

            if (!controller.signal.aborted) {
              setPreviewRenewAt(
                Date.now() + getHookPreviewRenewalDelay(data.expiresAt),
              );
            }
          } catch {
            if (!controller.signal.aborted) {
              setPreviewRenewAt(Date.now() + 10_000);
            }
          }
        }

        void renewPreviewSession();
      },
      Math.max(previewRenewAt - Date.now(), 0),
    );

    return () => {
      window.clearTimeout(renewalTimer);
      controller.abort();
    };
  }, [
    editedSource,
    previewInfluencerId,
    previewRenewAt,
    previewSessionEndpoint,
    previewSourceKind,
  ]);

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
  enqueueDecision,
  failure,
  headerActionsRoot,
  onActiveSlideChange,
  onActiveSlideMove,
  onHookCompose,
  onRetry,
  pendingSlotCount,
  remainingCount,
  upgradeRequired,
}: {
  activeSlideByCarouselId: Record<string, number>;
  candidates: TrendingCandidate[];
  enqueueDecision: (entry: TrendingDecisionOutboxEntry) => void;
  failure: TrendingFeedFailure | null;
  headerActionsRoot: HTMLDivElement | null;
  onActiveSlideChange: (carouselId: string, nextIndex: number) => void;
  onActiveSlideMove: (
    carouselId: string,
    direction: -1 | 1,
    slideCount: number,
  ) => void;
  onHookCompose: (
    item: TrendingHookVideoFeedItem,
    edit: TrendingCreativeEditRecord | null,
  ) => void;
  onRetry: () => void;
  pendingSlotCount: number;
  remainingCount: number;
  upgradeRequired: boolean;
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
  const deckProgressLabel = getTrendingDeckProgressLabel({
    readyCount: visibleCandidates.length,
    remainingCount,
  });
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
    activeCandidate?.format ?? "carousel",
  );
  const deckPresentation: TrendingDeckPresentation =
    activeCandidate?.format === "carousel" ? "centered" : "video_peek";
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
    advancePastActiveItem(direction, () => {
      dismissCandidate(candidate);
      setActiveItemId(nextCandidateId);
      decisionLockRef.current = false;
      enqueueDecision({
        assignmentId: candidate.item.assignmentId,
        creativeId: candidate.item.creativeId,
        decision,
        format: candidate.item.format,
        queuedAt: new Date().toISOString(),
      });
      showActionNotice({
        message: decision === "accepted" ? "Accepted." : "Rejected.",
      });

      if (decision === "accepted") {
        openAcceptedCandidate(candidate);
      }
    });
    return true;
  }

  function openAcceptedCandidate(candidate: TrendingCandidate) {
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
      exitDirection
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
    } catch (error) {
      setWallTextActionState({
        message: getErrorMessage(
          error,
          "Could not save this Wall-of-text video.",
        ),
        retryAction: "save",
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
      setPendingWallTextScheduleCandidate(wallTextCandidate);
      setWallTextCandidate(null);
      setWallTextActionState({ status: "idle" });
    } catch (error) {
      setWallTextActionState({
        message: getErrorMessage(
          error,
          "Could not prepare this Wall-of-text video for scheduling.",
        ),
        retryAction: "schedule",
        status: "error",
      });
    }
  }

  async function confirmWallTextSchedule(
    selection: HookVideoScheduleSelection,
  ) {
    const candidate = pendingWallTextScheduleCandidate;

    if (!candidate) {
      throw new Error("Choose a Wall-of-text video before scheduling.");
    }

    const schedule = await createPendingWallTextSchedule({
      candidate,
      selection,
    });

    setPendingWallTextScheduleCandidate(null);
    setWallTextCandidate(null);
    setWallTextActionState({ status: "idle" });
    showActionNotice({
      actionHref: `/scheduling?draft=${encodeURIComponent(schedule.id)}`,
      actionLabel: "View Scheduling",
      message: "Scheduled ·",
      tone: "success",
    });
  }

  const wallTextActionCandidate =
    wallTextCandidate ?? pendingWallTextScheduleCandidate;
  const wallTextEdit = wallTextActionCandidate
    ? editByCreativeId[wallTextActionCandidate.item.creativeId] ?? null
    : null;
  const wallTextEditContent =
    wallTextEdit?.content.format === "wall_text"
      ? wallTextEdit.content
      : null;

  return (
    <section
      aria-label="Trending content"
      className="relative flex min-h-0 w-full flex-1 flex-col items-center justify-center overflow-x-clip overflow-y-visible pb-[107px] pt-[94px]"
    >
      {activeCandidate && headerActionsRoot
        ? createPortal(
            <CreativeEditAction
              disabled={Boolean(exitDirection)}
              onEdit={handleEditActiveCandidate}
            />,
            headerActionsRoot,
          )
        : null}
      {activeCandidate ? (
        <>
          <div
            data-trending-review-frame
            role="group"
            aria-roledescription="Trending content deck"
            aria-busy={Boolean(exitDirection)}
            tabIndex={0}
            aria-label={`Trending content deck. Showing ready content ${activeItemIndex + 1} of ${visibleCandidates.length}. ${deckProgressLabel}. Press left arrow to reject or right arrow to accept this creative.`}
            onKeyDown={handleDeckKeyDown}
            className={cn(
              "relative isolate mx-auto flex items-center justify-center overflow-visible rounded-[20px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              getTrendingReviewCardFrameClass(activeCandidate.format),
            )}
          >
            {activeCandidate.format === "carousel" ? (
              <TrendingFormatPill
                candidate={activeCandidate}
                format={activeCandidate.format}
                positionClassName={getTrendingFormatPillPositionClass()}
              />
            ) : null}
            <div className="relative flex size-full items-center justify-center">
              {[...deckSlots].reverse().map((slot) => (
                <TrendingDeckCard
                  key={slot.candidate.item.id}
                  activeSlideByCarouselId={activeSlideByCarouselId}
                  candidate={slot.candidate}
                  depth={slot.depth}
                  edit={editByCreativeId[slot.candidate.item.creativeId] ?? null}
                  dragX={dragX}
                  exitDirection={slot.depth === 0 ? exitDirection : null}
                  isDragging={isDragging}
                  presentation={deckPresentation}
                  itemCount={visibleCandidates.length}
                  itemIndex={slot.itemIndex}
                  onActiveSlideChange={onActiveSlideChange}
                  onActiveSlideMove={onActiveSlideMove}
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
                className="pointer-events-none absolute inset-0 z-20"
              >
                <div
                  className="absolute left-3 top-3 rounded-full border border-success/70 bg-success/90 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-success-foreground"
                  style={{
                    opacity: Math.min(
                      Math.max(dragX / SWIPE_THRESHOLD_PX, 0),
                      1,
                    ),
                  }}
                >
                  Accept
                </div>
                <div
                  className="absolute right-3 top-3 rounded-full border border-error/70 bg-error/90 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-error-foreground"
                  style={{
                    opacity: Math.min(
                      Math.max(-dragX / SWIPE_THRESHOLD_PX, 0),
                      1,
                    ),
                  }}
                >
                  Reject
                </div>
              </div>
            </div>
            <div className="absolute left-1/2 top-full z-40 flex w-max -translate-x-1/2 flex-col items-center">
              <CreativeDecisionActions
                acceptDisabled={
                  activeHookPreviewStatus !== null &&
                  activeHookPreviewStatus !== "ready"
                }
                disabled={Boolean(exitDirection)}
                onAccept={() => requestCreativeDecision("accepted")}
                onReject={() => requestCreativeDecision("rejected")}
              />
              <p
                data-trending-deck-progress
                className="mt-2 whitespace-nowrap text-center text-xs text-muted"
              >
                {deckProgressLabel}
              </p>
            </div>
          </div>
          <span className="sr-only" aria-live="polite">
            Showing {title}, ready content {activeItemIndex + 1} of{" "}
            {visibleCandidates.length}. {deckProgressLabel}.
          </span>
        </>
      ) : upgradeRequired ? (
        <TrendingUpgradeRequiredEmptyState />
      ) : failure ? (
        <TrendingFeedFailureState
          failure={failure}
          onRetry={onRetry}
        />
      ) : pendingSlotCount > 0 ? (
        <TrendingPreparingEmptyState pendingSlotCount={pendingSlotCount} />
      ) : remainingCount > 0 ? (
        <TrendingIncompleteEmptyState onRetry={onRetry} />
      ) : (
        <TrendingReadyEmptyState />
      )}
      {actionCandidate ? (
        <CarouselActionDialog
          actionState={actionState}
          title={getCarouselTitle(actionCandidate.carousel)}
          onClose={() => {
            setActionState({ status: "idle" });
            setActionCandidate(null);
          }}
          onSaveToLibrary={handleSaveToLibrary}
          onSchedulePost={handleSchedulePost}
        />
      ) : null}
      {wallTextCandidate ? (
        <CarouselActionDialog
          actionState={wallTextActionState}
          title={wallTextCandidate.item.creative.title}
          onClose={() => {
            setWallTextActionState({ status: "idle" });
            setWallTextCandidate(null);
          }}
          onSaveToLibrary={handleSaveWallText}
          onSchedulePost={handleScheduleWallText}
          onRetry={
            wallTextActionState.status === "error" &&
            wallTextActionState.retryAction === "schedule"
              ? handleScheduleWallText
              : handleSaveWallText
          }
          retryLabel={
            wallTextActionState.status === "error" &&
            wallTextActionState.retryAction === "schedule"
              ? "Retry schedule"
              : "Retry save"
          }
        />
      ) : null}
      {pendingWallTextScheduleCandidate ? (
        <HookVideoScheduleDrawer
          summary={{
            backgroundTitle: pendingWallTextScheduleCandidate.item.creative.title,
            kind: "wall_text",
            text:
              wallTextEditContent?.content.fullText ??
              pendingWallTextScheduleCandidate.item.creative.text.fullText,
          }}
          onClose={() => {
            setPendingWallTextScheduleCandidate(null);
          }}
          onConfirm={confirmWallTextSchedule}
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
  onClose,
  onRetry,
  onSaveToLibrary,
  onSchedulePost,
  retryLabel = "Retry",
  title,
}: {
  actionState: CarouselActionState | WallTextDetailActionState;
  onClose: () => void;
  onRetry?: () => void | Promise<void>;
  onSaveToLibrary: () => void | Promise<void>;
  onSchedulePost: () => void | Promise<void>;
  retryLabel?: string;
  title: string;
}) {
  const firstActionRef = useRef<HTMLButtonElement>(null);
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
                  onClick={onRetry ?? onSaveToLibrary}
                  className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-error px-3 text-xs font-semibold text-error-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/30"
                >
                  {retryLabel}
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
      className={cn(
        "fixed bottom-5 left-1/2 z-[var(--z-modal)] flex -translate-x-1/2 items-center gap-3 rounded-full border px-4 py-2 text-sm font-semibold shadow-floating",
        notice.tone === "success"
          ? "border-success/40 bg-success/15 text-success"
          : "border-border bg-card text-foreground-strong",
      )}
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
  positionClassName,
}: {
  candidate?: TrendingCandidate | null;
  format?: TrendingCandidate["format"];
  positionClassName: string;
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
  const iconColor = isHook
    ? "text-info"
    : isWallText
      ? "text-accent-purple"
      : "text-primary";

  return (
    <div
      className={cn(
        "pointer-events-none absolute left-0 z-40 flex w-full items-center justify-start",
        positionClassName,
      )}
    >
      <span
        data-trending-format-pill
        className="inline-flex h-[22px] items-center gap-1.5 rounded-full border border-border/60 bg-card/80 px-2 text-[10px] font-medium leading-none text-muted"
      >
        <Icon
          className={cn("size-3 shrink-0", iconColor)}
          aria-hidden="true"
        />
        <span>{label}</span>
      </span>
    </div>
  );
}

function getTrendingDeckProgressLabel({
  readyCount,
  remainingCount,
}: {
  readyCount: number;
  remainingCount: number;
}) {
  const safeReadyCount = Math.max(Math.trunc(readyCount), 0);
  const safeRemainingCount = Math.max(
    Math.trunc(remainingCount),
    safeReadyCount,
  );

  if (safeRemainingCount > safeReadyCount) {
    return `${safeReadyCount} ready now · ${safeRemainingCount} total remaining`;
  }

  return `${safeRemainingCount} content ${safeRemainingCount === 1 ? "piece" : "pieces"} remaining`;
}

function getTrendingReviewCardFrameClass(
  format: TrendingCandidate["format"],
) {
  return format === "carousel"
    ? CAROUSEL_REVIEW_CARD_FRAME_CLASS
    : VERTICAL_REVIEW_CARD_FRAME_CLASS;
}

function getTrendingFormatPillPositionClass() {
  // The Slideshow deck can reveal a taller card behind its 4:5 active frame.
  // Keep this label above that stack without changing Hook or Wall-of-Text spacing.
  return "bottom-[calc(100%+72px)]";
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
  onActiveSlideMove: (
    carouselId: string,
    direction: -1 | 1,
    slideCount: number,
  ) => void;
  onHookPreviewStatusChange: (
    creativeId: string,
    status: HookPreviewStatus,
  ) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
  onExitTransitionEnd: (event: ReactTransitionEvent<HTMLElement>) => void;
  presentation: TrendingDeckPresentation;
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
          presentation={props.presentation}
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
          presentation={props.presentation}
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
  presentation,
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
  presentation: TrendingDeckPresentation;
}) {
  const isActive = depth === 0;
  const [previewRetryKey, setPreviewRetryKey] = useState(0);
  const [previewLoadKey, setPreviewLoadKey] = useState(0);
  const [previewRenewAt, setPreviewRenewAt] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HookPreviewAudio | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const automaticPreviewRecoveryAttemptedRef = useRef(false);
  const creativeId = candidate.item.creativeId;
  const creative = candidate.item.creative;
  const editedContent =
    edit?.content.format === "hook_video" ? edit.content : null;
  const editedSource = edit?.source ?? null;
  const editedSourceUrl = editedSource?.resolvedAssetUrl ?? null;
  const previewSessionEndpoint = creative.previewSessionEndpoint;
  const previewInfluencerId = creative.influencerId;
  const previewSourceKind = creative.sourceKind;
  const deckStyle = DECK_CARD_STYLES[depth];
  const cardStyle = getTrendingDeckCardPresentation({
    depth,
    dragX,
    exitDirection,
    isDragging,
    presentation,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadPreview() {
      setPreviewAudio(null);
      setPreviewRenewAt(null);
      setPreviewLoading(true);
      setPreviewError(null);
      onPreviewStatusChange(creativeId, "loading");

      if (editedSourceUrl) {
        setPreviewUrl(editedSourceUrl);
        setPreviewLoadKey((current) => current + 1);
        return;
      }

      try {
        const token = await getCurrentUserIdToken();

        if (!token) {
          throw new Error("Sign in before previewing Hook content.");
        }

        const response = await fetch(previewSessionEndpoint, {
          body: JSON.stringify({
            influencerId: previewInfluencerId,
            sourceKind: previewSourceKind,
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
              expiresAt: string;
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
          setPreviewRenewAt(
            Date.now() + getHookPreviewRenewalDelay(data.expiresAt),
          );
          setPreviewUrl(data.previewUrl);
          // A renewed protected session can return the same URL. Remount the
          // video in that case so it emits loadedmetadata again.
          setPreviewLoadKey((current) => current + 1);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setPreviewUrl(null);
          setPreviewAudio(null);
          setPreviewRenewAt(null);
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
    creativeId,
    editedSourceUrl,
    onPreviewStatusChange,
    previewInfluencerId,
    previewRetryKey,
    previewSessionEndpoint,
    previewSourceKind,
  ]);

  useEffect(() => {
    if (editedSourceUrl || previewRenewAt === null) {
      return;
    }

    const controller = new AbortController();
    const renewalTimer = window.setTimeout(
      () => {
        async function renewPreviewSession() {
          try {
            const token = await getCurrentUserIdToken();

            if (!token) {
              throw new Error("Sign in before previewing Hook content.");
            }

            const response = await fetch(previewSessionEndpoint, {
              body: JSON.stringify({
                influencerId: previewInfluencerId,
                sourceKind: previewSourceKind,
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
              | { expiresAt: string; ok: true; previewUrl: string }
              | { ok?: false }
              | null;

            if (!response.ok || data?.ok !== true) {
              throw new Error("Could not renew this Hook preview.");
            }

            if (!controller.signal.aborted) {
              setPreviewRenewAt(
                Date.now() + getHookPreviewRenewalDelay(data.expiresAt),
              );
            }
          } catch {
            if (!controller.signal.aborted) {
              // Keep the current playable media mounted and try the protected
              // session again shortly. A temporary renewal failure should not
              // replace a valid preview with an error screen.
              setPreviewRenewAt(Date.now() + 10_000);
            }
          }
        }

        void renewPreviewSession();
      },
      Math.max(previewRenewAt - Date.now(), 0),
    );

    return () => {
      window.clearTimeout(renewalTimer);
      controller.abort();
    };
  }, [
    editedSourceUrl,
    previewInfluencerId,
    previewRenewAt,
    previewSessionEndpoint,
    previewSourceKind,
  ]);

  return (
    <div
      data-trending-card-state={getTrendingDeckCardState(depth)}
      inert={isActive ? undefined : true}
      className={cn(
        "flex items-center justify-center",
        isActive
          ? "relative"
          : "pointer-events-none absolute inset-0 overflow-visible",
      )}
      style={{ zIndex: deckStyle.zIndex }}
    >
      <article
        data-trending-video-peek={
          presentation === "video_peek" ? "true" : undefined
        }
        data-trending-vertical-frame
        aria-label={`${creative.text.value}, Hook content ${itemIndex + 1} of ${itemCount}`}
        aria-hidden={isActive ? undefined : "true"}
        className={cn(
          VERTICAL_REVIEW_CARD_FRAME_CLASS,
          "relative origin-center select-none overflow-visible transition-[opacity,transform] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none",
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
        {isActive ? (
          <TrendingFormatPill
            candidate={candidate}
            positionClassName="left-0 bottom-[calc(100%+14px)]"
          />
        ) : null}
        {edit ? (
          <div
            data-trending-edited-badge
            className="pointer-events-none absolute right-2.5 top-2.5 z-30 inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-card/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-500"
          >
            <Check className="size-2.5 stroke-[3]" aria-hidden="true" />
            <span>Edited</span>
          </div>
        ) : null}
        <HookVideoCard
          active={isActive}
          dragOffset={0}
          hookAudio={isActive ? previewAudio : null}
          hookFontSize={editedContent?.fontSize ?? creative.text.fontSize}
          hookLines={editedContent?.lines ?? creative.text.lines}
          hookPosition={editedContent?.position ?? creative.text.position}
          hookTextColor={editedContent?.textColor}
          hookText={editedContent?.hookText ?? creative.text.value}
          previewError={isActive ? previewError : null}
          previewLoading={isActive && previewLoading}
          previewLoadKey={previewLoadKey}
          previewUrl={previewUrl}
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
            if (
              !editedSourceUrl &&
              !automaticPreviewRecoveryAttemptedRef.current
            ) {
              automaticPreviewRecoveryAttemptedRef.current = true;
              setPreviewLoading(true);
              setPreviewError(null);
              onPreviewStatusChange(creativeId, "loading");
              setPreviewRetryKey((current) => current + 1);
              return;
            }

            setPreviewUrl(null);
            setPreviewAudio(null);
            setPreviewRenewAt(null);
            setPreviewLoading(false);
            setPreviewError("Could not load this Hook preview.");
            onPreviewStatusChange(creativeId, "error");
          }}
          onPreviewReady={() => {
            automaticPreviewRecoveryAttemptedRef.current = false;
            setPreviewLoading(false);
            setPreviewError(null);
            onPreviewStatusChange(creativeId, "ready");
          }}
          onRetryPreview={() => {
            automaticPreviewRecoveryAttemptedRef.current = false;
            setPreviewRetryKey((current) => current + 1);
          }}
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
  presentation,
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
  presentation: TrendingDeckPresentation;
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
  const cardStyle = getTrendingDeckCardPresentation({
    depth,
    dragX,
    exitDirection,
    isDragging,
    presentation,
  });
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
      data-trending-card-state={getTrendingDeckCardState(depth)}
      inert={isActive ? undefined : true}
      className={cn(
        "flex items-center justify-center",
        isActive
          ? "relative"
          : "pointer-events-none absolute inset-0 overflow-visible",
      )}
      style={{ zIndex: deckStyle.zIndex }}
    >
      <article
        data-trending-video-peek={
          presentation === "video_peek" ? "true" : undefined
        }
        data-trending-vertical-frame
        aria-label={`${creative.title}, Wall-of-text content ${itemIndex + 1} of ${itemCount}`}
        aria-hidden={isActive ? undefined : "true"}
        className={cn(
          VERTICAL_REVIEW_CARD_FRAME_CLASS,
          "relative origin-center select-none overflow-visible transition-[opacity,transform] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none",
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
        {isActive ? (
          <TrendingFormatPill
            candidate={candidate}
            positionClassName="left-0 bottom-[calc(100%+14px)]"
          />
        ) : null}
        {edit ? (
          <div
            data-trending-edited-badge
            className="pointer-events-none absolute right-2.5 top-2.5 z-30 inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-card/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-500"
          >
            <Check className="size-2.5 stroke-[3]" aria-hidden="true" />
            <span>Edited</span>
          </div>
        ) : null}
        <div className="relative size-full overflow-hidden rounded-[20px] bg-[#171717] ring-1 ring-white/10">
          <video
            ref={videoRef}
            src={previewUrl}
            poster={thumbnailUrl ?? undefined}
            autoPlay={isActive}
            muted
            playsInline
            preload={depth <= 1 ? "auto" : "metadata"}
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
  onActiveSlideMove,
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
  onActiveSlideMove: (
    carouselId: string,
    direction: -1 | 1,
    slideCount: number,
  ) => void;
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
  const cardStyle = getTrendingDeckCardPresentation({
    depth,
    dragX,
    exitDirection,
    isDragging,
  });

  function moveSlide(direction: -1 | 1) {
    onActiveSlideMove(
      candidate.carousel.carouselId,
      direction,
      candidate.slides.length,
    );
  }

  function selectSlide(event: ReactMouseEvent<HTMLButtonElement>, nextIndex: number) {
    event.stopPropagation();
    onActiveSlideChange(candidate.carousel.carouselId, nextIndex);
  }

  function stopDeckControlPointer(event: ReactPointerEvent<HTMLElement>) {
    event.stopPropagation();
  }

  return (
    <div
      data-trending-card-state={getTrendingDeckCardState(depth)}
      inert={isActive ? undefined : true}
      className={cn(
        "flex items-center justify-center",
        isActive
          ? "relative"
          : "pointer-events-none absolute inset-0 overflow-visible",
      )}
      style={{ zIndex: deckStyle.zIndex }}
    >
      <article
        aria-label={`${title}, content ${carouselIndex + 1} of ${carouselCount}`}
        aria-hidden={isActive ? undefined : "true"}
        className={cn(
          CAROUSEL_REVIEW_CARD_FRAME_CLASS,
          "origin-center select-none overflow-visible transition-[opacity,transform] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none",
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
            className="pointer-events-none absolute right-2.5 top-2.5 z-30 inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-card/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-500"
          >
            <Check className="size-2.5 stroke-[3]" aria-hidden="true" />
            <span>Edited</span>
          </div>
        ) : null}
        <div className="relative size-full overflow-hidden rounded-[20px] bg-card ring-1 ring-black/5">
          {/* Rendered Carousel slides are immutable Cloud Storage creative assets. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={editedRenderedUrl ?? activeSlide.renderedUrl}
            alt={isActive ? `${title}, slide ${activeSlide.slideNumber}` : ""}
            aria-hidden={isActive ? undefined : "true"}
            draggable={false}
            className="size-full pointer-events-none object-cover"
          />

          {isActive && candidate.slides.length > 1 ? (
            <>
              <button
                type="button"
                data-deck-control
                onPointerCancel={stopDeckControlPointer}
                onPointerDown={stopDeckControlPointer}
                onPointerMove={stopDeckControlPointer}
                onPointerUp={stopDeckControlPointer}
                onClick={() => moveSlide(-1)}
                className="absolute left-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white transition-[background-color,transform] hover:scale-105 hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black motion-reduce:transition-none"
                aria-label={`Previous slide for ${title}`}
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                data-deck-control
                onPointerCancel={stopDeckControlPointer}
                onPointerDown={stopDeckControlPointer}
                onPointerMove={stopDeckControlPointer}
                onPointerUp={stopDeckControlPointer}
                onClick={() => moveSlide(1)}
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
              onPointerDown={stopDeckControlPointer}
              className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1.5"
              aria-label={`${title} slides`}
            >
              {candidate.slides.map((slide, index) => (
                <button
                  key={slide.slideNumber}
                  type="button"
                  data-deck-control
                  onPointerCancel={stopDeckControlPointer}
                  onPointerDown={stopDeckControlPointer}
                  onPointerMove={stopDeckControlPointer}
                  onPointerUp={stopDeckControlPointer}
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
  activeFormat: TrendingCandidate["format"],
): TrendingDeckSlot[] {
  const activeCandidate = candidates[activeItemIndex];

  if (!activeCandidate) {
    return [];
  }

  if (activeFormat !== "carousel") {
    const nextCandidate = candidates[activeItemIndex + 1];

    return [
      { candidate: activeCandidate, itemIndex: activeItemIndex, depth: 0 },
      ...(nextCandidate && nextCandidate.format !== "carousel"
        ? [
            {
              candidate: nextCandidate,
              itemIndex: activeItemIndex + 1,
              depth: 1 as const,
            },
          ]
        : []),
    ];
  }

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

function TrendingPostSkeleton({ active = true }: { active?: boolean }) {
  return (
    <div
      role="status"
      aria-label="Loading trending content"
      className="relative isolate mx-auto flex w-full flex-col items-center justify-center"
    >
      <div
        aria-hidden="true"
        className={cn(VERTICAL_REVIEW_CARD_WIDTH_CLASS, "mb-1.5 h-5")}
      />
      <div className="flex w-full items-center justify-center px-2">
        <div
          aria-hidden="true"
          className={cn(
            VERTICAL_REVIEW_CARD_WIDTH_CLASS,
            skeletonStyles.base,
            "aspect-[9/16] rounded-[20px] border border-white/[0.08]",
          )}
        >
          <span
            className={cn(
              skeletonStyles.shimmer,
              !active && skeletonStyles.paused,
            )}
          />
        </div>
      </div>
      <div
        aria-hidden="true"
        className="mt-3.5 h-14 sm:mt-4 sm:h-[86px]"
      />
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

async function persistTrendingDecisionOutboxEntry(
  entry: TrendingDecisionOutboxEntry,
) {
  const token = await getCurrentUserIdToken();

  if (!token) {
    throw new Error("Sign in before choosing a Trending creative.");
  }

  const response = await fetch("/api/trending/feed/decisions", {
    body: JSON.stringify({
      assignmentId: entry.assignmentId,
      creativeId: entry.creativeId,
      decision: entry.decision,
      format: entry.format,
    }),
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    keepalive: true,
    method: "POST",
  });
  const data = (await response.json().catch(() => null)) as
    | { error?: string; ok: false }
    | {
        dailyFeedSlotId: string | null;
        decision: { decidedAt: string };
        ok: true;
      }
    | null;

  if (
    !response.ok ||
    data?.ok !== true ||
    !data.dailyFeedSlotId
  ) {
    throw new Error(
      data?.ok === false && data.error
        ? data.error
        : "Could not save this creative decision.",
    );
  }
}

function getPendingDecisionAssignmentIds(userId: string) {
  return new Set(
    readPendingDecisionEntries(userId).map((entry) => entry.assignmentId),
  );
}

function readPendingDecisionEntries(userId: string) {
  try {
    const rawValue = window.localStorage.getItem(
      getTrendingDecisionOutboxKey(userId),
    );

    if (rawValue !== null) {
      const entries = parseTrendingDecisionOutbox(rawValue);
      decisionOutboxMemoryFallback.set(userId, entries);
      return entries;
    }
  } catch {
    // Fall through to the same-page queue when storage is unavailable.
  }

  return decisionOutboxMemoryFallback.get(userId) ?? [];
}

function writePendingDecisionEntries(
  userId: string,
  entries: readonly TrendingDecisionOutboxEntry[],
) {
  if (entries.length === 0) {
    decisionOutboxMemoryFallback.delete(userId);
  } else {
    decisionOutboxMemoryFallback.set(userId, [...entries]);
  }

  try {
    const key = getTrendingDecisionOutboxKey(userId);

    if (entries.length === 0) {
      window.localStorage.removeItem(key);
      return;
    }

    window.localStorage.setItem(key, JSON.stringify(entries));
  } catch {
    // The current page still advances when browser storage is unavailable.
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

async function createPendingWallTextSchedule(params: {
  candidate: CompleteWallText;
  selection: HookVideoScheduleSelection;
}) {
  const token = await getCurrentUserIdToken();

  if (!token) {
    throw new Error("Sign in before scheduling this Wall-of-text Reel.");
  }

  const response = await fetch("/api/trending/wall-text/schedules", {
    body: JSON.stringify(createWallTextScheduleRequest({
      assignmentId: params.candidate.item.assignmentId,
      scheduledDate: params.selection.scheduledDate,
      scheduledTime: params.selection.scheduledTime,
      targets: params.selection.targets.map((target) => ({
        connectionId: target.connectionId,
        platform: target.platform,
        settings: target.settings,
      })),
      timezone: params.selection.timezone,
      useDefaultScheduleTime: params.selection.useDefaultScheduleTime,
    })),
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const data = (await response.json().catch(() => null)) as
    | WallTextPendingScheduleResponse
    | null;

  if (!response.ok || !data || data.ok !== true) {
    throw new Error(
      data?.ok === false && data.message
        ? data.message
        : "Could not schedule this Wall-of-text Reel.",
    );
  }

  return data.schedule;
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
    .replace(/\bslideshow ideas\b/g, "carousel content")
    .replace(/\bSlideshow ideas\b/g, "Carousel content")
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
    `Carousel content ${carousel.candidateIndex + 1}`
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
