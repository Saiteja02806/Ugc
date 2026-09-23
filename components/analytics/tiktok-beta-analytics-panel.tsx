"use client";

import {
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Heart,
  MessageCircle,
  Share2,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { SocialAccountAvatar } from "@/components/social/social-account-avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSocialAnalytics } from "@/lib/analytics/use-social-analytics";
import { PublishDateLineChart, PublishDateRangeControl } from "@/components/analytics/publish-date-line-chart";
import { localPublishDate, publishDateRange } from "@/lib/analytics/publish-date-chart";
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
type TikTokPrivateContentItem = TikTokPrivatePublishingRecord & {
  accountLabel: string;
};
type TikTokTrendContentItem =
  | (TikTokContentItem & {
      kind: "public";
      metricValue: number | null;
    })
  | (TikTokPrivateContentItem & {
      kind: "private";
      metricValue: null;
    });
type TikTokTrendPoint = {
  date: string;
  items: TikTokTrendContentItem[];
  value: number | null;
};

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
  const { output, error, hasRefreshed, refreshing } = useSocialAnalytics("tiktok", connections, refreshRequest);
  const accounts = useMemo(() => getAccounts(output).filter((account) => connections.some((connection) => connection.id === account.connectionId)), [output, connections]);
  const [metric, setMetric] = useState<TikTokMetric>("views");
  const [selectedContent, setSelectedContent] =
    useState<TikTokTrendContentItem | null>(null);
  const [sort, setSort] = useState<TikTokSort>("views");

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

  useEffect(() => {
    onRefreshStateChange(refreshing);
    return () => onRefreshStateChange(false);
  }, [onRefreshStateChange, refreshing]);

  return (
    <div className="mt-6 space-y-5" aria-busy={refreshing}>
      {refreshing ? <p role="status" className="text-sm text-muted">{accounts.length ? "Showing saved analytics while fresh data loads…" : "Loading your TikTok analytics…"}</p> : null}
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
            source={hasRefreshed ? "Returned by TikTok" : "Loading analytics"}
          />
          <SnapshotMetric
            icon={<EyeOff />}
            label="Private records"
            value={hasRefreshed ? formatNumber(privateRecords.length) : "—"}
            source={hasRefreshed ? "Metrics unavailable" : "Loading analytics"}
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
            privateRecords={privateRecords}
            emptyDescription={getEmptyTrendDescription({
              error,
              hasRefreshed,
              visibleAccounts,
            })}
            onSelectItem={setSelectedContent}
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
          <TikTokContentTable
            metric={metric}
            onSelect={setSelectedContent}
            privateRecords={privateRecords}
            videos={videos}
          />
        ) : (
          <ContentEmptyState
            title={
              hasRefreshed
                ? "No TikTok content data returned"
                : "Loading content"
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
      <TikTokContentDetailDialog
        item={selectedContent}
        onOpenChange={(open) => {
          if (!open) setSelectedContent(null);
        }}
      />
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
  onSelectItem,
  privateRecords,
}: {
  emptyDescription: string;
  items: TikTokContentItem[];
  metric: TikTokMetric;
  onSelectItem: (item: TikTokTrendContentItem) => void;
  privateRecords: TikTokPrivateContentItem[];
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const range = publishDateRange(days);
  const allPoints = useMemo(
    () => buildTrendPoints(items, privateRecords, metric),
    [items, metric, privateRecords],
  );
  const points = allPoints.filter((point) => point.date >= range.start && point.date <= range.end);
  const metricPoints = points.filter(
    (point): point is TikTokTrendPoint & { value: number } =>
      point.value !== null,
  );
  const selectedDateItems = selectedDate
    ? (points.find((point) => point.date === selectedDate)?.items ?? [])
    : [];

  const peak = metricPoints.length > 0 ? getPeakPoint(metricPoints) : null;
  const selectPoint = (point: TikTokTrendPoint) => {
    if (point.items.length === 1) {
      onSelectItem(point.items[0]);
      return;
    }

    setSelectedDate(point.date);
  };

  return (
    <div className="mt-6">
      <PublishDateRangeControl days={days} onChange={(value) => { setDays(value); setSelectedDate(null); }} />
      {points.length === 0 ? <DashboardEmptyState title="No content in this period" description={allPoints.length ? "No returned videos were published in this period. Older returned videos remain in Content performance below." : emptyDescription} /> : <PublishDateLineChart
        points={points}
        onSelect={selectPoint}
        getLabel={(point) => getTrendPointLabel(point, metric)}
        getThumbnail={(item) => item.kind === "public" ? item.coverImageUrl : null}
        platform="TikTok"
        range={range}
      />}
      <div className="mt-3 flex justify-between gap-3 px-1 text-xs font-medium text-muted">
        <span>{formatShortDate(range.start)}</span>
        <span>{formatShortDate(range.end)}</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <TrendSummary
          label="Visible total"
          value={metricPoints.length ? formatNumber(
            metricPoints.reduce((total, point) => total + point.value, 0),
          ) : "—"}
        />
        <TrendSummary
          label="Peak publish date"
          value={
            peak
              ? `${formatNumber(peak.value)} · ${formatShortDate(peak.date)}`
              : "—"
          }
        />
        <TrendSummary
          label="Publish dates"
          value={`${metricPoints.length} measured · ${points.length} total`}
        />
      </div>
      <TikTokContentDayPickerDialog
        date={selectedDate}
        items={selectedDateItems}
        metric={metric}
        onOpenChange={(open) => {
          if (!open) setSelectedDate(null);
        }}
        onSelect={(item) => {
          setSelectedDate(null);
          onSelectItem(item);
        }}
      />
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

function TikTokContentDayPickerDialog({
  date,
  items,
  metric,
  onOpenChange,
  onSelect,
}: {
  date: string | null;
  items: TikTokTrendContentItem[];
  metric: TikTokMetric;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: TikTokTrendContentItem) => void;
}) {
  return (
    <Dialog open={Boolean(date && items.length > 1)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(80dvh,640px)] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-5 py-5 pr-14 sm:px-6">
          <DialogTitle className="text-lg font-bold leading-6 tracking-[-0.02em] text-foreground-strong">
            Videos from {formatDateOnly(date ?? "")}
          </DialogTitle>
          <DialogDescription className="text-sm leading-6 text-muted">
            {formatNumber(items.length)} videos were published on this day.
            Select one to view its available metrics.
          </DialogDescription>
        </DialogHeader>
        <ul className="flex min-h-0 flex-col gap-2 overflow-y-auto overscroll-contain p-3 sm:p-4">
          {items.map((item) => (
            <li key={`${item.kind}:${item.id}`}>
              <button
                type="button"
                className="flex min-h-20 w-full items-center gap-3 rounded-[var(--radius-control)] border border-border bg-card p-3 text-left transition-[border-color,background-color,box-shadow] hover:border-border-strong hover:bg-card-muted/45 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                onClick={() => onSelect(item)}
              >
                <TikTokTrendThumbnail item={item} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 block text-sm font-semibold text-foreground-strong">
                    {getTrendItemTitle(item)}
                  </span>
                  <span className="mt-1 block line-clamp-1 text-xs text-muted">
                    {item.accountLabel}
                    {item.kind === "private" ? " · Only me visibility" : ""}
                  </span>
                  <span className="mt-1 block text-xs text-muted-subtle">
                    {getTrendItemPublishedAt(item)
                      ? formatDate(getTrendItemPublishedAt(item)!)
                      : "Publish time unavailable"}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-sm font-semibold tabular-nums text-foreground-strong">
                    {item.metricValue === null
                      ? "Unavailable"
                      : formatNumber(item.metricValue)}
                  </span>
                  <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-subtle">
                    {item.metricValue === null ? "Metrics" : metricLabels[metric]}
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

function TikTokContentDetailDialog({
  item,
  onOpenChange,
}: {
  item: TikTokTrendContentItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const interactionRate =
    item?.kind === "public"
      ? getInteractionRate({
          comments: item.commentCount,
          likes: item.likeCount,
          shares: item.shareCount,
          views: item.viewCount,
        })
      : null;

  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent className="bottom-0 left-0 top-auto flex h-[min(88dvh,760px)] max-h-[88dvh] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-[var(--radius-panel)] border border-border bg-card p-0 sm:bottom-auto sm:left-auto sm:right-0 sm:top-0 sm:h-dvh sm:max-h-none sm:w-[480px] sm:max-w-[calc(100%-2rem)] sm:translate-x-0 sm:translate-y-0 sm:rounded-none sm:border-y-0 sm:border-r-0">
        {item ? (
          <>
            <DialogHeader className="border-b border-border px-5 py-5 pr-14 sm:px-6">
              <div className="flex items-start gap-4">
                <TikTokTrendThumbnail item={item} size="lg" />
                <div className="min-w-0">
                  <p className="w-fit rounded-full bg-card-muted px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
                    {item.kind === "private" ? "Private post" : "TikTok video"}
                  </p>
                  <DialogTitle className="mt-3 line-clamp-2 text-lg font-bold leading-6 tracking-[-0.02em] text-foreground-strong">
                    {getTrendItemTitle(item)}
                  </DialogTitle>
                  <DialogDescription className="mt-1 text-xs leading-5 text-muted">
                    Published {getTrendItemPublishedAt(item) ? formatDate(getTrendItemPublishedAt(item)!) : "date unavailable"}
                    {item.accountLabel ? ` · ${item.accountLabel}` : ""}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
              {item.kind === "public" ? (
                <>
                  <section aria-labelledby="tiktok-metric-breakdown">
                    <p
                      id="tiktok-metric-breakdown"
                      className="text-xs font-bold uppercase tracking-[0.12em] text-primary"
                    >
                      Metric breakdown
                    </p>
                    <dl className="mt-3 divide-y divide-border rounded-[var(--radius-control)] border border-border bg-card-muted/35 px-4">
                      <ContentDetailMetric icon={<Eye />} label="Views" value={formatOptionalNumber(item.viewCount)} />
                      <ContentDetailMetric icon={<Heart />} label="Likes" value={formatOptionalNumber(item.likeCount)} />
                      <ContentDetailMetric icon={<MessageCircle />} label="Comments" value={formatOptionalNumber(item.commentCount)} />
                      <ContentDetailMetric icon={<Share2 />} label="Shares" value={formatOptionalNumber(item.shareCount)} />
                      <ContentDetailMetric icon={<TrendingUp />} label="Interaction rate" value={formatOptionalPercentage(interactionRate)} />
                    </dl>
                  </section>
                  <section className="mt-6" aria-labelledby="tiktok-caption">
                    <p id="tiktok-caption" className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
                      Caption
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">
                      {item.description || item.title || "No caption was returned for this video."}
                    </p>
                  </section>
                </>
              ) : (
                <section className="rounded-[var(--radius-control)] border border-warning/25 bg-warning/10 p-4">
                  <p className="text-sm font-semibold text-foreground-strong">Metrics are unavailable for this private post</p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    TikTok returns analytics only for public videos. This UGC Pilot publishing record stays visible so it is not mistaken for a zero-view video.
                  </p>
                </section>
              )}
            </div>

            <footer className="border-t border-border bg-card px-5 py-4 sm:px-6">
              {item.kind === "public" && item.shareUrl ? (
                <a
                  href={item.shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(buttonVariants({ size: "lg", variant: "default" }), "w-full")}
                >
                  Open on TikTok
                  <ExternalLink data-icon="inline-end" aria-hidden="true" />
                </a>
              ) : (
                <p className="text-center text-xs leading-5 text-muted">
                  {item.kind === "private"
                    ? "This post is only visible to the connected TikTok account."
                    : "A public TikTok link was not returned for this video."}
                </p>
              )}
            </footer>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TikTokTrendThumbnail({
  item,
  size,
}: {
  item: TikTokTrendContentItem;
  size: "lg" | "sm";
}) {
  const sizeClassName = size === "lg" ? "size-20" : "size-12";

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-control)] bg-card-muted text-xs font-bold text-muted",
        sizeClassName,
      )}
    >
      {item.kind === "public" && item.coverImageUrl ? (
        <>
          <span>TT</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.coverImageUrl}
            alt=""
            width={size === "lg" ? 80 : 48}
            height={size === "lg" ? 80 : 48}
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
          />
        </>
      ) : item.kind === "private" ? (
        <EyeOff className="size-4 text-warning" />
      ) : (
        "TT"
      )}
    </span>
  );
}

function ContentDetailMetric({
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
      <dt className="flex items-center gap-2 text-sm font-medium text-muted [&>svg]:size-4 [&>svg]:text-primary">
        {icon}
        {label}
      </dt>
      <dd className="font-mono text-sm font-semibold tabular-nums text-foreground-strong">{value}</dd>
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
  metric,
  onSelect,
  privateRecords,
  videos,
}: {
  metric: TikTokMetric;
  onSelect: (item: TikTokTrendContentItem) => void;
  privateRecords: TikTokPrivateContentItem[];
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
              tabIndex={0}
              aria-label={`View details for ${getVideoTitle(video)}`}
              onClick={() => onSelect(toTikTokTrendContentItem(video, metric))}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(toTikTokTrendContentItem(video, metric));
                }
              }}
              className="cursor-pointer border-b border-border transition-colors hover:bg-card-muted/45 focus-visible:bg-card-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
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
                  "—"
                )}
              </td>
            </tr>
          ))}
          {privateRecords.map((record) => (
            <tr
              key={record.id}
              tabIndex={0}
              aria-label={`View publishing record for ${record.title || "TikTok post"}`}
              onClick={() => onSelect(toTikTokPrivateTrendContentItem(record))}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(toTikTokPrivateTrendContentItem(record));
                }
              }}
              className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-card-muted/45 focus-visible:bg-card-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
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
function buildTrendPoints(
  items: TikTokContentItem[],
  privateRecords: TikTokPrivateContentItem[],
  metric: TikTokMetric,
): TikTokTrendPoint[] {
  const points = new Map<string, TikTokTrendContentItem[]>();
  const addItem = (date: string | null, item: TikTokTrendContentItem) => {
    if (!date) return;
    const dateKey = localPublishDate(date);
    if (!dateKey) return;
    points.set(dateKey, [...(points.get(dateKey) ?? []), item]);
  };

  for (const item of items) {
    addItem(item.createdAt, toTikTokTrendContentItem(item, metric));
  }
  for (const record of privateRecords) {
    addItem(record.publishedAt, toTikTokPrivateTrendContentItem(record));
  }

  return [...points.entries()]
    .map(([date, dateItems]) => {
      const values = dateItems
        .map((item) => item.metricValue)
        .filter((value): value is number => value !== null);

      return {
        date,
        items: dateItems,
        value: values.length
          ? values.reduce((total, value) => total + value, 0)
          : null,
      };
    })
    .sort((left, right) => left.date.localeCompare(right.date));
}

function toTikTokTrendContentItem(
  item: TikTokContentItem,
  metric: TikTokMetric,
): TikTokTrendContentItem {
  const metricValue =
    metric === "views"
      ? item.viewCount
      : metric === "likes"
        ? item.likeCount
        : metric === "comments"
          ? item.commentCount
          : item.shareCount;

  return { ...item, kind: "public", metricValue };
}

function toTikTokPrivateTrendContentItem(
  item: TikTokPrivateContentItem,
): TikTokTrendContentItem {
  return { ...item, kind: "private", metricValue: null };
}

function getTrendItemTitle(item: TikTokTrendContentItem) {
  return item.kind === "public"
    ? getVideoTitle(item)
    : item.title || "TikTok post";
}

function getTrendItemPublishedAt(item: TikTokTrendContentItem) {
  return item.kind === "public" ? item.createdAt : item.publishedAt;
}

function getTrendPointLabel(point: TikTokTrendPoint, metric: TikTokMetric) {
  const date = formatDateOnly(point.date);
  const itemLabel = point.items.length === 1 ? "video" : "videos";
  const metricLabel =
    point.value === null
      ? "Metrics unavailable"
      : `${formatNumber(point.value)} ${metricLabels[metric].toLowerCase()}`;

  return `Open ${formatNumber(point.items.length)} ${itemLabel} from ${date}. ${metricLabel}.`;
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
    : "The connected account appears in Account readiness. Its analytics load automatically.";
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
    : "Loading public-video metrics and private publishing records.";
}
function getReadiness(
  account: TikTokAccount | undefined,
  hasRefreshed: boolean,
) {
  if (!hasRefreshed)
    return {
      label: "Loading analytics",
      message: "Account is connected. Current analytics load automatically.",
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
