"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Film,
} from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { getSocialConnectionAnalyticsLabel } from "@/lib/analytics/social-account-selection";
import { buildYouTubePublicationActivity } from "@/lib/analytics/youtube-publication-activity";
import type { ScheduledPost } from "@/lib/scheduling/types";
import type { SocialConnection } from "@/lib/social/types";

export function YouTubeBetaPublicationPanel({
  connections,
  schedules,
  selectedConnectionId = "all",
}: {
  connections: SocialConnection[];
  schedules: ScheduledPost[];
  selectedConnectionId?: string;
}) {
  const accountLabels = useMemo(
    () =>
      new Map(
        connections
          .filter((connection) => connection.platform === "youtube")
          .map((connection) => [
            connection.id,
            getSocialConnectionAnalyticsLabel(connection),
          ]),
      ),
    [connections],
  );
  const activity = useMemo(
    () =>
      buildYouTubePublicationActivity(
        schedules,
        selectedConnectionId === "all"
          ? undefined
          : { connectionId: selectedConnectionId },
      ),
    [schedules, selectedConnectionId],
  );

  return (
    <section className="mt-6 rounded-[var(--radius-panel)] border border-border bg-card p-5 shadow-card sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">YouTube beta</p>
          <h2 className="mt-1 text-xl font-bold tracking-[-0.02em] text-foreground">
            Upload activity
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Tracks YouTube videos scheduled through UGC Pilot, including their
            publish state and the YouTube link after upload. Performance
            metrics such as views and watch time are not collected yet.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-control border border-border bg-card-muted px-3 py-2 text-xs font-semibold text-muted">
          <Film className="size-3.5" aria-hidden="true" />
          Publishing records
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Metric label="Published" value={activity.published} />
        <Metric label="Scheduled" value={activity.scheduled} />
        <Metric label="Needs attention" value={activity.needsAttention} />
      </div>

      {activity.rows.length === 0 ? (
        <p className="mt-5 rounded-control border border-dashed border-border bg-card-muted/45 px-4 py-4 text-sm font-medium text-muted">
          No YouTube uploads have been scheduled from this account yet.
        </p>
      ) : (
        <div className="mt-5 divide-y divide-border overflow-hidden rounded-control border border-border">
          {activity.rows.slice(0, 8).map((row) => (
            <article
              key={row.id}
              className="flex flex-col gap-3 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {row.title}
                  </p>
                  <PublicationStatusBadge status={row.status} />
                </div>
                <p className="mt-1 text-xs font-medium text-muted">
                  {getDateLabel(row.status, row.date)}
                </p>
                {selectedConnectionId === "all" ? (
                  <p className="mt-1 text-xs font-semibold text-muted">
                    {accountLabels.get(row.connectionId) ?? "YouTube account"}
                  </p>
                ) : null}
                {row.errorMessage ? (
                  <p className="mt-2 text-xs font-medium text-error">
                    {row.errorMessage}
                  </p>
                ) : null}
              </div>

              {row.platformPostUrl ? (
                <a
                  href={row.platformPostUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit shrink-0 items-center gap-1.5 text-sm font-semibold text-primary transition hover:underline"
                >
                  Open in YouTube
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-control border border-border bg-card-muted/45 px-3 py-3">
      <span className="block font-mono text-xl font-bold text-foreground">
        {value.toLocaleString()}
      </span>
      <span className="mt-1 block text-xs font-semibold text-muted">{label}</span>
    </div>
  );
}

function PublicationStatusBadge({
  status,
}: {
  status: "attention" | "draft" | "published" | "scheduled";
}) {
  if (status === "published") {
    return (
      <Badge variant="published">
        <CheckCircle2 data-icon="inline-start" />
        Published
      </Badge>
    );
  }

  if (status === "attention") {
    return (
      <Badge variant="failed">
        <AlertCircle data-icon="inline-start" />
        Needs attention
      </Badge>
    );
  }

  if (status === "scheduled") {
    return (
      <Badge variant="scheduled">
        <Clock3 data-icon="inline-start" />
        Scheduled
      </Badge>
    );
  }

  return <Badge variant="draft">Draft</Badge>;
}

function getDateLabel(
  status: "attention" | "draft" | "published" | "scheduled",
  value: string,
) {
  const date = new Date(value);
  const formatted = Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);

  if (status === "published") {
    return `Published ${formatted}`;
  }

  if (status === "attention") {
    return `Last updated ${formatted}`;
  }

  if (status === "scheduled") {
    return `Scheduled for ${formatted}`;
  }

  return `Updated ${formatted}`;
}
