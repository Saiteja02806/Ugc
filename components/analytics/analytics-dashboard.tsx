"use client";

import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Clock3,
  Eye,
  Heart,
  ListChecks,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Share2,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { SidebarIcon } from "@/components/icons/sidebar-icon";
import { SocialPlatformIcon } from "@/components/social/platform-icon";
import { buttonClassName } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { runAnalyticsBackgroundSync } from "@/lib/analytics/background-sync-client";
import {
  schedulePlatforms,
  type ScheduledPost,
  type ScheduledPostTarget,
} from "@/lib/scheduling/types";
import type {
  SocialConnection,
  SocialConnectionStatus,
  SocialPlatform,
} from "@/lib/social/types";

export {
  InstagramAnalyticsWorkspace as AnalyticsDashboard,
} from "@/components/analytics/instagram-analytics-workspace";

type AnalyticsLoadState = "error" | "loading" | "ready";

type ConnectionsResponse = {
  connections?: SocialConnection[];
  message?: string;
  ok?: boolean;
};

type SchedulesResponse = {
  message?: string;
  ok?: boolean;
  schedules?: ScheduledPost[];
};

type TikTokAnalyticsResponse = {
  accounts?: TikTokAnalyticsAccount[];
  message?: string;
  ok?: boolean;
};

type TikTokAnalyticsAccountStatus =
  | "error"
  | "permission_missing"
  | "ready"
  | "unavailable";

type TikTokAnalyticsVideo = {
  commentCount: number | null;
  coverImageUrl: string | null;
  createdAt: string | null;
  description: string | null;
  id: string;
  likeCount: number | null;
  shareCount: number | null;
  shareUrl: string | null;
  title: string | null;
  viewCount: number | null;
};

type TikTokAnalyticsAccount = {
  accountName: string | null;
  accountUsername: string | null;
  connectionId: string;
  lastSyncedAt: string | null;
  message: string | null;
  status: TikTokAnalyticsAccountStatus;
  videos: TikTokAnalyticsVideo[];
};

type DateRangeDays = 7 | 30 | 90;

type MetricKey = "comments" | "likes" | "posts" | "shares" | "views";

type PerformanceMetricKey = Exclude<MetricKey, "posts">;

type DistributionMode = "account" | "contentType" | "platform";

type MetricTotals = Record<MetricKey, number>;

type MetricBucket = MetricTotals & {
  dateKey: string;
};

type AccountInsightRow = {
  connectionId: string;
  lastSyncedAt: string | null;
  message: string | null;
  name: string;
  platform: SocialPlatform;
  status: "connected" | "permission_missing" | "ready" | "unavailable";
  totals: MetricTotals;
};

type PlatformInsightRow = {
  metricAccess: boolean;
  platform: SocialPlatform;
  totals: MetricTotals;
};

type ContentTypeInsightRow = {
  label: string;
  message: string;
  totals: MetricTotals;
};

const dateRangeOptions: Array<{ days: DateRangeDays; label: string }> = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "Quarter" },
];

const metricLabels: Record<MetricKey, string> = {
  comments: "Comments",
  likes: "Likes",
  posts: "Posts",
  shares: "Shares",
  views: "Views",
};

const performanceMetricKeys: PerformanceMetricKey[] = [
  "views",
  "likes",
  "comments",
  "shares",
];

const allMetricKeys: MetricKey[] = [
  "views",
  "likes",
  "comments",
  "shares",
  "posts",
];

const emptyTotals: MetricTotals = {
  comments: 0,
  likes: 0,
  posts: 0,
  shares: 0,
  views: 0,
};

const platformLabels: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

const connectionStatusLabels: Record<SocialConnectionStatus, string> = {
  connected: "Connected",
  error: "Connection error",
  expired: "Expired",
  permission_missing: "Permission needed",
  revoked: "Access revoked",
};

/**
 * Dormant multi-platform analytics workspace retained for the later data
 * migration. The user-facing Analytics route now renders the Instagram-only
 * workspace. TikTok fetching and aggregation remain intact here instead of
 * being deleted.
 */
export function DormantMultiPlatformAnalyticsDashboard() {
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [schedules, setSchedules] = useState<ScheduledPost[]>([]);
  const [tiktokAnalyticsAccounts, setTikTokAnalyticsAccounts] = useState<
    TikTokAnalyticsAccount[]
  >([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dateRangeDays, setDateRangeDays] = useState<DateRangeDays>(30);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>("views");
  const [distributionMode, setDistributionMode] =
    useState<DistributionMode>("platform");
  const [loadState, setLoadState] = useState<AnalyticsLoadState>("loading");

  const loadAnalytics = useCallback(async (signal?: AbortSignal) => {
    try {
      const token = await getCurrentUserIdToken();

      if (signal?.aborted) {
        return;
      }

      if (!token) {
        setConnections([]);
        setSchedules([]);
        setTikTokAnalyticsAccounts([]);
        setErrorMessage(null);
        setLoadState("ready");
        return;
      }

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [connectionsResponse, schedulesResponse, tiktokAnalyticsOutput] =
        await Promise.all([
          fetch("/api/social/connections", {
            cache: "no-store",
            headers,
            signal,
          }),
          fetch("/api/schedules", {
            cache: "no-store",
            headers,
            signal,
          }),
          runAnalyticsBackgroundSync({
            signal,
            token,
            url: "/api/analytics/tiktok/videos",
          }),
        ]);

      const connectionsData = (await connectionsResponse
        .json()
        .catch(() => null)) as ConnectionsResponse | null;
      const schedulesData = (await schedulesResponse
        .json()
        .catch(() => null)) as SchedulesResponse | null;
      const tiktokAnalyticsData =
        tiktokAnalyticsOutput as TikTokAnalyticsResponse | null;

      if (signal?.aborted) {
        return;
      }

      if (!connectionsResponse.ok || !connectionsData?.ok) {
        throw new Error(
          connectionsData?.message || "We could not load your connected accounts.",
        );
      }

      if (!schedulesResponse.ok || !schedulesData?.ok) {
        throw new Error(
          schedulesData?.message || "We could not load your publishing activity.",
        );
      }

      setConnections(
        Array.isArray(connectionsData.connections) ? connectionsData.connections : [],
      );
      setSchedules(Array.isArray(schedulesData.schedules) ? schedulesData.schedules : []);
      setTikTokAnalyticsAccounts(
        Array.isArray(tiktokAnalyticsData?.accounts)
          ? tiktokAnalyticsData.accounts
          : [],
      );
      setErrorMessage(null);
      setLoadState("ready");
    } catch (error) {
      if (signal?.aborted) {
        return;
      }

      setErrorMessage(
        error instanceof Error ? error.message : "We could not load analytics.",
      );
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        void loadAnalytics(controller.signal);
      }
    });

    return () => controller.abort();
  }, [loadAnalytics]);

  const retryAnalytics = useCallback(() => {
    setErrorMessage(null);
    setLoadState("loading");
    void loadAnalytics();
  }, [loadAnalytics]);

  const analytics = useMemo(
    () =>
      buildAnalyticsSummary({
        connections,
        dateRangeDays,
        schedules,
        tiktokAnalyticsAccounts,
      }),
    [connections, dateRangeDays, schedules, tiktokAnalyticsAccounts],
  );

  return (
    <section className="min-h-dvh flex-1 bg-background px-4 py-5 text-foreground sm:px-6 lg:px-8 lg:py-7 xl:px-10">
      <div className="mx-auto w-full max-w-[1360px]">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-control bg-brand-soft text-primary">
              <SidebarIcon name="analytics" className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-[28px] font-semibold leading-tight tracking-normal text-foreground-strong sm:text-[30px]">
                Analytics
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
                Track content performance across connected publishing accounts.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex w-fit items-center gap-2 text-xs font-semibold text-muted">
              <ShieldCheck className="size-4 text-success" aria-hidden="true" />
              Real data only
            </span>
            <button
              type="button"
              onClick={retryAnalytics}
              className={buttonClassName({
                className: "h-9 gap-2 px-3 text-xs",
                variant: "secondary",
              })}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Refresh analytics
            </button>
          </div>
        </header>

        <div className="mt-6" aria-live="polite">
          {loadState === "loading" ? <AnalyticsLoadingState /> : null}
          {loadState === "error" ? (
            <AnalyticsErrorState message={errorMessage} onRetry={retryAnalytics} />
          ) : null}
          {loadState === "ready" ? (
            <AnalyticsReadyState
              analytics={analytics}
              connections={connections}
              dateRangeDays={dateRangeDays}
              distributionMode={distributionMode}
              onDateRangeChange={setDateRangeDays}
              onDistributionModeChange={setDistributionMode}
              onMetricChange={setSelectedMetric}
              selectedMetric={selectedMetric}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function AnalyticsReadyState({
  analytics,
  connections,
  dateRangeDays,
  distributionMode,
  onDateRangeChange,
  onDistributionModeChange,
  onMetricChange,
  selectedMetric,
}: {
  analytics: AnalyticsSummary;
  connections: SocialConnection[];
  dateRangeDays: DateRangeDays;
  distributionMode: DistributionMode;
  onDateRangeChange: (days: DateRangeDays) => void;
  onDistributionModeChange: (mode: DistributionMode) => void;
  onMetricChange: (metric: MetricKey) => void;
  selectedMetric: MetricKey;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted shadow-card">
          <Clock3 className="size-4" aria-hidden="true" />
          {analytics.rangeLabel}
        </span>
        <DateRangeSelector
          selectedDays={dateRangeDays}
          onChange={onDateRangeChange}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          icon={<Eye className="size-4" aria-hidden="true" />}
          label="Total Views"
          sourceLabel={analytics.performanceAccessLabel}
          value={getDisplayMetricValue({
            available: analytics.hasPerformanceAccess,
            value: analytics.totals.views,
          })}
        />
        <MetricCard
          icon={<Heart className="size-4" aria-hidden="true" />}
          label="Total Likes"
          sourceLabel={analytics.performanceAccessLabel}
          value={getDisplayMetricValue({
            available: analytics.hasPerformanceAccess,
            value: analytics.totals.likes,
          })}
        />
        <MetricCard
          icon={<MessageCircle className="size-4" aria-hidden="true" />}
          label="Total Comments"
          sourceLabel={analytics.performanceAccessLabel}
          value={getDisplayMetricValue({
            available: analytics.hasPerformanceAccess,
            value: analytics.totals.comments,
          })}
        />
        <MetricCard
          icon={<Share2 className="size-4" aria-hidden="true" />}
          label="Total Shares"
          sourceLabel={analytics.performanceAccessLabel}
          value={getDisplayMetricValue({
            available: analytics.hasPerformanceAccess,
            value: analytics.totals.shares,
          })}
        />
        <MetricCard
          icon={<ListChecks className="size-4" aria-hidden="true" />}
          label="Total Posts"
          sourceLabel="UGC Pilot schedule records"
          value={formatMetricNumber(analytics.totals.posts)}
        />
      </div>

      <AnalyticsPanel
        actions={
          <MetricSelector selectedMetric={selectedMetric} onChange={onMetricChange} />
        }
        eyebrow="Cumulative growth"
        title="Cumulative Growth"
        description="Total accumulated over the selected period from available real records."
      >
        <MetricLineChart
          buckets={analytics.cumulativeBuckets}
          emptyMessage={
            selectedMetric === "posts"
              ? "No scheduled posts in this period."
              : analytics.emptyChartMessage
          }
          metricKey={selectedMetric}
        />
      </AnalyticsPanel>

      <AnalyticsPanel
        actions={
          <MetricSelector selectedMetric={selectedMetric} onChange={onMetricChange} />
        }
        eyebrow="Growth per day"
        title="Growth Per Day"
        description="Daily movement for the selected metric using available account data."
      >
        <MetricLineChart
          buckets={analytics.dailyBuckets}
          emptyMessage={
            selectedMetric === "posts"
              ? "No scheduled posts in this period."
              : analytics.emptyChartMessage
          }
          metricKey={selectedMetric}
        />
      </AnalyticsPanel>

      <AnalyticsPanel
        eyebrow="By account"
        title="By Account"
        description="Engagement and publishing data grouped by connected account."
      >
        <AccountInsightList rows={analytics.accountRows} />
      </AnalyticsPanel>

      <div className="grid gap-5 xl:grid-cols-2">
        <AnalyticsPanel
          eyebrow="By platform"
          title="By Platform"
          description="Views distribution across connected publishing channels."
        >
          <InsightBreakdownList
            emptyTitle="No platform metric data yet"
            rows={analytics.platformRows.map((row) => ({
              id: row.platform,
              label: platformLabels[row.platform],
              metricAccess: row.metricAccess,
              totals: row.totals,
              visual: (
                <SocialPlatformIcon platform={row.platform} className="size-5" />
              ),
            }))}
            selectedMetric={selectedMetric}
          />
        </AnalyticsPanel>

        <AnalyticsPanel
          eyebrow="By content type"
          title="By Content Type"
          description="Metrics grouped by the content formats we can verify."
        >
          <InsightBreakdownList
            emptyTitle="No content type data yet"
            rows={analytics.contentTypeRows.map((row) => ({
              id: row.label,
              label: row.label,
              message: row.message,
              metricAccess: true,
              totals: row.totals,
              visual: <BarChart3 className="size-5" aria-hidden="true" />,
            }))}
            selectedMetric={selectedMetric}
          />
        </AnalyticsPanel>
      </div>

      <AnalyticsPanel
        actions={
          <DistributionSelector
            mode={distributionMode}
            onChange={onDistributionModeChange}
          />
        }
        eyebrow="Views distribution"
        title={`${metricLabels[selectedMetric]} Distribution`}
        description={`${metricLabels[selectedMetric]} distribution by ${getDistributionLabel(
          distributionMode,
        ).toLowerCase()}.`}
      >
        <DistributionBars
          mode={distributionMode}
          rows={getDistributionRows({
            analytics,
            mode: distributionMode,
            selectedMetric,
          })}
          selectedMetric={selectedMetric}
        />
      </AnalyticsPanel>

      <ConnectedAccountsDisclosure connections={connections} />

      <div className="flex items-start gap-2.5 px-1 text-xs leading-5 text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-subtle" aria-hidden="true" />
        <p>
          No sample numbers are shown here. Views, likes, comments, and shares appear
          only for accounts with granted analytics access.
        </p>
      </div>
    </div>
  );
}

function AnalyticsLoadingState() {
  return (
    <div className="space-y-5" aria-label="Loading analytics" role="status">
      <div className="rounded-card border border-border bg-card p-5 shadow-card sm:p-6">
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-64 max-w-full" />
          <Skeleton className="h-4 w-full max-w-2xl" />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-24 rounded-card" />
          ))}
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.8fr)]">
        <Skeleton className="h-[380px] rounded-card" />
        <Skeleton className="h-[380px] rounded-card" />
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
    <div className="rounded-card border border-border bg-card p-5 shadow-card sm:p-7">
      <StateHeading
        icon={<AlertCircle className="size-5" aria-hidden="true" />}
        iconClassName="bg-destructive/10 text-destructive"
        title="Analytics could not load"
        description={
          message || "We could not load your publishing activity. Your account data was not changed."
        }
      />
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onRetry}
          className={buttonClassName({ className: "gap-2" })}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Try again
        </button>
        <ManageAccountsLink />
      </div>
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
      className="inline-flex w-fit rounded-full bg-card-muted p-1"
      role="tablist"
    >
      {dateRangeOptions.map((option) => {
        const selected = option.days === selectedDays;

        return (
          <button
            key={option.days}
            type="button"
            aria-selected={selected}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              selected
                ? "bg-card text-foreground-strong shadow-card"
                : "text-muted hover:text-foreground-strong"
            }`}
            onClick={() => onChange(option.days)}
            role="tab"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function AnalyticsPanel({
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
    <section className="rounded-card border border-border bg-card p-5 shadow-card sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-normal text-foreground-strong">
            {title}
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
            {description}
          </p>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function MetricSelector({
  onChange,
  selectedMetric,
}: {
  onChange: (metric: MetricKey) => void;
  selectedMetric: MetricKey;
}) {
  return (
    <div
      aria-label="Chart metric"
      className="inline-flex max-w-full overflow-x-auto rounded-full bg-card-muted p-1"
      role="tablist"
    >
      {allMetricKeys.map((metric) => {
        const selected = metric === selectedMetric;

        return (
          <button
            key={metric}
            type="button"
            aria-selected={selected}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              selected
                ? "bg-card text-foreground-strong shadow-card"
                : "text-muted hover:text-foreground-strong"
            }`}
            onClick={() => onChange(metric)}
            role="tab"
          >
            {metricLabels[metric]}
          </button>
        );
      })}
    </div>
  );
}

function DistributionSelector({
  mode,
  onChange,
}: {
  mode: DistributionMode;
  onChange: (mode: DistributionMode) => void;
}) {
  const options: Array<{ label: string; mode: DistributionMode }> = [
    { label: "By Platform", mode: "platform" },
    { label: "By Content Type", mode: "contentType" },
    { label: "By Account", mode: "account" },
  ];

  return (
    <div
      aria-label="Distribution type"
      className="inline-flex max-w-full overflow-x-auto rounded-full bg-card-muted p-1"
      role="tablist"
    >
      {options.map((option) => {
        const selected = option.mode === mode;

        return (
          <button
            key={option.mode}
            type="button"
            aria-selected={selected}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              selected
                ? "bg-card text-foreground-strong shadow-card"
                : "text-muted hover:text-foreground-strong"
            }`}
            onClick={() => onChange(option.mode)}
            role="tab"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  sourceLabel,
  value,
}: {
  icon: ReactNode;
  label: string;
  sourceLabel: string;
  value: string;
}) {
  return (
    <div className="rounded-card border border-border bg-card p-4 shadow-card">
      <span className="flex size-9 items-center justify-center rounded-control bg-card-muted text-muted">
        {icon}
      </span>
      <span className="mt-5 block font-mono text-[26px] font-semibold leading-none text-foreground-strong">
        {value}
      </span>
      <p className="mt-3 text-xs font-semibold leading-5 text-muted">{label}</p>
      <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-subtle">
        {sourceLabel}
      </p>
    </div>
  );
}

function MetricLineChart({
  buckets,
  emptyMessage,
  metricKey,
}: {
  buckets: MetricBucket[];
  emptyMessage: string;
  metricKey: MetricKey;
}) {
  const chartWidth = 720;
  const chartHeight = 280;
  const paddingX = 42;
  const paddingY = 30;
  const values = buckets.map((bucket) => bucket[metricKey]);
  const maxValue = Math.max(...values, 1);
  const totalValue = values.reduce((sum, value) => sum + value, 0);
  const hasData = values.some((value) => value > 0);
  const drawableWidth = chartWidth - paddingX * 2;
  const drawableHeight = chartHeight - paddingY * 2;
  const points = buckets.map((bucket, index) => {
    const x =
      paddingX +
      (buckets.length <= 1
        ? drawableWidth / 2
        : (index / (buckets.length - 1)) * drawableWidth);
    const y = paddingY + (1 - bucket[metricKey] / maxValue) * drawableHeight;

    return { bucket, x, y };
  });
  const linePath = buildSmoothPath(points);
  const areaPath =
    hasData && points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${
          points[0].x
        } ${chartHeight - paddingY} Z`
      : "";
  const peak = points.reduce(
    (currentPeak, point) =>
      point.bucket[metricKey] > currentPeak.bucket[metricKey] ? point : currentPeak,
    points[0],
  );

  return (
    <div className="mt-6 rounded-card border border-border bg-card-muted/35 p-4 sm:p-5">
      <div className="relative h-[280px] min-w-0">
        <svg
          aria-label={`${metricLabels[metricKey]} chart from ${formatShortDate(
            buckets[0]?.dateKey ?? "",
          )} to ${formatShortDate(buckets.at(-1)?.dateKey ?? "")}`}
          className="h-full w-full overflow-visible"
          preserveAspectRatio="none"
          role="img"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        >
          {[0, 0.5, 1].map((step) => {
            const y = paddingY + step * drawableHeight;

            return (
              <line
                key={step}
                stroke="rgb(232 228 223)"
                strokeDasharray={step === 1 ? "0" : "6 8"}
                strokeWidth="1"
                x1={paddingX}
                x2={chartWidth - paddingX}
                y1={y}
                y2={y}
              />
            );
          })}
          {areaPath ? (
            <path d={areaPath} fill="rgb(255 90 31 / 0.10)" stroke="none" />
          ) : null}
          {linePath ? (
            <path
              d={linePath}
              fill="none"
              stroke={hasData ? "rgb(23 52 84)" : "rgb(255 90 31)"}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={hasData ? "5" : "3"}
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          {points.map((point) => (
            <circle
              key={point.bucket.dateKey}
              cx={point.x}
              cy={point.y}
              fill={point.bucket[metricKey] > 0 ? "rgb(255 90 31)" : "rgb(216 210 203)"}
              r={point.bucket[metricKey] > 0 ? 5 : 3.5}
              vectorEffect="non-scaling-stroke"
            >
              <title>
                {formatFullDate(point.bucket.dateKey)}:{" "}
                {formatMetricNumber(point.bucket[metricKey])} {metricLabels[metricKey]}
              </title>
            </circle>
          ))}
          <text fill="rgb(96 99 108)" fontSize="12" fontWeight="700" x={paddingX} y={chartHeight - 5}>
            {formatShortDate(buckets[0]?.dateKey ?? "")}
          </text>
          <text
            fill="rgb(96 99 108)"
            fontSize="12"
            fontWeight="700"
            textAnchor="middle"
            x={chartWidth / 2}
            y={chartHeight - 5}
          >
            {formatShortDate(buckets[Math.floor(buckets.length / 2)]?.dateKey ?? "")}
          </text>
          <text
            fill="rgb(96 99 108)"
            fontSize="12"
            fontWeight="700"
            textAnchor="end"
            x={chartWidth - paddingX}
            y={chartHeight - 5}
          >
            {formatShortDate(buckets.at(-1)?.dateKey ?? "")}
          </text>
          <text
            fill="rgb(96 99 108)"
            fontSize="12"
            fontWeight="700"
            textAnchor="end"
            x={chartWidth - 8}
            y={paddingY + 4}
          >
            {formatMetricNumber(maxValue)}
          </text>
          <text
            fill="rgb(96 99 108)"
            fontSize="12"
            fontWeight="700"
            textAnchor="end"
            x={chartWidth - 8}
            y={chartHeight - paddingY}
          >
            0
          </text>
        </svg>
        {!hasData ? (
          <div className="pointer-events-none absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-full border border-border bg-card/90 px-4 py-2 text-center text-xs font-semibold text-muted shadow-card">
            {emptyMessage}
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
        <ChartStat
          label="Peak day"
          value={
            peak
              ? `${formatShortDate(peak.bucket.dateKey)} - ${formatMetricNumber(
                  peak.bucket[metricKey],
                )}`
              : "No data"
          }
        />
        <ChartStat label="Total" value={formatMetricNumber(totalValue)} />
        <ChartStat label="Metric" value={metricLabels[metricKey]} />
      </div>
    </div>
  );
}

function ChartStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control border border-border bg-card px-3 py-2">
      <span className="block font-mono text-sm font-semibold text-foreground-strong">
        {value}
      </span>
      <span className="text-muted">{label}</span>
    </div>
  );
}

function AccountInsightList({ rows }: { rows: AccountInsightRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyAnalyticsState
        description="Connect TikTok with analytics access to see account-level performance metrics here. Instagram and YouTube currently contribute publishing activity only."
        title="No account data yet"
      />
    );
  }

  return (
    <div className="mt-6 divide-y divide-border">
      {rows.map((row) => {
        const metricAccess = row.status === "ready";
        const lastSyncedLabel = formatDateTime(row.lastSyncedAt);

        return (
          <article
            key={row.connectionId}
            className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 xl:flex-row xl:items-center xl:justify-between"
          >
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-card-muted">
                <SocialPlatformIcon platform={row.platform} className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground-strong">
                  {row.name}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {platformLabels[row.platform]}
                  {lastSyncedLabel ? ` - Refreshed ${lastSyncedLabel}` : ""}
                </p>
                {row.message ? (
                  <p className="mt-2 max-w-xl text-xs leading-5 text-muted">
                    {row.message}
                  </p>
                ) : null}
                {row.status === "permission_missing" ? (
                  <ManageAccountsLink className="mt-3" label="Reconnect TikTok" />
                ) : null}
              </div>
            </div>

            <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-5 xl:min-w-[520px]">
              {allMetricKeys.map((metric) => (
                <SmallMetricPill
                  key={metric}
                  label={metricLabels[metric]}
                  value={
                    metric === "posts" || metricAccess
                      ? formatMetricNumber(row.totals[metric])
                      : "--"
                  }
                />
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function InsightBreakdownList({
  emptyTitle,
  rows,
  selectedMetric,
}: {
  emptyTitle: string;
  rows: Array<{
    id: string;
    label: string;
    message?: string;
    metricAccess: boolean;
    totals: MetricTotals;
    visual: ReactNode;
  }>;
  selectedMetric: MetricKey;
}) {
  if (rows.length === 0) {
    return (
      <EmptyAnalyticsState
        compact
        description="Analytics will appear after matching real platform data is available."
        title={emptyTitle}
      />
    );
  }

  return (
    <div className="mt-6 space-y-3">
      {rows.map((row) => {
        const available = selectedMetric === "posts" || row.metricAccess;

        return (
          <div
            key={row.id}
            className="rounded-control border border-border bg-card-muted/45 p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-card text-muted">
                  {row.visual}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground-strong">
                    {row.label}
                  </p>
                  {row.message ? (
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted">
                      {row.message}
                    </p>
                  ) : null}
                </div>
              </div>
              <span className="font-mono text-lg font-semibold text-foreground-strong">
                {available ? formatMetricNumber(row.totals[selectedMetric]) : "--"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DistributionBars({
  mode,
  rows,
  selectedMetric,
}: {
  mode: DistributionMode;
  rows: Array<{
    available: boolean;
    id: string;
    label: string;
    value: number;
  }>;
  selectedMetric: MetricKey;
}) {
  const availableRows = rows.filter((row) => row.available);
  const total = availableRows.reduce((sum, row) => sum + row.value, 0);
  const maxValue = Math.max(...availableRows.map((row) => row.value), 1);

  if (availableRows.length === 0 || total === 0) {
    return (
      <EmptyAnalyticsState
        description={`No ${metricLabels[
          selectedMetric
        ].toLowerCase()} distribution data is available by ${getDistributionLabel(
          mode,
        ).toLowerCase()} yet.`}
        title="No distribution data yet"
      />
    );
  }

  return (
    <div className="mt-6 space-y-3">
      {availableRows.map((row) => {
        const width = Math.max((row.value / maxValue) * 100, row.value > 0 ? 8 : 0);
        const percent = total > 0 ? Math.round((row.value / total) * 100) : 0;

        return (
          <div key={row.id} className="rounded-control border border-border bg-card-muted/45 p-3">
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-foreground-strong">{row.label}</span>
              <span className="font-mono font-semibold text-foreground-strong">
                {formatMetricNumber(row.value)}{" "}
                <span className="text-xs font-semibold text-muted">{percent}%</span>
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-card">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SmallMetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control border border-border bg-card-muted px-2.5 py-2">
      <span className="block font-mono text-sm font-semibold text-foreground-strong">
        {value}
      </span>
      <span className="mt-0.5 block text-[11px] font-semibold text-muted">
        {label}
      </span>
    </div>
  );
}

function ConnectedAccountsDisclosure({
  connections,
}: {
  connections: SocialConnection[];
}) {
  const [open, setOpen] = useState(false);
  const activeConnections = connections.filter(
    (connection) => connection.status === "connected",
  );
  const attentionConnections = connections.length - activeConnections.length;

  return (
    <section className="rounded-card border border-border bg-card shadow-card">
      <button
        type="button"
        aria-expanded={open}
        className="flex w-full flex-col gap-3 p-5 text-left transition-colors hover:bg-card-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 sm:flex-row sm:items-center sm:justify-between sm:p-6"
        onClick={() => setOpen((current) => !current)}
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-success/10 text-success">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground-strong">
              Connected accounts
            </p>
            <p className="mt-1 text-sm leading-6 text-muted">
              {connections.length > 0
                ? `${activeConnections.length} ready${
                    attentionConnections > 0
                      ? `, ${attentionConnections} needs attention`
                      : ""
                  }. Open only when you want account details.`
                : "Connect accounts when you are ready to publish and measure outcomes."}
            </p>
          </div>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-control border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground-strong">
          {open ? "Hide accounts" : "Show accounts"}
          {open ? (
            <ChevronUp className="size-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-4" aria-hidden="true" />
          )}
        </span>
      </button>

      {open ? (
        <div className="border-t border-border px-5 pb-5 sm:px-6 sm:pb-6">
          {connections.length > 0 ? (
            <ConnectionList connections={connections} />
          ) : (
            <div className="pt-5">
              <StateHeading
                icon={<BarChart3 className="size-5" aria-hidden="true" />}
                title="No accounts connected yet"
                description="Connect TikTok with analytics access to load platform-level performance metrics. Instagram and YouTube currently contribute publishing activity only."
              />
            </div>
          )}
          <ManageAccountsLink className="mt-6" label="Manage accounts" />
        </div>
      ) : null}
    </section>
  );
}

function EmptyAnalyticsState({
  compact = false,
  description,
  title,
}: {
  compact?: boolean;
  description: string;
  title: string;
}) {
  return (
    <div
      className={`mt-6 flex flex-col items-center justify-center rounded-card border border-dashed border-border bg-card-muted/45 text-center ${
        compact ? "min-h-44 p-5" : "min-h-64 p-6"
      }`}
    >
      <span className="flex size-11 items-center justify-center rounded-control bg-card text-muted-subtle">
        <BarChart3 className="size-5" aria-hidden="true" />
      </span>
      <p className="mt-4 text-sm font-semibold text-foreground-strong">{title}</p>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted">{description}</p>
    </div>
  );
}

function StateHeading({
  description,
  icon,
  iconClassName = "bg-brand-soft text-primary",
  title,
}: {
  description: string;
  icon: ReactNode;
  iconClassName?: string;
  title: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <span
        className={`flex size-11 shrink-0 items-center justify-center rounded-control ${iconClassName}`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-normal text-foreground-strong">
          {title}
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">{description}</p>
      </div>
    </div>
  );
}

function ConnectionList({ connections }: { connections: SocialConnection[] }) {
  return (
    <div className="mt-5 border-y border-border">
      {connections.map((connection, index) => {
        const isConnected = connection.status === "connected";

        return (
          <div
            key={connection.id}
            className={`flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between ${
              index > 0 ? "border-t border-border" : ""
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-card-muted">
                <SocialPlatformIcon platform={connection.platform} className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground-strong">
                  {getConnectionName(connection)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {platformLabels[connection.platform]} - {formatConnectionDate(connection.connectedAt)}
                </p>
              </div>
            </div>
            <span
              className={`inline-flex w-fit items-center gap-1.5 text-xs font-semibold ${
                isConnected ? "text-success" : "text-muted"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${isConnected ? "bg-success" : "bg-muted-subtle"}`}
                aria-hidden="true"
              />
              {connectionStatusLabels[connection.status]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ManageAccountsLink({
  className = "",
  label = "Manage accounts",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <Link
      href="/settings#instagram-publishing"
      className={buttonClassName({
        className: `w-fit gap-2 ${className}`,
        variant: "secondary",
      })}
    >
      {label}
      <ArrowRight className="size-4" aria-hidden="true" />
    </Link>
  );
}

type AnalyticsSummary = {
  accountRows: AccountInsightRow[];
  contentTypeRows: ContentTypeInsightRow[];
  cumulativeBuckets: MetricBucket[];
  dailyBuckets: MetricBucket[];
  emptyChartMessage: string;
  hasPerformanceAccess: boolean;
  performanceAccessLabel: string;
  platformRows: PlatformInsightRow[];
  rangeLabel: string;
  totals: MetricTotals;
};

function buildAnalyticsSummary({
  connections,
  dateRangeDays,
  schedules,
  tiktokAnalyticsAccounts,
}: {
  connections: SocialConnection[];
  dateRangeDays: DateRangeDays;
  schedules: ScheduledPost[];
  tiktokAnalyticsAccounts: TikTokAnalyticsAccount[];
}): AnalyticsSummary {
  const rangeKeys = getDateRangeKeys(dateRangeDays);
  const bucketMap = new Map(
    rangeKeys.map((dateKey) => [
      dateKey,
      createMetricBucket(dateKey),
    ]),
  );
  const totals = cloneTotals();
  const accountTotals = new Map(
    connections.map((connection) => [connection.id, cloneTotals()]),
  );
  const platformTotals = new Map<SocialPlatform, MetricTotals>(
    schedulePlatforms.map((platform) => [platform, cloneTotals()]),
  );
  const tiktokPublicVideoTotals = cloneTotals();
  const scheduledPostTotals = cloneTotals();
  const tiktokAccountMap = new Map(
    tiktokAnalyticsAccounts.map((account) => [account.connectionId, account]),
  );

  for (const schedule of schedules) {
    const dateKey = getScheduleDateKey(schedule);

    if (dateKey && bucketMap.has(dateKey)) {
      const bucket = bucketMap.get(dateKey);

      if (bucket) {
        bucket.posts += 1;
        totals.posts += 1;
        scheduledPostTotals.posts += 1;
      }
    }

    for (const target of schedule.targets) {
      const targetDateKey = getTargetDateKey({ schedule, target });

      if (!targetDateKey || !bucketMap.has(targetDateKey)) {
        continue;
      }

      const platformTotal = platformTotals.get(target.platform);
      const connectionTotal = accountTotals.get(target.socialConnectionId);

      if (platformTotal) {
        platformTotal.posts += 1;
      }

      if (connectionTotal) {
        connectionTotal.posts += 1;
      }
    }
  }

  for (const account of tiktokAnalyticsAccounts) {
    if (account.status !== "ready") {
      continue;
    }

    const accountTotal = accountTotals.get(account.connectionId);
    const platformTotal = platformTotals.get("tiktok");

    for (const video of account.videos) {
      const dateKey = getVideoDateKey(video);

      if (!dateKey || !bucketMap.has(dateKey)) {
        continue;
      }

      const metrics = getVideoMetricTotals(video);
      const bucket = bucketMap.get(dateKey);

      if (bucket) {
        addTotals(bucket, metrics);
      }

      addTotals(totals, metrics);
      addTotals(tiktokPublicVideoTotals, metrics);

      if (accountTotal) {
        addTotals(accountTotal, metrics);
      }

      if (platformTotal) {
        addTotals(platformTotal, metrics);
      }
    }
  }

  const dailyBuckets = Array.from(bucketMap.values());
  const cumulativeBuckets = buildCumulativeBuckets(dailyBuckets);
  const hasPerformanceAccess = tiktokAnalyticsAccounts.some(
    (account) => account.status === "ready",
  );
  const needsTikTokReconnect = tiktokAnalyticsAccounts.some(
    (account) => account.status === "permission_missing",
  );
  const performanceAccessLabel = hasPerformanceAccess
    ? "Real TikTok public video data"
    : needsTikTokReconnect
      ? "Reconnect TikTok to grant analytics access"
      : "Connect TikTok with analytics access";
  const accountRows = buildAccountRows({
    accountTotals,
    connections,
    tiktokAccountMap,
  });
  const platformRows = schedulePlatforms.map((platform) => ({
    metricAccess: platform === "tiktok" && hasPerformanceAccess,
    platform,
    totals: platformTotals.get(platform) ?? cloneTotals(),
  }));
  const contentTypeRows: ContentTypeInsightRow[] = [];

  if (hasAnyPerformanceMetric(tiktokPublicVideoTotals) || hasPerformanceAccess) {
    contentTypeRows.push({
      label: "TikTok public videos",
      message: "Views, likes, comments, and shares from TikTok video.list.",
      totals: tiktokPublicVideoTotals,
    });
  }

  if (scheduledPostTotals.posts > 0) {
    contentTypeRows.push({
      label: "Scheduled posts",
      message: "Post count from UGC Pilot schedule records.",
      totals: scheduledPostTotals,
    });
  }

  return {
    accountRows,
    contentTypeRows,
    cumulativeBuckets,
    dailyBuckets,
    emptyChartMessage: hasPerformanceAccess
      ? "No matching data in this period."
      : performanceAccessLabel,
    hasPerformanceAccess,
    performanceAccessLabel,
    platformRows,
    rangeLabel: getRangeLabel(rangeKeys),
    totals,
  };
}

function buildAccountRows({
  accountTotals,
  connections,
  tiktokAccountMap,
}: {
  accountTotals: Map<string, MetricTotals>;
  connections: SocialConnection[];
  tiktokAccountMap: Map<string, TikTokAnalyticsAccount>;
}): AccountInsightRow[] {
  return connections.map((connection) => {
    const tiktokAccount =
      connection.platform === "tiktok" ? tiktokAccountMap.get(connection.id) : null;
    const totals = accountTotals.get(connection.id) ?? cloneTotals();
    const status = getAccountInsightStatus({ connection, tiktokAccount });
    const message =
      tiktokAccount?.message ??
      (connection.platform === "tiktok"
        ? "Reconnect TikTok with analytics access to load public video metrics."
        : "Publishing is connected. Performance metric sync is not enabled for this platform yet.");

    return {
      connectionId: connection.id,
      lastSyncedAt: tiktokAccount?.lastSyncedAt ?? null,
      message: status === "ready" ? null : message,
      name: getConnectionName(connection),
      platform: connection.platform,
      status,
      totals,
    };
  });
}

function getAccountInsightStatus({
  connection,
  tiktokAccount,
}: {
  connection: SocialConnection;
  tiktokAccount: TikTokAnalyticsAccount | null | undefined;
}): AccountInsightRow["status"] {
  if (connection.platform !== "tiktok") {
    return connection.status === "connected" ? "connected" : "unavailable";
  }

  if (tiktokAccount?.status === "ready") {
    return "ready";
  }

  if (tiktokAccount?.status === "permission_missing") {
    return "permission_missing";
  }

  return "unavailable";
}

function getDistributionRows({
  analytics,
  mode,
  selectedMetric,
}: {
  analytics: AnalyticsSummary;
  mode: DistributionMode;
  selectedMetric: MetricKey;
}) {
  if (mode === "account") {
    return analytics.accountRows.map((row) => ({
      available: selectedMetric === "posts" || row.status === "ready",
      id: row.connectionId,
      label: row.name,
      value: row.totals[selectedMetric],
    }));
  }

  if (mode === "contentType") {
    return analytics.contentTypeRows.map((row) => ({
      available: true,
      id: row.label,
      label: row.label,
      value: row.totals[selectedMetric],
    }));
  }

  return analytics.platformRows.map((row) => ({
    available: selectedMetric === "posts" || row.metricAccess,
    id: row.platform,
    label: platformLabels[row.platform],
    value: row.totals[selectedMetric],
  }));
}

function createMetricBucket(dateKey: string): MetricBucket {
  return {
    ...cloneTotals(),
    dateKey,
  };
}

function cloneTotals(): MetricTotals {
  return { ...emptyTotals };
}

function addTotals(target: MetricTotals, source: Partial<MetricTotals>) {
  for (const metric of allMetricKeys) {
    target[metric] += source[metric] ?? 0;
  }
}

function buildCumulativeBuckets(buckets: MetricBucket[]) {
  const running = cloneTotals();

  return buckets.map((bucket) => {
    addTotals(running, bucket);

    return {
      ...running,
      dateKey: bucket.dateKey,
    };
  });
}

function getDateRangeKeys(days: DateRangeDays) {
  const today = startOfDay(new Date());
  const rangeStart = addDays(today, -(days - 1));

  return Array.from({ length: days }, (_, index) =>
    toDateKey(addDays(rangeStart, index)),
  );
}

function getTargetDateKey({
  schedule,
  target,
}: {
  schedule: ScheduledPost;
  target: ScheduledPostTarget;
}) {
  return getDateKeyForTimezone(
    target.scheduledFor || schedule.scheduledFor || "",
    schedule.timezone,
  );
}

function getVideoDateKey(video: TikTokAnalyticsVideo) {
  if (!video.createdAt) {
    return null;
  }

  return getDateKeyForTimezone(video.createdAt, "UTC");
}

function getVideoMetricTotals(video: TikTokAnalyticsVideo): MetricTotals {
  return {
    comments: video.commentCount ?? 0,
    likes: video.likeCount ?? 0,
    posts: 0,
    shares: video.shareCount ?? 0,
    views: video.viewCount ?? 0,
  };
}

function hasAnyPerformanceMetric(totals: MetricTotals) {
  return performanceMetricKeys.some((metric) => totals[metric] > 0);
}

function getDisplayMetricValue({
  available,
  value,
}: {
  available: boolean;
  value: number;
}) {
  return available ? formatMetricNumber(value) : "--";
}

function formatMetricNumber(value: number) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 1,
    notation: value >= 10_000 ? "compact" : "standard",
  }).format(value);
}

function getDistributionLabel(mode: DistributionMode) {
  switch (mode) {
    case "account":
      return "Account";
    case "contentType":
      return "Content Type";
    case "platform":
    default:
      return "Platform";
  }
}

function getScheduleDateKey(schedule: ScheduledPost) {
  const scheduledFor =
    schedule.scheduledFor ||
    getMetadataString(schedule.metadata.plannedScheduledFor) ||
    schedule.targets[0]?.scheduledFor ||
    null;

  if (!scheduledFor) {
    return null;
  }

  return getDateKeyForTimezone(scheduledFor, schedule.timezone);
}

function getRangeLabel(rangeKeys: string[]) {
  const first = rangeKeys[0];
  const last = rangeKeys.at(-1);

  if (!first || !last) {
    return "No dated activity";
  }

  return `${formatShortDate(first)} - ${formatShortDate(last)}`;
}

function getDateKeyForTimezone(value: string, timeZone: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  try {
    const parts = new Intl.DateTimeFormat("en", {
      day: "2-digit",
      month: "2-digit",
      timeZone,
      year: "numeric",
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    return toDateKey(date);
  }

  return toDateKey(date);
}

function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    const point = points[0];

    return point ? `M ${point.x} ${point.y}` : "";
  }

  return points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }

    const previous = points[index - 1];

    if (!previous) {
      return path;
    }

    const controlX = previous.x + (point.x - previous.x) / 2;

    return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }, "");
}

function getMetadataString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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
    return dateKey;
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function formatFullDate(dateKey: string) {
  const date = parseDateKey(dateKey);

  if (!date) {
    return dateKey;
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getConnectionName(connection: SocialConnection) {
  if (connection.platformAccountName?.trim()) {
    return connection.platformAccountName.trim();
  }

  if (connection.platformAccountUsername?.trim()) {
    return `@${connection.platformAccountUsername.trim().replace(/^@/, "")}`;
  }

  return `${platformLabels[connection.platform]} account`;
}

function formatConnectionDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Connection date unavailable";
  }

  return `Connected ${new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date)}`;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
