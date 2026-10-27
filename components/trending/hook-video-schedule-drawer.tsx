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
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { ScheduleQuickActions } from "@/components/scheduling/schedule-quick-actions";
import { Button } from "@/components/ui/button";
import { useDeviceTimeFormat } from "@/components/scheduling/use-device-time-format";
import { displayScheduleTime } from "@/lib/scheduling/time-display";
import { WorkflowTimePicker } from "@/components/scheduling/workflow-time-picker";
import { HookInlineSymbols } from "@/components/trending/hook-inline-symbols";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { usePublishingPreferencesDefault } from "@/components/scheduling/use-publishing-preferences-default";
import { PostCaptionDefault, PostCaptionField } from "@/components/scheduling/post-caption-field";
import { useAccountTimeZone } from "@/components/providers/account-timezone-provider";
import { getBrowserTimeZone, getSchedulingTimeZoneOptions } from "@/lib/scheduling/account-timezone";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { SocialAccountAvatar } from "@/components/social/social-account-avatar";
import {
  invalidateAccountSchedules,
  loadAccountScheduleConfig,
  loadAccountSocialConnections,
} from "@/lib/scheduling/account-data-query";
import {
  getConfirmedScheduleTargetSettings,
  getDefaultScheduleTargetSettings,
  getScheduleTargetSettingsError,
  getTikTokPublishingAgreement,
  type ScheduleTargetSettings,
  type TikTokScheduleCapabilityState,
} from "@/lib/scheduling/platform-settings";
import {
  DEFAULT_SOCIAL_SCHEDULING_MIN_LEAD_MINUTES,
  getEarliestScheduleTimestamp,
  getZonedDateTimeParts,
  resolveZonedDateTime,
  ScheduleTimeError,
  validateScheduleLeadTime,
} from "@/lib/scheduling/schedule-time";
import {
  type TikTokPublishCapabilities,
} from "@/lib/social/tiktok-publishing";
import { hasTikTokUiAccess } from "@/lib/social/platform-visibility";
import { hasYouTubeBetaAccess } from "@/lib/social/youtube-beta-access";
import type { SocialConnection, SocialPlatform } from "@/lib/social/types";
import { cn } from "@/lib/utils";

type TikTokCapabilitiesResponse =
  | { capabilities: TikTokPublishCapabilities; ok: true }
  | { message?: string; ok?: false };

type PublishingSettings = ScheduleTargetSettings;

export type HookVideoScheduleSelection = {
  caption: string;
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

export type HookVideoScheduleSummary = {
  demoTitle: string;
  hookText: string;
};

export type VideoPreparationState =
  | { status: "ready" }
  | { status: "preparing" }
  | { message: string; status: "failed" };

const platformDetails: Record<SocialPlatform, { label: string; order: number }> = {
  instagram: { label: "Instagram", order: 0 },
  tiktok: { label: "TikTok", order: 1 },
  youtube: { label: "YouTube", order: 2 },
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
  const tiktokBetaEnabled = hasTikTokUiAccess(user);
  const youtubeBetaEnabled = hasYouTubeBetaAccess(user);
  const publishingAccountLabel = getPublishingAccountLabel(
    tiktokBetaEnabled,
    youtubeBetaEnabled,
  );
  const queryClient = useQueryClient();
  const accountId = user?.uid ?? "signed-out";
  const publishingPreferences = usePublishingPreferencesDefault(user?.uid ?? null);
  const defaultTimezone = useAccountTimeZone();
  const [timezoneOverride, setTimezone] = useState<string | null>(null);
  const timezone = timezoneOverride ?? defaultTimezone;
  const initialDateTime = getInitialDateTime(DEFAULT_SOCIAL_SCHEDULING_MIN_LEAD_MINUTES, timezone);
  const [stage, setStage] = useState<"details" | "review">("details");
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>([]);
  const [settingsOverrides, setSettings] = useState<Record<string, PublishingSettings>>({});
  const [tiktokCapabilities, setTikTokCapabilities] = useState<
    Record<string, TikTokScheduleCapabilityState>
  >({});
  const [manualScheduledDate, setScheduledDate] = useState(initialDateTime.date);
  const [manualScheduledTime, setScheduledTime] = useState(initialDateTime.time);
  const [captionState, setCaptionState] = useState({ owner: accountId, text: "", initialized: false });
  const caption = captionState.owner === accountId ? captionState.text : "";
  const captionInitialized = captionState.owner === accountId && captionState.initialized;
  function setCaption(text: string) { setCaptionState(previous => ({ owner: accountId, text, initialized: previous.owner === accountId && previous.initialized })); }
  function setCaptionInitialized(initialized: boolean) { setCaptionState(previous => ({ owner: accountId, text: previous.owner === accountId ? previous.text : "", initialized })); }
  const [hasManualScheduleTime, setHasManualScheduleTime] = useState(false);
  const [fiveMinutesFromSubmit, setFiveMinutesFromSubmit] = useState(false);
  const [minimumScheduleLeadMinutes, setMinimumScheduleLeadMinutes] = useState(
    DEFAULT_SOCIAL_SCHEDULING_MIN_LEAD_MINUTES,
  );
  const automaticDateTime = getInitialDateTime(minimumScheduleLeadMinutes, timezone);
  const scheduledDate = hasManualScheduleTime ? manualScheduledDate : automaticDateTime.date;
  const scheduledTime = hasManualScheduleTime ? manualScheduledTime : automaticDateTime.time;
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
      setMinimumScheduleLeadMinutes(configuredLeadMinutes);
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

  // Keep every provider in state so legacy schedules remain intact. The
  // verified beta account can select its approved publishing targets.
  const visibleConnections = useMemo(
    () =>
      connections.filter(
        (connection) =>
          connection.platform === "instagram" ||
          (tiktokBetaEnabled && connection.platform === "tiktok") ||
          (youtubeBetaEnabled && connection.platform === "youtube"),
      ),
    [connections, tiktokBetaEnabled, youtubeBetaEnabled],
  );
  const selectedConnections = visibleConnections.filter((connection) =>
    selectedConnectionIds.includes(connection.id),
  );
  const settings = useMemo(() => Object.fromEntries(
    connections.map((connection) => {
      const capability = tiktokCapabilities[connection.id];
      return [connection.id, {
      ...getDefaultScheduleTargetSettings(connection.platform),
      ...(connection.platform !== "instagram"
        ? { containsSyntheticMedia: publishingPreferences.containsSyntheticMedia }
        : {}),
      ...(connection.platform === "tiktok" ? {
        privacyLevel: publishingPreferences.tiktokPrivacyLevel,
        allowComment: publishingPreferences.tiktokAllowComments,
        brandOrganic: publishingPreferences.tiktokBrandOrganic,
        commercialContentDisclosureEnabled: publishingPreferences.tiktokBrandOrganic,
      } : {}),
      ...(connection.platform === "youtube" ? {
        privacyStatus: publishingPreferences.youtubePrivacyStatus,
        madeForKids: publishingPreferences.youtubeMadeForKids,
        notifySubscribers: publishingPreferences.youtubeNotifySubscribers,
      } : {}),
      ...settingsOverrides[connection.id],
      ...(connection.platform === "tiktok" && capability?.status === "ready" ? {
        ...(capability.capabilities.interactions.commentsDisabled ? { allowComment: false } : {}),
        ...(capability.capabilities.interactions.duetsDisabled ? { allowDuet: false } : {}),
        ...(capability.capabilities.interactions.stitchesDisabled ? { allowStitch: false } : {}),
      } : {}),
      }];
    }),
  ), [connections, publishingPreferences.containsSyntheticMedia, publishingPreferences.tiktokPrivacyLevel, publishingPreferences.tiktokAllowComments, publishingPreferences.tiktokBrandOrganic, publishingPreferences.youtubePrivacyStatus, publishingPreferences.youtubeMadeForKids, publishingPreferences.youtubeNotifySubscribers, settingsOverrides, tiktokCapabilities]);
  const usesPublishingPreferences = selectedConnections.some(
    (connection) => connection.platform !== "instagram",
  );
  const preferencesPending = usesPublishingPreferences && publishingPreferences.loading;
  const preferencesUnavailable = usesPublishingPreferences && Boolean(publishingPreferences.error);
  const tiktokPublishingAgreement = getTikTokPublishingAgreement({
    connections: selectedConnections,
    settings,
  });
  // Sort only the display copy; selection, settings and submission stay intact.
  const orderedConnections = useMemo(
    () =>
      [...visibleConnections].sort(
        (left, right) =>
          platformDetails[left.platform].order - platformDetails[right.platform].order,
      ),
    [visibleConnections],
  );
  const connectedCount = visibleConnections.filter(
    (connection) => connection.status === "connected",
  ).length;
  // Resolve the untouched "post right away" choice on the server at final
  // confirmation. The displayed preview can become stale while a Wall-of-text
  // Reel renders or while the user reviews either type of video.
  const useDefaultScheduleTime = !hasManualScheduleTime;
  const resolveOnSubmit = useDefaultScheduleTime || fiveMinutesFromSubmit;
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
            [connection.id]: {},
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
    if (preferencesPending || preferencesUnavailable) return;
    const validationError = getValidationError({
      scheduledDate,
      scheduledTime,
      selectedConnections,
      settings,
      tiktokCapabilities,
      minimumScheduleLeadMinutes,
      timezone,
      useDefaultScheduleTime: resolveOnSubmit,
      requireTikTokMusicConfirmation: false,
    });

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setErrorMessage(null);
    setStage("review");
  }

  function getScheduleSettings() {
    return Object.fromEntries(
      selectedConnections.map((connection) => {
        return [
          connection.id,
          getConfirmedScheduleTargetSettings(connection.platform, settings[connection.id]),
        ];
      }),
    ) as Record<string, PublishingSettings>;
  }

  function requestScheduleConfirmation() {
    void confirmSchedule();
  }

  async function confirmSchedule() {
    if (preferencesPending || preferencesUnavailable) return;
    const confirmedSettings = getScheduleSettings();
    const validationError = getValidationError({
      scheduledDate,
      scheduledTime,
      selectedConnections,
      settings: confirmedSettings,
      tiktokCapabilities,
      minimumScheduleLeadMinutes,
      timezone,
      useDefaultScheduleTime: resolveOnSubmit,
      requireTikTokMusicConfirmation: true,
    });

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    const submitTime = fiveMinutesFromSubmit ? getInitialDateTime(minimumScheduleLeadMinutes, timezone) : { date: scheduledDate, time: scheduledTime };
    const selection: HookVideoScheduleSelection = {
      caption,
      scheduledDate: submitTime.date,
      scheduledTime: submitTime.time,
      targets: selectedConnections.map((connection) => ({
        connectionId: connection.id,
        platform: connection.platform,
        settings: confirmedSettings[connection.id],
      })),
      timezone,
      useDefaultScheduleTime: resolveOnSubmit,
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

  const scheduleTitle = stage === "review" ? "Review schedule" : "Schedule Reel";

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
        className="max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-[18px] border border-border bg-background p-0 ring-0 sm:max-h-[calc(100dvh-2rem)] sm:max-w-[960px]"
      >
        <PostCaptionDefault ownerId={user?.uid ?? null} enabled={!submitting} value={caption} initialized={captionInitialized} onChange={value => { setCaptionInitialized(true); setCaption(value); }} />
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
                  : "Choose an account, caption, and optionally a publish time."}
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

        <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-7 sm:py-6">
          {stage === "details" ? (
            <>
              <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start">
                <section className="min-w-0" aria-labelledby="schedule-accounts-heading">
                  <div className="flex items-center justify-between gap-3">
                    <h4 id="schedule-accounts-heading" className="text-xs font-semibold text-foreground-strong">
                      Destinations
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
                    <div className="mt-3 grid grid-cols-1 gap-2.5">
                      {[0, 1, 2].map((item) => (
                        <Skeleton key={item} className="h-14 rounded-[12px]" />
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 grid grid-cols-1 gap-2.5">
                      {orderedConnections.map((connection) => (
                        <ConnectionRow
                          key={connection.id}
                          connection={connection}
                          selected={selectedConnectionIds.includes(connection.id)}
                          onToggle={() => toggleConnection(connection)}
                        >
                          {connection.platform === "tiktok" &&
                          selectedConnectionIds.includes(connection.id) ? (
                            <TikTokPublishingDetails
                              connection={connection}
                              settings={settings[connection.id] ?? getDefaultScheduleTargetSettings("tiktok")}
                              tiktokCapability={tiktokCapabilities[connection.id]}
                              onSettingChange={(key, value) => updateSetting(connection.id, key, value)}
                              onRetry={() => void loadTikTokCapabilities(connection.id)}
                            />
                          ) : null}
                        </ConnectionRow>
                      ))}
                      {visibleConnections.length === 0 ? (
                        <div className="rounded-[12px] border border-dashed border-border-strong px-3 py-5 text-center">
                          <p className="text-xs font-medium text-muted">
                            No {publishingAccountLabel} account connected.
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

                <div className="min-w-0 space-y-5">
                  <section className="border-t border-border pt-4">
                    <PostCaptionField applyDefault={false} ownerId={user?.uid ?? null} value={caption} initialized={captionInitialized} disabled={submitting} onChange={value => { setCaptionInitialized(true); setCaption(value); }} description="This appears with the published post, separately from the text in your Hook Video." />
                  </section>

                  <section className="border-t border-border pt-4" aria-labelledby="schedule-time-heading">
                    <h4 id="schedule-time-heading" className="text-xs font-semibold text-foreground-strong">
                      Publish time
                    </h4>
                    <div className="mt-3"><ScheduleQuickActions timezone={timezone} disabled={submitting} onSelect={(parts, preset) => { setFiveMinutesFromSubmit(preset === 5); setHasManualScheduleTime(true); setTimezone(timezone); setScheduledDate(parts.date); setScheduledTime(parts.time); }} /></div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <label className="text-xs font-semibold text-muted">
                        Date
                        <input
                          name="scheduled-date"
                          type="date"
                          autoComplete="off"
                          min={getZonedDateTimeParts(Date.now(), timezone).date}
                          value={scheduledDate}
                          onChange={(event) => {
                            setHasManualScheduleTime(true);
                            setFiveMinutesFromSubmit(false);
                            setTimezone(timezone);
                            setScheduledTime(scheduledTime);
                            setScheduledDate(event.target.value);
                          }}
                          className="mt-1.5 h-10 w-full rounded-control border border-border bg-card px-3 text-sm font-semibold text-foreground-strong outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                      </label>
                      <label className="text-xs font-semibold text-muted">
                        Time
                        <div className="mt-1.5"><WorkflowTimePicker id="hook-publish-time" value={scheduledTime} onChange={value => {
                          setFiveMinutesFromSubmit(false); setHasManualScheduleTime(true); setTimezone(timezone); setScheduledDate(scheduledDate); setScheduledTime(value);
                        }} /></div>
                      </label>
                    </div>
                    <label className="mt-3 block text-xs font-semibold text-muted">
                      Time zone
                      <select
                        name="schedule-timezone"
                        value={timezone}
                        onChange={(event) => setTimezone(event.target.value)}
                        className="mt-1.5 h-10 w-full rounded-control border border-border bg-card px-3 text-sm font-semibold text-foreground-strong outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      >
                        {getSchedulingTimeZoneOptions(timezone).map((zone) => <option key={zone} value={zone}>{zone.replaceAll("_", " ")}</option>)}
                      </select>
                    </label>
                    <p className="mt-2 text-[11px] font-medium leading-4 text-muted">
                      {useDefaultScheduleTime
                        ? `Post now queues your post ${minimumScheduleLeadMinutes} ${
                            minimumScheduleLeadMinutes === 1 ? "minute" : "minutes"
                          } after you confirm, once media preparation finishes.`
                        : `${timezone}. Schedule at least ${minimumScheduleLeadMinutes} ${
                            minimumScheduleLeadMinutes === 1 ? "minute" : "minutes"
                          } ahead.`}
                    </p>
                  </section>
                </div>
              </div>

              {selectedConnections.some(
                (connection) => connection.platform === "youtube",
              ) ? (
                <section className="mt-6 border-t border-border pt-4" aria-labelledby="schedule-publishing-details-heading">
                  <div>
                    <h4 id="schedule-publishing-details-heading" className="text-xs font-semibold text-foreground-strong">
                      YouTube destinations
                    </h4>
                    <p className="mt-1 text-[11px] font-medium leading-4 text-muted">
                      Uses your saved publishing defaults.
                    </p>
                  </div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    {selectedConnections
                      .filter((connection) => connection.platform === "youtube")
                      .map((connection) => (
                        <YouTubePublishingDetails
                          key={connection.id}
                          connection={connection}
                          settings={
                            settings[connection.id] ??
                            getDefaultScheduleTargetSettings("youtube")
                          }
                          onSettingChange={(key, value) =>
                            updateSetting(connection.id, key, value)
                          }
                        />
                      ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : (
            <ScheduleReview
              connections={orderedConnections.filter((connection) =>
                selectedConnectionIds.includes(connection.id),
              )}
              caption={caption}
              scheduledDate={scheduledDate}
              scheduledTime={scheduledTime}
              summary={summary}
              timezone={timezone}
              minimumScheduleLeadMinutes={minimumScheduleLeadMinutes}
              useDefaultScheduleTime={useDefaultScheduleTime}
            />
          )}

          {usesPublishingPreferences && (publishingPreferences.loading || publishingPreferences.error) ? (
            <p role={publishingPreferences.loading ? "status" : "alert"} className="mt-4 text-xs leading-5 text-muted">
              {publishingPreferences.loading ? "Loading your publishing defaults…" : publishingPreferences.error}
            </p>
          ) : null}
          {preferencesUnavailable ? <Button type="button" variant="outline" size="sm" onClick={publishingPreferences.retry} className="mt-2">Retry loading defaults</Button> : null}
          <a href="/settings#preferences" target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-xs font-semibold text-muted underline underline-offset-4 hover:text-foreground-strong">Change default settings</a>
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
          {stage === "review" && tiktokPublishingAgreement ? (
            <p className="mb-2 text-xs leading-5 text-muted">
              {tiktokPublishingAgreement}
            </p>
          ) : null}
          <Button
            type="button"
            size="lg"
            onClick={stage === "details" ? continueToReview : requestScheduleConfirmation}
            disabled={
              loading ||
              preferencesPending ||
              preferencesUnavailable ||
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
                  : useDefaultScheduleTime ? "Post now" : "Confirm schedule"
              : "Review"}
          </Button>
        </footer>
      </DialogContent>

    </Dialog>
  );
}

function ConnectionRow({
  children,
  connection,
  selected,
  onToggle,
}: {
  children?: ReactNode;
  connection: SocialConnection;
  selected: boolean;
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
      {children}
    </div>
  );
}

function TikTokPublishingDetails({ connection, tiktokCapability, onRetry }: {
  connection: SocialConnection;
  settings: PublishingSettings;
  tiktokCapability: TikTokScheduleCapabilityState | undefined;
  onSettingChange: (key: string, value: boolean | string) => void;
  onRetry: () => void;
}) {
  if (!tiktokCapability || tiktokCapability.status === "idle" || tiktokCapability.status === "loading") return <p role="status" className="px-3 py-2 text-xs text-muted">Checking TikTok account settings…</p>;
  if (tiktokCapability.status === "error") return <div className="px-3 py-2 text-xs text-error"><p role="alert">{connection.platformAccountName || 'TikTok'}: {tiktokCapability.message}</p><Button type="button" size="sm" variant="outline" onClick={onRetry}>Retry TikTok account</Button></div>;
  return null;
}

function YouTubePublishingDetails({ connection, settings }: {
  connection: SocialConnection;
  settings: PublishingSettings;
  onSettingChange: (key: string, value: boolean | string) => void;
}) {
  const privacyStatus = typeof settings.privacyStatus === 'string' ? settings.privacyStatus : 'public';
  return <p className="text-xs text-muted">{connection.platformAccountName || 'YouTube'} · {getYouTubePrivacyLabel(privacyStatus)}</p>;
}

function getYouTubePrivacyLabel(value: string) {
  if (value === "public") return "Public";
  if (value === "unlisted") return "Unlisted";
  return "Private";
}

function ScheduleReview({
  caption,
  connections,
  minimumScheduleLeadMinutes,
  scheduledDate,
  scheduledTime,
  summary,
  timezone,
  useDefaultScheduleTime,
}: {
  caption: string;
  connections: SocialConnection[];
  minimumScheduleLeadMinutes: number;
  scheduledDate: string;
  scheduledTime: string;
  summary: HookVideoScheduleSummary;
  timezone: string;
  useDefaultScheduleTime: boolean;
}) {
  const deviceHour12 = useDeviceTimeFormat();
  return (
    <div>
      <div className="border-b border-border pb-4">
        <p className="text-xs font-semibold text-muted">Publish time</p>
        <p className="mt-1 text-base font-semibold text-foreground-strong">
          {useDefaultScheduleTime
            ? `${minimumScheduleLeadMinutes} ${
                minimumScheduleLeadMinutes === 1 ? "minute" : "minutes"
              } after confirmation`
            : `${formatScheduleDate(scheduledDate)} at ${displayScheduleTime(scheduledTime, deviceHour12)}`}
        </p>
        <p className="mt-1 text-xs font-medium text-muted">
          {timezone}
        </p>
      </div>
      <div className="border-b border-border py-4">
        <p className="text-xs font-semibold text-muted">Composition</p>
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
              <HookInlineSymbols text={summary.hookText} />
            </dd>
          </div>
        </dl>
      </div>
      {caption.trim() ? (
        <div className="border-b border-border py-4">
          <p className="text-xs font-semibold text-muted">Caption</p>
          <p className="mt-2 whitespace-pre-wrap text-xs font-medium leading-5 text-foreground-strong">
            {caption}
          </p>
        </div>
      ) : null}
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
  requireTikTokMusicConfirmation: boolean;
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
    requireTikTokMusicConfirmation: params.requireTikTokMusicConfirmation,
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

function getPublishingAccountLabel(
  tiktokBetaEnabled: boolean,
  youtubeBetaEnabled: boolean,
) {
  if (tiktokBetaEnabled && youtubeBetaEnabled) {
    return "Instagram, TikTok, or YouTube";
  }

  if (tiktokBetaEnabled) {
    return "Instagram or TikTok";
  }

  if (youtubeBetaEnabled) {
    return "Instagram or YouTube";
  }

  return "Instagram";
}

function getInitialDateTime(
  minimumLeadMinutes = DEFAULT_SOCIAL_SCHEDULING_MIN_LEAD_MINUTES,
  timezone = getBrowserTimeZone(),
) {
  return getZonedDateTimeParts(
    getEarliestScheduleTimestamp({
      minimumLeadMinutes,
    }),
    timezone,
  );
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
