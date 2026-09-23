"use client";

import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  Eye,
  Heart,
  MessageCircle,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { SocialAccountAvatar } from "@/components/social/social-account-avatar";
import { buttonVariants } from "@/components/ui/button";
import { runAnalyticsBackgroundSync } from "@/lib/analytics/background-sync-client";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { SocialConnection } from "@/lib/social/types";
import { cn } from "@/lib/utils";

type YouTubeMetric = "comments" | "likes" | "views";
type YouTubeSort = "comments" | "likes" | "published" | "views";

type YouTubeMetrics = {
  comments: number | null;
  estimatedMinutesWatched: number | null;
  likes: number | null;
  views: number | null;
};

type YouTubeVideo = {
  commentCount: number | null;
  id: string;
  likeCount: number | null;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  title: string | null;
  viewCount: number | null;
  watchUrl: string;
};

type YouTubeAccount = {
  accountName: string | null;
  accountUsername: string | null;
  connectionId: string;
  lastSyncedAt: string | null;
  message: string | null;
  metrics: YouTubeMetrics | null;
  status: "error" | "permission_missing" | "ready" | "unavailable";
  videos: YouTubeVideo[];
};

type YouTubeContentItem = YouTubeVideo & { accountLabel: string };

const metricLabels: Record<YouTubeMetric, string> = {
  comments: "Comments",
  likes: "Likes",
  views: "Views",
};

export function YouTubeBetaAnalyticsPanel({
  connections,
  onRefreshStateChange,
  refreshRequest,
  selectedConnectionId = "all",
}: {
  connections: SocialConnection[];
  onRefreshStateChange: (refreshing: boolean) => void;
  refreshRequest: number;
  selectedConnectionId?: string;
}) {
  const [accounts, setAccounts] = useState<YouTubeAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasRefreshed, setHasRefreshed] = useState(false);
  const [metric, setMetric] = useState<YouTubeMetric>("views");
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<YouTubeSort>("views");
  const handledRefreshRequest = useRef(0);

  const visibleConnections = useMemo(
    () =>
      selectedConnectionId === "all"
        ? connections
        : connections.filter(
            (connection) => connection.id === selectedConnectionId,
          ),
    [connections, selectedConnectionId],
  );
  const visibleAccounts = useMemo(
    () =>
      selectedConnectionId === "all"
        ? accounts
        : accounts.filter(
            (account) => account.connectionId === selectedConnectionId,
          ),
    [accounts, selectedConnectionId],
  );
  const accountsByConnectionId = useMemo(
    () =>
      new Map(
        visibleAccounts.map((account) => [account.connectionId, account]),
      ),
    [visibleAccounts],
  );
  const channelMetrics = useMemo(
    () =>
      summarizeChannelMetrics(
        visibleAccounts.map((account) => account.metrics),
      ),
    [visibleAccounts],
  );
  const videos = useMemo<YouTubeContentItem[]>(
    () =>
      visibleAccounts
        .flatMap((account) =>
          account.videos.map((video) => ({
            ...video,
            accountLabel: getAccountLabel(account),
          })),
        )
        .sort((left, right) => compareVideos(left, right, sort)),
    [sort, visibleAccounts],
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);

    try {
      const token = await getCurrentUserIdToken();
      if (!token) throw new Error("Sign in before viewing YouTube analytics.");

      const output = await runAnalyticsBackgroundSync({
        idempotencyKey: crypto.randomUUID(),
        token,
        url: "/api/analytics/youtube/channel",
      });
      setAccounts(getAccounts(output));
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "YouTube analytics could not load right now.",
      );
    } finally {
      setHasRefreshed(true);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    onRefreshStateChange(refreshing);
  }, [onRefreshStateChange, refreshing]);

  useEffect(() => {
    if (
      refreshRequest === 0 ||
      refreshRequest === handledRefreshRequest.current
    ) {
      return;
    }

    handledRefreshRequest.current = refreshRequest;
    void refresh();
  }, [refresh, refreshRequest]);

  return (
    <div className="mt-6 space-y-5" aria-busy={refreshing}>
      {error ? <AnalyticsNotice message={error} /> : null}

      <section className="relative overflow-hidden rounded-[var(--radius-panel)] border border-border bg-card shadow-card">
        <span
          className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary to-red-500"
          aria-hidden="true"
        />
        <header className="px-5 py-5 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
            Performance snapshot
          </p>
          <h2 className="mt-2 text-lg font-bold tracking-[-0.02em] text-foreground-strong">
            Your channel at a glance
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            YouTube channel totals for the last 30 complete days. Uploaded-video
            values remain separate below so no metric is guessed.
          </p>
        </header>
        <div className="grid grid-cols-2 border-t border-border lg:grid-cols-4">
          <SnapshotMetric
            icon={<Eye />}
            label="Channel views"
            value={formatOptionalNumber(channelMetrics?.views)}
          />
          <SnapshotMetric
            icon={<Heart />}
            label="Likes"
            value={formatOptionalNumber(channelMetrics?.likes)}
          />
          <SnapshotMetric
            icon={<MessageCircle />}
            label="Comments"
            value={formatOptionalNumber(channelMetrics?.comments)}
          />
          <SnapshotMetric
            icon={<Clock3 />}
            label="Watch time"
            value={formatOptionalDuration(
              channelMetrics?.estimatedMinutesWatched,
            )}
          />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.7fr)]">
        <AnalyticsSurface
          actions={<MetricSelector metric={metric} onChange={setMetric} />}
          description="Uploaded-video totals grouped by publish date. This is the video-level trend that YouTube returns for the selected account."
          eyebrow="Content trend"
          title={`${metricLabels[metric]} by publish date`}
        >
          <PublishDateTrend
            emptyDescription={getEmptyTrendDescription({
              error,
              hasRefreshed,
              visibleAccounts,
            })}
            items={videos}
            metric={metric}
          />
        </AnalyticsSurface>

        <AccountReadiness
          accountsByConnectionId={accountsByConnectionId}
          connections={visibleConnections}
          hasRefreshed={hasRefreshed}
          platformLabel="YouTube"
        />
      </div>

      <section className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-card shadow-card">
        <header className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
              Content insights
            </p>
            <h2 className="mt-2 text-lg font-bold tracking-[-0.02em] text-foreground-strong">
              Content performance
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
              The 20 most recent uploaded videos returned by YouTube.
            </p>
          </div>
          <ContentSortControl sort={sort} onChange={setSort} />
        </header>
        {videos.length > 0 ? (
          <YouTubeVideoTable videos={videos} />
        ) : (
          <ContentEmptyState
            description={getEmptyContentDescription({
              error,
              hasRefreshed,
              visibleAccounts,
            })}
            title={
              hasRefreshed
                ? "No uploaded video data returned"
                : "No content loaded yet"
            }
          />
        )}
      </section>

      <DataIntegrityNote />
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

function SnapshotMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
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
      <p className="mt-2 text-xs leading-5 text-muted-subtle">
        YouTube channel data
      </p>
    </div>
  );
}

function MetricSelector({
  metric,
  onChange,
}: {
  metric: YouTubeMetric;
  onChange: (metric: YouTubeMetric) => void;
}) {
  return (
    <div
      className="grid w-full grid-cols-3 rounded-full border border-border bg-card-muted p-1 sm:inline-grid sm:w-auto"
      role="group"
      aria-label="YouTube trend metric"
    >
      {(Object.keys(metricLabels) as YouTubeMetric[]).map((option) => {
        const selected = option === metric;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option)}
            className={cn(
              "inline-flex min-h-10 items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "bg-card text-foreground-strong shadow-card"
                : "text-muted hover:text-foreground-strong",
            )}
          >
            {metricLabels[option]}
          </button>
        );
      })}
    </div>
  );
}

function PublishDateTrend({
  emptyDescription,
  items,
  metric,
}: {
  emptyDescription: string;
  items: YouTubeContentItem[];
  metric: YouTubeMetric;
}) {
  const points = useMemo(
    () => buildTrendPoints(items, metric),
    [items, metric],
  );
  const max = Math.max(...points.map((point) => point.value), 1);

  if (points.length === 0) {
    return (
      <DashboardEmptyState
        description={emptyDescription}
        title="No publish-date values yet"
      />
    );
  }

  return (
    <div className="mt-6">
      <div className="flex h-56 items-end gap-2 rounded-[var(--radius-control)] border border-border bg-card-muted/25 px-4 pb-6 pt-5 sm:gap-3 sm:px-6">
        {points.map((point) => (
          <div
            key={point.date}
            className="group flex min-w-0 flex-1 flex-col justify-end"
            title={`${formatDateOnly(point.date)}: ${formatNumber(point.value)} ${metricLabels[metric].toLowerCase()}`}
          >
            <span className="mb-2 text-center font-mono text-[10px] font-semibold tabular-nums text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              {formatNumber(point.value)}
            </span>
            <div
              className="min-h-1 rounded-t-full bg-primary/85 transition-colors group-hover:bg-primary"
              style={{ height: `${Math.max((point.value / max) * 100, 2)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between gap-3 px-1 text-xs font-medium text-muted">
        <span>{formatShortDate(points[0].date)}</span>
        <span>{formatShortDate(points.at(-1)?.date ?? points[0].date)}</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <TrendSummary
          label="Visible total"
          value={formatNumber(
            points.reduce((total, point) => total + point.value, 0),
          )}
        />
        <TrendSummary
          label="Peak publish date"
          value={`${formatNumber(getPeakPoint(points).value)} · ${formatShortDate(getPeakPoint(points).date)}`}
        />
        <TrendSummary label="Publish dates" value={`${points.length}`} />
      </div>
    </div>
  );
}

function TrendSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-control)] border border-border bg-card-muted/25 px-3 py-3">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-1 font-mono text-sm font-bold tabular-nums text-foreground-strong">
        {value}
      </p>
    </div>
  );
}

function AccountReadiness({
  accountsByConnectionId,
  connections,
  hasRefreshed,
  platformLabel,
}: {
  accountsByConnectionId: Map<string, YouTubeAccount>;
  connections: SocialConnection[];
  hasRefreshed: boolean;
  platformLabel: string;
}) {
  return (
    <aside className="rounded-[var(--radius-panel)] border border-border bg-card p-5 shadow-card sm:p-6">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
        Account readiness
      </p>
      <h2 className="mt-2 text-lg font-bold tracking-[-0.02em] text-foreground-strong">
        Connected account{connections.length === 1 ? "" : "s"}
      </h2>
      {connections.length > 0 ? (
        <div className="mt-5 divide-y divide-border rounded-[var(--radius-control)] border border-border">
          {connections.map((connection) => {
            const readiness = getReadiness(
              accountsByConnectionId.get(connection.id),
              hasRefreshed,
            );
            return (
              <div key={connection.id} className="p-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <SocialAccountAvatar connection={connection} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-foreground-strong">
                      {getConnectionLabel(connection)}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {connection.platformAccountUsername
                        ? formatHandle(connection.platformAccountUsername)
                        : platformLabel}
                    </p>
                  </div>
                  <ReadinessBadge tone={readiness.tone}>
                    {readiness.label}
                  </ReadinessBadge>
                </div>
                {readiness.message ? (
                  <p className="mt-3 text-xs leading-5 text-muted">
                    {readiness.message}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <DashboardEmptyState
          title={`No ${platformLabel} account connected`}
          description={`Connect a ${platformLabel} account in Settings to review its readiness here.`}
        />
      )}
      <Link
        href="/settings"
        className={cn(
          buttonVariants({ size: "lg", variant: "outline" }),
          "mt-5 w-full rounded-full",
        )}
      >
        Manage connection
      </Link>
    </aside>
  );
}

function ReadinessBadge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "muted" | "success" | "warning";
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold",
        tone === "success" && "bg-success/10 text-success",
        tone === "warning" && "bg-warning/10 text-warning",
        tone === "muted" && "bg-card-muted text-muted",
      )}
    >
      {children}
    </span>
  );
}

function YouTubeVideoTable({ videos }: { videos: YouTubeContentItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <thead className="bg-card-muted/55">
          <tr className="border-b border-border">
            <TableHeading className="w-[390px]">Content</TableHeading>
            <TableHeading>Published</TableHeading>
            <TableHeading numeric>Views</TableHeading>
            <TableHeading numeric>Likes</TableHeading>
            <TableHeading numeric>Comments</TableHeading>
            <TableHeading numeric>Engagement rate</TableHeading>
            <th scope="col" className="w-14 px-3 py-3">
              <span className="sr-only">Open on YouTube</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {videos.map((video) => (
            <tr
              key={video.id}
              className="border-b border-border last:border-b-0 hover:bg-card-muted/45"
            >
              <td className="px-4 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <VideoThumbnail src={video.thumbnailUrl} />
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-semibold text-foreground">
                      {video.title || "YouTube video"}
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted">
                      {video.accountLabel}
                    </p>
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap px-3 py-3.5 text-xs font-medium text-muted">
                {video.publishedAt ? formatDateOnly(video.publishedAt) : "—"}
              </td>
              <MetricCell value={video.viewCount} />
              <MetricCell value={video.likeCount} />
              <MetricCell value={video.commentCount} />
              <EngagementRateCell
                comments={video.commentCount}
                likes={video.likeCount}
                views={video.viewCount}
              />
              <td className="px-3 py-3.5 text-right">
                <a
                  href={video.watchUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${video.title || "YouTube video"} on YouTube`}
                  className={buttonVariants({
                    size: "icon-sm",
                    variant: "ghost",
                  })}
                >
                  <ExternalLink aria-hidden="true" />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContentSortControl({
  sort,
  onChange,
}: {
  sort: YouTubeSort;
  onChange: (sort: YouTubeSort) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-semibold text-muted">
      Sort by
      <select
        value={sort}
        onChange={(event) => onChange(event.target.value as YouTubeSort)}
        className="min-h-10 rounded-[var(--radius-control)] border border-border bg-card px-3 text-sm font-semibold text-foreground-strong outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="views">Views</option>
        <option value="likes">Likes</option>
        <option value="comments">Comments</option>
        <option value="published">Published</option>
      </select>
    </label>
  );
}

function ContentEmptyState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="px-5 py-10 text-center sm:px-6 sm:py-12">
      <span className="mx-auto flex size-11 items-center justify-center rounded-[var(--radius-control)] bg-card-muted text-muted">
        <TrendingUp className="size-5" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-sm font-semibold text-foreground-strong">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">
        {description}
      </p>
    </div>
  );
}

function DashboardEmptyState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="mt-6 rounded-[var(--radius-control)] border border-dashed border-border bg-card-muted/30 px-5 py-7">
      <p className="text-sm font-bold text-foreground-strong">{title}</p>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
        {description}
      </p>
    </div>
  );
}

function AnalyticsNotice({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-[var(--radius-control)] border border-error/25 bg-error/10 px-4 py-3 text-sm font-semibold text-error"
    >
      {message}
    </p>
  );
}

function DataIntegrityNote() {
  return (
    <div className="flex items-start gap-2.5 px-1 text-xs leading-5 text-muted">
      <CheckCircle2
        className="mt-0.5 size-4 shrink-0 text-muted-subtle"
        aria-hidden="true"
      />
      <p>
        Only values returned by YouTube are shown. Missing or unavailable
        metrics remain —.
      </p>
    </div>
  );
}

function VideoThumbnail({ src }: { src: string | null }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (!src || failedSource === src)
    return (
      <span
        aria-hidden="true"
        className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-card-muted text-xs font-bold text-muted"
      >
        YT
      </span>
    );
  return (
    <img
      src={src}
      alt=""
      width={48}
      height={48}
      loading="lazy"
      className="size-12 shrink-0 rounded-[var(--radius-control)] object-cover"
      onError={() => setFailedSource(src)}
    />
  );
}

function TableHeading({
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
        "whitespace-nowrap px-3 py-3 text-xs font-bold uppercase tracking-[0.08em] text-muted",
        numeric ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

function MetricCell({ value }: { value: number | null }) {
  return (
    <td className="whitespace-nowrap px-3 py-3.5 text-right font-mono text-xs font-semibold tabular-nums text-foreground">
      {formatOptionalNumber(value)}
    </td>
  );
}

function EngagementRateCell({
  comments,
  likes,
  views,
}: {
  comments: number | null;
  likes: number | null;
  views: number | null;
}) {
  const engagementRate =
    views === null || views === 0 || likes === null || comments === null
      ? null
      : (likes + comments) / views;

  return (
    <td className="whitespace-nowrap px-3 py-3.5 text-right font-mono text-xs font-semibold tabular-nums text-foreground">
      {formatOptionalPercentage(engagementRate)}
    </td>
  );
}

function getAccounts(value: unknown): YouTubeAccount[] {
  return value &&
    typeof value === "object" &&
    Array.isArray((value as { accounts?: unknown }).accounts)
    ? (value as { accounts: YouTubeAccount[] }).accounts
    : [];
}

function summarizeChannelMetrics(metrics: Array<YouTubeMetrics | null>) {
  const available = metrics.filter(
    (metric): metric is YouTubeMetrics => metric !== null,
  );
  if (available.length === 0) return null;
  return {
    comments: sumMetric(available.map((metric) => metric.comments)),
    estimatedMinutesWatched: sumMetric(
      available.map((metric) => metric.estimatedMinutesWatched),
    ),
    likes: sumMetric(available.map((metric) => metric.likes)),
    views: sumMetric(available.map((metric) => metric.views)),
  };
}

function sumMetric(values: Array<number | null>) {
  const available = values.filter((value): value is number => value !== null);
  return available.length
    ? available.reduce((total, value) => total + value, 0)
    : null;
}

function buildTrendPoints(items: YouTubeContentItem[], metric: YouTubeMetric) {
  const points = new Map<string, number>();
  for (const item of items) {
    if (!item.publishedAt) continue;
    const date = item.publishedAt.slice(0, 10);
    const value =
      metric === "views"
        ? item.viewCount
        : metric === "likes"
          ? item.likeCount
          : item.commentCount;
    if (value !== null) points.set(date, (points.get(date) ?? 0) + value);
  }
  return [...points.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

function getPeakPoint(points: Array<{ date: string; value: number }>) {
  return points.reduce(
    (peak, point) => (point.value > peak.value ? point : peak),
    points[0],
  );
}

function compareVideos(
  left: YouTubeContentItem,
  right: YouTubeContentItem,
  sort: YouTubeSort,
) {
  const value = (video: YouTubeContentItem) =>
    sort === "views"
      ? (video.viewCount ?? -1)
      : sort === "likes"
        ? (video.likeCount ?? -1)
        : sort === "comments"
          ? (video.commentCount ?? -1)
          : video.publishedAt
            ? Date.parse(video.publishedAt)
            : 0;
  return value(right) - value(left);
}

function getEmptyTrendDescription({
  error,
  hasRefreshed,
  visibleAccounts,
}: {
  error: string | null;
  hasRefreshed: boolean;
  visibleAccounts: YouTubeAccount[];
}) {
  if (error)
    return "The last refresh did not complete. Check the connection, then use Refresh above to try again.";
  const providerMessage = visibleAccounts.find(
    (account) => account.message,
  )?.message;
  if (providerMessage) return providerMessage;
  return hasRefreshed
    ? "YouTube returned no publish-date metrics for this selection yet."
    : "The connected channel appears in Account readiness. Use Refresh above to load its current analytics.";
}

function getEmptyContentDescription({
  error,
  hasRefreshed,
  visibleAccounts,
}: {
  error: string | null;
  hasRefreshed: boolean;
  visibleAccounts: YouTubeAccount[];
}) {
  if (error)
    return "No content records were changed. Resolve the connection issue, then use Refresh above.";
  const providerMessage = visibleAccounts.find(
    (account) => account.message,
  )?.message;
  if (providerMessage) return providerMessage;
  return hasRefreshed
    ? "YouTube did not return uploaded videos for this selection. New uploads can take a short time to appear."
    : "Use Refresh above to load uploaded-video data for this connected channel.";
}

function getReadiness(
  account: YouTubeAccount | undefined,
  hasRefreshed: boolean,
) {
  if (!hasRefreshed)
    return {
      label: "Ready to refresh",
      message: "Channel is connected. Refresh to load current analytics.",
      tone: "muted" as const,
    };
  if (!account)
    return {
      label: "No data yet",
      message: "The analytics service did not return this channel yet.",
      tone: "warning" as const,
    };
  if (account.status === "ready")
    return {
      label: "Synced",
      message: account.lastSyncedAt
        ? `Updated ${formatDate(account.lastSyncedAt)}`
        : null,
      tone: "success" as const,
    };
  return {
    label:
      account.status === "permission_missing" ? "Reconnect" : "Needs attention",
    message:
      account.message ?? "Refresh after checking the account connection.",
    tone: "warning" as const,
  };
}

function getAccountLabel(account: YouTubeAccount) {
  return account.accountUsername || account.accountName || "YouTube channel";
}
function getConnectionLabel(connection: SocialConnection) {
  return (
    connection.platformAccountName ||
    connection.platformAccountUsername ||
    "YouTube channel"
  );
}
function formatHandle(value: string) {
  return value.startsWith("@") ? value : `@${value}`;
}
function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: value >= 10000 ? 1 : 0,
  }).format(value);
}
function formatOptionalNumber(value: number | null | undefined) {
  return value == null ? "—" : formatNumber(value);
}
function formatOptionalPercentage(value: number | null | undefined) {
  return value == null
    ? "—"
    : new Intl.NumberFormat(undefined, {
        style: "percent",
        maximumFractionDigits: 1,
      }).format(value);
}
function formatOptionalDuration(value: number | null | undefined) {
  return value == null
    ? "—"
    : value < 60
      ? `${Math.round(value)} min`
      : `${(value / 60).toLocaleString(undefined, { maximumFractionDigits: 1 })} hr`;
}
function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}
function formatDateOnly(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}
function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
      }).format(date);
}
