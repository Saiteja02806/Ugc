"use client";

import {
  Clock3,
  Eye,
  Heart,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { runAnalyticsBackgroundSync } from "@/lib/analytics/background-sync-client";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";

type YouTubeMetrics = {
  comments: number | null;
  estimatedMinutesWatched: number | null;
  likes: number | null;
  views: number | null;
};

type YouTubeAccount = {
  accountName: string | null;
  accountUsername: string | null;
  connectionId: string;
  lastSyncedAt: string | null;
  message: string | null;
  metrics: YouTubeMetrics | null;
  status: "error" | "permission_missing" | "ready" | "unavailable";
};

export function YouTubeBetaAnalyticsPanel({
  selectedConnectionId = "all",
}: {
  selectedConnectionId?: string;
}) {
  const [accounts, setAccounts] = useState<YouTubeAccount[]>([]);
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
        throw new Error("Sign in before viewing YouTube analytics.");
      }

      const output = await runAnalyticsBackgroundSync({
        idempotencyKey: crypto.randomUUID(),
        token,
        url: "/api/analytics/youtube/channel",
      });
      setAccounts(getAccounts(output));
      setHasRefreshed(true);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "YouTube analytics could not load right now.",
      );
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section className="mt-6 rounded-[var(--radius-panel)] border border-border bg-card p-5 shadow-card sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">YouTube beta</p>
          <h2 className="mt-1 text-xl font-bold tracking-[-0.02em] text-foreground">
            Channel performance
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Views, likes, comments, and estimated watch time for the last 30
            complete days. YouTube Analytics reports are typically available
            after a short delay.
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
          Refresh YouTube analytics
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
          Refresh to load the selected channel&apos;s YouTube Analytics metrics.
          Existing channels need one reconnect to grant the new analytics
          permission.
        </p>
      ) : null}

      {hasRefreshed && visibleAccounts.length === 0 ? (
        <p className="mt-4 text-sm font-medium text-muted">
          No YouTube channel data is available for the selected account yet.
        </p>
      ) : null}

      <div className="mt-5 grid gap-4">
        {visibleAccounts.map((account) => (
          <article
            key={account.connectionId}
            className="overflow-hidden rounded-control border border-border bg-card-muted/45"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <p className="text-sm font-bold text-foreground">
                  {account.accountUsername || account.accountName || "YouTube channel"}
                </p>
                <p className="mt-0.5 text-xs font-medium text-muted">
                  {account.lastSyncedAt
                    ? `Updated ${formatDate(account.lastSyncedAt)}`
                    : "Not refreshed yet"}
                </p>
              </div>
              <span
                className={
                  account.status === "ready"
                    ? "text-xs font-bold text-success"
                    : "text-xs font-bold text-error"
                }
              >
                {account.status === "ready" ? "Ready" : "Action needed"}
              </span>
            </div>

            {account.message ? (
              <p className="px-4 py-3 text-sm font-medium text-muted">
                {account.message}
              </p>
            ) : null}

            {account.metrics ? (
              <div className="grid gap-px border-t border-border bg-border sm:grid-cols-4">
                <Metric icon={Eye} label="Views" value={account.metrics.views} />
                <Metric icon={Heart} label="Likes" value={account.metrics.likes} />
                <Metric
                  icon={MessageCircle}
                  label="Comments"
                  value={account.metrics.comments}
                />
                <Metric
                  icon={Clock3}
                  label="Watch time"
                  value={account.metrics.estimatedMinutesWatched}
                  format="duration"
                />
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function Metric({
  format = "number",
  icon: Icon,
  label,
  value,
}: {
  format?: "duration" | "number";
  icon: typeof Eye;
  label: string;
  value: number | null;
}) {
  const formattedValue =
    value === null
      ? "—"
      : format === "duration"
        ? formatDuration(value)
        : value.toLocaleString();

  return (
    <div className="bg-card px-4 py-4">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </span>
      <strong className="mt-2 block font-mono text-xl font-bold text-foreground">
        {formattedValue}
      </strong>
    </div>
  );
}

function getAccounts(value: unknown): YouTubeAccount[] {
  if (
    !value ||
    typeof value !== "object" ||
    !Array.isArray((value as { accounts?: unknown }).accounts)
  ) {
    return [];
  }

  return (value as { accounts: YouTubeAccount[] }).accounts;
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

function formatDuration(minutes: number) {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }

  const hours = minutes / 60;
  return `${hours.toLocaleString(undefined, { maximumFractionDigits: 1 })} hr`;
}
