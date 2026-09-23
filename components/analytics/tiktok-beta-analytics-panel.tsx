"use client";

import {
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Heart,
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

type TikTokMetric = "comments" | "likes" | "shares" | "views";
type TikTokSort = "comments" | "likes" | "published" | "shares" | "views";

type TikTokVideo = {
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

type TikTokPrivatePublishingRecord = {
  connectionId: string;
  id: string;
  publishedAt: string | null;
  title: string | null;
};

type TikTokAccount = {
  accountName: string | null;
  accountUsername: string | null;
  connectionId: string;
  lastSyncedAt: string | null;
  message: string | null;
  privatePublishingRecords: TikTokPrivatePublishingRecord[];
  status: "error" | "permission_missing" | "ready" | "unavailable";
  videos: TikTokVideo[];
};

type TikTokContentItem = TikTokVideo & { accountLabel: string };

const metricLabels: Record<TikTokMetric, string> = {
  comments: "Comments",
  likes: "Likes",
  shares: "Shares",
  views: "Views",
};

export function TikTokBetaAnalyticsPanel({
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
  const [accounts, setAccounts] = useState<TikTokAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasRefreshed, setHasRefreshed] = useState(false);
  const [metric, setMetric] = useState<TikTokMetric>("views");
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<TikTokSort>("views");
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
  const videos = useMemo<TikTokContentItem[]>(
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
  const privateRecords = useMemo(
    () =>
      visibleAccounts
        .flatMap((account) =>
          account.privatePublishingRecords.map((record) => ({
            ...record,
            accountLabel: getAccountLabel(account),
          })),
        )
        .sort((left, right) =>
          compareDates(left.publishedAt, right.publishedAt),
        ),
    [visibleAccounts],
  );
  const totals = useMemo(() => summarizePublicVideos(videos), [videos]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const token = await getCurrentUserIdToken();
      if (!token) throw new Error("Sign in before viewing TikTok analytics.");
      const output = await runAnalyticsBackgroundSync({
        idempotencyKey: crypto.randomUUID(),
        token,
        url: "/api/analytics/tiktok/videos",
      });
      setAccounts(getAccounts(output));
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "TikTok analytics could not load right now.",
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
    )
      return;
    handledRefreshRequest.current = refreshRequest;
    void refresh();
  }, [refresh, refreshRequest]);

  return (
    <div className="mt-6 space-y-5" aria-busy={refreshing}>
      {error ? <AnalyticsNotice message={error} /> : null}

      <section className="relative overflow-hidden rounded-[var(--radius-panel)] border border-border bg-card shadow-card">
        <span
          className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary to-[#111111]"
          aria-hidden="true"
        />
        <header className="px-5 py-5 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
            Performance snapshot
          </p>
          <h2 className="mt-2 text-lg font-bold tracking-[-0.02em] text-foreground-strong">
            Your public-video performance
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            TikTok returns metrics only for public videos. Private publishing
            records remain visible below without invented metric values.
          </p>
        </header>
        <div className="grid grid-cols-2 border-t border-border lg:grid-cols-4">
          <SnapshotMetric
            icon={<Eye />}
            label="Public views"
            value={formatOptionalNumber(totals?.views)}
            source="Public videos returned"
          />
          <SnapshotMetric
            icon={<Heart />}
            label="Interactions"
            value={formatOptionalNumber(totals?.interactions)}
            source="Likes, comments, shares"
          />
          <SnapshotMetric
            icon={<TrendingUp />}
            label="Public videos"
            value={hasRefreshed ? formatNumber(videos.length) : "—"}
            source={hasRefreshed ? "Returned by TikTok" : "Refresh to load"}
          />
          <SnapshotMetric
            icon={<EyeOff />}
            label="Private records"
            value={hasRefreshed ? formatNumber(privateRecords.length) : "—"}
            source={hasRefreshed ? "Metrics unavailable" : "Refresh to load"}
          />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.7fr)]">
        <AnalyticsSurface
          actions={<MetricSelector metric={metric} onChange={setMetric} />}
          eyebrow="Content trend"
          title={`${metricLabels[metric]} by publish date`}
          description="Current values for public TikTok videos, grouped by the date TikTok reports they were created."
        >
          <PublishDateTrend
            items={videos}
            metric={metric}
            emptyDescription={getEmptyTrendDescription({
              error,
              hasRefreshed,
              visibleAccounts,
            })}
          />
        </AnalyticsSurface>
        <AccountReadiness
          accountsByConnectionId={accountsByConnectionId}
          connections={visibleConnections}
          hasRefreshed={hasRefreshed}
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
              The 20 most recent public videos returned by TikTok, plus private
              publishing records from UGC Pilot.
            </p>
          </div>
          <ContentSortControl sort={sort} onChange={setSort} />
        </header>
        {videos.length > 0 || privateRecords.length > 0 ? (
          <TikTokContentTable privateRecords={privateRecords} videos={videos} />
        ) : (
          <ContentEmptyState
            title={
              hasRefreshed
                ? "No TikTok content data returned"
                : "No content loaded yet"
            }
            description={getEmptyContentDescription({
              error,
              hasRefreshed,
              visibleAccounts,
            })}
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
      <p className="mt-2 text-xs leading-5 text-muted-subtle">{source}</p>
    </div>
  );
}

function MetricSelector({
  metric,
  onChange,
}: {
  metric: TikTokMetric;
  onChange: (metric: TikTokMetric) => void;
}) {
  return (
    <div
      className="grid w-full grid-cols-4 rounded-full border border-border bg-card-muted p-1 sm:inline-grid sm:w-auto"
      role="group"
      aria-label="TikTok trend metric"
    >
      {(Object.keys(metricLabels) as TikTokMetric[]).map((option) => {
        const selected = option === metric;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option)}
            className={cn(
              "inline-flex min-h-10 items-center justify-center rounded-full px-2 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
  items: TikTokContentItem[];
  metric: TikTokMetric;
}) {
  const points = useMemo(
    () => buildTrendPoints(items, metric),
    [items, metric],
  );
  const max = Math.max(...points.map((point) => point.value), 1);
  if (points.length === 0)
    return (
      <DashboardEmptyState
        title="No publish-date values yet"
        description={emptyDescription}
      />
    );
  const peak = getPeakPoint(points);
  return (
    <div className="mt-6">
      <div className="flex h-56 items-end gap-2 rounded-[var(--radius-control)] border border-border bg-card-muted/25 px-4 pb-6 pt-5 sm:gap-3 sm:px-6">
        {points.map((point) => (
          <div
            key={point.date}
            className="group flex min-w-0 flex-1 flex-col justify-end"
            title={`${formatDateOnly(point.date)}: ${formatNumber(point.value)} ${metricLabels[metric].toLowerCase()}`}
          >
            <span className="mb-2 text-center font-mono text-[10px] font-semibold tabular-nums text-muted opacity-0 transition-opacity group-hover:opacity-100">
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
          value={`${formatNumber(peak.value)} · ${formatShortDate(peak.date)}`}
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
}: {
  accountsByConnectionId: Map<string, TikTokAccount>;
  connections: SocialConnection[];
  hasRefreshed: boolean;
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
                        : "TikTok"}
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
          title="No TikTok account connected"
          description="Connect a TikTok account in Settings to review its readiness here."
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

function TikTokContentTable({
  privateRecords,
  videos,
}: {
  privateRecords: Array<
    TikTokPrivatePublishingRecord & { accountLabel: string }
  >;
  videos: TikTokContentItem[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse text-left">
        <thead className="bg-card-muted/55">
          <tr className="border-b border-border">
            <TableHeading className="w-[360px]">Content</TableHeading>
            <TableHeading>Published</TableHeading>
            <TableHeading numeric>Views</TableHeading>
            <TableHeading numeric>Likes</TableHeading>
            <TableHeading numeric>Comments</TableHeading>
            <TableHeading numeric>Shares</TableHeading>
            <TableHeading numeric>Interaction rate</TableHeading>
            <TableHeading>Metric status</TableHeading>
            <th scope="col" className="w-14 px-3 py-3">
              <span className="sr-only">Open on TikTok</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {videos.map((video) => (
            <tr
              key={video.id}
              className="border-b border-border hover:bg-card-muted/45"
            >
              <td className="px-4 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <VideoThumbnail src={video.coverImageUrl} />
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-semibold text-foreground">
                      {getVideoTitle(video)}
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted">
                      {video.accountLabel}
                    </p>
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap px-3 py-3.5 text-xs font-medium text-muted">
                {video.createdAt ? formatDateOnly(video.createdAt) : "—"}
              </td>
              <MetricCell value={video.viewCount} />
              <MetricCell value={video.likeCount} />
              <MetricCell value={video.commentCount} />
              <MetricCell value={video.shareCount} />
              <InteractionRateCell
                comments={video.commentCount}
                likes={video.likeCount}
                shares={video.shareCount}
                views={video.viewCount}
              />
              <td className="px-3 py-3.5">
                <ReadinessBadge tone="success">Available</ReadinessBadge>
              </td>
              <td className="px-3 py-3.5 text-right">
                {video.shareUrl ? (
                  <a
                    href={video.shareUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${getVideoTitle(video)} on TikTok`}
                    className={buttonVariants({
                      size: "icon-sm",
                      variant: "ghost",
                    })}
                  >
                    <ExternalLink aria-hidden="true" />
                  </a>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
          {privateRecords.map((record) => (
            <tr
              key={record.id}
              className="border-b border-border last:border-b-0"
            >
              <td className="px-4 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-warning/10 text-warning">
                    <EyeOff className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-semibold text-foreground">
                      {record.title || "TikTok post"}
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted">
                      {record.accountLabel} · Only me visibility
                    </p>
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap px-3 py-3.5 text-xs font-medium text-muted">
                {record.publishedAt ? formatDateOnly(record.publishedAt) : "—"}
              </td>
              <UnavailableMetricCell />
              <UnavailableMetricCell />
              <UnavailableMetricCell />
              <UnavailableMetricCell />
              <UnavailableMetricCell />
              <td className="px-3 py-3.5">
                <ReadinessBadge tone="warning">Private</ReadinessBadge>
              </td>
              <td className="px-3 py-3.5 text-right text-muted">—</td>
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
  sort: TikTokSort;
  onChange: (sort: TikTokSort) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-semibold text-muted">
      Sort by
      <select
        value={sort}
        onChange={(event) => onChange(event.target.value as TikTokSort)}
        className="min-h-10 rounded-[var(--radius-control)] border border-border bg-card px-3 text-sm font-semibold text-foreground-strong outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="views">Views</option>
        <option value="likes">Likes</option>
        <option value="comments">Comments</option>
        <option value="shares">Shares</option>
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
        Only TikTok values returned for public videos are shown. Private posts
        are visible, but their unavailable metrics are never replaced with
        zeroes.
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
        TT
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
function UnavailableMetricCell() {
  return (
    <td className="whitespace-nowrap px-3 py-3.5 text-right font-mono text-xs font-semibold tabular-nums text-muted">
      Unavailable
    </td>
  );
}

function InteractionRateCell({
  comments,
  likes,
  shares,
  views,
}: {
  comments: number | null;
  likes: number | null;
  shares: number | null;
  views: number | null;
}) {
  const interactionRate = getInteractionRate({
    comments,
    likes,
    shares,
    views,
  });

  return (
    <td className="whitespace-nowrap px-3 py-3.5 text-right font-mono text-xs font-semibold tabular-nums text-foreground">
      {formatOptionalPercentage(interactionRate)}
    </td>
  );
}
function getAccounts(value: unknown): TikTokAccount[] {
  return value &&
    typeof value === "object" &&
    Array.isArray((value as { accounts?: unknown }).accounts)
    ? (value as { accounts: TikTokAccount[] }).accounts
    : [];
}
function summarizePublicVideos(videos: TikTokContentItem[]) {
  if (!videos.length) return null;
  const views = sumMetric(videos.map((video) => video.viewCount));
  const likes = sumMetric(videos.map((video) => video.likeCount));
  const comments = sumMetric(videos.map((video) => video.commentCount));
  const shares = sumMetric(videos.map((video) => video.shareCount));
  const interactions =
    likes === null || comments === null || shares === null
      ? null
      : likes + comments + shares;
  return {
    interactions,
    views,
  };
}

function getInteractionRate({
  comments,
  likes,
  shares,
  views,
}: {
  comments: number | null;
  likes: number | null;
  shares: number | null;
  views: number | null;
}) {
  if (
    views === null ||
    views === 0 ||
    likes === null ||
    comments === null ||
    shares === null
  ) {
    return null;
  }

  return (likes + comments + shares) / views;
}
function sumMetric(values: Array<number | null>) {
  const available = values.filter((value): value is number => value !== null);
  return available.length
    ? available.reduce((total, value) => total + value, 0)
    : null;
}
function buildTrendPoints(items: TikTokContentItem[], metric: TikTokMetric) {
  const points = new Map<string, number>();
  for (const item of items) {
    if (!item.createdAt) continue;
    const date = item.createdAt.slice(0, 10);
    const value =
      metric === "views"
        ? item.viewCount
        : metric === "likes"
          ? item.likeCount
          : metric === "comments"
            ? item.commentCount
            : item.shareCount;
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
  left: TikTokContentItem,
  right: TikTokContentItem,
  sort: TikTokSort,
) {
  const value = (video: TikTokContentItem) =>
    sort === "views"
      ? (video.viewCount ?? -1)
      : sort === "likes"
        ? (video.likeCount ?? -1)
        : sort === "comments"
          ? (video.commentCount ?? -1)
          : sort === "shares"
            ? (video.shareCount ?? -1)
            : video.createdAt
              ? Date.parse(video.createdAt)
              : 0;
  return value(right) - value(left);
}
function compareDates(left: string | null, right: string | null) {
  return (right ? Date.parse(right) : 0) - (left ? Date.parse(left) : 0);
}
function getEmptyTrendDescription({
  error,
  hasRefreshed,
  visibleAccounts,
}: {
  error: string | null;
  hasRefreshed: boolean;
  visibleAccounts: TikTokAccount[];
}) {
  if (error)
    return "The last refresh did not complete. Check the connection, then use Refresh above to try again.";
  const providerMessage = visibleAccounts.find(
    (account) => account.message,
  )?.message;
  if (providerMessage) return providerMessage;
  return hasRefreshed
    ? "TikTok returned no public-video metrics for this selection yet."
    : "The connected account appears in Account readiness. Use Refresh above to load public-video analytics.";
}
function getEmptyContentDescription({
  error,
  hasRefreshed,
  visibleAccounts,
}: {
  error: string | null;
  hasRefreshed: boolean;
  visibleAccounts: TikTokAccount[];
}) {
  if (error)
    return "No content records were changed. Resolve the connection issue, then use Refresh above.";
  const providerMessage = visibleAccounts.find(
    (account) => account.message,
  )?.message;
  if (providerMessage) return providerMessage;
  return hasRefreshed
    ? "TikTok did not return public videos for this selection. Private UGC Pilot posts appear here separately when available."
    : "Use Refresh above to load public-video metrics and private publishing records.";
}
function getReadiness(
  account: TikTokAccount | undefined,
  hasRefreshed: boolean,
) {
  if (!hasRefreshed)
    return {
      label: "Ready to refresh",
      message: "Account is connected. Refresh to load current analytics.",
      tone: "muted" as const,
    };
  if (!account)
    return {
      label: "No data yet",
      message: "The analytics service did not return this account yet.",
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
function getVideoTitle(video: TikTokVideo) {
  return video.title || video.description || "TikTok video";
}
function getAccountLabel(account: TikTokAccount) {
  return account.accountUsername || account.accountName || "TikTok account";
}
function getConnectionLabel(connection: SocialConnection) {
  return (
    connection.platformAccountName ||
    connection.platformAccountUsername ||
    "TikTok account"
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
