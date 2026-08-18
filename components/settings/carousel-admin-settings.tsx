"use client";

import {
  BarChart3,
  Check,
  LoaderCircle,
  RefreshCw,
  Route,
  Save,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type {
  CarouselAdminAnalyticsRow,
  CarouselAdminDashboard,
  CarouselAdminSettings,
} from "@/lib/carousel/admin-types";
import { CAROUSEL_CONTENT_FORMAT_IDS } from "@/lib/carousel/content-grammar";
import { CAROUSEL_STRUCTURE_2_FORMAT_IDS } from "@/lib/carousel/structure-2-formats";
import type {
  CarouselStructureId,
  CarouselStructureMode,
} from "@/lib/carousel/structure";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { cn } from "@/lib/utils";

type CarouselAdminApiResponse = {
  dashboard?: CarouselAdminDashboard;
  message?: string;
  ok?: boolean;
  settings?: CarouselAdminSettings;
};

type AccessState = "checking" | "denied" | "granted";

const MODE_OPTIONS: Array<{
  description: string;
  label: string;
  mode: CarouselStructureMode;
  shortLabel: string;
}> = [
  {
    description:
      "Alternate complete five-carousel batches. Each structure keeps its own format history.",
    label: "Rotate 50/50",
    mode: "rotate",
    shortLabel: "Rotate",
  },
  {
    description:
      "Route every future batch to informational Structure 1. Structure 2 history stays preserved.",
    label: "Structure 1 only",
    mode: "structure_1_only",
    shortLabel: "S1",
  },
  {
    description:
      "Route every future batch to story-native Structure 2. Structure 1 history stays preserved.",
    label: "Structure 2 only",
    mode: "structure_2_only",
    shortLabel: "S2",
  },
];

const STRUCTURE_META: Record<
  CarouselStructureId,
  { description: string; label: string }
> = {
  structure_1: {
    description: "Informational format system",
    label: "Structure 1",
  },
  structure_2: {
    description: "Eight-format story system",
    label: "Structure 2",
  },
};

export function CarouselAdminSettings() {
  const [accessState, setAccessState] = useState<AccessState>("checking");
  const [dashboard, setDashboard] = useState<CarouselAdminDashboard | null>(
    null,
  );
  const [draftMode, setDraftMode] = useState<CarouselStructureMode | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadDashboard = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    setLoadError(null);

    try {
      const token = await getRequiredToken();
      const response = await fetch("/api/admin/carousel", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json().catch(() => null)) as
        | CarouselAdminApiResponse
        | null;

      if (response.status === 401 || response.status === 403) {
        setAccessState("denied");
        return;
      }
      if (!response.ok || data?.ok !== true || !data.dashboard) {
        throw new Error(
          data?.message ??
            "Could not load Carousel administration data. Refresh and try again.",
        );
      }

      setDashboard(data.dashboard);
      setDraftMode(data.dashboard.settings.structureMode);
      setAccessState("granted");
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Could not load Carousel administration data. Refresh and try again.",
      );
      setAccessState("granted");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  const structureRows = useMemo(
    () =>
      (["structure_1", "structure_2"] as const).map(
        (structureId) =>
          dashboard?.analytics.find(
            (row) =>
              row.scope === "structure" && row.structureId === structureId,
          ) ?? emptyStructureRow(structureId),
      ),
    [dashboard],
  );

  if (accessState !== "granted") {
    return null;
  }

  const savedMode = dashboard?.settings.structureMode ?? null;
  const hasUnsavedChange = Boolean(
    draftMode && savedMode && draftMode !== savedMode,
  );

  async function saveMode() {
    if (!draftMode || !dashboard || !hasUnsavedChange) return;

    setIsSaving(true);
    setSaveError(null);
    setSavedMessage(null);

    try {
      const token = await getRequiredToken();
      const response = await fetch("/api/admin/carousel", {
        body: JSON.stringify({ structureMode: draftMode }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const data = (await response.json().catch(() => null)) as
        | CarouselAdminApiResponse
        | null;

      if (!response.ok || data?.ok !== true || !data.settings) {
        throw new Error(
          data?.message ?? "Could not update Carousel routing. Try again.",
        );
      }

      setDashboard((current) =>
        current ? { ...current, settings: data.settings! } : current,
      );
      setSavedMessage(
        `${getModeLabel(data.settings.structureMode)} is now active for future batches.`,
      );
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Could not update Carousel routing. Try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="relative overflow-hidden rounded-[var(--radius-panel)] border border-primary/25 bg-card shadow-card">
      <span
        className="absolute inset-y-0 left-0 w-1 bg-primary"
        aria-hidden="true"
      />
      <header className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-brand-soft text-primary">
            <Route className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-foreground-strong">
                Carousel routing
              </h2>
              <Badge variant="pro">Admin</Badge>
              {savedMode ? (
                <Badge variant="outline">{getModeLabel(savedMode)}</Badge>
              ) : null}
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
              Control the structure used by future five-carousel batches and
              compare performance without mixing structure histories.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void loadDashboard(true)}
          disabled={isRefreshing || isSaving}
          className="w-full sm:w-auto"
        >
          <RefreshCw
            data-icon="inline-start"
            className={
              isRefreshing ? "animate-spin motion-reduce:animate-none" : ""
            }
            aria-hidden="true"
          />
          Refresh
        </Button>
      </header>

      <Separator />

      {loadError ? (
        <div className="px-5 py-5 sm:px-6">
          <Alert variant="destructive" aria-live="polite">
            <AlertTitle>Carousel administration unavailable</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        </div>
      ) : dashboard && draftMode ? (
        <>
          <div className="px-5 py-5 sm:px-6">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-bold text-foreground-strong">
                  Batch routing mode
                </p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  A change affects new batches only; existing content and both
                  structures&apos; histories remain unchanged.
                </p>
              </div>
              <p className="text-xs font-medium text-muted-subtle">
                Configuration v{dashboard.settings.structureConfigVersion}
              </p>
            </div>

            <div
              className="grid overflow-hidden rounded-[var(--radius-control)] border border-border-strong bg-card-muted/40 md:grid-cols-3"
              role="radiogroup"
              aria-label="Global Carousel routing mode"
            >
              {MODE_OPTIONS.map((option, index) => {
                const selected = draftMode === option.mode;

                return (
                  <button
                    key={option.mode}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={cn(
                      "relative min-h-36 px-4 py-4 text-left transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                      index > 0 && "border-t border-border md:border-l md:border-t-0",
                      selected
                        ? "bg-brand-soft text-foreground-strong"
                        : "hover:bg-card text-foreground",
                    )}
                    onClick={() => {
                      setDraftMode(option.mode);
                      setSaveError(null);
                      setSavedMessage(null);
                    }}
                    disabled={isSaving}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="flex size-8 items-center justify-center rounded-full border border-border-strong bg-card text-xs font-black text-primary">
                        {option.shortLabel}
                      </span>
                      {selected ? (
                        <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3.5" aria-hidden="true" />
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-3 block text-sm font-bold">
                      {option.label}
                    </span>
                    <span className="mt-1.5 block text-xs leading-5 text-muted">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-muted-subtle">
                Last changed {formatDateTime(dashboard.settings.updatedAt)}
              </p>
              <Button
                type="button"
                size="lg"
                onClick={() => void saveMode()}
                disabled={!hasUnsavedChange || isSaving}
                className="w-full sm:w-auto"
              >
                {isSaving ? (
                  <LoaderCircle
                    data-icon="inline-start"
                    className="animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : (
                  <Save data-icon="inline-start" aria-hidden="true" />
                )}
                {isSaving ? "Saving…" : "Save routing"}
              </Button>
            </div>

            {saveError ? (
              <Alert
                variant="destructive"
                className="mt-4"
                aria-live="polite"
              >
                <AlertTitle>Routing was not changed</AlertTitle>
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            ) : null}
            {savedMessage ? (
              <Alert
                className="mt-4 border-success/25 bg-success/5"
                aria-live="polite"
              >
                <Check className="text-success" aria-hidden="true" />
                <AlertTitle className="text-success">Routing updated</AlertTitle>
                <AlertDescription>{savedMessage}</AlertDescription>
              </Alert>
            ) : null}
          </div>

          <Separator />

          <div className="px-5 py-5 sm:px-6">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-card-muted text-primary">
                <BarChart3 className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-foreground-strong">
                  Structure analytics
                </h3>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Last {dashboard.windowDays} days. Views use frozen seven-day
                  evidence, so new publishes may not have comparable results yet.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {structureRows.map((row) => (
                <StructureSummary key={row.structureId} row={row} />
              ))}
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              {(["structure_1", "structure_2"] as const).map(
                (structureId) => (
                  <FormatTable
                    key={structureId}
                    rows={dashboard.analytics.filter(
                      (row) =>
                        row.scope === "format" &&
                        row.structureId === structureId,
                    )}
                    structureId={structureId}
                  />
                ),
              )}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

function StructureSummary({ row }: { row: CarouselAdminAnalyticsRow }) {
  const meta = STRUCTURE_META[row.structureId];

  return (
    <article className="rounded-[var(--radius-control)] border border-border bg-card-muted/35 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-foreground-strong">
            {meta.label}
          </h4>
          <p className="mt-0.5 text-xs text-muted">{meta.description}</p>
        </div>
        <Badge variant={row.structureId === "structure_2" ? "pro" : "info"}>
          {formatCount(row.generatedCount)} generated
        </Badge>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Metric label="Saves" value={row.savedCount} />
        <Metric label="Schedules" value={row.scheduledCount} />
        <Metric label="Publishes" value={row.publishedCount} />
        <Metric
          label="Median 7d views"
          value={row.medianViewCount}
          suffix={
            row.evaluatedPostCount > 0
              ? `${formatCount(row.evaluatedPostCount)} evaluated`
              : "No evidence yet"
          }
        />
      </dl>
    </article>
  );
}

function Metric({
  label,
  suffix,
  value,
}: {
  label: string;
  suffix?: string;
  value: number | null;
}) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-subtle">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-black tracking-[-0.025em] text-foreground-strong">
        {value === null ? "—" : formatCount(value)}
      </dd>
      {suffix ? <p className="mt-0.5 text-[11px] text-muted">{suffix}</p> : null}
    </div>
  );
}

function FormatTable({
  rows,
  structureId,
}: {
  rows: CarouselAdminAnalyticsRow[];
  structureId: CarouselStructureId;
}) {
  const formatIds =
    structureId === "structure_1"
      ? CAROUSEL_CONTENT_FORMAT_IDS
      : CAROUSEL_STRUCTURE_2_FORMAT_IDS;
  const rowsByFormatId = new Map(
    rows.map((row) => [row.contentFormatId, row] as const),
  );
  const sortedRows = formatIds.map(
    (formatId) =>
      rowsByFormatId.get(formatId) ?? emptyFormatRow(structureId, formatId),
  );
  const meta = STRUCTURE_META[structureId];

  return (
    <article className="overflow-hidden rounded-[var(--radius-control)] border border-border">
      <header className="flex items-center justify-between gap-3 bg-card-muted/45 px-4 py-3">
        <div>
          <h4 className="text-sm font-bold text-foreground-strong">
            {meta.label} formats
          </h4>
          <p className="mt-0.5 text-xs text-muted">
            Isolated format history and outcomes
          </p>
        </div>
        <Badge variant="outline">{sortedRows.length} formats</Badge>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead className="border-y border-border bg-card text-muted-subtle">
            <tr>
              <th className="px-4 py-2.5 font-bold">Format</th>
              <th className="px-3 py-2.5 text-right font-bold">Generated</th>
              <th className="px-3 py-2.5 text-right font-bold">Saved</th>
              <th className="px-3 py-2.5 text-right font-bold">Scheduled</th>
              <th className="px-3 py-2.5 text-right font-bold">Published</th>
              <th className="px-4 py-2.5 text-right font-bold">Median views</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedRows.length > 0 ? (
              sortedRows.map((row) => (
                <tr key={`${row.structureId}:${row.contentFormatId}`}>
                  <td className="max-w-52 px-4 py-3">
                    <p className="truncate font-bold text-foreground-strong">
                      {humanizeFormatId(row.contentFormatId)}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-muted-subtle">
                      {row.contentFormatId}
                    </p>
                  </td>
                  <TableNumber value={row.generatedCount} />
                  <TableNumber value={row.savedCount} />
                  <TableNumber value={row.scheduledCount} />
                  <TableNumber value={row.publishedCount} />
                  <TableNumber
                    value={row.medianViewCount}
                    className="px-4"
                  />
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-7 text-center text-sm text-muted"
                >
                  No format activity in this window yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function TableNumber({
  className,
  value,
}: {
  className?: string;
  value: number | null;
}) {
  return (
    <td className={cn("px-3 py-3 text-right font-semibold text-foreground", className)}>
      {value === null ? "—" : formatCount(value)}
    </td>
  );
}

function emptyStructureRow(
  structureId: CarouselStructureId,
): CarouselAdminAnalyticsRow {
  return {
    averageViewCount: null,
    contentFormatId: null,
    evaluatedPostCount: 0,
    generatedCount: 0,
    medianViewCount: null,
    publishedCount: 0,
    savedCount: 0,
    scheduledCount: 0,
    scope: "structure",
    structureId,
    totalViewCount: 0,
  };
}

function emptyFormatRow(
  structureId: CarouselStructureId,
  contentFormatId: string,
): CarouselAdminAnalyticsRow {
  return {
    averageViewCount: null,
    contentFormatId,
    evaluatedPostCount: 0,
    generatedCount: 0,
    medianViewCount: null,
    publishedCount: 0,
    savedCount: 0,
    scheduledCount: 0,
    scope: "format",
    structureId,
    totalViewCount: 0,
  };
}

async function getRequiredToken() {
  const token = await getCurrentUserIdToken();

  if (!token) {
    throw new Error("Sign in again to manage Carousel routing.");
  }

  return token;
}

function getModeLabel(mode: CarouselStructureMode) {
  return MODE_OPTIONS.find((option) => option.mode === mode)?.label ?? mode;
}

function humanizeFormatId(value: string | null) {
  if (!value) return "Unknown format";

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatCount(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
    value,
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "recently";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
