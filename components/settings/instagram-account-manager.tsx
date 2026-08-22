"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { InstagramAccountAvatar } from "@/components/social/instagram-account-avatar";
import { SocialPlatformIcon } from "@/components/social/platform-icon";
import { useSocialOAuthPopup } from "@/components/social/use-social-oauth-popup";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import {
  loadAccountSocialConnections,
  removeAccountSocialConnection,
} from "@/lib/scheduling/account-data-query";
import { getConnectionPublishingBlockMessage } from "@/lib/scheduling/social-connection-policy";
import type {
  SocialConnection,
  SocialPlatform,
} from "@/lib/social/types";

type OAuthTraceInput = {
  callbackHost?: string;
  correlationId?: string;
  platform?: SocialPlatform;
};

type InstagramConnectionViewState = {
  badgeVariant: "connected" | "destructive";
  description: string;
  label: string;
};

/*
 * TikTok and YouTube account-management UI is intentionally dormant while
 * UGC Pilot is Instagram-only. Their provider, OAuth, and API implementations
 * remain preserved in the shared social modules for a future multi-platform
 * release.
 *
 * const dormantPlatforms: SocialPlatform[] = ["tiktok", "youtube"];
 */
const INSTAGRAM_PLATFORM: SocialPlatform = "instagram";

export function InstagramAccountManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const accountId = user?.uid ?? "signed-out";
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [renderTrace, setRenderTrace] = useState<OAuthTraceInput | null>(null);
  const [pendingDisconnect, setPendingDisconnect] =
    useState<SocialConnection | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  const loadInstagramConnections = useCallback(
    async (
      trace?: OAuthTraceInput,
      options: { force?: boolean } = {},
    ) => {
      setLoading(true);
      setLoadError(null);

      try {
        const token = await getRequiredToken();
        const accountConnections = await loadAccountSocialConnections(
          queryClient,
          accountId,
          {
            errorMessage:
              "Could not load your Instagram connection. Refresh and try again.",
            force: options.force ?? Boolean(trace),
            token,
            trace,
          },
        );

        const nextConnections = accountConnections
          .filter(
            (connection) => connection.platform === INSTAGRAM_PLATFORM,
          )
          .sort(
            (left, right) =>
              Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
          );

        setConnections(nextConnections);
        return nextConnections;
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : "Could not load your Instagram connection. Refresh and try again.",
        );
        return [];
      } finally {
        setLoading(false);
      }
    },
    [accountId, queryClient],
  );

  const {
    clearPopupError,
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
      const refreshedConnections = await loadInstagramConnections(undefined, {
        force: true,
      });
      const previousUpdatedAt = previousConnectionUpdatedAt
        ? Date.parse(previousConnectionUpdatedAt)
        : null;
      const isConnected = refreshedConnections.some(
        (connection) =>
          connection.platform === platform &&
          connection.status === "connected" &&
          (intent !== "reconnect" ||
            connection.id === expectedConnectionId) &&
          (previousUpdatedAt === null ||
            Date.parse(connection.updatedAt) > previousUpdatedAt),
      );

      if (isConnected) {
        setMessage("Instagram account connected.");
        return true;
      }

      return false;
    },
    onResult: async (result) => {
      if (
        result.status !== "success" ||
        result.platform !== INSTAGRAM_PLATFORM
      ) {
        return;
      }

      const refreshedConnections = await loadInstagramConnections({
        callbackHost: result.callbackHost,
        correlationId: result.correlationId,
        platform: result.platform,
      });
      setRenderTrace({
        callbackHost: result.callbackHost,
        correlationId: result.correlationId,
        platform: result.platform,
      });
      const connectedAccount = result.connectionId
        ? refreshedConnections.find(
            (connection) => connection.id === result.connectionId,
          )
        : null;
      setMessage(
        connectedAccount
          ? `${getInstagramAccountName(connectedAccount)} is connected.`
          : "Instagram account connected.",
      );
    },
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadInstagramConnections();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadInstagramConnections]);

  useEffect(() => {
    if (!renderTrace?.correlationId) {
      return;
    }

    console.info("social_oauth_trace", {
      callbackHost: renderTrace.callbackHost ?? null,
      correlationId: renderTrace.correlationId,
      hasConnectedAccount: connections.some(
        (connection) => connection.status === "connected",
      ),
      platform: INSTAGRAM_PLATFORM,
      stage: "frontend_rendering",
    });
  }, [connections, renderTrace]);

  async function addInstagram() {
    setLoadError(null);
    setMessage(null);
    clearPopupError();

    await startConnection({
      forceConsent: connections.length > 0,
      intent: "add",
      platform: INSTAGRAM_PLATFORM,
      previousConnectionUpdatedAt: connections[0]?.updatedAt ?? null,
      // "accounts" remains the stable internal OAuth source identifier. The
      // former /connected-accounts page now redirects to this Settings section.
      returnTo: "accounts",
    });
  }

  async function reconnectInstagram(connection: SocialConnection) {
    setLoadError(null);
    setMessage(null);
    clearPopupError();

    await startConnection({
      expectedConnectionId: connection.id,
      forceConsent: true,
      intent: "reconnect",
      platform: INSTAGRAM_PLATFORM,
      previousConnectionUpdatedAt: connection.updatedAt,
      returnTo: "accounts",
    });
  }

  async function refreshConnections() {
    setMessage(null);
    clearPopupError();
    await loadInstagramConnections(undefined, { force: true });
  }

  async function disconnectInstagram() {
    const connection = pendingDisconnect;

    if (!connection) {
      return;
    }

    setDisconnectingId(connection.id);
    setDisconnectError(null);
    setMessage(null);

    try {
      const token = await getRequiredToken();
      const response = await fetch(
        `/api/social/connections/${encodeURIComponent(connection.id)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          method: "DELETE",
        },
      );
      const data = (await response.json().catch(() => null)) as
        | { message?: string; ok?: boolean }
        | null;

      if (!response.ok || data?.ok !== true) {
        throw new Error(
          data?.message ??
            "Could not disconnect Instagram. Check your connection and try again.",
        );
      }

      setConnections((current) =>
        current.filter((item) => item.id !== connection.id),
      );
      removeAccountSocialConnection(queryClient, accountId, connection.id);
      setPendingDisconnect(null);
      setMessage("Instagram account disconnected.");
    } catch (error) {
      setDisconnectError(
        error instanceof Error
          ? error.message
          : "Could not disconnect Instagram. Check your connection and try again.",
      );
    } finally {
      setDisconnectingId(null);
    }
  }

  const isConnecting = connectingPlatform === INSTAGRAM_PLATFORM;
  const isAdding = isConnecting && connectingIntent === "add";

  return (
    <>
      {message ? (
        <div className="px-5 pt-5 sm:px-6">
          <Alert aria-live="polite" className="border-success/25 bg-success/5">
            <CheckCircle2 aria-hidden="true" className="text-success" />
            <AlertTitle className="text-success">Instagram updated</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      {popupError ? (
        <div className="px-5 pt-5 sm:px-6">
          <Alert variant="destructive" aria-live="polite">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Instagram connection failed</AlertTitle>
            <AlertDescription>{popupError}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      {loading ? (
        <InstagramConnectionSkeleton />
      ) : loadError ? (
        <div className="px-5 py-5 sm:px-6">
          <Alert variant="destructive" aria-live="polite">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Instagram status unavailable</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
            <AlertAction>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void refreshConnections()}
              >
                Retry
              </Button>
            </AlertAction>
          </Alert>
        </div>
      ) : connections.length > 0 ? (
        <div className="px-5 py-5 sm:px-6">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-foreground-strong">
                {formatConnectionCount(connections.length)}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted">
                Manage the Instagram accounts UGC Pilot can use for
                publishing.
              </p>
            </div>
            <Badge variant="outline" className="w-fit">
              <CheckCircle2 data-icon="inline-start" aria-hidden="true" />
              Connected through Meta
            </Badge>
          </div>

          <div className="grid gap-3">
            {connections.map((connection) => (
              <InstagramConnectionRow
                key={connection.id}
                connectionActionPending={isConnecting}
                connection={connection}
                reconnecting={
                  isConnecting &&
                  connectingIntent === "reconnect" &&
                  connectingConnectionId === connection.id
                }
                onDisconnect={() => {
                  setDisconnectError(null);
                  setPendingDisconnect(connection);
                }}
                onReconnect={() => void reconnectInstagram(connection)}
              />
            ))}
          </div>
        </div>
      ) : (
        <InstagramConnectionEmptyState />
      )}

      <Separator />

      <div className="flex flex-col gap-3 bg-card-muted/35 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="max-w-xl text-sm leading-6 text-muted">
          To add another profile, switch to that professional account in the
          Instagram authorization window.
        </p>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => void refreshConnections()}
            disabled={loading || isConnecting}
            className="w-full sm:w-auto"
          >
            <RefreshCw
              data-icon="inline-start"
              className={loading ? "animate-spin motion-reduce:animate-none" : ""}
              aria-hidden="true"
            />
            Refresh
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={() => void addInstagram()}
            disabled={Boolean(connectingPlatform)}
            className="w-full sm:w-auto"
          >
            {isAdding ? (
              <LoaderCircle
                data-icon="inline-start"
                className="animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <Plus data-icon="inline-start" aria-hidden="true" />
            )}
            {isAdding
              ? "Opening Instagram…"
              : connections.length > 0
                ? "Add another account"
                : "Connect Instagram"}
          </Button>
        </div>
      </div>

      <Dialog
        open={pendingDisconnect !== null}
        onOpenChange={(open) => {
          if (!open && !disconnectingId) {
            setDisconnectError(null);
            setPendingDisconnect(null);
          }
        }}
      >
        <DialogContent showCloseButton={!disconnectingId}>
          <DialogHeader className="pr-8">
            <DialogTitle className="text-lg font-semibold">
              Disconnect Instagram?
            </DialogTitle>
            <DialogDescription>
              UGC Pilot will no longer be able to publish new posts to this
              account. Existing Instagram posts will not be removed.
            </DialogDescription>
          </DialogHeader>

          {pendingDisconnect ? (
            <div className="flex items-center gap-3 rounded-[var(--radius-control)] border border-border bg-card-muted p-3">
              <InstagramAccountAvatar
                className="size-10"
                connection={pendingDisconnect}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground-strong">
                  {getInstagramAccountName(pendingDisconnect)}
                </p>
                {getInstagramAccountHandle(pendingDisconnect) ? (
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {getInstagramAccountHandle(pendingDisconnect)}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {disconnectError ? (
            <Alert variant="destructive" aria-live="polite">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Instagram was not disconnected</AlertTitle>
              <AlertDescription>{disconnectError}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter className="border-border bg-popover">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDisconnectError(null);
                setPendingDisconnect(null);
              }}
              disabled={Boolean(disconnectingId)}
            >
              Keep connected
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="bg-error text-error-foreground shadow-sm hover:bg-error/90"
              onClick={() => void disconnectInstagram()}
              disabled={Boolean(disconnectingId)}
            >
              {disconnectingId ? (
                <LoaderCircle
                  data-icon="inline-start"
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <Trash2 data-icon="inline-start" aria-hidden="true" />
              )}
              {disconnectingId ? "Disconnecting…" : "Disconnect Instagram"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function InstagramConnectionRow({
  connectionActionPending,
  connection,
  onDisconnect,
  onReconnect,
  reconnecting,
}: {
  connectionActionPending: boolean;
  connection: SocialConnection;
  onDisconnect: () => void;
  onReconnect: () => void;
  reconnecting: boolean;
}) {
  const accountHandle = getInstagramAccountHandle(connection);
  const viewState = getInstagramConnectionViewState(connection);

  return (
    <article className="flex flex-col gap-4 rounded-[var(--radius-control)] border border-border bg-card-muted/45 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <InstagramAccountAvatar
          className="size-11"
          connection={connection}
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-bold text-foreground-strong">
              {getInstagramAccountName(connection)}
            </h3>
            <Badge variant={viewState.badgeVariant}>
              {viewState.badgeVariant === "connected" ? (
                <CheckCircle2 data-icon="inline-start" aria-hidden="true" />
              ) : null}
              {viewState.label}
            </Badge>
          </div>
          {accountHandle ? (
            <p className="mt-0.5 truncate text-sm text-muted">
              {accountHandle}
            </p>
          ) : null}
          <p className="mt-2 text-sm leading-6 text-muted">
            {viewState.description}
          </p>
          <p className="mt-1 text-xs text-muted-subtle">
            Updated {formatConnectionUpdatedAt(connection.updatedAt)}
          </p>
        </div>
      </div>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReconnect}
          disabled={connectionActionPending}
          className="w-full sm:w-auto"
        >
          {reconnecting ? (
            <LoaderCircle
              data-icon="inline-start"
              className="animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <RefreshCw data-icon="inline-start" aria-hidden="true" />
          )}
          {reconnecting ? "Opening Instagram..." : "Reconnect"}
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={onDisconnect}
          disabled={connectionActionPending}
          className="w-full sm:w-auto"
        >
          <Trash2 data-icon="inline-start" aria-hidden="true" />
          Disconnect
        </Button>
      </div>
    </article>
  );
}

function InstagramConnectionEmptyState() {
  return (
    <div className="px-5 py-6 sm:px-6">
      <div className="flex flex-col items-start gap-4 rounded-[var(--radius-control)] border border-dashed border-border-strong bg-card-muted/30 p-5 sm:flex-row sm:items-center">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-brand-soft ring-1 ring-inset ring-primary/10">
          <SocialPlatformIcon className="size-6" platform="instagram" />
        </span>
        <div>
          <h3 className="text-sm font-bold text-foreground-strong">
            Connect an Instagram professional account
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            Connect through Meta to schedule approved posts from this
            workspace. Personal Instagram accounts are not eligible for
            publishing.
          </p>
        </div>
      </div>
    </div>
  );
}

function InstagramConnectionSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-4 px-5 py-6 sm:px-6"
    >
      <span className="sr-only">Loading Instagram account status…</span>
      <Skeleton className="size-11 shrink-0 rounded-[var(--radius-control)]" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-44 max-w-full" />
        <Skeleton className="h-3 w-64 max-w-full" />
      </div>
      <Skeleton className="hidden h-5 w-24 sm:block" />
    </div>
  );
}

async function getRequiredToken() {
  const token = await getCurrentUserIdToken();

  if (!token) {
    throw new Error("Sign in again to manage your Instagram connection.");
  }

  return token;
}

function getInstagramConnectionViewState(
  connection: SocialConnection,
): InstagramConnectionViewState {
  const publishingBlockMessage =
    getConnectionPublishingBlockMessage(connection);

  if (publishingBlockMessage) {
    return {
      badgeVariant: "destructive",
      description: publishingBlockMessage,
      label: "Needs attention",
    };
  }

  return {
    badgeVariant: "connected",
    description:
      "Ready for approved Instagram posts and scheduled publishing.",
    label: "Ready to publish",
  };
}

function getInstagramAccountName(connection: SocialConnection) {
  return (
    connection.platformAccountName ||
    connection.platformAccountUsername ||
    "Instagram professional account"
  );
}

function getInstagramAccountHandle(connection: SocialConnection) {
  const username = connection.platformAccountUsername?.trim();

  if (!username) {
    return null;
  }

  return username.startsWith("@") ? username : `@${username}`;
}

function formatConnectionCount(count: number) {
  return new Intl.NumberFormat(undefined).format(count) +
    ` Instagram ${count === 1 ? "account" : "accounts"} connected`;
}

function formatConnectionUpdatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
