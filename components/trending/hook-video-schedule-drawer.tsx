"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  Loader2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { SocialAccountAvatar } from "@/components/social/social-account-avatar";
import {
  invalidateAccountSchedules,
  loadAccountScheduleConfig,
  loadAccountSocialConnections,
} from "@/lib/scheduling/account-data-query";
import {
  getDefaultScheduleTargetSettings,
  getScheduleTargetSettingsError,
  type ScheduleTargetSettings,
  type TikTokScheduleCapabilityState,
} from "@/lib/scheduling/platform-settings";
import {
  DEFAULT_SOCIAL_SCHEDULING_MIN_LEAD_MINUTES,
  getEarliestScheduleTimestamp,
  resolveZonedDateTime,
  ScheduleTimeError,
  SOCIAL_SCHEDULING_TIME_STEP_SECONDS,
  validateScheduleLeadTime,
} from "@/lib/scheduling/schedule-time";
import {
  getTikTokPrivacyLabel,
  type TikTokPublishCapabilities,
} from "@/lib/social/tiktok-publishing";
import type { SocialConnection, SocialPlatform } from "@/lib/social/types";
import { cn } from "@/lib/utils";

type TikTokCapabilitiesResponse =
  | { capabilities: TikTokPublishCapabilities; ok: true }
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
  useDefaultScheduleTime: boolean;
};

export type HookVideoScheduleSummary =
  | {
      demoTitle: string;
      hookText: string;
      kind?: "hook_video";
    }
  | {
      backgroundTitle: string;
      kind: "wall_text";
      text: string;
    };

export type VideoPreparationState =
  | { status: "ready" }
  | { status: "preparing" }
  | { message: string; status: "failed" };

const platformDetails: Record<SocialPlatform, { label: string }> = {
  instagram: { label: "Instagram" },
  tiktok: { label: "TikTok" },
  youtube: { label: "YouTube" },
};

export function HookVideoScheduleDrawer({
  onClose,
  onConfirm,
  onRetryPreparation,
  preparation,
  summary,
}: {
  onClose: () => void;
  onConfirm: (selection: HookVideoScheduleSelection) => Promise<void>;
  onRetryPreparation?: () => void | Promise<void>;
  preparation?: VideoPreparationState;
  summary: HookVideoScheduleSummary;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const accountId = user?.uid ?? "signed-out";
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
  const [hasManualScheduleTime, setHasManualScheduleTime] = useState(false);
  const [minimumScheduleLeadMinutes, setMinimumScheduleLeadMinutes] = useState(
    DEFAULT_SOCIAL_SCHEDULING_MIN_LEAD_MINUTES,
  );
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const token = await requireToken();
      const [accountConnections, configData] = await Promise.all([
        loadAccountSocialConnections(queryClient, accountId, {
          errorMessage: "Could not load connected accounts.",
          token,
        }),
        loadAccountScheduleConfig(queryClient, accountId, {
          errorMessage: "Could not load scheduling settings.",
          token,
        }),
      ]);

      setConnections(accountConnections);
      const configuredLeadValue =
        configData.minimumScheduleLeadMinutes ??
        configData.minimumRenderLeadMinutes;
      const configuredLeadMinutes =
        typeof configuredLeadValue === "number" &&
        Number.isFinite(configuredLeadValue)
        ? Math.max(1, Math.ceil(configuredLeadValue))
        : DEFAULT_SOCIAL_SCHEDULING_MIN_LEAD_MINUTES;
      const nextDateTime = getInitialDateTime(configuredLeadMinutes);

      setMinimumScheduleLeadMinutes(configuredLeadMinutes);
      setScheduledDate(nextDateTime.date);
      setScheduledTime(nextDateTime.time);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not load connected accounts."));
    } finally {
      setLoading(false);
    }
  }, [accountId, queryClient]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadConnections(), 0);

    return () => window.clearTimeout(timer);
  }, [loadConnections]);

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
  // Resolve the untouched "post right away" choice on the server at final
  // confirmation. The displayed preview can become stale while a Wall-of-text
  // Reel renders or while the user reviews either type of video.
  const useDefaultScheduleTime = !hasManualScheduleTime;
  const preparationPending = preparation?.status === "preparing";
  const preparationFailed = preparation?.status === "failed";
  const canConfirmPreparation = !preparation || preparation.status === "ready";

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
      minimumScheduleLeadMinutes,
      timezone,
      useDefaultScheduleTime,
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
      useDefaultScheduleTime,
    };

    setSubmitting(true);
    setErrorMessage(null);

    try {
      await onConfirm(selection);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Could not schedule this video."));
      setSubmitting(false);
    } finally {
      void invalidateAccountSchedules(queryClient, accountId);
    }
  }

  const scheduleTitle =
    stage === "review"
      ? "Review schedule"
      : summary.kind === "wall_text"
        ? "Schedule post"
        : "Schedule Reel";

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !submitting) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-overlay [backdrop-filter:none] supports-backdrop-filter:[backdrop-filter:none]"
        className="max-h-[calc(100dvh-1rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-[18px] border border-border bg-background p-0 ring-0 sm:max-w-[520px]"
      >
        <DialogHeader className="flex-row items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-2">
            {stage === "review" ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setStage("details")}
                disabled={submitting}
                aria-label="Back to schedule details"
                title="Back"
              >
                <ArrowLeft aria-hidden="true" />
              </Button>
            ) : (
              <span className="flex size-8 items-center justify-center rounded-[10px] bg-card-muted text-primary">
                <CalendarClock className="size-4" aria-hidden="true" />
              </span>
            )}
            <div>
              <DialogTitle>{scheduleTitle}</DialogTitle>
              <DialogDescription className="mt-1 text-xs">
                {stage === "review"
                  ? "Confirm the destination and publish time."
                  : "Choose an account and optionally a publish time."}
              </DialogDescription>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close schedule"
            title="Close"
          >
            <X aria-hidden="true" />
          </Button>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-5">
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
                      <Skeleton key={item} className="h-14 rounded-[12px]" />
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
                      <div className="rounded-[12px] border border-dashed border-border-strong px-3 py-5 text-center">
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
                      name="scheduled-date"
                      type="date"
                      autoComplete="off"
                      min={getLocalDate(new Date())}
                      value={scheduledDate}
                      onChange={(event) => {
                        setHasManualScheduleTime(true);
                        setScheduledDate(event.target.value);
                      }}
                      className="mt-1.5 h-10 w-full rounded-control border border-border bg-card px-3 text-sm font-semibold text-foreground-strong outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </label>
                  <label className="text-xs font-semibold text-muted">
                    Time
                    <input
                      name="scheduled-time"
                      type="time"
                      autoComplete="off"
                      step={SOCIAL_SCHEDULING_TIME_STEP_SECONDS}
                      value={scheduledTime}
                      onChange={(event) => {
                        setHasManualScheduleTime(true);
                        setScheduledTime(event.target.value);
                      }}
                      className="mt-1.5 h-10 w-full rounded-control border border-border bg-card px-3 text-sm font-semibold text-foreground-strong outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </label>
                </div>
                <p className="mt-2 text-[11px] font-medium leading-4 text-muted">
                  {useDefaultScheduleTime
                    ? `Leave these unchanged to schedule ${minimumScheduleLeadMinutes} ${
                        minimumScheduleLeadMinutes === 1 ? "minute" : "minutes"
                      } after you confirm. Edit either value to choose a specific time.`
                    : `${timezone}. Schedule at least ${minimumScheduleLeadMinutes} ${
                        minimumScheduleLeadMinutes === 1 ? "minute" : "minutes"
                      } ahead.`}
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
              minimumScheduleLeadMinutes={minimumScheduleLeadMinutes}
              useDefaultScheduleTime={useDefaultScheduleTime}
            />
          )}

          {errorMessage ? (
            <p role="alert" className="mt-4 border-l-2 border-error px-3 py-1 text-sm font-semibold leading-5 text-error">
              {errorMessage}
            </p>
          ) : null}
          {preparationPending ? (
            <div
              role="status"
              className="mt-4 flex items-start gap-2 rounded-[10px] border border-primary/25 bg-primary/5 px-3 py-2.5 text-xs font-semibold leading-5 text-primary"
            >
              <Loader2
                className="mt-0.5 size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              <span>
                Preparing this Wall-of-text Reel. You can finish the account and
                time details now; confirmation unlocks as soon as the video is
                ready.
              </span>
            </div>
          ) : null}
          {preparation?.status === "failed" ? (
            <div
              role="alert"
              className="mt-4 flex flex-col gap-2 rounded-[10px] border border-error/30 bg-error/10 px-3 py-2.5 text-xs font-semibold leading-5 text-error sm:flex-row sm:items-center sm:justify-between"
            >
              <span>{preparation.message}</span>
              {onRetryPreparation ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void onRetryPreparation()}
                  className="shrink-0 border-error/40 text-error hover:bg-error/10 hover:text-error"
                >
                  Retry preparation
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <footer className="border-t border-border bg-background px-4 py-3 sm:px-5">
          <Button
            type="button"
            size="lg"
            onClick={stage === "details" ? continueToReview : () => void confirmSchedule()}
            disabled={
              loading ||
              submitting ||
              (stage === "review" && !canConfirmPreparation)
            }
            className="h-10 w-full rounded-[10px]"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : stage === "review" ? (
              <CalendarClock data-icon="inline-start" aria-hidden="true" />
            ) : (
              <Check data-icon="inline-start" aria-hidden="true" />
            )}
            {stage === "review"
              ? preparationPending
                ? "Preparing video…"
                : preparationFailed
                  ? "Video preparation failed"
                  : "Confirm schedule"
              : "Review"}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
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
    <div className={cn("overflow-hidden rounded-[12px] border bg-card", selected ? "border-primary" : "border-border", !available && "opacity-55")}>
      <label className={cn("flex min-h-14 items-center gap-3 px-3 py-2", available ? "cursor-pointer" : "cursor-not-allowed")}>
        <input
          type="checkbox"
          checked={selected}
          disabled={!available}
          onChange={onToggle}
          className="size-4 shrink-0 accent-primary"
        />
        <SocialAccountAvatar connection={connection} />
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
  minimumScheduleLeadMinutes,
  scheduledDate,
  scheduledTime,
  summary,
  timezone,
  useDefaultScheduleTime,
}: {
  connections: SocialConnection[];
  minimumScheduleLeadMinutes: number;
  scheduledDate: string;
  scheduledTime: string;
  summary: HookVideoScheduleSummary;
  timezone: string;
  useDefaultScheduleTime: boolean;
}) {
  return (
    <div>
      <div className="border-b border-border pb-4">
        <p className="text-xs font-semibold text-muted">Publish time</p>
        <p className="mt-1 text-base font-semibold text-foreground-strong">
          {useDefaultScheduleTime
            ? `${minimumScheduleLeadMinutes} ${
                minimumScheduleLeadMinutes === 1 ? "minute" : "minutes"
              } after confirmation`
            : `${formatScheduleDate(scheduledDate)} at ${scheduledTime}`}
        </p>
        <p className="mt-1 text-xs font-medium text-muted">
          {timezone}
        </p>
      </div>
      <div className="border-b border-border py-4">
        <p className="text-xs font-semibold text-muted">Composition</p>
        {summary.kind === "wall_text" ? (
          <dl className="mt-2 space-y-2 text-xs">
            <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3">
              <dt className="font-medium text-muted">Background</dt>
              <dd className="truncate font-semibold text-foreground-strong">
                {summary.backgroundTitle}
              </dd>
            </div>
            <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3">
              <dt className="font-medium text-muted">Overlay copy</dt>
              <dd className="line-clamp-5 font-semibold leading-5 text-foreground-strong">
                {summary.text}
              </dd>
            </div>
          </dl>
        ) : (
          <dl className="mt-2 space-y-2 text-xs">
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
        )}
      </div>
      <div className="pt-4">
        <p className="text-xs font-semibold text-muted">Accounts</p>
        <div className="mt-2 space-y-2">
          {connections.map((connection) => {
            const { label } = platformDetails[connection.platform];

            return (
              <div key={connection.id} className="flex items-center gap-3 border border-border px-3 py-2.5">
                <SocialAccountAvatar connection={connection} />
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
  minimumScheduleLeadMinutes: number;
  scheduledDate: string;
  scheduledTime: string;
  selectedConnections: SocialConnection[];
  settings: Record<string, PublishingSettings>;
  tiktokCapabilities: Record<string, TikTokScheduleCapabilityState>;
  timezone: string;
  useDefaultScheduleTime: boolean;
}) {
  if (params.selectedConnections.length === 0) {
    return "Choose at least one connected account.";
  }

  if (
    !params.useDefaultScheduleTime &&
    (!params.scheduledDate || !params.scheduledTime)
  ) {
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

  if (params.useDefaultScheduleTime) {
    return null;
  }

  try {
    const scheduledFor = resolveZonedDateTime({
      date: params.scheduledDate,
      time: params.scheduledTime,
      timeZone: params.timezone,
    });
    const leadTime = validateScheduleLeadTime({
      minimumLeadMinutes: params.minimumScheduleLeadMinutes,
      scheduledFor,
    });

    if (!leadTime.valid) {
      return `Choose a time at least ${params.minimumScheduleLeadMinutes} ${
        params.minimumScheduleLeadMinutes === 1 ? "minute" : "minutes"
      } from now.`;
    }
  } catch (error) {
    return error instanceof ScheduleTimeError
      ? error.message
      : "Choose a valid schedule date and time.";
  }

  return null;
}

function getInitialDateTime(
  minimumLeadMinutes = DEFAULT_SOCIAL_SCHEDULING_MIN_LEAD_MINUTES,
) {
  const date = new Date(
    getEarliestScheduleTimestamp({
      minimumLeadMinutes,
    }),
  );

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
