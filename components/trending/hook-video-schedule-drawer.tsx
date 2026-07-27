"use client";

import {
  ArrowLeft,
  CalendarClock,
  Check,
  Loader2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { SocialPlatformIcon } from "@/components/social/platform-icon";
import {
  getDefaultScheduleTargetSettings,
  getScheduleTargetSettingsError,
  type ScheduleTargetSettings,
  type TikTokScheduleCapabilityState,
} from "@/lib/scheduling/platform-settings";
import {
  DEFAULT_MINIMUM_RENDER_LEAD_MINUTES,
  resolveZonedDateTime,
  ScheduleTimeError,
  validateScheduleLeadTime,
} from "@/lib/scheduling/schedule-time";
import {
  getTikTokPrivacyLabel,
  type TikTokPublishCapabilities,
} from "@/lib/social/tiktok-publishing";
import type { SocialConnection, SocialPlatform } from "@/lib/social/types";
import { cn } from "@/lib/utils";

type ConnectionsResponse =
  | { connections: SocialConnection[]; ok: true }
  | { message?: string; ok?: false };

type TikTokCapabilitiesResponse =
  | { capabilities: TikTokPublishCapabilities; ok: true }
  | { message?: string; ok?: false };

type ScheduleConfigResponse =
  | { minimumRenderLeadMinutes: number; ok: true }
  | { message?: string; ok?: false };

type PublishingSettings = ScheduleTargetSettings;

export type HookVideoScheduleSelection = {
  scheduledDate: string;
  scheduledTime: string;
  targets: Array<{
    connectionId: string;
    platform: SocialPlatform;
    settings: PublishingSettings;
  }>;
  timezone: string;
};

export type HookVideoScheduleSummary = {
  demoTitle: string;
  hookText: string;
  influencerName: string;
};

const platformDetails: Record<SocialPlatform, { label: string }> = {
  instagram: { label: "Instagram" },
  tiktok: { label: "TikTok" },
  youtube: { label: "YouTube" },
};

export function HookVideoScheduleDrawer({
  onClose,
  onConfirm,
  summary,
}: {
  onClose: () => void;
  onConfirm: (selection: HookVideoScheduleSelection) => Promise<void>;
  summary: HookVideoScheduleSummary;
}) {
  const initialDateTime = useMemo(() => getInitialDateTime(), []);
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    [],
  );
  const [stage, setStage] = useState<"details" | "review">("details");
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>([]);
  const [settings, setSettings] = useState<Record<string, PublishingSettings>>({});
  const [tiktokCapabilities, setTikTokCapabilities] = useState<
    Record<string, TikTokScheduleCapabilityState>
  >({});
  const [scheduledDate, setScheduledDate] = useState(initialDateTime.date);
  const [scheduledTime, setScheduledTime] = useState(initialDateTime.time);
  const [minimumRenderLeadMinutes, setMinimumRenderLeadMinutes] = useState(
    DEFAULT_MINIMUM_RENDER_LEAD_MINUTES,
  );
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const token = await requireToken();
      const [connectionsResponse, configResponse] = await Promise.all([
        fetch("/api/social/connections", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/schedules?configOnly=1", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const data = (await connectionsResponse.json().catch(() => null)) as
        | ConnectionsResponse
        | null;
      const configData = (await configResponse.json().catch(() => null)) as
        | ScheduleConfigResponse
        | null;

      if (!connectionsResponse.ok || !data || data.ok !== true) {
        throw new Error(getApiMessage(data, "Could not load connected accounts."));
      }
      if (!configResponse.ok || !configData || configData.ok !== true) {
        throw new Error(getApiMessage(configData, "Could not load scheduling settings."));
      }

      setConnections(data.connections);
      const configuredLeadMinutes = Number.isFinite(
        configData.minimumRenderLeadMinutes,
      )
        ? Math.max(1, Math.ceil(configData.minimumRenderLeadMinutes))
        : DEFAULT_MINIMUM_RENDER_LEAD_MINUTES;
      const nextDateTime = getInitialDateTime(configuredLeadMinutes);

      setMinimumRenderLeadMinutes(configuredLeadMinutes);
      setScheduledDate(nextDateTime.date);
      setScheduledTime(nextDateTime.time);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not load connected accounts."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadConnections(), 0);

    return () => window.clearTimeout(timer);
  }, [loadConnections]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) onClose();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, submitting]);

  // Keep every provider in state so legacy schedules and provider-specific
  // validation remain intact. New Reel scheduling only exposes Instagram.
  const visibleConnections = useMemo(
    () =>
      connections.filter(
        (connection) => connection.platform === "instagram",
      ),
    [connections],
  );
  const selectedConnections = visibleConnections.filter((connection) =>
    selectedConnectionIds.includes(connection.id),
  );
  const connectedCount = visibleConnections.filter(
    (connection) => connection.status === "connected",
  ).length;

  async function loadTikTokCapabilities(connectionId: string) {
    setTikTokCapabilities((current) => ({
      ...current,
      [connectionId]: { status: "loading" },
    }));

    try {
      const token = await requireToken();
      const response = await fetch(
        `/api/social/connections/${encodeURIComponent(connectionId)}/publish-settings`,
        {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = (await response.json().catch(() => null)) as
        | TikTokCapabilitiesResponse
        | null;

      if (!response.ok || !data || data.ok !== true) {
        throw new Error(getApiMessage(data, "Could not load TikTok settings."));
      }

      setTikTokCapabilities((current) => ({
        ...current,
        [connectionId]: { capabilities: data.capabilities, status: "ready" },
      }));
    } catch (error) {
      setTikTokCapabilities((current) => ({
        ...current,
        [connectionId]: {
          message: getErrorMessage(error, "Could not load TikTok settings."),
          status: "error",
        },
      }));
    }
  }

  function toggleConnection(connection: SocialConnection) {
    if (connection.status !== "connected") return;

    const selecting = !selectedConnectionIds.includes(connection.id);
    setSelectedConnectionIds((current) =>
      selecting
        ? [...current, connection.id]
        : current.filter((connectionId) => connectionId !== connection.id),
    );
    setSettings((current) =>
      current[connection.id]
        ? current
        : {
            ...current,
            [connection.id]: getDefaultScheduleTargetSettings(
              connection.platform,
            ),
          },
    );

    if (
      selecting &&
      connection.platform === "tiktok" &&
      !tiktokCapabilities[connection.id]
    ) {
      void loadTikTokCapabilities(connection.id);
    }
  }

  function updateSetting(
    connectionId: string,
    key: string,
    value: boolean | string,
  ) {
    setSettings((current) => ({
      ...current,
      [connectionId]: {
        ...(current[connectionId] ?? {}),
        [key]: value,
      },
    }));
  }

  function continueToReview() {
    const validationError = getValidationError({
      scheduledDate,
      scheduledTime,
      selectedConnections,
      settings,
      tiktokCapabilities,
      minimumRenderLeadMinutes,
      timezone,
    });

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setErrorMessage(null);
    setStage("review");
  }

  async function confirmSchedule() {
    const selection: HookVideoScheduleSelection = {
      scheduledDate,
      scheduledTime,
      targets: selectedConnections.map((connection) => ({
        connectionId: connection.id,
        platform: connection.platform,
        settings:
          settings[connection.id] ??
          getDefaultScheduleTargetSettings(connection.platform),
      })),
      timezone,
    };

    setSubmitting(true);
    setErrorMessage(null);

    try {
      await onConfirm(selection);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not schedule this video."));
      setSubmitting(false);
    }
  }

  return (
    <div className="absolute inset-0 z-50" role="presentation">
      <button
        type="button"
        aria-label="Close schedule"
        className="absolute inset-0 cursor-default bg-foreground-strong/24 backdrop-blur-[1px]"
        onClick={() => {
          if (!submitting) onClose();
        }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="hook-schedule-heading"
        className="absolute inset-x-0 bottom-0 flex max-h-[86dvh] flex-col border-t border-border bg-card shadow-[0_-16px_42px_rgb(23_23_27_/_0.16)] sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[410px] sm:border-l sm:border-t-0 sm:shadow-[-16px_0_42px_rgb(23_23_27_/_0.14)]"
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            {stage === "review" ? (
              <button
                type="button"
                onClick={() => setStage("details")}
                disabled={submitting}
                className="inline-flex size-8 items-center justify-center rounded-full text-muted hover:bg-card-muted hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                aria-label="Back to schedule details"
                title="Back"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
              </button>
            ) : (
              <CalendarClock className="size-4 text-primary" aria-hidden="true" />
            )}
            <h3 id="hook-schedule-heading" className="text-sm font-semibold text-foreground-strong">
              {stage === "review" ? "Review schedule" : "Schedule"}
            </h3>
          </div>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            disabled={submitting}
            className="inline-flex size-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-card-muted hover:text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"
            aria-label="Close schedule"
            title="Close"
          >
            <X className="size-4.5" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {stage === "details" ? (
            <>
              <section aria-labelledby="schedule-accounts-heading">
                <div className="flex items-center justify-between gap-3">
                  <h4 id="schedule-accounts-heading" className="text-xs font-semibold text-foreground-strong">
                    Accounts
                  </h4>
                  <span className="flex items-center gap-2 text-xs font-medium text-muted">
                    {loading ? "Loading" : `${connectedCount} connected`}
                    {!loading ? (
                      <Link
                        href="/settings#instagram-publishing"
                        className="font-semibold text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        Manage
                      </Link>
                    ) : null}
                  </span>
                </div>

                {loading ? (
                  <div className="mt-3 space-y-2">
                    {[0, 1, 2].map((item) => (
                      <div key={item} className="h-14 animate-pulse border border-border bg-card-muted motion-reduce:animate-none" />
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {visibleConnections.map((connection) => (
                      <ConnectionRow
                        key={connection.id}
                        connection={connection}
                        selected={selectedConnectionIds.includes(connection.id)}
                        settings={
                          settings[connection.id] ??
                          getDefaultScheduleTargetSettings(connection.platform)
                        }
                        tiktokCapability={tiktokCapabilities[connection.id]}
                        onSettingChange={(key, value) =>
                          updateSetting(connection.id, key, value)
                        }
                        onToggle={() => toggleConnection(connection)}
                      />
                    ))}
                    {visibleConnections.length === 0 ? (
                      <div className="border border-dashed border-border-strong px-3 py-5 text-center">
                        <p className="text-xs font-medium text-muted">
                          No Instagram account connected.
                        </p>
                        <Link
                          href="/settings#instagram-publishing"
                          className="mt-2 inline-flex text-xs font-semibold text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                        >
                          Connect an account
                        </Link>
                      </div>
                    ) : null}
                  </div>
                )}
              </section>

              <section className="mt-5 border-t border-border pt-4" aria-labelledby="schedule-time-heading">
                <h4 id="schedule-time-heading" className="text-xs font-semibold text-foreground-strong">
                  Date and time
                </h4>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-muted">
                    Date
                    <input
                      type="date"
                      min={getLocalDate(new Date())}
                      value={scheduledDate}
                      onChange={(event) => setScheduledDate(event.target.value)}
                      className="mt-1.5 h-10 w-full rounded-control border border-border bg-card px-3 text-sm font-semibold text-foreground-strong outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </label>
                  <label className="text-xs font-semibold text-muted">
                    Time
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(event) => setScheduledTime(event.target.value)}
                      className="mt-1.5 h-10 w-full rounded-control border border-border bg-card px-3 text-sm font-semibold text-foreground-strong outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </label>
                </div>
                <p className="mt-2 text-[11px] font-medium leading-4 text-muted">
                  {timezone}. Allow at least {minimumRenderLeadMinutes}{" "}
                  {minimumRenderLeadMinutes === 1 ? "minute" : "minutes"} for
                  video preparation.
                </p>
              </section>
            </>
          ) : (
            <ScheduleReview
              connections={selectedConnections}
              scheduledDate={scheduledDate}
              scheduledTime={scheduledTime}
              summary={summary}
              timezone={timezone}
            />
          )}

          {errorMessage ? (
            <p role="alert" className="mt-4 border-l-2 border-error px-3 py-1 text-sm font-semibold leading-5 text-error">
              {errorMessage}
            </p>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-border bg-card px-4 py-3">
          <button
            type="button"
            onClick={stage === "details" ? continueToReview : () => void confirmSchedule()}
            disabled={loading || submitting}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : stage === "review" ? (
              <CalendarClock className="size-4" aria-hidden="true" />
            ) : (
              <Check className="size-4" aria-hidden="true" />
            )}
            {stage === "review" ? "Confirm schedule" : "Review"}
          </button>
        </footer>
      </aside>
    </div>
  );
}

// Provider-specific controls remain here for legacy/internal schedule targets.
// The current picker only passes Instagram connections into this component.
function ConnectionRow({
  connection,
  selected,
  settings,
  tiktokCapability,
  onSettingChange,
  onToggle,
}: {
  connection: SocialConnection;
  selected: boolean;
  settings: PublishingSettings;
  tiktokCapability: TikTokScheduleCapabilityState | undefined;
  onSettingChange: (key: string, value: boolean | string) => void;
  onToggle: () => void;
}) {
  const { label } = platformDetails[connection.platform];
  const available = connection.status === "connected";

  return (
    <div className={cn("border bg-card", selected ? "border-primary" : "border-border", !available && "opacity-55")}>
      <label className={cn("flex min-h-14 items-center gap-3 px-3 py-2", available ? "cursor-pointer" : "cursor-not-allowed")}>
        <input
          type="checkbox"
          checked={selected}
          disabled={!available}
          onChange={onToggle}
          className="size-4 shrink-0 accent-primary"
        />
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card-muted text-muted">
          <SocialPlatformIcon platform={connection.platform} className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-foreground-strong">
            {connection.platformAccountName || connection.platformAccountUsername || label}
          </span>
          <span className="mt-0.5 block text-[11px] font-medium text-muted">
            {available ? label : "Reconnect required"}
          </span>
        </span>
      </label>

      {selected && connection.platform === "tiktok" ? (
        <div className="border-t border-border px-3 py-3">
          {!tiktokCapability ||
          tiktokCapability.status === "idle" ||
          tiktokCapability.status === "loading" ? (
            <p className="flex items-center gap-2 text-xs font-semibold text-muted">
              <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Loading TikTok visibility
            </p>
          ) : tiktokCapability.status === "error" ? (
            <p className="text-xs font-semibold leading-5 text-error">
              {tiktokCapability.message}
            </p>
          ) : (
            <label className="text-xs font-semibold text-muted">
              Visibility
              <select
                value={typeof settings.privacyLevel === "string" ? settings.privacyLevel : ""}
                onChange={(event) => onSettingChange("privacyLevel", event.target.value)}
                className="mt-1.5 h-9 w-full rounded-control border border-border bg-card px-2.5 text-xs font-semibold text-foreground-strong outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="">Choose visibility</option>
                {tiktokCapability.capabilities.privacyLevels.map((privacyLevel) => (
                  <option key={privacyLevel} value={privacyLevel}>
                    {getTikTokPrivacyLabel(privacyLevel)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      ) : null}

      {selected && connection.platform === "youtube" ? (
        <div className="border-t border-border px-3 py-3">
          <label className="text-xs font-semibold text-muted">
            Visibility
            <select
              value={typeof settings.privacyStatus === "string" ? settings.privacyStatus : "private"}
              onChange={(event) => onSettingChange("privacyStatus", event.target.value)}
              className="mt-1.5 h-9 w-full rounded-control border border-border bg-card px-2.5 text-xs font-semibold text-foreground-strong outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value="private">Private</option>
              <option value="unlisted">Unlisted</option>
              <option value="public">Public</option>
            </select>
          </label>
        </div>
      ) : null}
    </div>
  );
}

function ScheduleReview({
  connections,
  scheduledDate,
  scheduledTime,
  summary,
  timezone,
}: {
  connections: SocialConnection[];
  scheduledDate: string;
  scheduledTime: string;
  summary: HookVideoScheduleSummary;
  timezone: string;
}) {
  return (
    <div>
      <div className="border-b border-border pb-4">
        <p className="text-xs font-semibold text-muted">Publish time</p>
        <p className="mt-1 text-base font-semibold text-foreground-strong">
          {formatScheduleDate(scheduledDate)} at {scheduledTime}
        </p>
        <p className="mt-1 text-xs font-medium text-muted">
          {timezone}
        </p>
      </div>
      <div className="border-b border-border py-4">
        <p className="text-xs font-semibold text-muted">Composition</p>
        <dl className="mt-2 space-y-2 text-xs">
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3">
            <dt className="font-medium text-muted">Opening source</dt>
            <dd className="truncate font-semibold text-foreground-strong">
              {summary.influencerName}
            </dd>
          </div>
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3">
            <dt className="font-medium text-muted">Demo</dt>
            <dd className="truncate font-semibold text-foreground-strong">
              {summary.demoTitle}
            </dd>
          </div>
          <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3">
            <dt className="font-medium text-muted">Hook</dt>
            <dd className="line-clamp-3 font-semibold leading-5 text-foreground-strong">
              {summary.hookText}
            </dd>
          </div>
        </dl>
      </div>
      <div className="pt-4">
        <p className="text-xs font-semibold text-muted">Accounts</p>
        <div className="mt-2 space-y-2">
          {connections.map((connection) => {
            const { label } = platformDetails[connection.platform];

            return (
              <div key={connection.id} className="flex items-center gap-3 border border-border px-3 py-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card-muted text-muted">
                  <SocialPlatformIcon platform={connection.platform} className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground-strong">
                    {connection.platformAccountName || connection.platformAccountUsername || label}
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium text-muted">{label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getValidationError(params: {
  minimumRenderLeadMinutes: number;
  scheduledDate: string;
  scheduledTime: string;
  selectedConnections: SocialConnection[];
  settings: Record<string, PublishingSettings>;
  tiktokCapabilities: Record<string, TikTokScheduleCapabilityState>;
  timezone: string;
}) {
  if (params.selectedConnections.length === 0) {
    return "Choose at least one connected account.";
  }

  if (!params.scheduledDate || !params.scheduledTime) {
    return "Choose a date and time.";
  }

  const settingsError = getScheduleTargetSettingsError({
    connections: params.selectedConnections,
    settings: params.settings,
    tiktokCapabilities: params.tiktokCapabilities,
  });

  if (settingsError) {
    return settingsError;
  }

  try {
    const scheduledFor = resolveZonedDateTime({
      date: params.scheduledDate,
      time: params.scheduledTime,
      timeZone: params.timezone,
    });
    const leadTime = validateScheduleLeadTime({
      minimumLeadMinutes: params.minimumRenderLeadMinutes,
      scheduledFor,
    });

    if (!leadTime.valid) {
      return `Choose a time at least ${params.minimumRenderLeadMinutes} ${
        params.minimumRenderLeadMinutes === 1 ? "minute" : "minutes"
      } from now so the final video has time to be prepared.`;
    }
  } catch (error) {
    return error instanceof ScheduleTimeError
      ? error.message
      : "Choose a valid schedule date and time.";
  }

  return null;
}

function getInitialDateTime(
  minimumLeadMinutes = DEFAULT_MINIMUM_RENDER_LEAD_MINUTES,
) {
  const initialLeadMinutes = Math.max(60, minimumLeadMinutes + 15);
  const date = new Date(Date.now() + initialLeadMinutes * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);

  return {
    date: getLocalDate(date),
    time: `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`,
  };
}

function getLocalDate(date: Date) {
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
}

function formatScheduleDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

async function requireToken() {
  const token = await getCurrentUserIdToken();
  if (!token) throw new Error("Sign in before scheduling this video.");
  return token;
}

function getApiMessage(value: unknown, fallback: string) {
  return value &&
    typeof value === "object" &&
    "message" in value &&
    typeof value.message === "string"
    ? value.message
    : fallback;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
