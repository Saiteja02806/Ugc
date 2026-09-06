"use client";

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
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { SocialPlatformIcon } from "@/components/social/platform-icon";
import { SocialAccountAvatar } from "@/components/social/social-account-avatar";
import { useSocialOAuthPopup } from "@/components/social/use-social-oauth-popup";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  DEFAULT_SOCIAL_SCHEDULING_MIN_LEAD_MINUTES,
  getEarliestScheduleTimestamp,
  getZonedDateTimeParts,
  resolveZonedDateTime,
  SOCIAL_SCHEDULING_TIME_STEP_SECONDS,
  validateScheduleLeadTime,
} from "@/lib/scheduling/schedule-time";
import { getConnectionPublishingBlockMessage } from "@/lib/scheduling/social-connection-policy";
import {
  getTikTokPrivacyLabel,
  isTikTokPrivacyLevel,
  type TikTokPrivacyLevel,
  type TikTokPublishCapabilities,
} from "@/lib/social/tiktok-publishing";
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
type ConnectionPublishingSettings = Record<string, boolean | string>;
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
    description: "YouTube accepts video uploads, not carousel posts.",
    label: "YouTube",
    platform: "youtube",
  },
];

// TikTok and YouTube definitions stay available for legacy OAuth callbacks and
// existing schedule records. New Carousel scheduling is intentionally
// Instagram-only, so only Instagram is rendered as a selectable destination.
const visiblePlatforms = platforms.filter(
  (definition) => definition.platform === "instagram",
);

const defaultTimezone =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
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
): Record<ModalStep, { description: string; number: 2 | 3 | 4; title: string }> {
  const contentLabel = getContentLabel(contentKind);

  return {
    accounts: {
      description: `Choose the Instagram account that will publish this ${contentLabel.toLowerCase()}.`,
      number: 2,
      title: "Select Instagram account",
    },
    details: {
      description:
        contentKind === "wall_text"
          ? "Review the destination and optionally add a caption for this ready-to-prepare Reel."
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
  const queryClient = useQueryClient();
  const accountId = user?.uid ?? "signed-out";
  const [step, setStep] = useState<ModalStep>("accounts");
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("choose");
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [selectedConnectionIds, setSelectedConnectionIds] = useState<string[]>(
    [],
  );
  const [publishingSettings, setPublishingSettings] = useState<
    Record<string, ConnectionPublishingSettings>
  >({});
  const [tiktokCapabilities, setTikTokCapabilities] = useState<
    Record<string, TikTokCapabilitiesState>
  >({});
  const [caption, setCaption] = useState("");
  const [timezone, setTimezone] = useState(defaultTimezone);
  const initialLaterSlot = getEarliestScheduleSlot(
    Date.now(),
    DEFAULT_SOCIAL_SCHEDULING_MIN_LEAD_MINUTES,
    defaultTimezone,
  );
  const [scheduledDate, setScheduledDate] = useState(initialLaterSlot.date);
  const [scheduledTime, setScheduledTime] = useState(initialLaterSlot.time);
  const [minimumLeadMinutes, setMinimumLeadMinutes] = useState(
    DEFAULT_SOCIAL_SCHEDULING_MIN_LEAD_MINUTES,
  );
  const [currentTime, setCurrentTime] = useState(() => Date.now());
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

  const carouselConnections = useMemo(
    () =>
      connections.filter(
        (connection) => connection.platform === "instagram",
      ),
    [connections],
  );
  const selectedConnections = useMemo(
    () =>
      carouselConnections.filter((connection) =>
        selectedConnectionIds.includes(connection.id),
      ),
    [carouselConnections, selectedConnectionIds],
  );
  const publishingSettingsError = getPublishingSettingsError({
    connections: selectedConnections,
    settings: publishingSettings,
    tiktokCapabilities,
  });
  const laterValidation = useMemo(
    () =>
      validateLaterSchedule({
        date: scheduledDate,
        minimumLeadMinutes,
        now: currentTime,
        time: scheduledTime,
        timezone,
      }),
    [
      currentTime,
      minimumLeadMinutes,
      scheduledDate,
      scheduledTime,
      timezone,
    ],
  );
  const earliestSlot = useMemo(
    () => getEarliestScheduleSlot(currentTime, minimumLeadMinutes, timezone),
    [currentTime, minimumLeadMinutes, timezone],
  );
  const minimumScheduledDate = useMemo(
    () => getFutureSlot(currentTime, timezone).date,
    [currentTime, timezone],
  );
  const contentKind = getContentKind(context);
  const contentLabel = getContentLabel(contentKind);
  const currentStep = getStepDetails(contentKind)[step];
  const canContinueAccounts =
    selectedConnections.length > 0 &&
    selectedConnections.every(
      (connection) => !getCarouselAccountUnavailableMessage(connection),
    );

  function resetModal() {
    const now = Date.now();
    const nextSlot = getEarliestScheduleSlot(
      now,
      minimumLeadMinutes,
      defaultTimezone,
    );

    closePopup();
    clearPopupError();
    setStep("accounts");
    setScheduleMode("choose");
    setSelectedConnectionIds([]);
    setPublishingSettings({});
    setTikTokCapabilities({});
    setCaption("");
    setTimezone(defaultTimezone);
    setScheduledDate(nextSlot.date);
    setScheduledTime(nextSlot.time);
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
    if (getCarouselAccountUnavailableMessage(connection)) {
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
        `Choose up to ${MAX_SELECTED_INSTAGRAM_ACCOUNTS} Instagram accounts per post.`,
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
            [connection.id]: getDefaultPublishingSettings(connection.platform),
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
      setPublishingSettings((current) => {
        const settings =
          current[connectionId] ?? getDefaultPublishingSettings("tiktok");
        const privacyLevel = settings.privacyLevel;

        return {
          ...current,
          [connectionId]: {
            ...settings,
            allowComment: data.capabilities.interactions.commentsDisabled
              ? false
              : settings.allowComment === true,
            privacyLevel:
              isTikTokPrivacyLevel(privacyLevel) &&
              data.capabilities.privacyLevels.includes(privacyLevel)
                ? privacyLevel
                : "",
          },
        };
      });
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
      mode === "asap"
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
          settings:
            publishingSettings[connection.id] ??
            getDefaultPublishingSettings(connection.platform),
        })),
        timezone,
        useDefaultScheduleTime: mode === "asap",
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

  function applyQuickSlot(hoursFromNow: number) {
    const next = getFutureSlot(currentTime + hoursFromNow * 60 * 60_000, timezone);
    setScheduledDate(next.date);
    setScheduledTime(next.time);
  }

  function applyTomorrowSlot(time: string) {
    setScheduledDate(addDaysToDateKey(minimumScheduledDate, 1));
    setScheduledTime(time);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
                Instagram post
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
          {confirmError || loadError || popupError ? (
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
                    returnTo: context.returnTo,
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
            />
          ) : step === "details" ? (
            <DetailsStep
              caption={caption}
              contentKind={contentKind}
              context={context}
              publishingSettings={publishingSettings}
              publishingSettingsError={publishingSettingsError}
              selectedConnections={selectedConnections}
              tiktokCapabilities={tiktokCapabilities}
              onCaptionChange={setCaption}
              onChangeSetting={updatePublishingSetting}
              onRetryTikTok={loadTikTokCapabilities}
            />
          ) : scheduleMode === "choose" ? (
            <ScheduleChoiceStep
              earliestLabel={formatScheduleInstant(
                earliestSlot.scheduledFor,
                timezone,
              )}
              minimumLeadMinutes={minimumLeadMinutes}
              onPostAsap={() => void submitSchedule("asap")}
              onScheduleLater={() => setScheduleMode("later")}
            />
          ) : (
            <LaterScheduleStep
              date={scheduledDate}
              error={laterValidation.error}
              minimumDate={minimumScheduledDate}
              time={scheduledTime}
              timezone={timezone}
              onDateChange={setScheduledDate}
              onQuickHours={applyQuickSlot}
              onQuickTomorrow={applyTomorrowSlot}
              onTimeChange={setScheduledTime}
              onTimezoneChange={setTimezone}
            />
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
            ) : scheduleMode === "later" ? (
              <Button
                size="lg"
                className="px-4"
                onClick={() => void submitSchedule("later")}
                disabled={Boolean(laterValidation.error)}
              >
                <Check data-icon="inline-start" />
                Schedule post
              </Button>
            ) : null}
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
}) {
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-5">
      <div>
        <h3 className="text-base font-semibold text-foreground">
          Publishing account
        </h3>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          Select one or more Instagram accounts. Each selected account
          publishes its own {contentLabel.toLowerCase()}. You can choose up to five.
        </p>
      </div>

      <fieldset>
        <legend className="sr-only">Connected Instagram accounts</legend>
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
                getCarouselAccountUnavailableMessage(connection);
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
                        Instagram professional account
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
                  ? "Opening Instagram..."
                  : "Add another Instagram account"}
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
              Connect Instagram to continue
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">
              UGCPilot needs a connected Instagram professional account before
              it can schedule this post.
            </p>
            <div className="mt-4 flex justify-center">
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
                    : "Connect Instagram"}
                </Button>
              ))}
            </div>
          </div>
        )}
      </fieldset>

      {carouselConnections.some((connection) =>
        Boolean(getCarouselAccountUnavailableMessage(connection)),
      ) ? (
        <div className="grid gap-2">
          {carouselConnections.map((connection) => {
            const unavailableMessage =
              getCarouselAccountUnavailableMessage(connection);

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
  contentKind,
  context,
  onCaptionChange,
  onChangeSetting,
  onRetryTikTok,
  publishingSettings,
  publishingSettingsError,
  selectedConnections,
  tiktokCapabilities,
}: {
  caption: string;
  contentKind: ScheduleContentKind;
  context: SchedulePlatformContext | null;
  onCaptionChange: (value: string) => void;
  onChangeSetting: (
    connectionId: string,
    key: string,
    value: boolean | string,
  ) => void;
  onRetryTikTok: (connectionId: string) => void;
  publishingSettings: Record<string, ConnectionPublishingSettings>;
  publishingSettingsError: string | null;
  selectedConnections: SocialConnection[];
  tiktokCapabilities: Record<string, TikTokCapabilitiesState>;
}) {
  const isWallText = contentKind === "wall_text";
  const isReel = contentKind !== "carousel";

  return (
    <div className="grid gap-5 md:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="self-start overflow-hidden rounded-card border border-border bg-card shadow-card">
        {context?.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={context.coverUrl}
            alt=""
            className={cn(
              "w-full bg-card-muted object-cover",
              isReel ? "aspect-[9/16]" : "aspect-[4/5]",
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
        {isWallText ? (
          <section className="rounded-card border border-primary/20 bg-primary/5 p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-foreground">
              Text Reel is ready to prepare
            </h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Its message already appears on screen, so there is nothing extra
              to write here. We start preparing the video after you confirm the
              schedule.
            </p>
          </section>
        ) : null}

        <label className="block rounded-card border border-border bg-card p-4 sm:p-5">
          <span className="text-sm font-semibold text-foreground">
            Instagram caption{" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
            {isWallText
              ? "Add context to accompany this Text Reel, or leave this empty to publish without a caption."
              : isReel
                ? "Add context for the post, or leave this empty to publish only the Reaction Reel."
                : "Add context for the post, or leave this empty to publish only the carousel."}
          </span>
          <textarea
            name="caption"
            rows={4}
            maxLength={5000}
            value={caption}
            onChange={(event) => onCaptionChange(event.target.value)}
            placeholder="Leave blank to publish without a caption."
            className="mt-3 min-h-28 w-full resize-y rounded-control border border-border bg-card-muted px-3.5 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground hover:border-border-strong focus:border-focus focus:ring-2 focus:ring-focus/20"
          />
          <span className="mt-1 block text-right text-xs text-muted-foreground">
            {caption.length}/5000
          </span>
        </label>

        <section
          aria-labelledby="post-publishing-settings"
          className="rounded-card border border-border bg-card p-4 sm:p-5"
        >
          <h3
            id="post-publishing-settings"
            className="text-sm font-semibold text-foreground"
          >
            Publishing settings
          </h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Confirm the destination before choosing when to publish.
          </p>
          <div className="mt-3 divide-y divide-border rounded-control border border-border bg-card-muted px-3.5">
            {selectedConnections.map((connection) => (
                <CarouselAccountSettings
                  key={connection.id}
                  connection={connection}
                  contentKind={contentKind}
                settings={
                  publishingSettings[connection.id] ??
                  getDefaultPublishingSettings(connection.platform)
                }
                tiktokCapabilities={tiktokCapabilities[connection.id]}
                onChange={(key, value) =>
                  onChangeSetting(connection.id, key, value)
                }
                onRetry={() => onRetryTikTok(connection.id)}
              />
            ))}
          </div>
          {publishingSettingsError ? (
            <p className="mt-2 text-xs font-semibold text-error" role="alert">
              {publishingSettingsError}
            </p>
          ) : null}
        </section>
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
          This will publish as an Instagram {contentKind === "wall_text" ? "Reel" : "feed carousel"}.
        </p>
      ) : (
        <TikTokCarouselSettings
          capabilitiesState={tiktokCapabilities}
          settings={settings}
          onChange={onChange}
          onRetry={onRetry}
        />
      )}
    </div>
  );
}

function TikTokCarouselSettings({
  capabilitiesState,
  onChange,
  onRetry,
  settings,
}: {
  capabilitiesState?: TikTokCapabilitiesState;
  onChange: (key: string, value: boolean | string) => void;
  onRetry: () => void;
  settings: ConnectionPublishingSettings;
}) {
  if (!capabilitiesState || capabilitiesState.status === "loading") {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        Loading TikTok account settings...
      </div>
    );
  }

  if (capabilitiesState.status === "error") {
    return (
      <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-error/10 px-3 py-2">
        <p className="text-xs font-semibold text-error">
          {capabilitiesState.message}
        </p>
        <Button type="button" size="sm" variant="ghost" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  const capabilities = capabilitiesState.capabilities;
  const privacyLevel = getStringSetting(settings, "privacyLevel", "");
  const brandedContent = getBooleanSetting(settings, "brandedContent", false);

  return (
    <div className="mt-3 grid gap-3">
      <label className="block">
        <span className="text-xs font-semibold text-foreground">Visibility</span>
        <select
          value={privacyLevel}
          onChange={(event) => onChange("privacyLevel", event.target.value)}
          className="mt-1.5 h-10 w-full rounded-control border border-border bg-card-muted px-3 text-sm text-foreground outline-none hover:border-border-strong focus:border-focus focus:ring-2 focus:ring-focus/20"
        >
          <option value="">Select visibility</option>
          {capabilities.privacyLevels.map((level) => (
            <option
              key={level}
              value={level}
              disabled={brandedContent && level === "SELF_ONLY"}
            >
              {getTikTokPrivacyLabel(level)}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-2 sm:grid-cols-3">
        <SettingCheckbox
          checked={getBooleanSetting(settings, "allowComment", false)}
          disabled={capabilities.interactions.commentsDisabled}
          label="Allow comments"
          onChange={(checked) => onChange("allowComment", checked)}
        />
        <SettingCheckbox
          checked={getBooleanSetting(settings, "brandOrganic", false)}
          label="Promotes your brand"
          onChange={(checked) => onChange("brandOrganic", checked)}
        />
        <SettingCheckbox
          checked={brandedContent}
          label="Paid partnership"
          onChange={(checked) => {
            onChange("brandedContent", checked);

            if (checked && privacyLevel === "SELF_ONLY") {
              onChange("privacyLevel", "");
            }
          }}
        />
      </div>

      <p className="text-[11px] leading-5 text-muted-foreground">
        TikTok photo posts use automatic music. By scheduling, you agree to
        TikTok&apos;s Music Usage Confirmation.
      </p>
    </div>
  );
}

function ScheduleChoiceStep({
  earliestLabel,
  minimumLeadMinutes,
  onPostAsap,
  onScheduleLater,
}: {
  earliestLabel: string;
  minimumLeadMinutes: number;
  onPostAsap: () => void;
  onScheduleLater: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div>
        <h3 className="text-base font-semibold text-foreground">
          Choose a publishing time
        </h3>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          Publish at the earliest safe time, or choose an exact date and time.
        </p>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <ScheduleChoice
          description={`Earliest available: ${earliestLabel}. Uses the configured ${minimumLeadMinutes}-minute lead time.`}
          icon={<Zap className="size-5" aria-hidden="true" />}
          label="Post Right away"
          onClick={onPostAsap}
        />
        <ScheduleChoice
          description="Pick a specific date, time, and timezone"
          icon={<CalendarClock className="size-5" aria-hidden="true" />}
          label="Schedule for later"
          onClick={onScheduleLater}
        />
      </div>
    </div>
  );
}

function ScheduleChoice({
  description,
  icon,
  label,
  onClick,
}: {
  description: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-36 items-start gap-4 rounded-card border border-border bg-card px-4 py-5 text-left transition hover:-translate-y-0.5 hover:border-primary/50 hover:bg-card-muted hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:hover:translate-y-0 sm:px-5"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-primary/12 text-primary ring-1 ring-primary/20">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold text-foreground">
          {label}
        </span>
        <span className="mt-1 block text-sm leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
      <ChevronRight
        className="mt-2 size-5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
        aria-hidden="true"
      />
    </button>
  );
}

function LaterScheduleStep({
  date,
  error,
  minimumDate,
  onDateChange,
  onQuickHours,
  onQuickTomorrow,
  onTimeChange,
  onTimezoneChange,
  time,
  timezone,
}: {
  date: string;
  error: string | null;
  minimumDate: string;
  onDateChange: (value: string) => void;
  onQuickHours: (hours: number) => void;
  onQuickTomorrow: (time: string) => void;
  onTimeChange: (value: string) => void;
  onTimezoneChange: (value: string) => void;
  time: string;
  timezone: string;
}) {
  return (
    <div className="grid gap-5">
      <section aria-labelledby="quick-schedule-heading">
        <h3
          id="quick-schedule-heading"
          className="flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          <Zap className="size-4 text-primary" aria-hidden="true" />
          Quick select
        </h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <QuickSlot label="In 1 hour" onClick={() => onQuickHours(1)} />
          <QuickSlot label="In 3 hours" onClick={() => onQuickHours(3)} />
          <QuickSlot
            label="Tomorrow 9 AM"
            onClick={() => onQuickTomorrow("09:00")}
          />
          <QuickSlot
            label="Tomorrow 12 PM"
            onClick={() => onQuickTomorrow("12:00")}
          />
          <QuickSlot
            label="Tomorrow 6 PM"
            onClick={() => onQuickTomorrow("18:00")}
          />
        </div>
      </section>

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
          <input
            type="time"
            step={SOCIAL_SCHEDULING_TIME_STEP_SECONDS}
            value={time}
            onChange={(event) => onTimeChange(event.target.value)}
            className="mt-2 h-11 w-full rounded-control border border-border bg-card-muted px-3 text-sm text-foreground outline-none hover:border-border-strong focus:border-focus focus:ring-2 focus:ring-focus/20"
          />
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

function QuickSlot({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-control border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {label}
    </button>
  );
}

function SettingCheckbox({
  checked,
  disabled = false,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex min-h-10 items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground",
        disabled && "cursor-not-allowed bg-muted opacity-65",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 shrink-0 accent-primary"
      />
      {label}
    </label>
  );
}

function getDefaultPublishingSettings(
  platform: SocialPlatform,
): ConnectionPublishingSettings {
  if (platform === "instagram") {
    return { shareToFeed: true };
  }

  return {
    allowComment: false,
    allowDuet: false,
    allowStitch: false,
    brandOrganic: false,
    brandedContent: false,
    containsSyntheticMedia: true,
    privacyLevel: "",
  };
}

function getCarouselAccountUnavailableMessage(connection: SocialConnection) {
  if (connection.platform === "youtube") {
    return "YouTube accepts video uploads, not carousel posts.";
  }

  return getConnectionPublishingBlockMessage(connection);
}

function getPublishingSettingsError(params: {
  connections: SocialConnection[];
  settings: Record<string, ConnectionPublishingSettings>;
  tiktokCapabilities: Record<string, TikTokCapabilitiesState>;
}) {
  for (const connection of params.connections) {
    if (connection.platform !== "tiktok") {
      continue;
    }

    const capabilityState = params.tiktokCapabilities[connection.id];

    if (!capabilityState || capabilityState.status === "loading") {
      return "Wait for TikTok publishing settings to finish loading.";
    }

    if (capabilityState.status === "error") {
      return capabilityState.message;
    }

    const settings =
      params.settings[connection.id] ?? getDefaultPublishingSettings("tiktok");
    const privacyLevel = getStringSetting(settings, "privacyLevel", "");

    if (!isTikTokPrivacyLevel(privacyLevel)) {
      return "Choose who can view the TikTok post.";
    }

    const selectedPrivacyLevel: TikTokPrivacyLevel = privacyLevel;

    if (!capabilityState.capabilities.privacyLevels.includes(selectedPrivacyLevel)) {
      return "Choose a TikTok visibility available for this account.";
    }

    if (
      getBooleanSetting(settings, "brandedContent", false) &&
      selectedPrivacyLevel === "SELF_ONLY"
    ) {
      return "TikTok paid partnerships cannot use Only me visibility.";
    }
  }

  return null;
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

function formatScheduleInstant(value: string | null, timezone: string) {
  if (!value) {
    return "the next available slot";
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleString();
  }
}

function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));

  return date.toISOString().slice(0, 10);
}

function getTimezoneOptions(currentTimezone: string) {
  const common = [
    currentTimezone,
    "UTC",
    "Asia/Calcutta",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
    "Australia/Sydney",
  ];

  return Array.from(new Set(common.filter(Boolean)));
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
  return platform === "instagram" ? "Instagram" : "TikTok";
}

function getBooleanSetting(
  settings: ConnectionPublishingSettings,
  key: string,
  fallback: boolean,
) {
  return typeof settings[key] === "boolean"
    ? (settings[key] as boolean)
    : fallback;
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
