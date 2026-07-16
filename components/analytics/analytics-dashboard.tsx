"use client";

import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  ListChecks,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { SidebarIcon } from "@/components/icons/sidebar-icon";
import { SocialPlatformIcon } from "@/components/social/platform-icon";
import { buttonClassName } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
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

type ActivityBucket = {
  cancelled: number;
  dateKey: string;
  failed: number;
  planned: number;
  published: number;
  total: number;
};

type OutcomeKey = "cancelled" | "failed" | "planned" | "published";

type PlatformOutcome = {
  cancelled: number;
  failed: number;
  platform: SocialPlatform;
  planned: number;
  published: number;
  total: number;
};

const ACTIVITY_DAYS = 14;

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

const outcomeLabels: Record<OutcomeKey, string> = {
  cancelled: "Cancelled",
  failed: "Needs attention",
  planned: "Planned",
  published: "Published",
};

const outcomeBarClasses: Record<OutcomeKey, string> = {
  cancelled: "bg-muted-subtle",
  failed: "bg-error",
  planned: "bg-deep-contrast",
  published: "bg-success",
};

export function AnalyticsDashboard() {
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [schedules, setSchedules] = useState<ScheduledPost[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
        setErrorMessage(null);
        setLoadState("ready");
        return;
      }

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [connectionsResponse, schedulesResponse] = await Promise.all([
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
      ]);

      const connectionsData = (await connectionsResponse
        .json()
        .catch(() => null)) as ConnectionsResponse | null;
      const schedulesData = (await schedulesResponse
        .json()
        .catch(() => null)) as SchedulesResponse | null;

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

  const activeConnections = connections.filter(
    (connection) => connection.status === "connected",
  );
  const analytics = useMemo(
    () => buildAnalyticsSummary({ connections, schedules }),
    [connections, schedules],
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
                Real publishing activity from your scheduled posts and connected accounts.
              </p>
            </div>
          </div>

          <span className="inline-flex w-fit items-center gap-2 text-xs font-semibold text-muted">
            <ShieldCheck className="size-4 text-success" aria-hidden="true" />
            Real data only
          </span>
        </header>

        <div className="mt-6" aria-live="polite">
          {loadState === "loading" ? <AnalyticsLoadingState /> : null}
          {loadState === "error" ? (
            <AnalyticsErrorState message={errorMessage} onRetry={retryAnalytics} />
          ) : null}
          {loadState === "ready" ? (
            <AnalyticsReadyState
              activeConnectionCount={activeConnections.length}
              analytics={analytics}
              connections={connections}
              schedules={schedules}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function AnalyticsReadyState({
  activeConnectionCount,
  analytics,
  connections,
  schedules,
}: {
  activeConnectionCount: number;
  analytics: AnalyticsSummary;
  connections: SocialConnection[];
  schedules: ScheduledPost[];
}) {
  const hasSchedules = schedules.length > 0;

  return (
    <div className="space-y-5">
      <section className="rounded-card border border-border bg-card p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
              Publishing overview
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-normal text-foreground-strong">
              What is happening with your posts
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              This uses UGC Pilot schedule and publish records. Views, likes, comments,
              and follower metrics will appear only after provider performance sync is enabled.
            </p>
          </div>

          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card-muted px-3 py-1.5 text-xs font-semibold text-muted">
            <Clock3 className="size-4" aria-hidden="true" />
            {analytics.activityRangeLabel}
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<ListChecks className="size-4" aria-hidden="true" />}
            label="Scheduled posts tracked"
            value={analytics.totalPosts.toString()}
          />
          <MetricCard
            icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
            label="Published platform posts"
            tone="success"
            value={analytics.publishedTargets.toString()}
          />
          <MetricCard
            icon={<AlertCircle className="size-4" aria-hidden="true" />}
            label="Targets needing attention"
            tone={analytics.needsAttentionTargets > 0 ? "error" : "neutral"}
            value={analytics.needsAttentionTargets.toString()}
          />
          <MetricCard
            icon={<Calendar className="size-4" aria-hidden="true" />}
            label="Upcoming platform posts"
            value={analytics.upcomingTargets.toString()}
          />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.8fr)]">
        <section className="rounded-card border border-border bg-card p-5 shadow-card sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                Activity chart
              </p>
              <h2 className="mt-2 text-lg font-semibold tracking-normal text-foreground-strong">
                Daily publishing pipeline
              </h2>
            </div>
            <OutcomeLegend />
          </div>

          {analytics.activityTotal > 0 ? (
            <ActivityChart buckets={analytics.activityBuckets} />
          ) : (
            <EmptyAnalyticsState
              description={
                hasSchedules
                  ? "Your saved posts do not have scheduled dates in this view yet."
                  : "Schedule a post first. Once it exists, this chart will use the real schedule and publish status."
              }
              title="No publishing activity to chart yet"
            />
          )}
        </section>

        <section className="rounded-card border border-border bg-card p-5 shadow-card sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                Platforms
              </p>
              <h2 className="mt-2 text-lg font-semibold tracking-normal text-foreground-strong">
                Outcome by channel
              </h2>
            </div>
            <TrendingUp className="size-5 text-muted-subtle" aria-hidden="true" />
          </div>

          {analytics.platformOutcomes.some((platform) => platform.total > 0) ? (
            <PlatformOutcomeList outcomes={analytics.platformOutcomes} />
          ) : (
            <EmptyAnalyticsState
              compact
              description={
                activeConnectionCount > 0
                  ? "Choose accounts when scheduling to create platform-level outcomes."
                  : "Connect Instagram, TikTok, or YouTube before scheduling posts."
              }
              title="No platform outcomes yet"
            />
          )}
        </section>
      </div>

      <ConnectedAccountsDisclosure connections={connections} />

      <div className="flex items-start gap-2.5 px-1 text-xs leading-5 text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-subtle" aria-hidden="true" />
        <p>
          No sample numbers are shown here. When a chart is empty, it means there is no
          matching account or publishing data yet.
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

function MetricCard({
  icon,
  label,
  tone = "neutral",
  value,
}: {
  icon: ReactNode;
  label: string;
  tone?: "error" | "neutral" | "success";
  value: string;
}) {
  const toneClassName =
    tone === "success"
      ? "bg-success/10 text-success"
      : tone === "error"
        ? "bg-error/10 text-error"
        : "bg-brand-soft text-primary";

  return (
    <div className="rounded-card border border-border bg-card-muted/45 p-4">
      <div className="flex items-center justify-between gap-3">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-control ${toneClassName}`}
        >
          {icon}
        </span>
        <span className="font-mono text-2xl font-semibold leading-none text-foreground-strong">
          {value}
        </span>
      </div>
      <p className="mt-4 text-xs font-semibold leading-5 text-muted">{label}</p>
    </div>
  );
}

function ActivityChart({ buckets }: { buckets: ActivityBucket[] }) {
  const maxTotal = Math.max(...buckets.map((bucket) => bucket.total), 1);

  return (
    <div className="mt-6 space-y-3">
      {buckets.map((bucket) => (
        <div key={bucket.dateKey} className="grid gap-2 sm:grid-cols-[84px_minmax(0,1fr)_44px] sm:items-center">
          <div className="text-xs font-semibold text-muted">
            {formatShortDate(bucket.dateKey)}
          </div>
          <div className="h-9 overflow-hidden rounded-control border border-border bg-card-muted">
            {bucket.total > 0 ? (
              <div
                className="flex h-full min-w-6 overflow-hidden rounded-[inherit]"
                style={{ width: `${Math.max(10, (bucket.total / maxTotal) * 100)}%` }}
                aria-label={`${bucket.total} posts on ${formatFullDate(bucket.dateKey)}`}
              >
                {(["published", "planned", "failed", "cancelled"] as OutcomeKey[]).map(
                  (outcome) => {
                    const count = bucket[outcome];

                    if (count <= 0) {
                      return null;
                    }

                    return (
                      <span
                        key={outcome}
                        className={`${outcomeBarClasses[outcome]} block h-full`}
                        style={{ width: `${Math.max(8, (count / bucket.total) * 100)}%` }}
                        title={`${outcomeLabels[outcome]}: ${count}`}
                      />
                    );
                  },
                )}
              </div>
            ) : null}
          </div>
          <div className="text-right font-mono text-sm font-semibold text-foreground-strong">
            {bucket.total}
          </div>
        </div>
      ))}
    </div>
  );
}

function OutcomeLegend() {
  return (
    <div className="flex flex-wrap gap-2">
      {(["published", "planned", "failed", "cancelled"] as OutcomeKey[]).map(
        (outcome) => (
          <span
            key={outcome}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted"
          >
            <span
              className={`size-2 rounded-full ${outcomeBarClasses[outcome]}`}
              aria-hidden="true"
            />
            {outcomeLabels[outcome]}
          </span>
        ),
      )}
    </div>
  );
}

function PlatformOutcomeList({ outcomes }: { outcomes: PlatformOutcome[] }) {
  return (
    <div className="mt-6 space-y-4">
      {outcomes.map((outcome) => {
        const hasData = outcome.total > 0;

        return (
          <div key={outcome.platform} className="border-t border-border pt-4 first:border-t-0 first:pt-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-card-muted">
                  <SocialPlatformIcon platform={outcome.platform} className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground-strong">
                    {platformLabels[outcome.platform]}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {hasData ? `${outcome.total} platform targets` : "No targets yet"}
                  </p>
                </div>
              </div>
              <span className="font-mono text-lg font-semibold text-foreground-strong">
                {outcome.published}
              </span>
            </div>

            {hasData ? (
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <OutcomePill label="Published" value={outcome.published} />
                <OutcomePill label="Planned" value={outcome.planned} />
                <OutcomePill
                  label="Attention"
                  tone={outcome.failed > 0 ? "error" : "neutral"}
                  value={outcome.failed}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function OutcomePill({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "error" | "neutral";
  value: number;
}) {
  return (
    <div
      className={`rounded-control border px-2.5 py-2 ${
        tone === "error"
          ? "border-error/20 bg-error/5 text-error"
          : "border-border bg-card-muted text-muted"
      }`}
    >
      <span className="block font-mono text-sm font-semibold text-foreground-strong">
        {value}
      </span>
      <span className="mt-0.5 block font-semibold">{label}</span>
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
                description="Connect Instagram, TikTok, or YouTube to create platform-level analytics from real publishing activity."
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
      href="/connected-accounts"
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
  activityBuckets: ActivityBucket[];
  activityRangeLabel: string;
  activityTotal: number;
  needsAttentionTargets: number;
  platformOutcomes: PlatformOutcome[];
  publishedTargets: number;
  totalPosts: number;
  upcomingTargets: number;
};

function buildAnalyticsSummary({
  connections,
  schedules,
}: {
  connections: SocialConnection[];
  schedules: ScheduledPost[];
}): AnalyticsSummary {
  const datedSchedules = schedules
    .map((schedule) => ({
      dateKey: getScheduleDateKey(schedule),
      outcome: getScheduleOutcome(schedule),
      schedule,
    }))
    .filter((entry): entry is {
      dateKey: string;
      outcome: OutcomeKey;
      schedule: ScheduledPost;
    } => Boolean(entry.dateKey));
  const rangeKeys = getActivityRangeKeys(datedSchedules.map((entry) => entry.dateKey));
  const bucketMap = new Map(
    rangeKeys.map((dateKey) => [
      dateKey,
      {
        cancelled: 0,
        dateKey,
        failed: 0,
        planned: 0,
        published: 0,
        total: 0,
      } satisfies ActivityBucket,
    ]),
  );

  for (const entry of datedSchedules) {
    const bucket = bucketMap.get(entry.dateKey);

    if (!bucket) {
      continue;
    }

    bucket[entry.outcome] += 1;
    bucket.total += 1;
  }

  const targets = schedules.flatMap((schedule) => schedule.targets);
  const platformOutcomes = schedulePlatforms.map((platform) => {
    const platformTargets = targets.filter((target) => target.platform === platform);
    const outcome: PlatformOutcome = {
      cancelled: 0,
      failed: 0,
      planned: 0,
      platform,
      published: 0,
      total: platformTargets.length,
    };

    for (const target of platformTargets) {
      outcome[getTargetOutcome(target)] += 1;
    }

    return outcome;
  });
  const targetsNeedingAttention = targets.filter(
    (target) => getTargetOutcome(target) === "failed",
  ).length;
  const scheduleLevelFailuresWithoutTargets = schedules.filter(
    (schedule) =>
      schedule.targets.length === 0 &&
      (schedule.status === "failed" || schedule.status === "partially_failed"),
  ).length;
  const upcomingTargets = targets.filter(
    (target) => getTargetOutcome(target) === "planned",
  ).length;
  const connectedPlatforms = new Set(
    connections
      .filter((connection) => connection.status === "connected")
      .map((connection) => connection.platform),
  );

  return {
    activityBuckets: Array.from(bucketMap.values()),
    activityRangeLabel: getRangeLabel(rangeKeys),
    activityTotal: Array.from(bucketMap.values()).reduce(
      (sum, bucket) => sum + bucket.total,
      0,
    ),
    needsAttentionTargets: targetsNeedingAttention + scheduleLevelFailuresWithoutTargets,
    platformOutcomes: platformOutcomes.sort((first, second) => {
      const firstConnected = connectedPlatforms.has(first.platform) ? 0 : 1;
      const secondConnected = connectedPlatforms.has(second.platform) ? 0 : 1;

      return firstConnected - secondConnected || second.total - first.total;
    }),
    publishedTargets: targets.filter((target) => target.status === "published").length,
    totalPosts: schedules.length,
    upcomingTargets,
  };
}

function getScheduleOutcome(schedule: ScheduledPost): OutcomeKey {
  if (schedule.status === "published") {
    return "published";
  }

  if (schedule.status === "failed" || schedule.status === "partially_failed") {
    return "failed";
  }

  if (schedule.status === "cancelled") {
    return "cancelled";
  }

  return "planned";
}

function getTargetOutcome(target: ScheduledPostTarget): OutcomeKey {
  if (target.status === "published") {
    return "published";
  }

  if (target.status === "failed" || target.status === "action_required") {
    return "failed";
  }

  if (target.status === "cancelled" || target.status === "skipped") {
    return "cancelled";
  }

  return "planned";
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

function getActivityRangeKeys(dateKeys: string[]) {
  const today = startOfDay(new Date());
  const currentRangeStart = addDays(today, -(ACTIVITY_DAYS - 1));
  const currentRangeKeys = Array.from({ length: ACTIVITY_DAYS }, (_, index) =>
    toDateKey(addDays(currentRangeStart, index)),
  );
  const hasCurrentActivity = dateKeys.some((dateKey) =>
    currentRangeKeys.includes(dateKey),
  );

  if (hasCurrentActivity || dateKeys.length === 0) {
    return currentRangeKeys;
  }

  const latestKey = [...dateKeys].sort().at(-1) ?? toDateKey(today);
  const latestDate = parseDateKey(latestKey) ?? today;
  const rangeStart = addDays(latestDate, -(ACTIVITY_DAYS - 1));

  return Array.from({ length: ACTIVITY_DAYS }, (_, index) =>
    toDateKey(addDays(rangeStart, index)),
  );
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
