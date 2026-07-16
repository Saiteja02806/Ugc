"use client";

import {
  AlertCircle,
  Camera,
  ExternalLink,
  LoaderCircle,
  Music2,
  Play,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  type SocialConnection,
  type SocialConnectionStatus,
  type SocialOAuthResultMessage,
  type SocialPlatform,
} from "@/lib/social/types";
import { cn } from "@/lib/utils";

export type SchedulePlatformContext = {
  carouselId: string;
  libraryItemId: string;
  returnTo: "library" | "trending";
};

type PlatformSelectionModalProps = {
  context: SchedulePlatformContext | null;
  onConfirmed: (platforms: SocialPlatform[]) => Promise<void> | void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type ConnectionsResponse =
  | { connections: SocialConnection[]; ok: true }
  | { message: string; ok: false };

type OAuthTraceInput = {
  callbackHost?: string;
  correlationId?: string;
  platform?: SocialPlatform;
};

type PlatformDefinition = {
  description: string;
  Icon: LucideIcon;
  label: string;
  platform: SocialPlatform;
};

const platforms: PlatformDefinition[] = [
  {
    description: "Professional account connected through Meta",
    Icon: Camera,
    label: "Instagram",
    platform: "instagram",
  },
  {
    description: "Creator account authorized with TikTok",
    Icon: Music2,
    label: "TikTok",
    platform: "tiktok",
  },
  {
    description: "Channel authorized through Google",
    Icon: Play,
    label: "YouTube",
    platform: "youtube",
  },
];

export function PlatformSelectionModal({
  context,
  onConfirmed,
  onOpenChange,
  open,
}: PlatformSelectionModalProps) {
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
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
      setLoadError(
        error instanceof Error
          ? error.message
          : "Could not load connected accounts.",
      );
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOAuthResult = useCallback(
    async (result: SocialOAuthResultMessage) => {
      if (result.status !== "success") {
        return;
      }

      const refreshedConnections = await loadConnections({
        callbackHost: result.callbackHost,
        correlationId: result.correlationId,
        platform: result.platform,
      });
      const isConnected = refreshedConnections.some(
        (connection) =>
          connection.platform === result.platform &&
          connection.status === "connected",
      );
      setRenderTrace({
        callbackHost: result.callbackHost,
        correlationId: result.correlationId,
        platform: result.platform,
      });

      if (isConnected) {
        setSelectedPlatforms((current) =>
          current.includes(result.platform)
            ? current
            : [...current, result.platform],
        );
      }
    },
    [loadConnections],
  );
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
      const isConnected = refreshedConnections.some(
        (connection) =>
          connection.platform === platform &&
          connection.status === "connected" &&
          (previousUpdatedAt === null ||
            Date.parse(connection.updatedAt) > previousUpdatedAt),
      );

      if (isConnected) {
        setSelectedPlatforms((current) =>
          current.includes(platform) ? current : [...current, platform],
        );
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
      void loadConnections();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadConnections, open]);

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

  const connectedPlatforms = useMemo(
    () =>
      platforms.filter(({ platform }) =>
        connections.some(
          (connection) =>
            connection.platform === platform &&
            connection.status === "connected",
        ),
      ),
    [connections],
  );
  const canContinue = selectedPlatforms.length > 0 && !submitting;

  function setOpen(nextOpen: boolean) {
    if (!nextOpen && submitting) {
      return;
    }

    if (!nextOpen) {
      closePopup();
      clearPopupError();
      setConfirmError(null);
      setSubmitting(false);
      setSelectedPlatforms([]);
    }

    onOpenChange(nextOpen);
  }

  function togglePlatform(platform: SocialPlatform, checked: boolean) {
    setSelectedPlatforms((current) =>
      checked
        ? current.includes(platform)
          ? current
          : [...current, platform]
        : current.filter((value) => value !== platform),
    );
  }

  async function confirmSelection() {
    if (!canContinue) {
      return;
    }

    setConfirmError(null);
    setSubmitting(true);

    try {
      await onConfirmed([...selectedPlatforms]);
      setSelectedPlatforms([]);
      clearPopupError();
      onOpenChange(false);
    } catch (error) {
      setConfirmError(
        error instanceof Error && error.message
          ? error.message
          : "Could not save this platform selection.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl"
        showCloseButton={!submitting}
      >
        <DialogHeader className="pr-8">
          <DialogTitle className="text-lg font-semibold">
            Select platforms
          </DialogTitle>
          <DialogDescription>
            Connect your accounts, then choose where this saved carousel will be
            prepared next.
          </DialogDescription>
        </DialogHeader>

        {submitting ? (
          <Alert className="border-success/20 bg-success/5 text-success">
            <LoaderCircle className="animate-spin" />
            <AlertTitle>Saving selection</AlertTitle>
            <AlertDescription className="text-success">
              Please wait while this carousel is prepared for its next step.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {confirmError || loadError || popupError ? (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>
                  {confirmError
                    ? "Could not create the schedule draft"
                    : "Connection needs attention"}
                </AlertTitle>
                <AlertDescription>
                  {confirmError ?? popupError ?? loadError}
                </AlertDescription>
              </Alert>
            ) : null}

            <section aria-labelledby="platform-connections-heading">
              <h3
                id="platform-connections-heading"
                className="mb-2 text-sm font-semibold text-foreground"
              >
                Platform connections
              </h3>
              <div className="overflow-hidden rounded-lg border border-border">
                {platforms.map((definition, index) => {
                  const platformConnections = connections.filter(
                    (connection) =>
                      connection.platform === definition.platform,
                  );
                  const connection = getPreferredConnection(platformConnections);
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
                      onConnect={() => {
                        if (!context) {
                          setLoadError("Choose a saved Library carousel first.");
                          return;
                        }

                        void startConnection({
                          carouselId: context.carouselId,
                          forceConsent: Boolean(connection),
                          libraryItemId: context.libraryItemId,
                          platform: definition.platform,
                          previousConnectionUpdatedAt:
                            connection?.updatedAt ?? null,
                          returnTo: context.returnTo,
                        });
                      }}
                      status={status}
                    />
                  );
                })}
              </div>
            </section>

            <FieldSet>
              <FieldLegend className="text-sm font-semibold">
                Select connected platforms
              </FieldLegend>
              <FieldDescription>
                Choose at least one connected account to continue.
              </FieldDescription>
              {loading ? (
                <FieldGroup>
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </FieldGroup>
              ) : connectedPlatforms.length > 0 ? (
                <FieldGroup data-slot="checkbox-group" className="gap-2">
                  {connectedPlatforms.map(({ Icon, label, platform }) => {
                    const checkboxId = `schedule-platform-${platform}`;

                    return (
                      <Field
                        key={platform}
                        orientation="horizontal"
                        className="rounded-lg border border-border p-3"
                      >
                        <Checkbox
                          id={checkboxId}
                          checked={selectedPlatforms.includes(platform)}
                          onCheckedChange={(checked) =>
                            togglePlatform(platform, checked)
                          }
                        />
                        <FieldContent>
                          <FieldLabel htmlFor={checkboxId}>
                            <Icon className="size-4" aria-hidden="true" />
                            {label}
                          </FieldLabel>
                        </FieldContent>
                      </Field>
                    );
                  })}
                </FieldGroup>
              ) : (
                <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                  Connect a platform above to make it available here.
                </p>
              )}
            </FieldSet>
          </>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void confirmSelection()}
            disabled={!canContinue}
          >
            {submitting ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : null}
            Next
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  status:
    | SocialConnectionStatus
    | "connecting"
    | "not_connected";
}) {
  const { Icon, label } = definition;
  const statusDisplay = getStatusDisplay(status);
  const accountName =
    connection?.platformAccountName ??
    connection?.platformAccountUsername ??
    null;

  return (
    <div
      className={cn(
        "flex min-h-20 items-center gap-3 px-3 py-3 sm:px-4",
        !first && "border-t border-border",
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
        <Icon aria-hidden="true" />
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
