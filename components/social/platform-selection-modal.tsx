"use client";

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
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { SocialPlatformIcon } from "@/components/social/platform-icon";
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
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import {
  CarouselScheduleRecoveryError,
  type CarouselScheduleSubmission,
} from "@/lib/scheduling/carousel-scheduling-client";
import {
  DEFAULT_MINIMUM_RENDER_LEAD_MINUTES,
  getZonedDateTimeParts,
  resolveZonedDateTime,
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
  type SocialOAuthResultMessage,
  type SocialPlatform,
} from "@/lib/social/types";
import { cn } from "@/lib/utils";

export type SchedulePlatformContext = {
  assignmentId?: string;
  carouselId: string;
  coverUrl?: string | null;
  idempotencyKey: string;
  libraryItemId: string;
  returnTo: "library" | "trending";
  title: string;
};

type PlatformSelectionModalProps = {
  context: SchedulePlatformContext | null;
  onConfirmed: (
    submission: CarouselScheduleSubmission,
  ) => Promise<void> | void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type ConnectionsResponse =
  | { connections: SocialConnection[]; ok: true }
  | { message: string; ok: false };

type ScheduleConfigResponse =
  | { minimumRenderLeadMinutes?: number; ok: true }
  | { message?: string; ok: false };

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

const stepDetails: Record<
  ModalStep,
  { description: string; number: 2 | 3 | 4; title: string }
> = {
  accounts: {
    description: "Choose the Instagram account that will publish this carousel.",
    number: 2,
    title: "Select Instagram account",
  },
  details: {
    description:
      "Review the destinations and add a caption only if you want one.",
    number: 3,
    title: "Content details",
  },
  schedule: {
    description: "Choose when this carousel should be published.",
    number: 4,
    title: "Schedule",
  },
};

export function PlatformSelectionModal({
  context,
  onConfirmed,
  onOpenChange,
  open,
}: PlatformSelectionModalProps) {
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
  const initialLaterSlot = getFutureSlot(
    Date.now() + 60 * 60_000,
    defaultTimezone,
  );
  const [scheduledDate, setScheduledDate] = useState(initialLaterSlot.date);
  const [scheduledTime, setScheduledTime] = useState(initialLaterSlot.time);
  const [minimumLeadMinutes, setMinimumLeadMinutes] = useState(
    DEFAULT_MINIMUM_RENDER_LEAD_MINUTES,
  );
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [recoveryDraftId, setRecoveryDraftId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [renderTrace, setRenderTrace] = useState<OAuthTraceInput | null>(null);

  const loadConnections = useCallback(async (trace?: OAuthTraceInput) => {
    setLoading(true);
    setLoadError(null);

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in before connecting a social account.");
      }

      const response = await fetch("/api/social/connections", {
        cache: "no-store",
        headers: getConnectionHeaders(token, trace),
      });
      const data = (await response.json().catch(() => null)) as
        | ConnectionsResponse
        | null;

      if (!response.ok || data?.ok !== true) {
        throw new Error(
          data?.ok === false
            ? data.message
            : "Could not load connected accounts.",
        );
      }

      setConnections(data.connections);
      return data.connections;
    } catch (error) {
      setLoadError(getErrorMessage(error, "Could not load connected accounts."));
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMinimumLeadMinutes = useCallback(async () => {
    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        return;
      }

      const response = await fetch("/api/schedules?status=draft", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json().catch(() => null)) as
        | ScheduleConfigResponse
        | null;
      const leadMinutes = data?.ok === true
        ? data.minimumRenderLeadMinutes
        : null;

      if (
        response.ok &&
        Number.isInteger(leadMinutes) &&
        Number(leadMinutes) >= 1
      ) {
        setMinimumLeadMinutes(Number(leadMinutes));
      }
    } catch {
      // The shared server default remains the safe fallback.
    }
  }, []);

  async function handleOAuthResult(result: SocialOAuthResultMessage) {
    if (result.status !== "success") {
      return;
    }

    const refreshedConnections = await loadConnections({
      callbackHost: result.callbackHost,
      correlationId: result.correlationId,
      platform: result.platform,
    });
    const connection = getPreferredConnection(
      refreshedConnections.filter(
        (candidate) => candidate.platform === result.platform,
      ),
    );

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
    connectingPlatform,
    popupError,
    startConnection,
  } = useSocialOAuthPopup({
    onPopupClosed: async ({ platform, previousConnectionUpdatedAt }) => {
      const refreshedConnections = await loadConnections();
      const previousUpdatedAt = previousConnectionUpdatedAt
        ? Date.parse(previousConnectionUpdatedAt)
        : null;
      const connection = getPreferredConnection(
        refreshedConnections.filter(
          (candidate) =>
            candidate.platform === platform &&
            candidate.status === "connected" &&
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
  const platformConnections = useMemo(
    () =>
      connections.filter((connection) =>
        platforms.some((definition) => definition.platform === connection.platform),
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
  const currentStep = stepDetails[step];
  const canContinueAccounts =
    selectedConnections.length > 0 &&
    selectedConnections.every(
      (connection) => !getCarouselAccountUnavailableMessage(connection),
    );

  function resetModal() {
    const nextSlot = getFutureSlot(Date.now() + 60 * 60_000, defaultTimezone);

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

    const scheduleTime = mode === "asap" ? earliestSlot : laterValidation;

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
      });
      resetModal();
      onOpenChange(false);
    } catch (error) {
      setConfirmError(
        getErrorMessage(error, "Could not schedule this carousel."),
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
        className="max-h-[calc(100vh-2rem)] overflow-hidden p-0 sm:max-w-3xl"
        showCloseButton={!submitting}
      >
        <div className="border-b border-border bg-card">
          <DialogHeader className="px-5 pb-4 pt-5 pr-14 sm:px-6 sm:pr-14">
            <DialogTitle className="text-xl font-semibold">
              {currentStep.title}
            </DialogTitle>
            <p className="text-sm font-medium text-muted-foreground">
              Step {currentStep.number} of 4
            </p>
            <DialogDescription>{currentStep.description}</DialogDescription>
          </DialogHeader>
          <div className="h-1 bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-200 motion-reduce:transition-none"
              style={{ width: `${currentStep.number * 25}%` }}
            />
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
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
              <AlertTitle>Scheduling carousel</AlertTitle>
              <AlertDescription className="text-success">
                Saving the exact account settings and creating the calendar
                schedule.
              </AlertDescription>
            </Alert>
          ) : step === "accounts" ? (
            <AccountsStep
              carouselConnections={carouselConnections}
              connectingPlatform={connectingPlatform}
              context={context}
              loading={loading}
              platformConnections={platformConnections}
              selectedConnectionIds={selectedConnectionIds}
              onConnect={(definition, connection) => {
                if (!context) {
                  setLoadError("Choose a saved Library carousel first.");
                  return;
                }

                void startConnection({
                  carouselId: context.carouselId,
                  forceConsent: Boolean(connection),
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
          <DialogFooter className="border-t border-border bg-card px-5 py-4 sm:px-6">
            {step === "accounts" ? (
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            ) : (
              <Button variant="ghost" onClick={goBack}>
                <ArrowLeft data-icon="inline-start" />
                Back
              </Button>
            )}

            {step === "accounts" || step === "details" ? (
              <Button
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
  connectingPlatform,
  context,
  loading,
  onConnect,
  onToggle,
  platformConnections,
  selectedConnectionIds,
}: {
  carouselConnections: SocialConnection[];
  connectingPlatform: SocialPlatform | null;
  context: SchedulePlatformContext | null;
  loading: boolean;
  onConnect: (
    definition: PlatformDefinition,
    connection?: SocialConnection,
  ) => void;
  onToggle: (connection: SocialConnection) => void;
  platformConnections: SocialConnection[];
  selectedConnectionIds: string[];
}) {
  const accountRows = carouselConnections;

  return (
    <div className="grid gap-6">
      <section aria-labelledby="platform-connections-heading">
        <h3
          id="platform-connections-heading"
          className="mb-2 text-sm font-semibold text-foreground"
        >
          Instagram connection
        </h3>
        <div className="overflow-hidden rounded-lg border border-border">
          {visiblePlatforms.map((definition, index) => {
            const connectionsForPlatform = platformConnections.filter(
              (connection) => connection.platform === definition.platform,
            );
            const connection = getPreferredConnection(connectionsForPlatform);
            const status = connectingPlatform === definition.platform
              ? "connecting"
              : (connection?.status ?? "not_connected");

            return (
              <PlatformConnectionRow
                key={definition.platform}
                connection={connection}
                definition={definition}
                first={index === 0}
                loading={loading}
                onConnect={() => onConnect(definition, connection)}
                status={status}
              />
            );
          })}
        </div>
      </section>

      <FieldSet>
        <FieldLegend className="text-sm font-semibold">
          Select connected account
        </FieldLegend>
        <FieldDescription>
          Choose the Instagram account that will publish this carousel.
        </FieldDescription>
        {loading ? (
          <FieldGroup>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </FieldGroup>
        ) : accountRows.length > 0 ? (
          <FieldGroup data-slot="checkbox-group" className="gap-2">
            {accountRows.map((connection) => {
              const checkboxId = `schedule-connection-${connection.id}`;
              const unavailableMessage =
                getCarouselAccountUnavailableMessage(connection);
              const accountName = getConnectionAccountName(connection);

              return (
                <Field
                  key={connection.id}
                  orientation="horizontal"
                  className={cn(
                    "rounded-lg border border-border p-3",
                    unavailableMessage && "bg-muted/40 opacity-75",
                  )}
                >
                  <Checkbox
                    id={checkboxId}
                    checked={selectedConnectionIds.includes(connection.id)}
                    disabled={Boolean(unavailableMessage)}
                    onCheckedChange={() => onToggle(connection)}
                  />
                  <FieldContent>
                    <FieldLabel htmlFor={checkboxId}>
                      <SocialPlatformIcon
                        platform={connection.platform}
                        className="size-4"
                      />
                      {getPlatformLabel(connection.platform)}
                      <span className="font-normal text-muted-foreground">
                        {accountName}
                      </span>
                    </FieldLabel>
                    {unavailableMessage ? (
                      <FieldDescription
                        className={
                          connection.platform === "youtube"
                            ? "text-muted-foreground"
                            : "text-error"
                        }
                      >
                        {unavailableMessage}
                      </FieldDescription>
                    ) : null}
                  </FieldContent>
                </Field>
              );
            })}
          </FieldGroup>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
            Connect Instagram above to continue.
          </p>
        )}
      </FieldSet>
      {context ? <p className="sr-only">Scheduling {context.title}</p> : null}
    </div>
  );
}

function DetailsStep({
  caption,
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
  return (
    <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div className="self-start overflow-hidden rounded-card border border-border bg-card">
        {context?.coverUrl ? (
          // Carousel slides are already rendered production media.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={context.coverUrl}
            alt=""
            className="aspect-[4/5] w-full object-contain"
          />
        ) : (
          <div className="flex aspect-[4/5] items-center justify-center bg-muted/30 text-muted-foreground">
            <Camera className="size-8" aria-hidden="true" />
          </div>
        )}
        <div className="border-t border-border bg-card px-3 py-3">
          <p className="text-xs font-semibold text-muted-foreground">
            Carousel
          </p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold text-foreground">
            {context?.title ?? "Saved carousel"}
          </p>
        </div>
      </div>

      <div className="grid content-start gap-5">
        <label className="block">
          <span className="text-sm font-semibold text-foreground">
            Caption <span className="font-normal text-muted-foreground">(optional)</span>
          </span>
          <textarea
            rows={4}
            maxLength={5000}
            value={caption}
            onChange={(event) => onCaptionChange(event.target.value)}
            placeholder="Leave blank to publish without a caption."
            className="mt-2 min-h-28 w-full resize-y rounded-control border border-border bg-card-muted px-3 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground hover:border-border-strong focus:border-focus focus:ring-2 focus:ring-focus/20"
          />
          <span className="mt-1 block text-right text-xs text-muted-foreground">
            {caption.length}/5000
          </span>
        </label>

        <section aria-labelledby="carousel-publishing-settings">
          <h3
            id="carousel-publishing-settings"
            className="text-sm font-semibold text-foreground"
          >
            Publishing settings
          </h3>
          <div className="mt-2 divide-y divide-border rounded-card border border-border bg-card px-3">
            {selectedConnections.map((connection) => (
              <CarouselAccountSettings
                key={connection.id}
                connection={connection}
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
  onChange,
  onRetry,
  settings,
  tiktokCapabilities,
}: {
  connection: SocialConnection;
  onChange: (key: string, value: boolean | string) => void;
  onRetry: () => void;
  settings: ConnectionPublishingSettings;
  tiktokCapabilities?: TikTokCapabilitiesState;
}) {
  return (
    <div className="py-4 first:pt-3 last:pb-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
          <SocialPlatformIcon
            platform={connection.platform}
            className="size-4 shrink-0"
          />
          {getPlatformLabel(connection.platform)}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {getConnectionAccountName(connection)}
        </span>
      </div>

      {connection.platform === "instagram" ? (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          This will publish as an Instagram feed carousel.
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
    <div>
      <p className="text-center text-sm text-muted-foreground">
        How would you like to post this carousel?
      </p>
      <div className="mt-5 grid gap-3">
        <ScheduleChoice
          description={`Earliest available: ${earliestLabel}. Uses the configured ${minimumLeadMinutes}-minute lead time.`}
          icon={<Zap className="size-5" aria-hidden="true" />}
          label="Post ASAP"
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
      className="group flex min-h-24 items-center gap-4 rounded-card border border-border bg-card px-4 py-4 text-left transition hover:border-primary/50 hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-5"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
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
      <ChevronRight className="size-5 shrink-0 text-primary" aria-hidden="true" />
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

function PlatformConnectionRow({
  connection,
  definition,
  first,
  loading,
  onConnect,
  status,
}: {
  connection?: SocialConnection;
  definition: PlatformDefinition;
  first: boolean;
  loading: boolean;
  onConnect: () => void;
  status: SocialConnectionStatus | "connecting" | "not_connected";
}) {
  const { label, platform } = definition;
  const statusDisplay = getStatusDisplay(status);
  const accountName = connection ? getConnectionAccountName(connection) : null;

  return (
    <div
      className={cn(
        "flex min-h-20 items-center gap-3 px-3 py-3 sm:px-4",
        !first && "border-t border-border",
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
        <SocialPlatformIcon platform={platform} className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-foreground">{label}</p>
          <Badge variant={statusDisplay.variant}>{statusDisplay.label}</Badge>
        </div>
        {loading ? (
          <Skeleton className="mt-2 h-3 w-40" />
        ) : (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {accountName ?? definition.description}
          </p>
        )}
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onConnect}
        disabled={loading || status === "connecting"}
      >
        {status === "connecting" ? (
          <LoaderCircle data-icon="inline-start" className="animate-spin" />
        ) : (
          <ExternalLink data-icon="inline-start" />
        )}
        {status === "connected" ? "Reconnect" : "Connect"}
      </Button>
    </div>
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
  const scheduledTimestamp =
    Math.ceil(
      (now + (minimumLeadMinutes + 2) * 60_000) / 60_000,
    ) * 60_000;
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

function getConnectionHeaders(token: string, trace?: OAuthTraceInput) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  if (trace?.correlationId) {
    headers["x-ugc-oauth-correlation-id"] = trace.correlationId;
  }

  if (trace?.callbackHost) {
    headers["x-ugc-oauth-callback-host"] = trace.callbackHost;
  }

  return headers;
}

function getStatusDisplay(
  status: SocialConnectionStatus | "connecting" | "not_connected",
): {
  label: string;
  variant: "destructive" | "outline" | "secondary";
} {
  switch (status) {
    case "connected":
      return { label: "Connected", variant: "secondary" };
    case "connecting":
      return { label: "Connecting", variant: "outline" };
    case "expired":
      return { label: "Expired", variant: "destructive" };
    case "permission_missing":
      return { label: "Permission needed", variant: "destructive" };
    case "error":
      return { label: "Connection error", variant: "destructive" };
    case "revoked":
      return { label: "Disconnected", variant: "outline" };
    case "not_connected":
      return { label: "Not connected", variant: "outline" };
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
