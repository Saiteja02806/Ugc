"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  Bookmark,
  CalendarClock,
  ChartNoAxesCombined,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  Clock3,
  ExternalLink,
  Eye,
  Film,
  Heart,
  ImageIcon,
  Images,
  Layers,
  MessageCircle,
  RefreshCw,
  Share2,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { SocialAccountAvatar } from "@/components/social/social-account-avatar";
import { InstagramAccountAvatar } from "@/components/social/instagram-account-avatar";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildInstagramActivitySummary,
  type InstagramAnalyticsSummary,
} from "@/lib/analytics/instagram-activity";
import {
  buildInstagramContentPerformanceTrend,
  filterAndSortInstagramContent,
  flattenReadyInstagramContentAccounts,
  groupInstagramContentByPublishedDate,
  getInstagramContentTitle,
  getInstagramInteractionRate,
  summarizeInstagramContentPerformance,
  type InstagramContentAccount,
  type InstagramContentFilter,
  type InstagramContentItem,
  type InstagramContentSort,
  type InstagramContentType,
} from "@/lib/analytics/instagram-content-insights";
import { loadInstagramAnalyticsQuery } from "@/lib/analytics/instagram-query";
import { useAuth } from "@/contexts/auth-context";
import {
  getInstagramPerformanceTrendMode,
  getUniqueInstagramConnections,
  type InstagramInsightPoint,
  type InstagramInsightsAccount,
} from "@/lib/analytics/instagram-insights";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import {
  loadAccountSchedules,
  loadAccountSocialConnections,
} from "@/lib/scheduling/account-data-query";
import { getConnectionPublishingBlockMessage } from "@/lib/scheduling/social-connection-policy";
import type { ScheduledPost } from "@/lib/scheduling/types";
import type { SocialConnection } from "@/lib/social/types";
import { cn } from "@/lib/utils";

type AnalyticsLoadState = "error" | "loading" | "ready";
type DateRangeDays = 7 | 30 | 90;
type PerformanceMetric = "interactions" | "reach" | "views";

type InstagramInsightsResponse = {
  accounts?: InstagramInsightsAccount[];
  days?: DateRangeDays;
  message?: string;
  ok?: boolean;
};

type InstagramInsightsResult = {
  accounts: InstagramInsightsAccount[];
  days: DateRangeDays | null;
  message: string | null;
  state: "loading" | "ready";
};

type InstagramContentResponse = {
  accounts?: InstagramContentAccount[];
  days?: DateRangeDays;
  message?: string;
  ok?: boolean;
};

type InstagramContentResult = {
  accounts: InstagramContentAccount[];
  days: DateRangeDays | null;
  message: string | null;
  state: "loading" | "ready";
};

type InstagramAnalyticsWorkspaceSummary = InstagramAnalyticsSummary & {
  rangeLabel: string;
};

type InstagramInsightSnapshot = {
  hasUnavailableAccounts: boolean;
  interactions: number | null;
  permissionMissing: boolean;
  readyAccountCount: number;
  reach: number | null;
  totalAccountCount: number;
  views: number | null;
};

type InstagramVisibleContentSnapshot = InstagramInsightSnapshot & {
  publishedPosts: number;
};

type PerformanceTrendPoint = InstagramInsightPoint;

type PositionedPerformanceTrendPoint = {
  date: string;
  index: number;
  value: number | null;
  x: number;
  y: number;
};

type AvailablePerformanceTrendPoint =
  Omit<PositionedPerformanceTrendPoint, "value"> & {
    value: number;
  };

const dateRangeOptions: Array<{ days: DateRangeDays; label: string }> = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

const performanceMetricLabels: Record<PerformanceMetric, string> = {
  views: "Views",
  reach: "Reach",
  interactions: "Interactions",
};

const performanceMetricColors: Record<PerformanceMetric, string> = {
  views: "#e16540",
  reach: "#d62976",
  interactions: "#7a35c9",
};

const contentFilterOptions: Array<{
  label: string;
  value: InstagramContentFilter;
}> = [
  { label: "All", value: "all" },
  { label: "Reels", value: "reel" },
  { label: "Carousels", value: "carousel" },
  { label: "Posts", value: "post" },
];

const contentSortOptions: Array<{
  label: string;
  value: InstagramContentSort;
}> = [
  { label: "Views", value: "views" },
  { label: "Reach", value: "reach" },
  { label: "Interactions", value: "interactions" },
  { label: "Saves", value: "saves" },
  { label: "Shares", value: "shares" },
];

const contentTypeLabels: Record<InstagramContentType, string> = {
  carousel: "Carousel",
  post: "Post",
  reel: "Reel",
};

export function InstagramAnalyticsWorkspace() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const accountId = user?.uid ?? "";

  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [schedules, setSchedules] = useState<ScheduledPost[]>([]);
  const [dateRangeDays, setDateRangeDays] = useState<DateRangeDays>(30);
  const activeDateRangeRef = useRef<DateRangeDays>(dateRangeDays);
  const [performanceMetric, setPerformanceMetric] =
    useState<PerformanceMetric>("views");
  const [loadState, setLoadState] =
    useState<AnalyticsLoadState>("loading");
  const [refreshInProgress, setRefreshInProgress] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [insightsResult, setInsightsResult] =
    useState<InstagramInsightsResult>({
      accounts: [],
      days: null,
      message: null,
      state: "loading",
    });
  const [contentResult, setContentResult] =
    useState<InstagramContentResult>({
      accounts: [],
      days: null,
      message: null,
      state: "loading",
    });

  useEffect(() => {
    activeDateRangeRef.current = dateRangeDays;
  }, [dateRangeDays]);

  const loadAnalytics = useCallback(async (
    signal?: AbortSignal,
    idempotencyKey?: string,
  ) => {
    try {
      const token = await getCurrentUserIdToken();

      if (signal?.aborted) {
        return;
      }

      if (!token) {
        setConnections([]);
        setSchedules([]);
        setInsightsResult({
          accounts: [],
          days: dateRangeDays,
          message: null,
          state: "ready",
        });
        setErrorMessage(null);
        setLoadState("ready");
        return;
      }

      setInsightsResult((current) =>
        current.days === dateRangeDays && current.accounts.length > 0
          ? current
          : { ...current, state: "loading" },
      );
      const [
        loadedConnections,
        loadedSchedules,
        insightsOutput,
      ] = await Promise.all([
        loadAccountSocialConnections(queryClient, accountId, {
          force: Boolean(idempotencyKey),
          token,
        }),
        loadAccountSchedules(queryClient, accountId, {
          force: Boolean(idempotencyKey),
          token,
        }),
        loadInstagramAnalyticsQuery({
          accountId,
          days: dateRangeDays,
          force: Boolean(idempotencyKey),
          idempotencyKey,
          kind: "insights",
          onBackgroundError: (error) => {
            setInsightsResult((current) => ({
              ...current,
              message: error.message,
            }));
          },
          onBackgroundOutput: (output) => {
            const refreshed = output as InstagramInsightsResponse | null;

            if (
              refreshed?.accounts &&
              refreshed.days === activeDateRangeRef.current
            ) {
              setInsightsResult({
                accounts: refreshed.accounts,
                days: dateRangeDays,
                message: refreshed.message ?? null,
                state: "ready",
              });
            }
          },
          queryClient,
          token,
        }),
      ]);
      const insightsData =
        insightsOutput as InstagramInsightsResponse | null;

      if (signal?.aborted) {
        return;
      }

      setConnections(
        getUniqueInstagramConnections(
          [...(loadedConnections ?? [])].sort(
            (left, right) =>
              Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
          ),
        ),
      );
      setSchedules(
        Array.isArray(loadedSchedules.schedules)
          ? loadedSchedules.schedules
          : [],
      );
      setInsightsResult({
        accounts: insightsData?.accounts ?? [],
        days: dateRangeDays,
        message: insightsData?.message ?? null,
        state: "ready",
      });
      setErrorMessage(null);
      setLoadState("ready");
    } catch (error) {
      if (signal?.aborted) {
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load analytics. Refresh and try again.",
      );
      setInsightsResult((current) => ({
        ...current,
        days: dateRangeDays,
        message: "Performance insights could not load right now.",
        state: "ready",
      }));
      setLoadState("error");
    }
  }, [accountId, dateRangeDays, queryClient]);

  const loadContentPerformance = useCallback(
    async (signal?: AbortSignal, idempotencyKey?: string) => {
      try {
        const token = await getCurrentUserIdToken();

        if (signal?.aborted) {
          return;
        }

        if (!token) {
          setContentResult({
            accounts: [],
            days: dateRangeDays,
            message: null,
            state: "ready",
          });
          return;
        }

        setContentResult((current) =>
          current.days === dateRangeDays && current.accounts.length > 0
            ? current
            : { ...current, state: "loading" },
        );
        const output = await loadInstagramAnalyticsQuery({
          accountId,
          days: dateRangeDays,
          force: Boolean(idempotencyKey),
          idempotencyKey,
          kind: "content",
          onBackgroundError: (error) => {
            setContentResult((current) => ({
              ...current,
              message: error.message,
            }));
          },
          onBackgroundOutput: (backgroundOutput) => {
            const refreshed =
              backgroundOutput as InstagramContentResponse | null;

            if (
              refreshed?.accounts &&
              refreshed.days === activeDateRangeRef.current
            ) {
              setContentResult({
                accounts: refreshed.accounts,
                days: dateRangeDays,
                message: refreshed.message ?? null,
                state: "ready",
              });
            }
          },
          queryClient,
          token,
        });
        const data = output as InstagramContentResponse | null;

        if (signal?.aborted) {
          return;
        }

        setContentResult({
          accounts: data?.accounts ?? [],
          days: dateRangeDays,
          message: null,
          state: "ready",
        });
      } catch (error) {
        if (signal?.aborted) {
          return;
        }

        setContentResult({
          accounts: [],
          days: dateRangeDays,
          message:
            error instanceof Error
              ? error.message
              : "Content performance could not load right now.",
          state: "ready",
        });
      }
    },
    [accountId, dateRangeDays, queryClient],
  );

  useEffect(() => {
    const controller = new AbortController();

    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        void loadAnalytics(controller.signal);
        void loadContentPerformance(controller.signal);
      }
    });

    return () => controller.abort();
  }, [loadAnalytics, loadContentPerformance]);

  const retryAnalytics = useCallback(() => {
    setErrorMessage(null);
    setRefreshInProgress(true);
    const refreshKey = crypto.randomUUID();
    void Promise.all([
      loadAnalytics(undefined, refreshKey),
      loadContentPerformance(undefined, refreshKey),
    ]).finally(() => setRefreshInProgress(false));
  }, [loadAnalytics, loadContentPerformance]);

  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("all");

  const activeConnectionIds = useMemo(
    () => new Set(connections.map((connection) => connection.id)),
    [connections],
  );
  const effectiveSelectedConnectionId =
    selectedConnectionId !== "all" && !activeConnectionIds.has(selectedConnectionId)
      ? "all"
      : selectedConnectionId;

  const displayedConnections = useMemo(() => {
    if (effectiveSelectedConnectionId === "all") return connections;
    return connections.filter((c) => c.id === effectiveSelectedConnectionId);
  }, [connections, effectiveSelectedConnectionId]);

  const activeInsightAccounts = useMemo(
    () =>
      insightsResult.accounts.filter((account) =>
        activeConnectionIds.has(account.connectionId),
      ),
    [activeConnectionIds, insightsResult.accounts],
  );
  const activeContentAccounts = useMemo(
    () =>
      contentResult.accounts.filter((account) =>
        activeConnectionIds.has(account.connectionId),
      ),
    [activeConnectionIds, contentResult.accounts],
  );

  const displayedContentAccounts = useMemo(() => {
    if (effectiveSelectedConnectionId === "all") return activeContentAccounts;
    return activeContentAccounts.filter(
      (account) => account.connectionId === effectiveSelectedConnectionId,
    );
  }, [activeContentAccounts, effectiveSelectedConnectionId]);

  const displayedInsightAccounts = useMemo(() => {
    if (effectiveSelectedConnectionId === "all") return activeInsightAccounts;
    return activeInsightAccounts.filter(
      (account) => account.connectionId === effectiveSelectedConnectionId,
    );
  }, [activeInsightAccounts, effectiveSelectedConnectionId]);

  const displayedVisibleConnectionIds = useMemo(
    () => new Set(displayedConnections.map((connection) => connection.id)),
    [displayedConnections],
  );

  const analytics = useMemo<InstagramAnalyticsWorkspaceSummary>(() => {
    const dateKeys = getDateRangeKeys(dateRangeDays);

    return {
      ...buildInstagramActivitySummary({
        accountNames: new Map(
          displayedConnections.map((connection) => [
            connection.id,
            getInstagramAccountName(connection),
          ]),
        ),
        dateKeys,
        schedules,
        visibleConnectionIds: displayedVisibleConnectionIds,
      }),
      rangeLabel: getRangeLabel(dateKeys),
    };
  }, [dateRangeDays, displayedConnections, displayedVisibleConnectionIds, schedules]);

  const primaryConnection = useMemo(
    () => getPrimaryInstagramConnection(displayedConnections),
    [displayedConnections],
  );
  const primaryInsightAccount = useMemo(
    () =>
      primaryConnection
        ? displayedInsightAccounts.find(
            (account) => account.connectionId === primaryConnection.id,
          ) ?? null
        : null,
    [displayedInsightAccounts, primaryConnection],
  );
  const insightsLoading =
    insightsResult.state === "loading" ||
    insightsResult.days !== dateRangeDays;
  const contentLoading =
    contentResult.state === "loading" ||
    contentResult.days !== dateRangeDays;
  const refreshing =
    refreshInProgress ||
    loadState === "loading" ||
    insightsLoading ||
    contentLoading;

  return (
    <section className="min-h-dvh min-w-0 flex-1 bg-background px-4 py-5 text-foreground sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto w-full max-w-[1180px]">
        <header className="flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
              Performance overview
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-foreground-strong sm:text-4xl">
              Analytics
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-muted sm:text-base">
              Review views, interactions, content performance, and account
              readiness in one focused workspace.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Badge variant="outline" className="h-8 w-fit px-3">
              <ShieldCheck data-icon="inline-start" aria-hidden="true" />
              Real workspace data
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={retryAnalytics}
              disabled={refreshing}
              className="w-full sm:w-auto"
            >
              <RefreshCw
                data-icon="inline-start"
                className={cn(
                  refreshing &&
                    "animate-spin motion-reduce:animate-none",
                )}
                aria-hidden="true"
              />
              Refresh
            </Button>
          </div>
        </header>

        <div
          className="mt-6"
          aria-busy={loadState === "loading"}
        >
          {loadState === "loading" ? <AnalyticsLoadingState /> : null}
          {loadState === "error" ? (
            <AnalyticsErrorState
              message={errorMessage}
              onRetry={retryAnalytics}
            />
          ) : null}
          {loadState === "ready" ? (
            <AnalyticsReadyState
              allConnections={connections}
              analytics={analytics}
              connection={primaryConnection}
              connectionCount={displayedConnections.length}
              contentAccounts={displayedContentAccounts}
              contentLoading={contentLoading}
              contentMessage={contentResult.message}
              dateRangeDays={dateRangeDays}
              insightAccount={primaryInsightAccount}
              insightsLoading={insightsLoading}
              insightsMessage={insightsResult.message}
              onDateRangeChange={setDateRangeDays}
              onPerformanceMetricChange={setPerformanceMetric}
              onSelectConnectionId={setSelectedConnectionId}
              performanceMetric={performanceMetric}
              selectedConnectionId={effectiveSelectedConnectionId}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function AnalyticsReadyState({
  allConnections,
  analytics,
  connection,
  connectionCount,
  contentAccounts,
  contentLoading,
  contentMessage,
  dateRangeDays,
  insightAccount,
  insightsLoading,
  insightsMessage,
  onDateRangeChange,
  onPerformanceMetricChange,
  onSelectConnectionId,
  performanceMetric,
  selectedConnectionId,
}: {
  allConnections: SocialConnection[];
  analytics: InstagramAnalyticsWorkspaceSummary;
  connection: SocialConnection | null;
  connectionCount: number;
  contentAccounts: InstagramContentAccount[];
  contentLoading: boolean;
  contentMessage: string | null;
  dateRangeDays: DateRangeDays;
  insightAccount: InstagramInsightsAccount | null;
  insightsLoading: boolean;
  insightsMessage: string | null;
  onDateRangeChange: (days: DateRangeDays) => void;
  onPerformanceMetricChange: (metric: PerformanceMetric) => void;
  onSelectConnectionId: (connectionId: string) => void;
  performanceMetric: PerformanceMetric;
  selectedConnectionId: string;
}) {
  const contentSnapshot = useMemo(
    () =>
      buildInstagramVisibleContentSnapshot(
        contentAccounts,
        connectionCount,
      ),
    [connectionCount, contentAccounts],
  );
  const contentMetricsReady = contentSnapshot.readyAccountCount > 0;
  const displayedViews = contentLoading || !contentMetricsReady
    ? null
    : contentSnapshot.views;
  const displayedInteractions = contentLoading || !contentMetricsReady
    ? null
    : contentSnapshot.interactions;
  const contentMetricSource = getContentMetricSource({
    contentSnapshot,
    contentLoading,
    contentMessage,
  });
  const performanceTrend = useMemo(
    () =>
      buildInstagramContentPerformanceTrend({
        accounts: contentAccounts,
        dateKeys: getDateRangeKeys(dateRangeDays),
        getPublishedDateKey: getLocalPublishedDateKey,
      }),
    [contentAccounts, dateRangeDays],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="inline-flex w-fit items-center gap-2 text-sm font-medium text-muted">
          <Clock3 className="size-4 text-primary" aria-hidden="true" />
          {analytics.rangeLabel}
        </span>
        <DateRangeSelector
          selectedDays={dateRangeDays}
          onChange={onDateRangeChange}
        />
      </div>

      {allConnections.length > 1 ? (
        <div className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-border bg-card p-3.5 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 px-0.5">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
              Account View
            </span>
          </div>
          <InstagramAccountSelector
            connections={allConnections}
            selectedConnectionId={selectedConnectionId}
            onChange={onSelectConnectionId}
          />
        </div>
      ) : null}

      <section className="relative overflow-hidden rounded-[var(--radius-panel)] border border-border bg-card shadow-card">
        <span
          className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary to-[#d62976]"
          aria-hidden="true"
        />
        <header className="flex flex-col gap-2 px-5 py-5 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
            Performance snapshot
          </p>
          <h2 className="text-lg font-bold tracking-[-0.02em] text-foreground-strong">
            Your performance at a glance
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-muted">
            Views, interactions, and published-post totals use only posts that
            Instagram currently returns for the selected period. Deleted or
            unavailable posts are not counted.
          </p>
        </header>

        <div className="grid grid-cols-2 border-t border-border lg:grid-cols-4">
          <SnapshotMetric
            icon={<Eye aria-hidden="true" />}
            label="Post views"
            source={contentMetricSource}
            value={formatOptionalNumber(displayedViews)}
          />
          <SnapshotMetric
            icon={<Heart aria-hidden="true" />}
            label="Interactions"
            source={contentMetricSource}
            value={formatOptionalNumber(displayedInteractions)}
          />
          <SnapshotMetric
            icon={<CheckCircle2 aria-hidden="true" />}
            label="Published posts"
            source={contentMetricSource}
            value={formatOptionalNumber(
              contentLoading || !contentMetricsReady
                ? null
                : contentSnapshot.publishedPosts,
            )}
          />
          <SnapshotMetric
            icon={<CalendarClock aria-hidden="true" />}
            label="Upcoming posts"
            source="Schedule records"
            value={formatNumber(analytics.scheduled)}
          />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.7fr)]">
        <AnalyticsSurface
          actions={
            <PerformanceMetricSelector
              metric={performanceMetric}
              onChange={onPerformanceMetricChange}
            />
          }
          description="Current totals for Instagram posts published in the selected period, grouped by their publish date."
          eyebrow="Content trend"
          title={`${performanceMetricLabels[performanceMetric]} by publish date`}
        >
          <InstagramPerformanceTrendChart
            connectionCount={connectionCount}
            contentAccounts={contentAccounts}
            insightsLoading={contentLoading}
            insightsMessage={contentMessage}
            insightSnapshot={contentSnapshot}
            metric={performanceMetric}
            points={performanceTrend}
            groupedByPublishDate
          />
        </AnalyticsSurface>

        <InstagramReadinessPanel
          connection={connection}
          connectionCount={connectionCount}
          insightAccount={insightAccount}
          insightsLoading={insightsLoading}
          insightsMessage={insightsMessage}
          needsAttention={analytics.needsAttention}
        />
      </div>

      <InstagramContentPerformance
        accounts={contentAccounts}
        connectionCount={connectionCount}
        loading={contentLoading}
        message={contentMessage}
      />

      <div className="flex items-start gap-2.5 px-1 text-xs leading-5 text-muted">
        <ShieldCheck
          className="mt-0.5 size-4 shrink-0 text-muted-subtle"
          aria-hidden="true"
        />
        <p>
          No sample performance numbers are shown. Meta values that are missing
          or unavailable remain shown as —.
        </p>
      </div>
    </div>
  );
}

function SnapshotMetric({
  icon,
  label,
  source,
  value,
}: {
  icon: ReactNode;
  label: string;
  source: string;
  value: string;
}) {
  return (
    <div className="min-w-0 border-b border-border p-4 [&:nth-child(odd)]:border-r [&:nth-last-child(-n+2)]:border-b-0 sm:p-5 lg:border-b-0 lg:border-r lg:last:border-r-0">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-muted">{label}</p>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-card-muted text-primary [&>svg]:size-4">
          {icon}
        </span>
      </div>
      <p className="mt-5 font-mono text-3xl font-semibold tabular-nums tracking-[-0.04em] text-foreground-strong">
        {value}
      </p>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-subtle">
        {source}
      </p>
    </div>
  );
}

function AnalyticsSurface({
  actions,
  children,
  description,
  eyebrow,
  title,
}: {
  actions?: ReactNode;
  children: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <section className="rounded-[var(--radius-panel)] border border-border bg-card p-5 shadow-card sm:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-lg font-bold tracking-[-0.02em] text-foreground-strong">
            {title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            {description}
          </p>
        </div>
        {actions ? (
          <div className="w-full shrink-0 sm:w-auto">{actions}</div>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function InstagramAccountSelector({
  connections,
  onChange,
  selectedConnectionId,
}: {
  connections: SocialConnection[];
  onChange: (connectionId: string) => void;
  selectedConnectionId: string;
}) {
  return (
    <div
      aria-label="Filter by Instagram account"
      className="inline-flex w-fit max-w-full flex-wrap items-center gap-1 rounded-[var(--radius-control)] border border-border bg-card-muted/50 p-1"
      role="tablist"
    >
      <button
        type="button"
        role="tab"
        aria-selected={selectedConnectionId === "all"}
        className={cn(
          "inline-flex min-h-11 touch-manipulation items-center gap-2 whitespace-nowrap rounded-[7px] px-3 py-1.5 text-xs font-semibold transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
          selectedConnectionId === "all"
            ? "bg-primary text-primary-foreground shadow-card"
            : "text-muted hover:bg-card hover:text-foreground-strong",
        )}
        onClick={() => onChange("all")}
      >
        <Layers className="size-3.5" aria-hidden="true" />
        <span>All accounts</span>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-bold leading-none",
            selectedConnectionId === "all"
              ? "bg-primary-foreground/20 text-primary-foreground"
              : "bg-background text-muted-foreground",
          )}
        >
          {connections.length}
        </span>
      </button>

      {connections.map((connection) => {
        const selected = selectedConnectionId === connection.id;
        const handle = getInstagramAccountHandle(connection);
        const name = getInstagramAccountName(connection);
        const label = handle ?? name;

        return (
          <button
            key={connection.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={cn(
              "inline-flex min-h-11 touch-manipulation items-center gap-2 whitespace-nowrap rounded-[7px] px-3 py-1.5 text-xs font-semibold transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
              selected
                ? "bg-primary text-primary-foreground shadow-card"
                : "text-muted hover:bg-card hover:text-foreground-strong",
            )}
            onClick={() => onChange(connection.id)}
          >
            <SocialAccountAvatar connection={connection} size="sm" />
            <span className="max-w-[150px] truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

function DateRangeSelector({
  onChange,
  selectedDays,
}: {
  onChange: (days: DateRangeDays) => void;
  selectedDays: DateRangeDays;
}) {
  return (
    <div
      aria-label="Analytics date range"
      className="inline-flex w-fit max-w-full overflow-x-auto rounded-[var(--radius-control)] border border-border bg-card p-1"
      role="group"
    >
      {dateRangeOptions.map((option) => {
        const selected = option.days === selectedDays;

        return (
          <button
            key={option.days}
            type="button"
            aria-pressed={selected}
            className={cn(
              "min-h-11 touch-manipulation whitespace-nowrap rounded-[7px] px-3 py-1.5 text-xs font-semibold transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
              selected
                ? "bg-primary text-primary-foreground shadow-card"
                : "text-muted hover:bg-card-muted hover:text-foreground-strong",
            )}
            onClick={() => onChange(option.days)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function PerformanceMetricSelector({
  metric,
  onChange,
}: {
  metric: PerformanceMetric;
  onChange: (metric: PerformanceMetric) => void;
}) {
  return (
    <div
      aria-label="Performance metric"
      className="grid w-full grid-cols-3 rounded-[var(--radius-control)] border border-border bg-card-muted p-1 sm:inline-grid sm:w-auto"
      role="group"
    >
      {(Object.keys(performanceMetricLabels) as PerformanceMetric[]).map(
        (option) => {
          const selected = option === metric;

          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              className={cn(
                "inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-[7px] px-2.5 py-1.5 text-xs font-semibold transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                selected
                  ? "bg-card text-foreground-strong shadow-card"
                  : "text-muted hover:text-foreground-strong",
              )}
              onClick={() => onChange(option)}
            >
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: performanceMetricColors[option],
                }}
                aria-hidden="true"
              />
              {performanceMetricLabels[option]}
            </button>
          );
        },
      )}
    </div>
  );
}

function InstagramPerformanceTrendChart({
  connectionCount,
  contentAccounts,
  groupedByPublishDate,
  insightSnapshot,
  insightsLoading,
  insightsMessage,
  metric,
  points,
}: {
  connectionCount: number;
  contentAccounts: InstagramContentAccount[];
  groupedByPublishDate: boolean;
  insightSnapshot: InstagramInsightSnapshot;
  insightsLoading: boolean;
  insightsMessage: string | null;
  metric: PerformanceMetric;
  points: PerformanceTrendPoint[];
}) {
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const [selectedContentDate, setSelectedContentDate] = useState<string | null>(
    null,
  );
  const [selectedItem, setSelectedItem] =
    useState<InstagramContentItem | null>(null);
  const gradientId = `instagram-performance-${useId().replaceAll(":", "")}`;
  const chartWidth = 720;
  const chartHeight = 280;
  const paddingX = 42;
  const paddingTop = 30;
  const paddingBottom = 34;
  const availableValues = points
    .map((point) => point[metric])
    .filter((value): value is number => value !== null);
  const maxValue = Math.max(...availableValues, 1);
  const trendMode = getInstagramPerformanceTrendMode(
    points.map((point) => point[metric]),
  );
  const hasData = trendMode !== "empty";
  const drawableWidth = chartWidth - paddingX * 2;
  const drawableHeight = chartHeight - paddingTop - paddingBottom;
  const baselineY = chartHeight - paddingBottom;
  const positionedPoints: PositionedPerformanceTrendPoint[] =
    points.map((point, index) => ({
      date: point.date,
      index,
      value: point[metric],
      x:
        paddingX +
        (points.length <= 1
          ? drawableWidth / 2
          : (index / (points.length - 1)) * drawableWidth),
      y:
        point[metric] === null
          ? baselineY
          : paddingTop +
            (1 - point[metric] / maxValue) * drawableHeight,
    }));
  const availablePoints = positionedPoints.filter(
    (point): point is AvailablePerformanceTrendPoint =>
      point.value !== null,
  );
  const segments = splitPerformanceTrendSegments(positionedPoints);
  const activePoint =
    availablePoints.find((point) => point.date === activeDate) ?? null;
  const total = insightSnapshot[metric];
  const peakPoint = hasData
    ? availablePoints.reduce((peak, point) =>
        point.value > peak.value ? point : peak,
      )
    : null;
  const emptyState = getPerformanceTrendEmptyState({
    connectionCount,
    insightSnapshot,
    insightsMessage,
    metric,
  });
  const metricColor = performanceMetricColors[metric];
  const contentItems = useMemo(
    () => flattenReadyInstagramContentAccounts(contentAccounts),
    [contentAccounts],
  );
  const contentByDate = useMemo(
    () =>
      new Map(
        groupInstagramContentByPublishedDate(
          contentAccounts,
          getLocalPublishedDateKey,
        ).map((group) => [group.date, group.items]),
      ),
    [contentAccounts],
  );
  const contentMarkers = availablePoints.flatMap((point) => {
    const items = sortContentForPerformanceMarker(
      contentByDate.get(point.date) ?? [],
      metric,
    );
    const previewItem = items.find((item) => item.thumbnailUrl);

    return previewItem ? [{ items, point, previewItem }] : [];
  });
  const contentMarkerDates = new Set(
    contentMarkers.map((marker) => marker.point.date),
  );
  const selectedDateItems = selectedContentDate
    ? sortContentForPerformanceMarker(
        contentByDate.get(selectedContentDate) ?? [],
        metric,
      )
    : [];
  const activeSelectedItem = selectedItem
    ? contentItems.find(
        (item) =>
          item.id === selectedItem.id &&
          item.connectionId === selectedItem.connectionId,
      ) ?? null
    : null;
  const firstPoint = availablePoints[0] ?? null;
  const firstPointItems = firstPoint
    ? sortContentForPerformanceMarker(
        contentByDate.get(firstPoint.date) ?? [],
        metric,
      )
    : [];

  const openContentItems = (
    date: string,
    items: InstagramContentItem[],
  ) => {
    if (items.length === 0) {
      return;
    }

    setActiveDate(date);

    if (items.length === 1) {
      setSelectedContentDate(null);
      setSelectedItem(items[0]);
      return;
    }

    setSelectedItem(null);
    setSelectedContentDate(date);
  };

  const activateNearestPoint = (
    event: ReactPointerEvent<SVGSVGElement>,
  ) => {
    if (availablePoints.length === 0) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX =
      ((event.clientX - bounds.left) / Math.max(bounds.width, 1)) *
      chartWidth;
    const nearest = availablePoints.reduce((closest, point) =>
      Math.abs(point.x - pointerX) < Math.abs(closest.x - pointerX)
        ? point
        : closest,
    );

    setActiveDate(nearest.date);
  };

  if (insightsLoading) {
    return <PerformanceTrendLoadingState />;
  }

  if (trendMode === "insufficient-history" && firstPoint) {
    return (
      <div className="mt-6">
        <PerformanceTrendInsufficientState
          items={firstPointItems}
          metric={metric}
          onViewContent={() =>
            openContentItems(firstPoint.date, firstPointItems)
          }
          point={firstPoint}
        />
        <ContentDayPickerDialog
          date={selectedContentDate}
          items={selectedDateItems}
          metric={metric}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedContentDate(null);
            }
          }}
          onSelect={(item) => {
            setSelectedContentDate(null);
            setSelectedItem(item);
          }}
          showAccountName={connectionCount > 1}
        />
        <ContentPerformanceDrawer
          item={activeSelectedItem}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedItem(null);
            }
          }}
          showAccountName={connectionCount > 1}
        />
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="relative h-[280px] min-w-0 overflow-hidden rounded-[var(--radius-control)] border border-border bg-card-muted/35">
        <svg
          aria-label={`${
            groupedByPublishDate ? "Published-content" : "Daily"
          } ${performanceMetricLabels[metric].toLowerCase()} from ${formatShortDate(
            points[0]?.date ?? "",
          )} to ${formatShortDate(points.at(-1)?.date ?? "")}`}
          className="h-full w-full"
          onPointerLeave={() => setActiveDate(null)}
          onPointerMove={activateNearestPoint}
          preserveAspectRatio="none"
          role="img"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        >
          <defs>
            <linearGradient
              id={gradientId}
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor={metricColor}
                stopOpacity="0.28"
              />
              <stop
                offset="100%"
                stopColor={metricColor}
                stopOpacity="0"
              />
            </linearGradient>
          </defs>
          {hasData
            ? [0, 0.25, 0.5, 0.75, 1].map((step) => {
                const y = paddingTop + step * drawableHeight;

                return (
                  <line
                    key={step}
                    stroke="rgb(56 56 56)"
                    strokeDasharray={step === 1 ? "0" : "4 8"}
                    strokeWidth="1"
                    x1={paddingX}
                    x2={chartWidth - paddingX}
                    y1={y}
                    y2={y}
                  />
                );
              })
            : null}
          {segments.map((segment) => {
            const linePath = buildSmoothPath(segment);
            const areaPath =
              segment.length > 1
                ? `${linePath} L ${segment[segment.length - 1].x} ${baselineY} L ${segment[0].x} ${baselineY} Z`
                : null;

            return (
              <g key={segment[0].date}>
                {areaPath ? (
                  <path
                    d={areaPath}
                    fill={`url(#${gradientId})`}
                    stroke="none"
                  />
                ) : null}
                <path
                  d={linePath}
                  fill="none"
                  stroke={metricColor}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3.5"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}
          {activePoint ? (
            <line
              x1={activePoint.x}
              x2={activePoint.x}
              y1={paddingTop}
              y2={baselineY}
              stroke={metricColor}
              strokeDasharray="3 6"
              strokeOpacity="0.55"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          {availablePoints.map((point) =>
            contentMarkerDates.has(point.date) ? null : (
              <circle
                key={point.date}
                aria-label={`${formatFullDate(point.date)}: ${formatNumber(
                  point.value,
                )} ${performanceMetricLabels[metric].toLowerCase()}`}
                cx={point.x}
                cy={point.y}
                fill={metricColor}
                onBlur={() => setActiveDate(null)}
                onFocus={() => setActiveDate(point.date)}
                onPointerEnter={() => setActiveDate(point.date)}
                r={activePoint?.date === point.date ? 5 : 3}
                role="img"
                stroke={
                  activePoint?.date === point.date
                    ? "#f5f3f0"
                    : "rgb(41 41 41)"
                }
                strokeWidth={activePoint?.date === point.date ? 2.5 : 1.5}
                tabIndex={0}
                vectorEffect="non-scaling-stroke"
              >
                <title>
                  {formatFullDate(point.date)}: {formatNumber(point.value)}{" "}
                  {performanceMetricLabels[metric].toLowerCase()}
                </title>
              </circle>
            ),
          )}
          {hasData ? (
            <>
              <text
                fill="#8d8984"
                fontSize="10"
                fontWeight="600"
                textAnchor="end"
                x={chartWidth - 7}
                y={paddingTop + 4}
              >
                {formatNumber(maxValue)}
              </text>
              <text
                fill="#8d8984"
                fontSize="10"
                fontWeight="600"
                textAnchor="end"
                x={chartWidth - 7}
                y={baselineY + 4}
              >
                0
              </text>
            </>
          ) : null}
        </svg>

        {contentMarkers.map((marker) => (
          <PerformanceContentMarker
            key={marker.point.date}
            active={activePoint?.date === marker.point.date}
            chartHeight={chartHeight}
            chartWidth={chartWidth}
            items={marker.items}
            metric={metric}
            metricColor={metricColor}
            onActivate={setActiveDate}
            onSelect={() =>
              openContentItems(marker.point.date, marker.items)
            }
            peak={peakPoint?.date === marker.point.date}
            point={marker.point}
            previewItem={marker.previewItem}
          />
        ))}

        {activePoint ? (
          <PerformanceTrendTooltip
            chartHeight={chartHeight}
            chartWidth={chartWidth}
            metric={metric}
            point={activePoint}
          />
        ) : null}

        <div
          className="pointer-events-none absolute inset-x-5 bottom-2 flex items-center justify-between text-[11px] font-semibold text-muted-subtle"
          aria-hidden="true"
        >
          <span>{formatShortDate(points[0]?.date ?? "")}</span>
          <span>{formatShortDate(points.at(-1)?.date ?? "")}</span>
        </div>

        {!hasData ? (
          <div className="absolute inset-x-5 top-1/2 -translate-y-1/2 text-center">
            <span className="mx-auto flex size-10 items-center justify-center rounded-full border border-border bg-card text-muted">
              <ChartNoAxesCombined className="size-5" aria-hidden="true" />
            </span>
            <p className="mt-3 text-sm font-semibold text-foreground-strong">
              {emptyState.title}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">
              {emptyState.description}
            </p>
            {emptyState.manageConnection ? (
              <Link
                href="/settings#instagram-publishing"
                className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-border bg-card px-3 text-xs font-semibold text-foreground-strong transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
              >
                Manage connection
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2">
        <ChartStat
          label="Visible total"
          value={formatOptionalNumber(total)}
        />
        <ChartStat
          label="Peak publish date"
          value={
            peakPoint
              ? `${formatNumber(peakPoint.value)} · ${formatShortDate(
                  peakPoint.date,
                )}`
              : "—"
          }
          textValue
        />
        <ChartStat
          label="Publish dates"
          value={`${formatNumber(availablePoints.length)} / ${formatNumber(
            points.length,
          )}`}
        />
      </dl>

      <ContentDayPickerDialog
        date={selectedContentDate}
        items={selectedDateItems}
        metric={metric}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedContentDate(null);
          }
        }}
        onSelect={(item) => {
          setSelectedContentDate(null);
          setSelectedItem(item);
        }}
        showAccountName={connectionCount > 1}
      />
      <ContentPerformanceDrawer
        item={activeSelectedItem}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedItem(null);
          }
        }}
        showAccountName={connectionCount > 1}
      />
    </div>
  );
}

function PerformanceTrendInsufficientState({
  items,
  metric,
  onViewContent,
  point,
}: {
  items: InstagramContentItem[];
  metric: PerformanceMetric;
  onViewContent: () => void;
  point: AvailablePerformanceTrendPoint;
}) {
  const metricLabel = performanceMetricLabels[metric].toLowerCase();

  return (
    <div className="min-h-[280px] overflow-hidden rounded-[var(--radius-control)] border border-border bg-card-muted/35">
      <Empty className="min-h-[280px] px-6 py-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ChartNoAxesCombined aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Not enough history to show a trend</EmptyTitle>
          <EmptyDescription>
            We recorded your first reporting day on {formatShortDate(point.date)}.
            The chart will appear after another day reports performance.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Badge variant="outline">
            {formatShortDate(point.date)}
            <span aria-hidden="true">·</span>
            {formatNumber(point.value)} {metricLabel}
          </Badge>
          {items.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onViewContent}
            >
              {items.length === 1
                ? "View post"
                : `View ${formatNumber(items.length)} posts`}
              <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Button>
          ) : null}
        </EmptyContent>
      </Empty>
    </div>
  );
}

function PerformanceContentMarker({
  active,
  chartHeight,
  chartWidth,
  items,
  metric,
  metricColor,
  onActivate,
  onSelect,
  peak,
  point,
  previewItem,
}: {
  active: boolean;
  chartHeight: number;
  chartWidth: number;
  items: InstagramContentItem[];
  metric: PerformanceMetric;
  metricColor: string;
  onActivate: (date: string | null) => void;
  onSelect: () => void;
  peak: boolean;
  point: AvailablePerformanceTrendPoint;
  previewItem: InstagramContentItem;
}) {
  const multiple = items.length > 1;
  const markerLabel = multiple
    ? `Choose from ${formatNumber(items.length)} posts published ${formatFullDate(
        point.date,
      )}`
    : `Open ${getInstagramContentTitle(previewItem)}, published ${formatFullDate(
        point.date,
      )}`;

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={markerLabel}
      className={cn(
        "absolute z-20 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full p-0 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card motion-reduce:transition-none",
        peak ? "size-11" : "size-9",
        active && "scale-105",
      )}
      onBlur={() => onActivate(null)}
      onClick={onSelect}
      onFocus={() => onActivate(point.date)}
      onPointerEnter={() => onActivate(point.date)}
      onPointerLeave={() => onActivate(null)}
      style={{
        left: `${(point.x / chartWidth) * 100}%`,
        top: `${(point.y / chartHeight) * 100}%`,
      }}
      title={markerLabel}
    >
      {multiple ? (
        <span
          className="absolute inset-0 translate-x-1 -translate-y-1 rounded-full border-2 bg-card-muted"
          style={{ borderColor: metricColor }}
          aria-hidden="true"
        />
      ) : null}
      <span
        className="relative flex size-full items-center justify-center overflow-hidden rounded-full border-2 bg-card-muted text-muted"
        style={{
          borderColor: metricColor,
          boxShadow: `0 0 0 3px ${metricColor}26, 0 7px 18px rgb(0 0 0 / 0.38)`,
        }}
        aria-hidden="true"
      >
        <ImageIcon className="size-4" />
        {previewItem.thumbnailUrl ? (
          // Instagram owns these short-lived media URLs; optimization would
          // cache expired signed URLs, so graph thumbnails render directly.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewItem.thumbnailUrl}
            alt=""
            width={48}
            height={48}
            className="absolute inset-0 size-full object-cover"
            loading="lazy"
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
            referrerPolicy="no-referrer"
          />
        ) : null}
      </span>
      {multiple ? (
        <span className="absolute -bottom-1 -right-1 flex min-w-5 items-center justify-center rounded-full border border-border-strong bg-card px-1 font-mono text-[9px] font-bold leading-4 text-foreground-strong shadow-card">
          {formatNumber(items.length)}
        </span>
      ) : null}
      <span className="sr-only">
        {formatNumber(point.value)} {performanceMetricLabels[metric].toLowerCase()}
      </span>
    </button>
  );
}

function sortContentForPerformanceMarker(
  items: InstagramContentItem[],
  metric: PerformanceMetric,
) {
  return [...items].sort((left, right) => {
    const leftValue = left.metrics[metric];
    const rightValue = right.metrics[metric];

    if (leftValue !== null || rightValue !== null) {
      return (rightValue ?? -1) - (leftValue ?? -1);
    }

    return (
      Date.parse(right.publishedAt) - Date.parse(left.publishedAt) ||
      left.id.localeCompare(right.id)
    );
  });
}

function PerformanceTrendLoadingState() {
  return (
    <div
      className="mt-6"
      aria-label="Loading performance trend"
      role="status"
    >
      <span className="sr-only">
        Loading performance trend…
      </span>
      <div className="flex h-[280px] items-end gap-2 overflow-hidden rounded-[var(--radius-control)] border border-border bg-card-muted/35 p-5">
        {[42, 64, 38, 78, 56, 84, 62, 72, 48, 68, 52, 76].map(
          (height, index) => (
            <Skeleton
              key={`${height}-${index}`}
              className="min-w-2 flex-1 rounded-t-sm"
              style={{ height: `${height}%` }}
            />
          ),
        )}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Skeleton className="h-[63px] rounded-[var(--radius-control)]" />
        <Skeleton className="h-[63px] rounded-[var(--radius-control)]" />
        <Skeleton className="h-[63px] rounded-[var(--radius-control)]" />
      </div>
    </div>
  );
}

function PerformanceTrendTooltip({
  chartHeight,
  chartWidth,
  metric,
  point,
}: {
  chartHeight: number;
  chartWidth: number;
  metric: PerformanceMetric;
  point: {
    date: string;
    value: number;
    x: number;
    y: number;
  };
}) {
  const alignClass =
    point.x < 125
      ? "translate-x-0"
      : point.x > chartWidth - 125
        ? "-translate-x-full"
        : "-translate-x-1/2";
  const verticalClass =
    point.y < 88
      ? "translate-y-3"
      : "-translate-y-[calc(100%+12px)]";

  return (
    <div
      className={cn(
        "pointer-events-none absolute z-10 min-w-32 rounded-[var(--radius-control)] border border-border-strong bg-card px-3 py-2 shadow-floating",
        alignClass,
        verticalClass,
      )}
      role="tooltip"
      style={{
        left: `${(point.x / chartWidth) * 100}%`,
        top: `${(point.y / chartHeight) * 100}%`,
      }}
    >
      <p className="text-[11px] font-medium text-muted">
        {formatFullDate(point.date)}
      </p>
      <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-foreground-strong">
        <span
          className="size-2 rounded-full"
          style={{ backgroundColor: performanceMetricColors[metric] }}
          aria-hidden="true"
        />
        <span className="font-mono tabular-nums">
          {formatNumber(point.value)}
        </span>
        <span className="text-xs font-medium text-muted">
          {performanceMetricLabels[metric].toLowerCase()}
        </span>
      </p>
    </div>
  );
}

function ChartStat({
  label,
  textValue = false,
  value,
}: {
  label: string;
  textValue?: boolean;
  value: string;
}) {
  return (
    <div className="rounded-[var(--radius-control)] border border-border bg-card-muted/40 px-3 py-2.5">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd
        className={cn(
          "mt-1 font-semibold text-foreground-strong",
          textValue ? "text-xs" : "font-mono text-sm tabular-nums",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function InstagramReadinessPanel({
  connection,
  connectionCount,
  insightAccount,
  insightsLoading,
  insightsMessage,
  needsAttention,
}: {
  connection: SocialConnection | null;
  connectionCount: number;
  insightAccount: InstagramInsightsAccount | null;
  insightsLoading: boolean;
  insightsMessage: string | null;
  needsAttention: number;
}) {
  const publishingBlockMessage = connection
    ? getConnectionPublishingBlockMessage(connection)
    : null;
  const ready = Boolean(connection && !publishingBlockMessage);
  const accountName = connection
    ? getInstagramAccountName(connection)
    : "No connected account";
  const accountHandle = connection
    ? getInstagramAccountHandle(connection)
    : null;
  const accountIdentityRepeats =
    accountHandle !== null &&
    normalizeInstagramIdentity(accountName) ===
      normalizeInstagramIdentity(accountHandle);
  const primaryAccountLabel = accountIdentityRepeats
    ? accountHandle
    : accountName;
  const secondaryAccountHandle = accountIdentityRepeats
    ? null
    : accountHandle;
  const insightsReadiness = getInstagramInsightsReadiness({
    connection,
    insightAccount,
    insightsLoading,
    insightsMessage,
  });

  return (
    <aside className="rounded-[var(--radius-panel)] border border-border bg-card p-5 shadow-card sm:p-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
          Account readiness
        </p>
        <h2 className="mt-2 text-lg font-bold tracking-[-0.02em] text-foreground-strong">
          Connected account
        </h2>
      </div>

      <div className="mt-5 rounded-[var(--radius-control)] border border-border bg-card-muted/45 p-4">
        <div className="flex min-w-0 items-center gap-3">
          {connection ? (
            <InstagramAccountAvatar
              className="size-10"
              connection={connection}
            />
          ) : (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-brand-soft ring-1 ring-inset ring-primary/10">
              <CircleUserRound className="size-5" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground-strong">
              {primaryAccountLabel}
            </p>
            {secondaryAccountHandle ? (
              <p className="mt-0.5 truncate text-xs text-muted">
                {secondaryAccountHandle}
              </p>
            ) : !connection ? (
              <p className="mt-0.5 text-xs text-muted">
                Connect through Meta in Settings.
              </p>
            ) : null}
          </div>
        </div>
        {connectionCount > 1 ? (
          <p className="mt-3 text-xs text-muted">
            +{formatNumber(connectionCount - 1)} more connected{" "}
            {connectionCount === 2 ? "account" : "accounts"}
          </p>
        ) : null}
      </div>

      <dl className="mt-5 divide-y divide-border">
        <ReadinessRow
          label="Publishing access"
          value={
            !connection
              ? "Not connected"
              : ready
                ? "Ready"
                : "Needs attention"
          }
          tone={ready ? "success" : connection ? "warning" : "muted"}
        />
        <ReadinessRow
          label="Performance insights"
          value={insightsReadiness.value}
          tone={insightsReadiness.tone}
        />
        <ReadinessRow
          label="Posts needing attention"
          value={formatNumber(needsAttention)}
          tone={needsAttention > 0 ? "warning" : "success"}
        />
      </dl>

      {insightsReadiness.message ? (
        <p className="mt-4 text-xs leading-5 text-muted">
          {insightsReadiness.message}
        </p>
      ) : null}

      {publishingBlockMessage ? (
        <Alert variant="destructive" className="mt-5" aria-live="polite">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>Account needs attention</AlertTitle>
          <AlertDescription>{publishingBlockMessage}</AlertDescription>
        </Alert>
      ) : null}

      <Link
        href="/settings#instagram-publishing"
        className={cn(
          buttonVariants({
            size: "lg",
            variant: connection ? "outline" : "default",
          }),
          "mt-5 w-full",
        )}
      >
        {insightAccount?.status === "permission_missing"
          ? "Reconnect in Settings"
          : connection
            ? "Manage connection"
            : "Connect account"}
        <ArrowRight data-icon="inline-end" aria-hidden="true" />
      </Link>
    </aside>
  );
}

function ReadinessRow({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "muted" | "success" | "warning";
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-semibold",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
          tone === "muted" && "text-muted",
        )}
      >
        <span
          className={cn(
            "size-1.5 rounded-full",
            tone === "success" && "bg-success",
            tone === "warning" && "bg-warning",
            tone === "muted" && "bg-muted-subtle",
          )}
          aria-hidden="true"
        />
        {value}
      </dd>
    </div>
  );
}

function InstagramContentPerformance({
  accounts,
  connectionCount,
  loading,
  message,
}: {
  accounts: InstagramContentAccount[];
  connectionCount: number;
  loading: boolean;
  message: string | null;
}) {
  const [filter, setFilter] =
    useState<InstagramContentFilter>("all");
  const [sort, setSort] = useState<InstagramContentSort>("views");
  const [page, setPage] = useState(0);
  const [selectedItem, setSelectedItem] =
    useState<InstagramContentItem | null>(null);
  const items = useMemo(
    () => flattenReadyInstagramContentAccounts(accounts),
    [accounts],
  );
  const filteredItems = useMemo(
    () => filterAndSortInstagramContent({ filter, items, sort }),
    [filter, items, sort],
  );
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const activePage = Math.min(page, pageCount - 1);
  const visibleItems = filteredItems.slice(
    activePage * pageSize,
    (activePage + 1) * pageSize,
  );
  const readyAccountCount = accounts.filter(
    (account) => account.status === "ready",
  ).length;
  const unavailableAccounts = accounts.filter(
    (account) => account.status !== "ready",
  );
  const showAccountName = connectionCount > 1;
  const activeSelectedItem = selectedItem
    ? items.find(
        (item) =>
          item.id === selectedItem.id &&
          item.connectionId === selectedItem.connectionId,
      ) ?? null
    : null;

  return (
    <>
      <section
        className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-card shadow-card"
        aria-busy={loading}
      >
        <header className="border-b border-border px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
                Content insights
              </p>
              <h2 className="mt-2 text-lg font-bold tracking-[-0.02em] text-foreground-strong">
                Content performance
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                Current values for posts Instagram still returns. Deleted,
                unavailable, or database-only records are not shown or counted.
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <fieldset>
                <legend className="mb-2 text-xs font-semibold text-muted">
                  Content type
                </legend>
                <div
                  className="grid grid-cols-4 rounded-[var(--radius-control)] border border-border bg-card-muted/70 p-1"
                  aria-label="Filter content type"
                >
                  {contentFilterOptions.map((option) => {
                    const selected = filter === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setFilter(option.value);
                          setPage(0);
                        }}
                        className={cn(
                          "min-h-9 rounded-[calc(var(--radius-control)-4px)] px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                          selected
                            ? "bg-card text-foreground-strong shadow-sm"
                            : "text-muted hover:text-foreground-strong",
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-muted">
                  Sort by
                </span>
                <select
                  value={sort}
                  onChange={(event) => {
                    setSort(event.target.value as InstagramContentSort);
                    setPage(0);
                  }}
                  className="h-11 w-full min-w-40 rounded-[var(--radius-control)] border border-border bg-card-muted/70 px-3 text-sm font-semibold text-foreground-strong outline-none transition-colors hover:border-foreground/20 focus:border-focus focus:ring-2 focus:ring-focus/20 lg:w-auto"
                >
                  {contentSortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {!loading &&
          readyAccountCount > 0 &&
          unavailableAccounts.length > 0 ? (
            <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-warning">
              <TriangleAlert
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              {formatNumber(unavailableAccounts.length)} connected{" "}
              {unavailableAccounts.length === 1 ? "account is" : "accounts are"}{" "}
              not included because its content insights are unavailable.
            </p>
          ) : null}
        </header>

        {loading ? (
          <ContentPerformanceLoadingState />
        ) : message ? (
          <ContentPerformanceState
            description={message}
            title="Content performance is unavailable"
          />
        ) : connectionCount === 0 ? (
          <ContentPerformanceState
            action
            description="Connect a professional account to review post-level performance."
            title="Connect an account to continue"
          />
        ) : readyAccountCount === 0 ? (
          <ContentPerformanceState
            action
            description={
              accounts[0]?.message ??
              "Reconnect your account to grant content performance access."
            }
            title="Content insights need attention"
          />
        ) : items.length === 0 ? (
          <ContentPerformanceState
            description="No posts were published in this date range. Choose a longer range when more content is available."
            title="No content in this period"
          />
        ) : filteredItems.length === 0 ? (
          <ContentPerformanceState
            description={`No ${getContentFilterLabel(filter).toLowerCase()} were published in this date range.`}
            title={`No ${getContentFilterLabel(filter).toLowerCase()} found`}
          />
        ) : (
          <>
            <ContentPerformanceDesktopTable
              items={visibleItems}
              onSelect={setSelectedItem}
              showAccountName={showAccountName}
            />
            <ContentPerformanceMobileList
              items={visibleItems}
              onSelect={setSelectedItem}
              showAccountName={showAccountName}
            />
            <ContentPerformancePagination
              activePage={activePage}
              onPageChange={setPage}
              pageCount={pageCount}
              pageSize={pageSize}
              totalItems={filteredItems.length}
            />
          </>
        )}
      </section>

      <ContentPerformanceDrawer
        item={activeSelectedItem}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedItem(null);
          }
        }}
        showAccountName={showAccountName}
      />
    </>
  );
}

function ContentPerformanceDesktopTable({
  items,
  onSelect,
  showAccountName,
}: {
  items: InstagramContentItem[];
  onSelect: (item: InstagramContentItem) => void;
  showAccountName: boolean;
}) {
  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full min-w-[1100px] border-collapse text-left">
        <thead className="bg-card-muted/55">
          <tr className="border-b border-border">
            <ContentTableHeading className="w-[300px]">
              Content
            </ContentTableHeading>
            <ContentTableHeading>Type</ContentTableHeading>
            <ContentTableHeading>Published</ContentTableHeading>
            <ContentTableHeading numeric>Views</ContentTableHeading>
            <ContentTableHeading numeric>Reach</ContentTableHeading>
            <ContentTableHeading numeric>Interactions</ContentTableHeading>
            <ContentTableHeading numeric>Saves</ContentTableHeading>
            <ContentTableHeading numeric>Shares</ContentTableHeading>
            <ContentTableHeading numeric>Interaction rate</ContentTableHeading>
            <th scope="col" className="w-14 px-3 py-3">
              <span className="sr-only">Open on Instagram</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={`${item.connectionId}:${item.id}`}
              tabIndex={0}
              aria-label={`View details for ${getInstagramContentTitle(item)}`}
              onClick={() => onSelect(item)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(item);
                }
              }}
              className="group cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-card-muted/45 focus-visible:bg-card-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
            >
              <td className="px-5 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <ContentThumbnail item={item} size="sm" />
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-semibold text-foreground-strong">
                      {getInstagramContentTitle(item)}
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted">
                      {showAccountName
                        ? getInstagramContentAccountLabel(item)
                        : item.caption
                          ? "Post caption"
                          : "No caption"}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3.5">
                <ContentTypeBadge type={item.contentType} />
              </td>
              <td className="whitespace-nowrap px-3 py-3.5 text-xs font-medium text-muted">
                {formatDateOnly(item.publishedAt)}
              </td>
              <ContentMetricCell value={item.metrics.views} />
              <ContentMetricCell value={item.metrics.reach} />
              <ContentMetricCell value={item.metrics.interactions} />
              <ContentMetricCell value={item.metrics.saves} />
              <ContentMetricCell value={item.metrics.shares} />
              <td className="whitespace-nowrap px-3 py-3.5 text-right font-mono text-xs font-semibold tabular-nums text-foreground-strong">
                {formatInteractionRate(
                  getInstagramInteractionRate(item.metrics),
                )}
              </td>
              <td className="px-3 py-3.5 text-right">
                {item.permalink ? (
                  <a
                    href={item.permalink}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${getInstagramContentTitle(item)} on Instagram`}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                    className={buttonVariants({
                      size: "icon-sm",
                      variant: "ghost",
                    })}
                  >
                    <ExternalLink aria-hidden="true" />
                  </a>
                ) : (
                  <span className="inline-flex size-8 items-center justify-center text-muted-subtle">
                    —
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContentPerformanceMobileList({
  items,
  onSelect,
  showAccountName,
}: {
  items: InstagramContentItem[];
  onSelect: (item: InstagramContentItem) => void;
  showAccountName: boolean;
}) {
  return (
    <div className="divide-y divide-border lg:hidden">
      {items.map((item) => (
        <button
          key={`${item.connectionId}:${item.id}`}
          type="button"
          onClick={() => onSelect(item)}
          className="block w-full px-5 py-4 text-left transition-colors hover:bg-card-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus sm:px-6"
        >
          <div className="flex items-start gap-3">
            <ContentThumbnail item={item} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <ContentTypeBadge type={item.contentType} />
                <ChevronRight
                  className="size-4 shrink-0 text-muted-subtle"
                  aria-hidden="true"
                />
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-foreground-strong">
                {getInstagramContentTitle(item)}
              </p>
              {showAccountName ? (
                <p className="mt-1 truncate text-xs text-muted">
                  {getInstagramContentAccountLabel(item)}
                </p>
              ) : null}
              <p className="mt-2 text-xs font-medium text-muted">
                {formatOptionalNumber(item.metrics.views)}{" "}
                {item.metrics.views === 1 ? "view" : "views"}
                <span aria-hidden="true"> · </span>
                {formatOptionalNumber(item.metrics.interactions)}{" "}
                {item.metrics.interactions === 1
                  ? "interaction"
                  : "interactions"}
              </p>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
            <ContentMobileMetric
              label="Reach"
              value={item.metrics.reach}
            />
            <ContentMobileMetric
              label="Saves"
              value={item.metrics.saves}
            />
            <ContentMobileMetric
              label="Shares"
              value={item.metrics.shares}
            />
          </dl>
        </button>
      ))}
    </div>
  );
}

function ContentPerformancePagination({
  activePage,
  onPageChange,
  pageCount,
  pageSize,
  totalItems,
}: {
  activePage: number;
  onPageChange: (page: number) => void;
  pageCount: number;
  pageSize: number;
  totalItems: number;
}) {
  if (pageCount <= 1) {
    return null;
  }

  const firstItem = activePage * pageSize + 1;
  const lastItem = Math.min((activePage + 1) * pageSize, totalItems);

  return (
    <div className="flex flex-col gap-3 border-t border-border bg-card-muted/25 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <p className="text-xs font-medium text-muted">
        Showing {formatNumber(firstItem)}–{formatNumber(lastItem)} of{" "}
        {formatNumber(totalItems)}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={activePage === 0}
          onClick={() => onPageChange(activePage - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={activePage >= pageCount - 1}
          onClick={() => onPageChange(activePage + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function ContentDayPickerDialog({
  date,
  items,
  metric,
  onOpenChange,
  onSelect,
  showAccountName,
}: {
  date: string | null;
  items: InstagramContentItem[];
  metric: PerformanceMetric;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: InstagramContentItem) => void;
  showAccountName: boolean;
}) {
  return (
    <Dialog open={Boolean(date && items.length > 1)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(80dvh,640px)] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-5 py-5 pr-14 sm:px-6">
          <DialogTitle className="text-lg font-bold leading-6 tracking-[-0.02em] text-foreground-strong">
            Posts from {formatFullDate(date ?? "")}
          </DialogTitle>
          <DialogDescription className="text-sm leading-6 text-muted">
            {formatNumber(items.length)} posts were published on this day. Select
            one to view its exact content metrics and preview.
          </DialogDescription>
        </DialogHeader>

        <ul className="flex min-h-0 flex-col gap-2 overflow-y-auto overscroll-contain p-3 sm:p-4">
          {items.map((item) => (
            <li key={`${item.connectionId}:${item.id}`}>
              <button
                type="button"
                className="flex min-h-20 w-full items-center gap-3 rounded-[var(--radius-control)] border border-border bg-card p-3 text-left transition-[border-color,background-color,box-shadow] hover:border-border-strong hover:bg-card-muted/45 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                onClick={() => onSelect(item)}
              >
                <ContentThumbnail item={item} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <ContentTypeBadge type={item.contentType} />
                    {showAccountName ? (
                      <span className="truncate text-[11px] font-medium text-muted-subtle">
                        {getInstagramContentAccountLabel(item)}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-2 line-clamp-1 block text-sm font-semibold text-foreground-strong">
                    {getInstagramContentTitle(item)}
                  </span>
                  <span className="mt-1 block text-xs text-muted">
                    {formatDateTime(item.publishedAt)}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-sm font-semibold tabular-nums text-foreground-strong">
                    {formatOptionalNumber(item.metrics[metric])}
                  </span>
                  <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-subtle">
                    {performanceMetricLabels[metric]}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function ContentPerformanceDrawer({
  item,
  onOpenChange,
  showAccountName,
}: {
  item: InstagramContentItem | null;
  onOpenChange: (open: boolean) => void;
  showAccountName: boolean;
}) {
  const interactionRate = item
    ? getInstagramInteractionRate(item.metrics)
    : null;

  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent className="bottom-0 left-0 top-auto flex h-[min(88dvh,760px)] max-h-[88dvh] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-[var(--radius-panel)] border border-border bg-card p-0 sm:bottom-auto sm:left-auto sm:right-0 sm:top-0 sm:h-dvh sm:max-h-none sm:w-[480px] sm:max-w-[calc(100%-2rem)] sm:translate-x-0 sm:translate-y-0 sm:rounded-none sm:border-y-0 sm:border-r-0">
        {item ? (
          <>
            <DialogHeader className="border-b border-border px-5 py-5 pr-14 sm:px-6">
              <div className="flex items-start gap-4">
                <ContentThumbnail item={item} size="lg" />
                <div className="min-w-0">
                  <ContentTypeBadge type={item.contentType} />
                  <DialogTitle className="mt-3 line-clamp-2 text-lg font-bold leading-6 tracking-[-0.02em] text-foreground-strong">
                    {getInstagramContentTitle(item)}
                  </DialogTitle>
                  <DialogDescription className="mt-1 text-xs leading-5 text-muted">
                    Published {formatDateTime(item.publishedAt)}
                    {showAccountName
                      ? ` · ${getInstagramContentAccountLabel(item)}`
                      : ""}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
              <section aria-labelledby="content-metric-breakdown">
                <p
                  id="content-metric-breakdown"
                  className="text-xs font-bold uppercase tracking-[0.12em] text-primary"
                >
                  Metric breakdown
                </p>
                <dl className="mt-3 divide-y divide-border rounded-[var(--radius-control)] border border-border bg-card-muted/35 px-4">
                  <DrawerMetric
                    icon={<Eye aria-hidden="true" />}
                    label="Views"
                    value={formatOptionalNumber(item.metrics.views)}
                  />
                  <DrawerMetric
                    icon={<ChartNoAxesCombined aria-hidden="true" />}
                    label="Reach"
                    value={formatOptionalNumber(item.metrics.reach)}
                  />
                  <DrawerMetric
                    icon={<Heart aria-hidden="true" />}
                    label="Interactions"
                    value={formatOptionalNumber(item.metrics.interactions)}
                  />
                  <DrawerMetric
                    icon={<Bookmark aria-hidden="true" />}
                    label="Saves"
                    value={formatOptionalNumber(item.metrics.saves)}
                  />
                  <DrawerMetric
                    icon={<Share2 aria-hidden="true" />}
                    label="Shares"
                    value={formatOptionalNumber(item.metrics.shares)}
                  />
                  <DrawerMetric
                    icon={<Heart aria-hidden="true" />}
                    label="Likes"
                    value={formatOptionalNumber(item.metrics.likes)}
                  />
                  <DrawerMetric
                    icon={<MessageCircle aria-hidden="true" />}
                    label="Comments"
                    value={formatOptionalNumber(item.metrics.comments)}
                  />
                  <DrawerMetric
                    icon={<ChartNoAxesCombined aria-hidden="true" />}
                    label="Interaction rate"
                    value={formatInteractionRate(interactionRate)}
                  />
                </dl>
              </section>

              <section className="mt-6" aria-labelledby="content-caption">
                <p
                  id="content-caption"
                  className="text-xs font-bold uppercase tracking-[0.12em] text-primary"
                >
                  Caption
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">
                  {item.caption || "No caption was returned for this post."}
                </p>
              </section>
            </div>

            <footer className="border-t border-border bg-card px-5 py-4 sm:px-6">
              {item.permalink ? (
                <a
                  href={item.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    buttonVariants({ size: "lg", variant: "default" }),
                    "w-full",
                  )}
                >
                  Open on Instagram
                  <ExternalLink data-icon="inline-end" aria-hidden="true" />
                </a>
              ) : (
                <p className="text-center text-xs leading-5 text-muted">
                  A public link was not returned for this post.
                </p>
              )}
            </footer>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ContentPerformanceLoadingState() {
  return (
    <div
      className="divide-y divide-border"
      role="status"
      aria-label="Loading content performance"
    >
      <span className="sr-only">Loading content performance…</span>
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-center gap-3 px-5 py-4 sm:px-6">
          <Skeleton className="h-14 w-12 shrink-0 rounded-[var(--radius-control)]" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-56 max-w-full" />
            <Skeleton className="mt-2 h-3 w-36 max-w-[70%]" />
          </div>
          <Skeleton className="hidden h-7 w-20 rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}

function ContentPerformanceState({
  action = false,
  description,
  title,
}: {
  action?: boolean;
  description: string;
  title: string;
}) {
  return (
    <div className="px-5 py-10 text-center sm:px-6 sm:py-12">
      <span className="mx-auto flex size-11 items-center justify-center rounded-[var(--radius-control)] bg-card-muted text-muted">
        <ChartNoAxesCombined className="size-5" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-sm font-semibold text-foreground-strong">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">
        {description}
      </p>
      {action ? (
        <Link
          href="/settings#instagram-publishing"
          className={cn(
            buttonVariants({ size: "lg", variant: "outline" }),
            "mt-5",
          )}
        >
          Manage connection
          <ArrowRight data-icon="inline-end" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

function ContentThumbnail({
  item,
  size,
}: {
  item: InstagramContentItem;
  size: "lg" | "md" | "sm";
}) {
  const [failedThumbnailUrl, setFailedThumbnailUrl] = useState<string | null>(
    null,
  );
  const sizeClassName =
    size === "lg"
      ? "h-20 w-16"
      : size === "md"
        ? "h-[72px] w-14"
        : "h-14 w-11";
  const fallbackIcon =
    item.contentType === "reel" ? (
      <Film className="size-5" aria-hidden="true" />
    ) : item.contentType === "carousel" ? (
      <Images className="size-5" aria-hidden="true" />
    ) : (
      <ImageIcon className="size-5" aria-hidden="true" />
    );

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-control)] border border-border bg-card-muted text-muted",
        sizeClassName,
      )}
      aria-hidden="true"
    >
      {item.thumbnailUrl && failedThumbnailUrl !== item.thumbnailUrl ? (
        // Instagram owns these short-lived media URLs; optimization would cache
        // stale signed URLs, so the analytics thumbnail is rendered directly.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.thumbnailUrl}
          alt=""
          width={96}
          height={120}
          className="size-full object-cover"
          loading="lazy"
          onError={() => setFailedThumbnailUrl(item.thumbnailUrl)}
          referrerPolicy="no-referrer"
        />
      ) : (
        fallbackIcon
      )}
    </span>
  );
}

function ContentTypeBadge({ type }: { type: InstagramContentType }) {
  const icon =
    type === "reel" ? (
      <Film aria-hidden="true" />
    ) : type === "carousel" ? (
      <Images aria-hidden="true" />
    ) : (
      <ImageIcon aria-hidden="true" />
    );

  return (
    <Badge
      variant="outline"
      className={cn(
        "w-fit",
        type === "reel" && "border-instagram-rose/25 bg-instagram-rose/8 text-instagram-rose",
        type === "carousel" &&
          "border-instagram-violet/25 bg-instagram-violet/8 text-instagram-violet",
        type === "post" && "border-primary/25 bg-primary/8 text-primary",
      )}
    >
      {icon}
      {contentTypeLabels[type]}
    </Badge>
  );
}

function ContentTableHeading({
  children,
  className,
  numeric = false,
}: {
  children: ReactNode;
  className?: string;
  numeric?: boolean;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap px-3 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-muted",
        numeric && "text-right",
        className,
      )}
    >
      {children}
    </th>
  );
}

function ContentMetricCell({ value }: { value: number | null }) {
  return (
    <td className="whitespace-nowrap px-3 py-3.5 text-right font-mono text-xs font-semibold tabular-nums text-foreground-strong">
      {formatOptionalNumber(value)}
    </td>
  );
}

function ContentMobileMetric({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-subtle">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-xs font-semibold tabular-nums text-foreground-strong">
        {formatOptionalNumber(value)}
      </dd>
    </div>
  );
}

function DrawerMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="flex items-center gap-2 text-sm font-medium text-muted [&>svg]:size-4 [&>svg]:text-muted-subtle">
        {icon}
        {label}
      </dt>
      <dd className="font-mono text-sm font-semibold tabular-nums text-foreground-strong">
        {value}
      </dd>
    </div>
  );
}

function AnalyticsLoadingState() {
  return (
    <div
      className="space-y-5"
      aria-label="Loading analytics"
      role="status"
    >
      <span className="sr-only">Loading analytics…</span>
      <Skeleton className="h-10 w-64 max-w-full rounded-[var(--radius-control)]" />
      <div className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-card p-5 sm:p-6">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="mt-3 h-6 w-72 max-w-full" />
        <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton
              key={item}
              className="h-28 rounded-[var(--radius-control)]"
            />
          ))}
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.7fr)]">
        <Skeleton className="h-[420px] rounded-[var(--radius-panel)]" />
        <Skeleton className="h-[420px] rounded-[var(--radius-panel)]" />
      </div>
    </div>
  );
}

function AnalyticsErrorState({
  message,
  onRetry,
}: {
  message: string | null;
  onRetry: () => void;
}) {
  return (
    <section
      className="rounded-[var(--radius-panel)] border border-border bg-card p-5 shadow-card sm:p-7"
      role="alert"
    >
      <div className="flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-destructive/10 text-destructive">
          <AlertCircle className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-[-0.02em] text-foreground-strong">
            Analytics could not load
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
            {message ??
              "Refresh to try again. Your account and publishing records were not changed."}
          </p>
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button type="button" size="lg" onClick={onRetry}>
          <RefreshCw data-icon="inline-start" aria-hidden="true" />
          Try again
        </Button>
        <Link
          href="/settings#instagram-publishing"
          className={buttonVariants({ size: "lg", variant: "outline" })}
        >
          Manage connection
          <ArrowRight data-icon="inline-end" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function splitPerformanceTrendSegments(
  points: PositionedPerformanceTrendPoint[],
) {
  const segments: AvailablePerformanceTrendPoint[][] = [];
  let currentSegment: AvailablePerformanceTrendPoint[] = [];

  for (const point of points) {
    if (point.value === null) {
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
        currentSegment = [];
      }

      continue;
    }

    currentSegment.push({
      ...point,
      value: point.value,
    });
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
}

function getPerformanceTrendEmptyState({
  connectionCount,
  insightSnapshot,
  insightsMessage,
  metric,
}: {
  connectionCount: number;
  insightSnapshot: InstagramInsightSnapshot;
  insightsMessage: string | null;
  metric: PerformanceMetric;
}) {
  if (connectionCount === 0) {
    return {
      description:
        "Connect a professional account to load real performance insights.",
      manageConnection: true,
      title: "Connect an account to see performance",
    };
  }

  if (insightSnapshot.permissionMissing) {
    return {
      description:
        "Reconnect once after Insights access is approved to grant the required permission.",
      manageConnection: true,
      title: "Insights permission is required",
    };
  }

  if (insightsMessage || insightSnapshot.hasUnavailableAccounts) {
    return {
      description:
        insightsMessage ??
        "Refresh the page or check the account connection in Settings.",
      manageConnection: false,
      title: "Performance trend is unavailable",
    };
  }

  const metricLabel = performanceMetricLabels[metric].toLowerCase();

  if (insightSnapshot[metric] !== null) {
    return {
      description: `Instagram returned a current ${metricLabel} total, but no matching publish-date value for this range.`,
      manageConnection: false,
      title: "Publish-date values are unavailable",
    };
  }

  return {
    description: `Instagram returned no current ${metricLabel} values for posts published in this period.`,
    manageConnection: false,
    title: `No ${metricLabel} data for this period`,
  };
}

function buildInstagramVisibleContentSnapshot(
  accounts: InstagramContentAccount[],
  totalAccountCount: number,
): InstagramVisibleContentSnapshot {
  const summary = summarizeInstagramContentPerformance(accounts);
  const readyAccountCount = accounts.filter(
    (account) => account.status === "ready",
  ).length;

  return {
    hasUnavailableAccounts: accounts.some(
      (account) =>
        account.status === "error" ||
        account.status === "unavailable",
    ),
    interactions: summary.interactions,
    permissionMissing: accounts.some(
      (account) => account.status === "permission_missing",
    ),
    publishedPosts: summary.posts,
    reach: summary.reach,
    readyAccountCount,
    totalAccountCount,
    views: summary.views,
  };
}

function getContentMetricSource({
  contentSnapshot,
  contentLoading,
  contentMessage,
}: {
  contentSnapshot: InstagramVisibleContentSnapshot;
  contentLoading: boolean;
  contentMessage: string | null;
}) {
  if (contentLoading) {
    return "Loading Instagram posts…";
  }

  if (contentSnapshot.readyAccountCount > 0) {
    if (
      contentSnapshot.readyAccountCount <
      contentSnapshot.totalAccountCount
    ) {
      return `${formatNumber(
        contentSnapshot.readyAccountCount,
      )} of ${formatNumber(contentSnapshot.totalAccountCount)} accounts loaded`;
    }

    return contentSnapshot.readyAccountCount === 1
      ? "Current Instagram posts"
      : `${formatNumber(
          contentSnapshot.readyAccountCount,
        )} connected accounts`;
  }

  if (contentSnapshot.totalAccountCount === 0) {
    return "Connect an account to load posts";
  }

  if (contentSnapshot.permissionMissing) {
    return "Reconnect to enable content insights";
  }

  if (contentSnapshot.hasUnavailableAccounts) {
    return "Instagram posts unavailable for this account";
  }

  if (contentMessage) {
    return "Instagram posts temporarily unavailable";
  }

  return "No Instagram posts for this period";
}

function getInstagramInsightsReadiness({
  connection,
  insightAccount,
  insightsLoading,
  insightsMessage,
}: {
  connection: SocialConnection | null;
  insightAccount: InstagramInsightsAccount | null;
  insightsLoading: boolean;
  insightsMessage: string | null;
}): {
  message: string | null;
  tone: "muted" | "success" | "warning";
  value: string;
} {
  if (!connection) {
    return {
      message: null,
      tone: "muted",
      value: "Not connected",
    };
  }

  if (insightsLoading) {
    return {
      message: null,
      tone: "muted",
      value: "Syncing",
    };
  }

  if (insightsMessage) {
    return {
      message: insightsMessage,
      tone: "warning",
      value: "Unavailable",
    };
  }

  if (!insightAccount) {
    return {
      message: "The insights service did not return an account.",
      tone: "warning",
      value: "Unavailable",
    };
  }

  if (insightAccount.status === "ready") {
    return {
      message: insightAccount.message,
      tone: "success",
      value: "Synced",
    };
  }

  if (insightAccount.status === "permission_missing") {
    return {
      message: insightAccount.message,
      tone: "warning",
      value: "Reconnect required",
    };
  }

  return {
    message: insightAccount.message,
    tone: "warning",
    value:
      insightAccount.status === "error"
        ? "Try again"
        : "Unavailable",
  };
}

function getPrimaryInstagramConnection(connections: SocialConnection[]) {
  return (
    connections.find(
      (connection) => !getConnectionPublishingBlockMessage(connection),
    ) ??
    connections[0] ??
    null
  );
}

function getInstagramAccountName(connection: SocialConnection) {
  return (
    connection.platformAccountName ||
    connection.platformAccountUsername ||
    "Professional account"
  );
}

function getInstagramAccountHandle(connection: SocialConnection) {
  const username = connection.platformAccountUsername?.trim();

  if (!username) {
    return null;
  }

  return username.startsWith("@") ? username : `@${username}`;
}

function normalizeInstagramIdentity(value: string) {
  return value.trim().replace(/^@/, "").toLowerCase();
}

function getDateRangeKeys(days: DateRangeDays) {
  const today = startOfDay(new Date());

  return Array.from({ length: days }, (_, index) =>
    toDateKey(addDays(today, index - (days - 1))),
  );
}

function getLocalPublishedDateKey(publishedAt: string) {
  const date = new Date(publishedAt);

  return Number.isNaN(date.getTime()) ? null : toDateKey(date);
}

function getRangeLabel(rangeKeys: string[]) {
  const first = rangeKeys[0];
  const last = rangeKeys.at(-1);

  if (!first || !last) {
    return "Selected period";
  }

  return `${formatShortDate(first)} – ${formatShortDate(last)}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function formatShortDate(dateKey: string) {
  const date = parseDateKey(dateKey);

  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(date);
}

function formatFullDate(dateKey: string) {
  const date = parseDateKey(dateKey);

  if (!date) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(date);
}

function getContentFilterLabel(filter: InstagramContentFilter) {
  if (filter === "all") {
    return "content";
  }

  if (filter === "reel") {
    return "Reels";
  }

  if (filter === "carousel") {
    return "carousels";
  }

  return "posts";
}

function getInstagramContentAccountLabel(item: InstagramContentItem) {
  const username = item.accountUsername?.trim().replace(/^@/, "");

  if (username) {
    return `@${username}`;
  }

  return item.accountName?.trim() || "Connected account";
}

function formatDateOnly(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: value >= 10000 ? 1 : 0,
  }).format(value);
}

function formatOptionalNumber(value: number | null) {
  return value === null ? "—" : formatNumber(value);
}

function formatInteractionRate(value: number | null) {
  return value === null
    ? "—"
    : new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 1,
        minimumFractionDigits: 0,
        style: "percent",
      }).format(value / 100);
}

function buildSmoothPath(
  points: Array<{
    x: number;
    y: number;
  }>,
) {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  const smoothing = 0.18;
  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const previous = points[index - 1] ?? current;
    const afterNext = points[index + 2] ?? next;
    const firstControlX =
      current.x + (next.x - previous.x) * smoothing;
    const firstControlY =
      current.y + (next.y - previous.y) * smoothing;
    const secondControlX =
      next.x - (afterNext.x - current.x) * smoothing;
    const secondControlY =
      next.y - (afterNext.y - current.y) * smoothing;

    path += ` C ${firstControlX} ${firstControlY}, ${secondControlX} ${secondControlY}, ${next.x} ${next.y}`;
  }

  return path;
}
