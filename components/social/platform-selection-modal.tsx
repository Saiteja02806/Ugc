"use client";

import { useAccountTimeZone } from "@/components/providers/account-timezone-provider";
import { getSchedulingTimeZoneOptions } from "@/lib/scheduling/account-timezone";

import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  Camera,
  Check,
  ChevronRight,
  Clock3,
  ExternalLink,
  LoaderCircle,
  Plus,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { SocialPlatformIcon } from "@/components/social/platform-icon";
import { InstagramCaptionPreview } from "@/components/social/instagram-caption-preview";
import { InstagramProfessionalAccountGuide } from "@/components/social/instagram-professional-account-guide";
import { SocialAccountAvatar } from "@/components/social/social-account-avatar";
import { useSocialOAuthPopup } from "@/components/social/use-social-oauth-popup";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScheduleQuickActions } from "@/components/scheduling/schedule-quick-actions";
import type { QuickTimePreset } from "@/lib/scheduling/quick-time";
import { WorkflowTimePicker } from "@/components/scheduling/workflow-time-picker";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { usePublishingPreferencesDefault } from "@/components/scheduling/use-publishing-preferences-default";
import { PostCaptionDefault, PostCaptionField } from "@/components/scheduling/post-caption-field";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import {
  invalidateAccountSchedules,
  loadAccountScheduleConfig,
  loadAccountSocialConnections,
} from "@/lib/scheduling/account-data-query";
import {
  CarouselScheduleRecoveryError,
  type CarouselScheduleSubmission,
} from "@/lib/scheduling/carousel-scheduling-client";
import {
  getConfirmedScheduleTargetSettings,
  getDefaultScheduleTargetSettings,
  getScheduleTargetSettingsError as getPublishingSettingsError,
  getTikTokPublishingAgreement,
  type ScheduleTargetSettings,
} from "@/lib/scheduling/platform-settings";
import {
  DEFAULT_SOCIAL_SCHEDULING_MIN_LEAD_MINUTES,
  getEarliestScheduleTimestamp,
  getZonedDateTimeParts,
  resolveZonedDateTime,
  validateScheduleLeadTime,
} from "@/lib/scheduling/schedule-time";
import { getConnectionPublishingBlockMessage } from "@/lib/scheduling/social-connection-policy";
import { INSTAGRAM_PROFESSIONAL_ACCOUNT_REQUIRED_ERROR } from "@/lib/social/instagram-professional-account";
import {
  type TikTokPublishCapabilities,
} from "@/lib/social/tiktok-publishing";
import { hasTikTokUiAccess } from "@/lib/social/platform-visibility";
import { hasYouTubeBetaAccess } from "@/lib/social/youtube-beta-access";
import {
  type SocialConnection,
  type SocialConnectionStatus,
  type SocialOAuthIntent,
  type SocialOAuthResultMessage,
  type SocialPlatform,
} from "@/lib/social/types";
import { cn } from "@/lib/utils";

export type CarouselSchedulePlatformContext = {
  assignmentId?: string;
  carouselId: string;
  contentType?: "carousel";
  coverUrl?: string | null;
  idempotencyKey: string;
  libraryItemId: string;
  returnTo: "library" | "trending";
  title: string;
};

export type WallTextSchedulePlatformContext = {
  assignmentId: string;
  contentType: "wall_text";
  coverUrl?: string | null;
  returnTo: "accounts";
  title: string;
};

export type ReactionSchedulePlatformContext = {
  assignmentId: string;
  requestKey: string;
  contentType: "reaction";
  coverUrl?: string | null;
  returnTo: "trending";
  title: string;
};

export type SchedulePlatformContext =
  | CarouselSchedulePlatformContext
  | WallTextSchedulePlatformContext
  | ReactionSchedulePlatformContext;

type PlatformSelectionModalProps = {
  context: SchedulePlatformContext | null;
  onConfirmed: (
    submission: CarouselScheduleSubmission,
  ) => Promise<void> | void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type TikTokPublishSettingsResponse =
  | { capabilities: TikTokPublishCapabilities; ok: true }
  | { message?: string; ok: false };

type OAuthTraceInput = {
  callbackHost?: string;
  correlationId?: string;
  platform?: SocialPlatform;
};

type PlatformDefinition = {
  description: string;
  label: string;
  platform: SocialPlatform;
};

type ModalStep = "accounts" | "details" | "schedule";
type ScheduleMode = "choose" | "later";
type ScheduleContentKind = "carousel" | "wall_text" | "reaction";
type ConnectionPublishingSettings = ScheduleTargetSettings;
type TikTokCapabilitiesState =
  | { status: "loading" }
  | { capabilities: TikTokPublishCapabilities; status: "ready" }
  | { message: string; status: "error" };

const platforms: PlatformDefinition[] = [
  {
    description: "Professional account connected through Meta",
    label: "Instagram",
    platform: "instagram",
  },
  {
    description: "Creator account authorized with TikTok",
    label: "TikTok",
    platform: "tiktok",
  },
  {
    description: "Channel authorized with YouTube",
    label: "YouTube",
    platform: "youtube",
  },
];

const MAX_SELECTED_INSTAGRAM_ACCOUNTS = 5;

const publishingJourney = [
  { label: "Post", number: 1 },
  { label: "Account", number: 2 },
  { label: "Details", number: 3 },
  { label: "Publish", number: 4 },
] as const;

function getContentKind(
  context: SchedulePlatformContext | null,
): ScheduleContentKind {
  return context?.contentType ?? "carousel";
}

function getContentLabel(contentKind: ScheduleContentKind) {
  if (contentKind === "wall_text") return "Text Reel";
  if (contentKind === "reaction") return "Reaction Reel";
  return "Carousel";
}

function getStepDetails(
  contentKind: ScheduleContentKind,
  hasMultiplePlatforms: boolean,
): Record<ModalStep, { description: string; number: 2 | 3 | 4; title: string }> {
  const contentLabel = getContentLabel(contentKind);
  const accountLabel = hasMultiplePlatforms ? "publishing account" : "Instagram account";

  return {
    accounts: {
      description: `Choose the ${accountLabel} that will publish this ${contentLabel.toLowerCase()}.`,
      number: 2,
      title: `Select ${accountLabel}`,
    },
    details: {
      description:
        contentKind === "wall_text"
          ? "Review the destination and optionally add a caption for this Text Reel."
          : "Review the destinations and add a caption only if you want one.",
      number: 3,
      title: "Post details",
    },
    schedule: {
      description: `Choose when this ${contentLabel.toLowerCase()} should be published.`,
      number: 4,
      title: "Schedule",
    },
  };
}

export function PlatformSelectionModal({
  context,
  onConfirmed,
  onOpenChange,
  open,
}: PlatformSelectionModalProps) {
  const { user } = useAuth();
  const defaultTimezone = useAccountTimeZone();
  const tiktokBetaEnabled = hasTikTokUiAccess(user);
  const youtubeBetaEnabled = hasYouTubeBetaAccess(user);
  const contentKind = getContentKind(context);
  const queryClient = useQueryClient();
  const accountId = user?.uid ?? "signed-out";
  const publishingPreferences = usePublishingPreferencesDefault(user?.uid ?? null, open);
  const [step, setStep] = useState<ModalStep>("accounts");
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("choose");
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>(
    [],
  );
  const [publishingSettingsOverrides, setPublishingSettings] = useState<
    Record<string, ConnectionPublishingSettings>
  >({});
  const [tiktokCapabilities, setTikTokCapabilities] = useState<
    Record<string, TikTokCapabilitiesState>
  >({});
  const [captionState, setCaptionState] = useState({ owner: accountId, text: "", initialized: false });
  const caption = captionState.owner === accountId ? captionState.text : "";
  const captionInitialized = captionState.owner === accountId && captionState.initialized;
  function setCaption(text: string) { setCaptionState(previous => ({ owner: accountId, text, initialized: previous.owner === accountId && previous.initialized })); }
  function setCaptionInitialized(initialized: boolean) { setCaptionState(previous => ({ owner: accountId, text: previous.owner === accountId ? previous.text : "", initialized })); }
  const [timezoneOverride, setTimezone] = useState<string | null>(null);
  const timezone = timezoneOverride ?? defaultTimezone;
  const [scheduledDateOverride, setScheduledDate] = useState<string | null>(null);
  const [scheduledTimeOverride, setScheduledTime] = useState<string | null>(null);
  const [fiveMinutesFromSubmit, setFiveMinutesFromSubmit] = useState(false);
  const [minimumLeadMinutes, setMinimumLeadMinutes] = useState(
    DEFAULT_SOCIAL_SCHEDULING_MIN_LEAD_MINUTES,
  );
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const initialLaterSlot = getEarliestScheduleSlot(currentTime, minimumLeadMinutes, timezone);
  const scheduledDate = scheduledDateOverride ?? initialLaterSlot.date;
  const scheduledTime = scheduledTimeOverride ?? initialLaterSlot.time;
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [recoveryDraftId, setRecoveryDraftId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [renderTrace, setRenderTrace] = useState<OAuthTraceInput | null>(null);

  const loadConnections = useCallback(async (
    trace?: OAuthTraceInput,
    options: { force?: boolean } = {},
  ) => {
    setLoading(true);
    setLoadError(null);

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in before connecting a social account.");
      }

      const connections = await loadAccountSocialConnections(
        queryClient,
        accountId,
        {
          errorMessage: "Could not load connected accounts.",
          force: options.force ?? Boolean(trace),
          token,
          trace,
        },
      );

      setConnections(connections);
      return connections;
    } catch (error) {
      setLoadError(getErrorMessage(error, "Could not load connected accounts."));
      return [];
    } finally {
      setLoading(false);
    }
  }, [accountId, queryClient]);

  const loadMinimumLeadMinutes = useCallback(async () => {
    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        return;
      }

      const data = await loadAccountScheduleConfig(queryClient, accountId, {
        token,
      });
      const leadMinutes =
        data.minimumScheduleLeadMinutes ?? data.minimumRenderLeadMinutes;

      if (
        Number.isInteger(leadMinutes) &&
        Number(leadMinutes) >= 1
      ) {
        setMinimumLeadMinutes(Number(leadMinutes));
      }
    } catch {
      // The shared server default remains the safe fallback.
    }
  }, [accountId, queryClient]);

  async function handleOAuthResult(result: SocialOAuthResultMessage) {
    if (result.status !== "success") {
      return;
    }

    const refreshedConnections = await loadConnections({
      callbackHost: result.callbackHost,
      correlationId: result.correlationId,
      platform: result.platform,
    });
    const platformConnections = refreshedConnections.filter(
      (candidate) => candidate.platform === result.platform,
    );
    const connection =
      (result.connectionId
        ? platformConnections.find(
            (candidate) => candidate.id === result.connectionId,
          )
        : null) ?? getPreferredConnection(platformConnections);

    setRenderTrace({
      callbackHost: result.callbackHost,
      correlationId: result.correlationId,
      platform: result.platform,
    });

    if (connection?.status === "connected") {
      selectConnection(connection, true);
    }
  }
  const {
    clearPopupError,
    closePopup,
    connectingConnectionId,
    connectingIntent,
    connectingPlatform,
    popupError,
    popupErrorCode,
    startConnection,
  } = useSocialOAuthPopup({
    onPopupClosed: async ({
      expectedConnectionId,
      intent,
      platform,
      previousConnectionUpdatedAt,
    }) => {
      const refreshedConnections = await loadConnections(undefined, {
        force: true,
      });
      const previousUpdatedAt = previousConnectionUpdatedAt
        ? Date.parse(previousConnectionUpdatedAt)
        : null;
      const connection = getPreferredConnection(
        refreshedConnections.filter(
          (candidate) =>
            candidate.platform === platform &&
            candidate.status === "connected" &&
            (intent !== "reconnect" ||
              candidate.id === expectedConnectionId) &&
            (previousUpdatedAt === null ||
              Date.parse(candidate.updatedAt) > previousUpdatedAt),
        ),
      );

      if (connection) {
        selectConnection(connection, true);
        return true;
      }

      return false;
    },
    onResult: handleOAuthResult,
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    const timer = window.setTimeout(() => {
      void Promise.all([loadConnections(), loadMinimumLeadMinutes()]);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadConnections, loadMinimumLeadMinutes, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);

    return () => window.clearInterval(timer);
  }, [open]);

  useEffect(() => {
    if (!renderTrace?.correlationId || !renderTrace.platform) {
      return;
    }

    console.info("social_oauth_trace", {
      callbackHost: renderTrace.callbackHost ?? null,
      correlationId: renderTrace.correlationId,
      hasConnectedAccount: connections.some(
        (connection) =>
          connection.platform === renderTrace.platform &&
          connection.status === "connected",
      ),
      stage: "frontend_rendering",
    });
  }, [connections, renderTrace]);

  const visiblePlatforms = useMemo(
    () =>
      platforms.filter(
        (definition) =>
          definition.platform === "instagram" ||
          (tiktokBetaEnabled && definition.platform === "tiktok") ||
          (youtubeBetaEnabled &&
            contentKind !== "carousel" &&
            definition.platform === "youtube"),
      ),
    [contentKind, tiktokBetaEnabled, youtubeBetaEnabled],
  );
  const carouselConnections = useMemo(
    () =>
      connections.filter(
        (connection) =>
          visiblePlatforms.some(
            (definition) => definition.platform === connection.platform,
          ),
      ),
    [connections, visiblePlatforms],
  );
  const hasExistingProfessionalAccountRequirement =
    carouselConnections.some(
      (connection) =>
        connection.requiresInstagramProfessionalAccount === true,
    );
  const showProfessionalAccountGuide =
    popupErrorCode === INSTAGRAM_PROFESSIONAL_ACCOUNT_REQUIRED_ERROR ||
    (!confirmError &&
      !loadError &&
      !popupError &&
      hasExistingProfessionalAccountRequirement);
  const selectedConnections = useMemo(
    () =>
      carouselConnections.filter((connection) =>
        selectedConnectionIds.includes(connection.id),
      ),
    [carouselConnections, selectedConnectionIds],
  );
  const hasInstagramDestination = selectedConnections.some(
    (connection) => connection.platform === "instagram",
  );
  const publishingSettings = useMemo(() => Object.fromEntries(
    connections.map((connection) => {
      const capability = tiktokCapabilities[connection.id];
      return [connection.id, {
      ...getDefaultPublishingSettings(connection.platform),
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
      ...publishingSettingsOverrides[connection.id],
      ...(connection.platform === "tiktok" && capability?.status === "ready" ? {
        ...(capability.capabilities.interactions.commentsDisabled ? { allowComment: false } : {}),
        ...(capability.capabilities.interactions.duetsDisabled ? { allowDuet: false } : {}),
        ...(capability.capabilities.interactions.stitchesDisabled ? { allowStitch: false } : {}),
      } : {}),
      }];
    }),
  ), [connections, publishingPreferences.containsSyntheticMedia, publishingPreferences.tiktokPrivacyLevel, publishingPreferences.tiktokAllowComments, publishingPreferences.tiktokBrandOrganic, publishingPreferences.youtubePrivacyStatus, publishingPreferences.youtubeMadeForKids, publishingPreferences.youtubeNotifySubscribers, publishingSettingsOverrides, tiktokCapabilities]);
  const usesPublishingPreferences = selectedConnections.some(
    (connection) => connection.platform !== "instagram",
  );
  const preferencesPending = usesPublishingPreferences && publishingPreferences.loading;
  const publishingSettingsError = preferencesPending
    ? "Loading your publishing defaults…"
    : usesPublishingPreferences && publishingPreferences.error
      ? publishingPreferences.error
    : getPublishingSettingsError({
        connections: selectedConnections,
        requireTikTokMusicConfirmation: false,
        settings: publishingSettings,
        tiktokCapabilities,
      });
  const tiktokPublishingAgreement = getTikTokPublishingAgreement({
    connections: selectedConnections,
    settings: publishingSettings,
  });
  const laterValidation = useMemo(
    () =>
      validateLaterSchedule({
        date: fiveMinutesFromSubmit ? getEarliestScheduleSlot(currentTime, minimumLeadMinutes, timezone).date : scheduledDate,
        minimumLeadMinutes,
        now: currentTime,
        time: fiveMinutesFromSubmit ? getEarliestScheduleSlot(currentTime, minimumLeadMinutes, timezone).time : scheduledTime,
        timezone,
      }),
    [
      currentTime,
      fiveMinutesFromSubmit,
      minimumLeadMinutes,
      scheduledDate,
      scheduledTime,
      timezone,
    ],
  );
  const minimumScheduledDate = useMemo(
    () => getFutureSlot(currentTime, timezone).date,
    [currentTime, timezone],
  );
  const contentLabel = getContentLabel(contentKind);
  const hasMultiplePlatforms = visiblePlatforms.length > 1;
  const currentStep = getStepDetails(contentKind, hasMultiplePlatforms)[step];
  const canContinueAccounts =
    selectedConnections.length > 0 &&
    selectedConnections.every(
      (connection) => !getPostAccountUnavailableMessage(connection, contentKind),
    );

  function resetModal() {
    const now = Date.now();
    closePopup();
    clearPopupError();
    setStep("accounts");
    setScheduleMode("choose");
    setSelectedConnectionIds([]);
    setPublishingSettings({});
    setTikTokCapabilities({});
    setCaption("");
    setCaptionInitialized(false);
    setTimezone(null);
    setScheduledDate(null);
    setScheduledTime(null);
    setFiveMinutesFromSubmit(false);
    setCurrentTime(now);
    setConfirmError(null);
    setRecoveryDraftId(null);
    setSubmitting(false);
  }

  function setOpen(nextOpen: boolean) {
    if (!nextOpen && submitting) {
      return;
    }

    if (!nextOpen) {
      resetModal();
    }

    onOpenChange(nextOpen);
  }

  function selectConnection(
    connection: SocialConnection,
    forceSelected?: boolean,
  ) {
    if (getPostAccountUnavailableMessage(connection, contentKind)) {
      return;
    }

    const selecting =
      forceSelected ?? !selectedConnectionIds.includes(connection.id);

    if (
      selecting &&
      !selectedConnectionIds.includes(connection.id) &&
      selectedConnectionIds.length >= MAX_SELECTED_INSTAGRAM_ACCOUNTS
    ) {
      setConfirmError(
        `Choose up to ${MAX_SELECTED_INSTAGRAM_ACCOUNTS} publishing accounts per post.`,
      );
      return;
    }

    setConfirmError(null);
    setSelectedConnectionIds((current) =>
      selecting
        ? current.includes(connection.id)
          ? current
          : [...current, connection.id]
        : current.filter((id) => id !== connection.id),
    );

    if (!selecting) {
      return;
    }

    setPublishingSettings((current) =>
      current[connection.id]
        ? current
        : {
            ...current,
            [connection.id]: {},
          },
    );

    if (
      connection.platform === "tiktok" &&
      !tiktokCapabilities[connection.id]
    ) {
      void loadTikTokCapabilities(connection.id);
    }
  }

  function updatePublishingSetting(
    connectionId: string,
    key: string,
    value: boolean | string,
  ) {
    setPublishingSettings((current) => ({
      ...current,
      [connectionId]: {
        ...(current[connectionId] ?? {}),
        [key]: value,
      },
    }));
  }

  const loadTikTokCapabilities = useCallback(async (connectionId: string) => {
    setTikTokCapabilities((current) => ({
      ...current,
      [connectionId]: { status: "loading" },
    }));

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in before loading TikTok settings.");
      }

      const response = await fetch(
        `/api/social/connections/${connectionId}/publish-settings`,
        {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = (await response.json().catch(() => null)) as
        | TikTokPublishSettingsResponse
        | null;

      if (!response.ok || data?.ok !== true) {
        throw new Error(
          data?.ok === false && data.message
            ? data.message
            : "Could not load TikTok publishing settings.",
        );
      }

      setTikTokCapabilities((current) => ({
        ...current,
        [connectionId]: {
          capabilities: data.capabilities,
          status: "ready",
        },
      }));
    } catch (error) {
      setTikTokCapabilities((current) => ({
        ...current,
        [connectionId]: {
          message: getErrorMessage(
            error,
            "Could not load TikTok publishing settings.",
          ),
          status: "error",
        },
      }));
    }
  }, []);

  function goBack() {
    setConfirmError(null);
    setRecoveryDraftId(null);

    if (step === "details") {
      setStep("accounts");
      return;
    }

    if (step === "schedule" && scheduleMode === "later") {
      setScheduleMode("choose");
      return;
    }

    setStep("details");
  }

  function goNext() {
    setConfirmError(null);
    setRecoveryDraftId(null);

    if (step === "accounts" && canContinueAccounts) {
      setStep("details");
      return;
    }

    if (step === "details" && !publishingSettingsError) {
      setStep("schedule");
      setScheduleMode("choose");
    }
  }

  async function submitSchedule(mode: "asap" | "later") {
    if (!context || !canContinueAccounts || publishingSettingsError) {
      return;
    }

    // The schedule screen can stay open while the user connects an account or
    // finishes reviewing their post. Always calculate from the instant they
    // press the final button, rather than using the displayed slot from an
    // earlier render.
    const submittedAt = Date.now();
    setCurrentTime(submittedAt);
    const scheduleTime =
      mode === "asap" || fiveMinutesFromSubmit
        ? getEarliestScheduleSlot(
            submittedAt,
            minimumLeadMinutes,
            timezone,
          )
        : validateLaterSchedule({
            date: scheduledDate,
            minimumLeadMinutes,
            now: submittedAt,
            time: scheduledTime,
            timezone,
          });

    if (!scheduleTime.scheduledFor || scheduleTime.error) {
      setConfirmError(
        scheduleTime.error ?? "Choose a valid date and time to schedule.",
      );
      return;
    }

    setConfirmError(null);
    setRecoveryDraftId(null);
    setSubmitting(true);

    try {
      await onConfirmed({
        caption,
        scheduledDate: scheduleTime.date,
        scheduledFor: scheduleTime.scheduledFor,
        scheduledTime: scheduleTime.time,
        targets: selectedConnections.map((connection) => ({
          connectionId: connection.id,
          platform: connection.platform,
          settings: getConfirmedScheduleTargetSettings(
            connection.platform,
            publishingSettings[connection.id],
          ),
        })),
        timezone,
        useDefaultScheduleTime: mode === "asap" || fiveMinutesFromSubmit,
      });
      void invalidateAccountSchedules(queryClient, accountId);
      resetModal();
      onOpenChange(false);
    } catch (error) {
      if (error instanceof CarouselScheduleRecoveryError) {
        void invalidateAccountSchedules(queryClient, accountId);
      }

      setConfirmError(
        getErrorMessage(error, "Could not schedule this post."),
      );
      setRecoveryDraftId(
        error instanceof CarouselScheduleRecoveryError ? error.draftId : null,
      );
    } finally {
      setSubmitting(false);
    }
  }


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <PostCaptionDefault ownerId={user?.uid ?? null} enabled={open && !submitting} value={caption} initialized={captionInitialized} onChange={value => { setCaptionInitialized(true); setCaption(value); }} />
      <DialogContent
        className="instagram-theme max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-[22px] border border-border bg-card p-0 text-foreground shadow-floating ring-0 sm:max-h-[calc(100dvh-2rem)] sm:max-w-[960px]"
        showCloseButton={!submitting}
      >
        <div className="relative overflow-hidden border-b border-border bg-card">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_18%_0%,color-mix(in_srgb,var(--instagram-rose)_14%,transparent),transparent_56%),radial-gradient(circle_at_82%_0%,color-mix(in_srgb,var(--instagram-violet)_10%,transparent),transparent_50%)]"
            aria-hidden="true"
          />
          <div
            className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--instagram-orange),var(--instagram-rose),var(--instagram-violet),transparent)]"
            aria-hidden="true"
          />
          <DialogHeader className="relative gap-3 px-5 pb-4 pr-14 pt-5 sm:px-7 sm:pb-5 sm:pr-16 sm:pt-6">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                {hasMultiplePlatforms ? "Publishing post" : "Instagram post"}
              </p>
              <DialogTitle className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
                {currentStep.title}
              </DialogTitle>
              <DialogDescription className="mt-1 leading-5">
                {currentStep.description}
              </DialogDescription>
              <span className="sr-only">
                Step {currentStep.number} of 4
              </span>
            </div>

            <ol
              className="grid grid-cols-4 gap-2"
              aria-label={`Step ${currentStep.number} of 4`}
            >
              {publishingJourney.map((journeyStep) => {
                const complete = journeyStep.number < currentStep.number;
                const active = journeyStep.number === currentStep.number;

                return (
                  <li
                    key={journeyStep.number}
                    className="flex min-w-0 items-center gap-2"
                    aria-current={active ? "step" : undefined}
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                        complete &&
                          "border-primary bg-primary text-primary-foreground",
                        active && "border-primary bg-primary/10 text-primary",
                        !complete &&
                          !active &&
                          "border-border bg-card-muted text-muted-foreground",
                      )}
                    >
                      {complete ? (
                        <Check className="size-3" aria-hidden="true" />
                      ) : (
                        journeyStep.number
                      )}
                    </span>
                    <span
                      className={cn(
                        "truncate text-[11px] font-medium sm:text-xs",
                        active || complete
                          ? "text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {journeyStep.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </DialogHeader>
          <div className="h-0.5 bg-card-muted">
            <div
              className="h-full bg-[linear-gradient(90deg,var(--instagram-orange),var(--instagram-rose),var(--instagram-violet))] transition-[width] duration-200 motion-reduce:transition-none"
              style={{ width: `${currentStep.number * 25}%` }}
            />
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto overscroll-contain bg-background/35 px-5 py-5 sm:px-7 sm:py-6">
          {showProfessionalAccountGuide ? (
            <InstagramProfessionalAccountGuide className="mb-5" />
          ) : confirmError || loadError || popupError ? (
            <Alert variant="destructive" className="mb-5">
              <AlertCircle />
              <AlertTitle>
                {recoveryDraftId
                  ? "Scheduling needs attention"
                  : "Could not continue"}
              </AlertTitle>
              <AlertDescription>
                <span>{confirmError ?? popupError ?? loadError}</span>
                {recoveryDraftId ? (
                  <a
                    href={`/scheduling?draft=${encodeURIComponent(recoveryDraftId)}`}
                    className="ml-1 underline underline-offset-2"
                  >
                    Open the saved draft
                  </a>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          {submitting ? (
            <Alert className="border-success/20 bg-success/5 text-success">
              <LoaderCircle className="animate-spin" />
              <AlertTitle>Scheduling post</AlertTitle>
              <AlertDescription className="text-success">
                Saving the exact account settings and creating the calendar
                schedule.
              </AlertDescription>
            </Alert>
          ) : step === "accounts" ? (
            <AccountsStep
              carouselConnections={carouselConnections}
              contentLabel={contentLabel}
              connectingConnectionId={connectingConnectionId}
              connectingIntent={connectingIntent}
              connectingPlatform={connectingPlatform}
              context={context}
              loading={loading}
              selectedConnectionIds={selectedConnectionIds}
              onConnect={(definition, connection) => {
                if (!context) {
                  setLoadError("Choose a post before connecting an account.");
                  return;
                }

                if (context.contentType !== "carousel" && context.contentType) {
                  void startConnection({
                    expectedConnectionId: connection?.id,
                    forceConsent: Boolean(connection),
                    intent: connection ? "reconnect" : "add",
                    platform: definition.platform,
                    previousConnectionUpdatedAt: connection?.updatedAt ?? null,
                    // Video posts have no Carousel Library item to validate.
                    // The popup returns the new connection to this open modal.
                    returnTo: "accounts",
                  });
                  return;
                }

                void startConnection({
                  carouselId: context.carouselId,
                  expectedConnectionId: connection?.id,
                  forceConsent: Boolean(connection),
                  intent: connection ? "reconnect" : "add",
                  libraryItemId: context.libraryItemId,
                  platform: definition.platform,
                  previousConnectionUpdatedAt: connection?.updatedAt ?? null,
                  returnTo: context.returnTo,
                });
              }}
              onToggle={selectConnection}
              visiblePlatforms={visiblePlatforms}
            />
          ) : step === "details" ? (
            <DetailsStep
              caption={caption}
              ownerId={user?.uid ?? null}
              captionInitialized={captionInitialized}
              contentKind={contentKind}
              context={context}
              publishingSettings={publishingSettings}
              publishingSettingsError={publishingSettingsError}
              preferencesError={usesPublishingPreferences ? publishingPreferences.error : null}
              preferencesPending={preferencesPending}
              onRetryPreferences={publishingPreferences.retry}
              selectedConnections={selectedConnections}
              tiktokCapabilities={tiktokCapabilities}
              onCaptionChange={value => { setCaptionInitialized(true); setCaption(value); }}
              onChangeSetting={updatePublishingSetting}
              onRetryTikTok={loadTikTokCapabilities}
            />
          ) : (
            <div className="grid gap-5">
              {hasInstagramDestination ? (
                <InstagramCaptionPreview
                  caption={caption}
                  onEdit={() => setStep("details")}
                />
              ) : (
                <section className="rounded-card border border-border bg-card p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Post caption
                      </h3>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                        {caption || "No caption"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep("details")}
                      className="shrink-0 text-xs font-semibold text-primary hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                </section>
              )}
              {tiktokPublishingAgreement ? (
                <p className="text-xs leading-5 text-muted-foreground">
                  {tiktokPublishingAgreement}
                </p>
              ) : null}
                <LaterScheduleStep
                  date={scheduledDate}
                  error={scheduleMode === "later" ? laterValidation.error : null}
                  minimumDate={minimumScheduledDate}
                  time={scheduledTime}
                  timezone={timezone}
                  onDateChange={(value) => { setFiveMinutesFromSubmit(false); setScheduleMode("later"); setTimezone(timezone); setScheduledTime(scheduledTime); setScheduledDate(value); }}
                  onTimeChange={(value) => { setFiveMinutesFromSubmit(false); setScheduleMode("later"); setTimezone(timezone); setScheduledDate(scheduledDate); setScheduledTime(value); }}
                  onQuickTime={(parts, preset) => { setFiveMinutesFromSubmit(preset === 5); setScheduleMode("later"); setTimezone(timezone); setScheduledDate(parts.date); setScheduledTime(parts.time); }}
                  onTimezoneChange={setTimezone}
                />
            </div>
          )}
        </div>

        {!submitting ? (
          <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none rounded-b-[22px] border-t border-border bg-card px-5 py-4 sm:px-7">
            {step === "accounts" ? (
              <Button
                size="lg"
                variant="outline"
                className="px-4"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
            ) : (
              <Button
                size="lg"
                variant="ghost"
                className="px-4"
                onClick={goBack}
              >
                <ArrowLeft data-icon="inline-start" />
                Back
              </Button>
            )}

            {step === "accounts" || step === "details" ? (
              <Button
                size="lg"
                className="px-4"
                onClick={goNext}
                disabled={
                  step === "accounts"
                    ? !canContinueAccounts
                    : Boolean(publishingSettingsError)
                }
              >
                Next
                <ChevronRight data-icon="inline-end" />
              </Button>
              ) : (
                <Button
                  size="lg"
                  className="px-4"
                  onClick={() => void submitSchedule(scheduleMode === "later" ? "later" : "asap")}
                  disabled={scheduleMode === "later" && Boolean(laterValidation.error)}
                >
                  <Check data-icon="inline-start" />
                  {scheduleMode === "later" ? "Schedule post" : "Post now"}
                </Button>
            )}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AccountsStep({
  carouselConnections,
  contentLabel,
  connectingConnectionId,
  connectingIntent,
  connectingPlatform,
  context,
  loading,
  onConnect,
  onToggle,
  selectedConnectionIds,
  visiblePlatforms,
}: {
  carouselConnections: SocialConnection[];
  contentLabel: string;
  connectingConnectionId: string | null;
  connectingIntent: SocialOAuthIntent | null;
  connectingPlatform: SocialPlatform | null;
  context: SchedulePlatformContext | null;
  loading: boolean;
  onConnect: (
    definition: PlatformDefinition,
    connection?: SocialConnection,
  ) => void;
  onToggle: (connection: SocialConnection) => void;
  selectedConnectionIds: string[];
  visiblePlatforms: PlatformDefinition[];
}) {
  const contentKind = getContentKind(context);
  const platformLabels = visiblePlatforms.map((definition) => definition.label).join(", ");
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5">
      <div>
        <h3 className="text-base font-semibold text-foreground">
          Publishing account
        </h3>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          Select one or more publishing accounts. Each selected account
          publishes its own {contentLabel.toLowerCase()}. You can choose up to five.
        </p>
      </div>

      <fieldset>
        <legend className="sr-only">Connected publishing accounts</legend>
        {loading ? (
          <div className="grid gap-3">
            <Skeleton className="h-[88px] w-full rounded-card" />
            <Skeleton className="h-[88px] w-full rounded-card" />
          </div>
        ) : carouselConnections.length > 0 ? (
          <div className="grid gap-3">
            {carouselConnections.map((connection) => {
              const checkboxId = `schedule-connection-${connection.id}`;
              const unavailableMessage =
                getPostAccountUnavailableMessage(connection, contentKind);
              const accountName = getConnectionAccountName(connection);
              const selected = selectedConnectionIds.includes(connection.id);
              const status =
                connectingIntent === "reconnect" &&
                connectingConnectionId === connection.id
                  ? "connecting"
                  : connection.status;
              const statusDisplay = getStatusDisplay(status);
              const definition = visiblePlatforms.find(
                (candidate) => candidate.platform === connection.platform,
              );

              return (
                <div
                  key={connection.id}
                  className={cn(
                    "flex items-center gap-3 rounded-card border bg-card p-3.5 transition sm:p-4",
                    selected
                      ? "border-primary/60 bg-primary/5 shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_18%,transparent)]"
                      : "border-border hover:border-border-strong",
                    unavailableMessage && "bg-card-muted/70",
                  )}
                >
                  <Checkbox
                    id={checkboxId}
                    checked={selected}
                    disabled={Boolean(unavailableMessage)}
                    onCheckedChange={() => onToggle(connection)}
                    aria-describedby={
                      unavailableMessage
                        ? `${checkboxId}-availability`
                        : undefined
                    }
                  />
                  <label
                    htmlFor={checkboxId}
                    className={cn(
                      "flex min-w-0 flex-1 cursor-pointer items-center gap-3",
                      unavailableMessage && "cursor-not-allowed",
                    )}
                  >
                    <SocialAccountAvatar connection={connection} size="lg" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {accountName}
                        </span>
                        <Badge variant={statusDisplay.variant}>
                          {statusDisplay.label}
                        </Badge>
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {connection.platform === "instagram"
                          ? "Instagram professional account"
                          : connection.platform === "youtube"
                            ? "YouTube channel"
                            : "TikTok creator account"}
                      </span>
                    </span>
                  </label>
                  {definition ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => onConnect(definition, connection)}
                      disabled={loading || Boolean(connectingPlatform)}
                    >
                      {status === "connecting" ? (
                        <LoaderCircle
                          data-icon="inline-start"
                          className="animate-spin"
                        />
                      ) : (
                        <ExternalLink data-icon="inline-start" />
                      )}
                      <span className="hidden sm:inline">Reconnect</span>
                      <span className="sr-only sm:hidden">
                        Reconnect {accountName}
                      </span>
                    </Button>
                  ) : null}
                  {unavailableMessage ? (
                    <p id={`${checkboxId}-availability`} className="sr-only">
                      {unavailableMessage}
                    </p>
                  ) : null}
                </div>
              );
            })}
            {visiblePlatforms.map((definition) => (
              <Button
                key={`add-${definition.platform}`}
                type="button"
                variant="outline"
                onClick={() => onConnect(definition)}
                disabled={loading || Boolean(connectingPlatform)}
                className="w-full sm:w-fit"
              >
                {connectingIntent === "add" &&
                connectingPlatform === definition.platform ? (
                  <LoaderCircle
                    data-icon="inline-start"
                    className="animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : (
                  <Plus data-icon="inline-start" aria-hidden="true" />
                )}
                {connectingIntent === "add" &&
                connectingPlatform === definition.platform
                  ? `Opening ${definition.label}...`
                  : `Add another ${definition.label} account`}
              </Button>
            ))}
          </div>
        ) : (
          <div className="rounded-card border border-dashed border-border bg-card px-5 py-8 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,var(--instagram-orange),var(--instagram-rose)_55%,var(--instagram-violet))] text-white shadow-[0_10px_24px_rgb(214_41_118_/_0.16)]">
              <SocialPlatformIcon
                platform="instagram"
                className="size-6 !text-white"
              />
            </span>
            <p className="mt-4 text-sm font-semibold text-foreground">
              Connect a publishing account to continue
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">
              Connect an account on {platformLabels} before scheduling this post.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {visiblePlatforms.map((definition) => (
                <Button
                  key={definition.platform}
                  type="button"
                  size="lg"
                  onClick={() => onConnect(definition)}
                  disabled={
                    loading || connectingPlatform === definition.platform
                  }
                >
                  {connectingPlatform === definition.platform ? (
                    <LoaderCircle
                      data-icon="inline-start"
                      className="animate-spin"
                    />
                  ) : (
                    <ExternalLink data-icon="inline-start" />
                  )}
                  {connectingPlatform === definition.platform
                    ? "Connecting..."
                    : `Connect ${definition.label}`}
                </Button>
              ))}
            </div>
          </div>
        )}
      </fieldset>

      {carouselConnections.some((connection) =>
        Boolean(getPostAccountUnavailableMessage(connection, contentKind)),
      ) ? (
        <div className="grid gap-2">
          {carouselConnections.map((connection) => {
            const unavailableMessage =
              getPostAccountUnavailableMessage(connection, contentKind);

            return unavailableMessage ? (
              <p
                key={connection.id}
                className="flex items-start gap-2 rounded-control border border-error/20 bg-error/10 px-3 py-2.5 text-xs leading-5 text-error"
              >
                <AlertCircle
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  {getConnectionAccountName(connection)}: {unavailableMessage}
                </span>
              </p>
            ) : null;
          })}
        </div>
      ) : null}
      {context ? <p className="sr-only">Scheduling {context.title}</p> : null}
    </div>
  );
}

function DetailsStep({
  caption,
  ownerId,
  captionInitialized,
  contentKind,
  context,
  onCaptionChange,
  onChangeSetting,
  onRetryTikTok,
  onRetryPreferences,
  publishingSettings,
  publishingSettingsError,
  preferencesError,
  preferencesPending,
  selectedConnections,
  tiktokCapabilities,
}: {
  caption: string;
  ownerId: string | null;
  captionInitialized: boolean;
  contentKind: ScheduleContentKind;
  context: SchedulePlatformContext | null;
  onCaptionChange: (value: string) => void;
  onChangeSetting: (
    connectionId: string,
    key: string,
    value: boolean | string,
  ) => void;
  onRetryTikTok: (connectionId: string) => void;
  onRetryPreferences: () => void;
  publishingSettings: Record<string, ConnectionPublishingSettings>;
  publishingSettingsError: string | null;
  preferencesError: string | null;
  preferencesPending: boolean;
  selectedConnections: SocialConnection[];
  tiktokCapabilities: Record<string, TikTokCapabilitiesState>;
}) {
  const isWallText = contentKind === "wall_text";
  const isReel = contentKind !== "carousel";
  const hasTikTokDestination = selectedConnections.some(
    (connection) => connection.platform === "tiktok",
  );

  return (
    <div className="grid gap-5 md:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="self-start overflow-hidden rounded-card border border-border bg-card shadow-card">
        {context?.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={context.coverUrl}
            alt=""
            className={cn(
              "w-full bg-card-muted",
              isReel ? "aspect-[9/16] object-cover" : "aspect-[4/5] object-contain",
            )}
          />
        ) : (
          <div
            className={cn(
              "flex items-center justify-center bg-muted/30 text-muted-foreground",
              isReel ? "aspect-[9/16]" : "aspect-[4/5]",
            )}
          >
            <Camera className="size-8" aria-hidden="true" />
          </div>
        )}
        <div className="border-t border-border bg-card px-4 py-3.5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
            <SocialPlatformIcon platform="instagram" className="size-3.5" />
            {getContentLabel(contentKind)} preview
          </p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold text-foreground">
            {context?.title ?? `Saved ${getContentLabel(contentKind).toLowerCase()}`}
          </p>
        </div>
      </div>

      <div className="grid content-start gap-5">
        <div className="rounded-card border border-border bg-card p-4 sm:p-5">
          <PostCaptionField applyDefault={false} ownerId={ownerId} value={caption} initialized={captionInitialized} onChange={onCaptionChange} description={hasTikTokDestination
              ? "This appears with the TikTok post, separate from the text on the media."
              : isWallText
                ? "Add context to accompany this Text Reel. This appears in the Instagram post caption, separate from the on-screen text."
                : isReel
                  ? "This appears in the Instagram post caption, separate from the text in the Reaction Reel."
                  : "This appears below the carousel on Instagram, separate from the text on the slides."} />
        </div>

        {selectedConnections.some(
          (connection) => connection.platform === "instagram",
        ) ? (
          <InstagramCaptionPreview caption={caption} />
        ) : null}

        {preferencesError ? (
          <div className="text-xs text-error" role="alert">
            <p>{preferencesError}</p>
            <Button type="button" variant="outline" size="sm" onClick={onRetryPreferences} className="mt-2">Retry loading defaults</Button>
          </div>
        ) : preferencesPending ? (
          <p className="text-xs text-muted-foreground" role="status">Loading your publishing defaults…</p>
        ) : null}
        <a href="/settings#preferences" target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground">Change default settings</a>
        {selectedConnections.filter((connection) => connection.platform === "tiktok" && tiktokCapabilities[connection.id]?.status !== "ready").map((connection) => (
          <CarouselAccountSettings key={connection.id} connection={connection} contentKind={contentKind}
            settings={publishingSettings[connection.id] ?? getDefaultPublishingSettings(connection.platform)}
            tiktokCapabilities={tiktokCapabilities[connection.id]}
            onChange={(key, value) => onChangeSetting(connection.id, key, value)}
            onRetry={() => onRetryTikTok(connection.id)} />
        ))}
        {publishingSettingsError && !preferencesPending && !preferencesError ? <p className="text-xs font-semibold text-error" role="alert">{publishingSettingsError}</p> : null}
      </div>
    </div>
  );
}

function CarouselAccountSettings({
  connection,
  contentKind,
  onChange,
  onRetry,
  settings,
  tiktokCapabilities,
}: {
  connection: SocialConnection;
  contentKind: ScheduleContentKind;
  onChange: (key: string, value: boolean | string) => void;
  onRetry: () => void;
  settings: ConnectionPublishingSettings;
  tiktokCapabilities?: TikTokCapabilitiesState;
}) {
  return (
    <div className="py-4 first:pt-3 last:pb-3">
      <div className="flex min-w-0 items-center gap-3">
        <SocialAccountAvatar connection={connection} />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">
            {getPlatformLabel(connection.platform)}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {getConnectionAccountName(connection)}
          </span>
        </span>
      </div>

      {connection.platform === "instagram" ? (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          This will publish as an Instagram {contentKind === "carousel" ? "feed carousel" : "Reel"}.
        </p>
      ) : connection.platform === "tiktok" ? (
        <TikTokCarouselSettings
          capabilitiesState={tiktokCapabilities}
          settings={settings}
          onChange={onChange}
          onRetry={onRetry}
        />
      ) : (
        <YouTubeVideoSettings settings={settings} onChange={onChange} />
      )}
    </div>
  );
}

function YouTubeVideoSettings({ settings }: { onChange: (key: string, value: boolean | string) => void; settings: ConnectionPublishingSettings }) {
  const privacyStatus = getStringSetting(settings, 'privacyStatus', 'public');
  return <p className="mt-3 text-xs text-muted-foreground">{privacyStatus === 'public' ? 'Public' : privacyStatus === 'unlisted' ? 'Unlisted' : 'Private'} · Uses your publishing defaults in Settings.</p>;
}

function TikTokCarouselSettings({ capabilitiesState, onRetry }: {
  capabilitiesState?: TikTokCapabilitiesState;
  onChange: (key: string, value: boolean | string) => void;
  onRetry: () => void;
  settings: ConnectionPublishingSettings;
}) {
  if (!capabilitiesState || capabilitiesState.status === "loading") return <p role="status" className="mt-3 text-xs text-muted-foreground">Checking TikTok account settings…</p>;
  if (capabilitiesState.status === "error") return <div className="mt-3 text-xs text-error"><p role="alert">{capabilitiesState.message}</p><Button type="button" size="sm" variant="outline" onClick={onRetry}>Retry TikTok account</Button></div>;
  return null;
}

function LaterScheduleStep({
  date,
  error,
  minimumDate,
  onDateChange,
  onQuickTime,
  onTimeChange,
  onTimezoneChange,
  time,
  timezone,
}: {
  date: string;
  error: string | null;
  minimumDate: string;
  onDateChange: (value: string) => void;
  onQuickTime: (parts: { date: string; time: string }, preset: QuickTimePreset) => void;
  onTimeChange: (value: string) => void;
  onTimezoneChange: (value: string) => void;
  time: string;
  timezone: string;
}) {
  return (
    <div className="grid gap-5">
      <ScheduleQuickActions timezone={timezone} onSelect={onQuickTime} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CalendarClock className="size-4 text-primary" aria-hidden="true" />
            Date
          </span>
          <input
            type="date"
            min={minimumDate}
            value={date}
            onChange={(event) => onDateChange(event.target.value)}
            className="mt-2 h-11 w-full rounded-control border border-border bg-card-muted px-3 text-sm text-foreground outline-none hover:border-border-strong focus:border-focus focus:ring-2 focus:ring-focus/20"
          />
        </label>
        <label className="block">
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Clock3 className="size-4 text-primary" aria-hidden="true" />
            Time
          </span>
          <div className="mt-2"><WorkflowTimePicker id="platform-publish-time" value={time} onChange={onTimeChange} /></div>
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-semibold text-foreground">Timezone</span>
        <select
          value={timezone}
          onChange={(event) => onTimezoneChange(event.target.value)}
          className="mt-2 h-11 w-full rounded-control border border-border bg-card-muted px-3 text-sm text-foreground outline-none hover:border-border-strong focus:border-focus focus:ring-2 focus:ring-focus/20"
        >
          {getTimezoneOptions(timezone).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md bg-error/10 px-3 py-2 text-xs font-semibold text-error"
        >
          <Clock3 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}


function getDefaultPublishingSettings(
  platform: SocialPlatform,
): ConnectionPublishingSettings {
  return getDefaultScheduleTargetSettings(platform);
}

function getPostAccountUnavailableMessage(
  connection: SocialConnection,
  contentKind: ScheduleContentKind,
) {
  if (connection.platform === "youtube" && contentKind === "carousel") {
    return "YouTube accepts video uploads, not carousel posts.";
  }

  return getConnectionPublishingBlockMessage(connection);
}

function getEarliestScheduleSlot(
  now: number,
  minimumLeadMinutes: number,
  timezone: string,
) {
  const scheduledTimestamp = getEarliestScheduleTimestamp({
    minimumLeadMinutes,
    now,
  });
  const parts = getFutureSlot(scheduledTimestamp, timezone);

  return {
    ...parts,
    error: null,
    scheduledFor: new Date(scheduledTimestamp).toISOString(),
  };
}

function validateLaterSchedule(params: {
  date: string;
  minimumLeadMinutes: number;
  now: number;
  time: string;
  timezone: string;
}) {
  try {
    const scheduledFor = resolveZonedDateTime({
      date: params.date,
      time: params.time,
      timeZone: params.timezone,
    });
    const leadTime = validateScheduleLeadTime({
      minimumLeadMinutes: params.minimumLeadMinutes,
      now: params.now,
      scheduledFor,
    });

    if (!leadTime.valid) {
      return {
        date: params.date,
        error: `Choose a time at least ${params.minimumLeadMinutes} minutes from now.`,
        scheduledFor: null,
        time: params.time,
      };
    }

    return {
      date: params.date,
      error: null,
      scheduledFor,
      time: params.time,
    };
  } catch (error) {
    return {
      date: params.date,
      error: getErrorMessage(error, "Choose a valid date and time."),
      scheduledFor: null,
      time: params.time,
    };
  }
}

function getFutureSlot(timestamp: number, timezone: string) {
  try {
    return getZonedDateTimeParts(timestamp, timezone);
  } catch {
    return getZonedDateTimeParts(timestamp, "UTC");
  }
}



function getTimezoneOptions(currentTimezone: string) {
  return getSchedulingTimeZoneOptions(currentTimezone);
}

function getPreferredConnection(connections: SocialConnection[]) {
  return (
    connections.find((connection) => connection.status === "connected") ??
    connections[0]
  );
}

function getStatusDisplay(
  status: SocialConnectionStatus | "connecting" | "not_connected",
): {
  label: string;
  variant: "connected" | "destructive" | "disconnected" | "rendering";
} {
  switch (status) {
    case "connected":
      return { label: "Connected", variant: "connected" };
    case "connecting":
      return { label: "Connecting", variant: "rendering" };
    case "expired":
      return { label: "Expired", variant: "destructive" };
    case "permission_missing":
      return { label: "Permission needed", variant: "destructive" };
    case "error":
      return { label: "Connection error", variant: "destructive" };
    case "revoked":
      return { label: "Disconnected", variant: "disconnected" };
    case "not_connected":
      return { label: "Not connected", variant: "disconnected" };
  }
}

function getConnectionAccountName(connection: SocialConnection) {
  const value =
    connection.platformAccountUsername ||
    connection.platformAccountName ||
    connection.platformAccountId;

  return connection.platformAccountUsername && !value.startsWith("@")
    ? `@${value}`
    : value;
}

function getPlatformLabel(platform: SocialPlatform) {
  return platforms.find((definition) => definition.platform === platform)?.label ?? platform;
}

function getStringSetting(
  settings: ConnectionPublishingSettings,
  key: string,
  fallback: string,
) {
  return typeof settings[key] === "string"
    ? (settings[key] as string)
    : fallback;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
