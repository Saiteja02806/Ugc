"use client";

import { ExternalLink, EyeOff, LoaderCircle, RefreshCw } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { runAnalyticsBackgroundSync } from "@/lib/analytics/background-sync-client";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";

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

type TikTokPrivatePublishingRecord = {
  connectionId: string;
  id: string;
  publishedAt: string | null;
  title: string | null;
};

export function TikTokBetaAnalyticsPanel({
  selectedConnectionId = "all",
}: {
  selectedConnectionId?: string;
}) {
  const [accounts, setAccounts] = useState<TikTokAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [hasRefreshed, setHasRefreshed] = useState(false);
  const visibleAccounts =
    selectedConnectionId === "all"
      ? accounts
      : accounts.filter((account) => account.connectionId === selectedConnectionId);

  async function refresh() {
    setRefreshing(true);
    setError(null);

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in before viewing TikTok analytics.");
      }

      const output = await runAnalyticsBackgroundSync({
        idempotencyKey: crypto.randomUUID(),
        token,
        url: "/api/analytics/tiktok/videos",
      });
      setAccounts(getAccounts(output));
      setHasRefreshed(true);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "TikTok analytics could not load right now.",
      );
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section className="mt-6 rounded-[var(--radius-panel)] border border-border bg-card p-5 shadow-card sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-pretty text-xl font-bold tracking-[-0.02em] text-foreground">
            TikTok analytics
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Review views and interactions for the 20 most recent public videos.
            Private posts remain visible with their publishing status, not made-up
            zero metrics.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          onClick={() => void refresh()}
          disabled={refreshing}
        >
          {refreshing ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" />
          ) : (
            <RefreshCw data-icon="inline-start" />
          )}
          Refresh TikTok analytics
        </Button>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-control border border-error/25 bg-error/10 px-3 py-2 text-sm font-semibold text-error"
        >
          {error}
        </p>
      ) : null}

      {!hasRefreshed && !error ? (
        <p className="mt-4 text-sm font-medium text-muted">
          Refresh to load public-video metrics for the selected TikTok account.
        </p>
      ) : null}

      {hasRefreshed && visibleAccounts.length === 0 ? (
        <p className="mt-4 text-sm font-medium text-muted">
          No TikTok account data is available for the selected account yet.
        </p>
      ) : null}

      <div className="mt-5 grid gap-4">
        {visibleAccounts.map((account) => (
          <article
            key={account.connectionId}
            className="overflow-hidden rounded-[var(--radius-control)] border border-border bg-card-muted/45"
          >
            <AccountHeader account={account} />
            {account.message ? (
              <p aria-live="polite" className="px-4 py-3 text-sm font-medium text-muted">
                {account.message}
              </p>
            ) : null}
            {account.videos.length > 0 ? (
              <TikTokVideoTable videos={account.videos} />
            ) : null}
            {account.privatePublishingRecords.length > 0 ? (
              <TikTokPrivatePublishingRecordsTable
                records={account.privatePublishingRecords}
              />
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function TikTokPrivatePublishingRecordsTable({
  records,
}: {
  records: TikTokPrivatePublishingRecord[];
}) {
  return (
    <div className="border-t border-border">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card-muted/35 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <span className="flex size-7 items-center justify-center rounded-full bg-warning/10 text-warning">
            <EyeOff className="size-3.5" aria-hidden="true" />
          </span>
          Private publishing records
        </div>
        <span className="text-xs font-medium text-muted">
          Metrics unavailable from TikTok
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[740px] border-collapse text-left">
          <thead className="bg-card-muted/55">
            <tr className="border-b border-border">
              <TableHeading className="w-[360px]">Content</TableHeading>
              <TableHeading>Published</TableHeading>
              <TableHeading numeric>Views</TableHeading>
              <TableHeading numeric>Likes</TableHeading>
              <TableHeading numeric>Comments</TableHeading>
              <TableHeading numeric>Shares</TableHeading>
              <TableHeading>Status</TableHeading>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-warning/10 text-xs font-bold text-warning">
                      TT
                    </span>
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-sm font-semibold text-foreground">
                        {record.title || "TikTok post"}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        Published with Only me visibility
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
                <td className="px-3 py-3.5">
                  <span className="inline-flex rounded-full bg-warning/10 px-2.5 py-1 text-xs font-bold text-warning">
                    Private
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AccountHeader({ account }: { account: TikTokAccount }) {
  const accountLabel =
    account.accountUsername || account.accountName || "TikTok account";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-foreground">{accountLabel}</p>
        <p className="mt-0.5 text-xs font-medium text-muted">
          {account.lastSyncedAt
            ? `Updated ${formatDate(account.lastSyncedAt)}`
            : "Not refreshed yet"}
        </p>
      </div>
      <span
        className={
          account.status === "ready"
            ? "rounded-full bg-success/10 px-2.5 py-1 text-xs font-bold text-success"
            : "rounded-full bg-error/10 px-2.5 py-1 text-xs font-bold text-error"
        }
      >
        {account.status === "ready" ? "Ready" : "Action needed"}
      </span>
    </div>
  );
}

function TikTokVideoTable({ videos }: { videos: TikTokVideo[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[740px] border-collapse text-left">
        <thead className="bg-card-muted/55">
          <tr className="border-b border-border">
            <TableHeading className="w-[360px]">Content</TableHeading>
            <TableHeading>Published</TableHeading>
            <TableHeading numeric>Views</TableHeading>
            <TableHeading numeric>Likes</TableHeading>
            <TableHeading numeric>Comments</TableHeading>
            <TableHeading numeric>Shares</TableHeading>
            <th scope="col" className="w-14 px-3 py-3">
              <span className="sr-only">Open on TikTok</span>
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
                  <VideoThumbnail
                    src={video.coverImageUrl}
                  />
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-semibold text-foreground">
                      {getVideoTitle(video)}
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted">
                      TikTok video
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
              <td className="px-3 py-3.5 text-right">
                {video.shareUrl ? (
                  <a
                    href={video.shareUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${getVideoTitle(video)} on TikTok`}
                    className={buttonVariants({ size: "icon-sm", variant: "ghost" })}
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

function VideoThumbnail({ src }: { src: string | null }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);

  if (!src || failedSource === src) {
    return (
      <span
        aria-hidden="true"
        className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-card-muted text-xs font-bold text-muted"
      >
        TT
      </span>
    );
  }

  return (
    // TikTok owns these remote thumbnails. Rendering them directly avoids
    // caching a stale image behind an optimized URL.
    // eslint-disable-next-line @next/next/no-img-element
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
      className={`whitespace-nowrap px-3 py-3 text-xs font-bold uppercase tracking-[0.08em] text-muted ${
        numeric ? "text-right" : "text-left"
      } ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

function MetricCell({ value }: { value: number | null }) {
  return (
    <td className="whitespace-nowrap px-3 py-3.5 text-right font-mono text-xs font-semibold tabular-nums text-foreground">
      {formatMetric(value)}
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

function getVideoTitle(video: TikTokVideo) {
  return video.title || video.description || "TikTok video";
}

function formatMetric(value: number | null) {
  return value === null ? "—" : value.toLocaleString();
}

function getAccounts(value: unknown): TikTokAccount[] {
  if (
    !value ||
    typeof value !== "object" ||
    !Array.isArray((value as { accounts?: unknown }).accounts)
  ) {
    return [];
  }

  return (value as { accounts: TikTokAccount[] }).accounts;
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
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}
