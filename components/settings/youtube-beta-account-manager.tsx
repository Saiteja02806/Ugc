"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  LoaderCircle,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { SocialAccountAvatar } from "@/components/social/social-account-avatar";
import { SocialPlatformIcon } from "@/components/social/platform-icon";
import { useSocialOAuthPopup } from "@/components/social/use-social-oauth-popup";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import {
  loadAccountSocialConnections,
  removeAccountSocialConnection,
} from "@/lib/scheduling/account-data-query";
import { getConnectionPublishingBlockMessage } from "@/lib/scheduling/social-connection-policy";
import type { SocialConnection } from "@/lib/social/types";
import { hasYouTubeAnalyticsScope } from "@/lib/social/youtube-oauth-config";

const YOUTUBE_PLATFORM = "youtube" as const;

export function YouTubeBetaAccountManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const accountId = user?.uid ?? "signed-out";
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDisconnect, setPendingDisconnect] =
    useState<SocialConnection | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const loadConnections = useCallback(
    async (force = false) => {
      setLoading(true);
      setError(null);

      try {
        const token = await getCurrentUserIdToken();

        if (!token) {
          throw new Error("Sign in before connecting YouTube.");
        }

        const allConnections = await loadAccountSocialConnections(
          queryClient,
          accountId,
          {
            errorMessage: "Could not load your YouTube connection.",
            force,
            token,
          },
        );
        setConnections(
          allConnections.filter(
            (connection) => connection.platform === YOUTUBE_PLATFORM,
          ),
        );

        return allConnections;
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load your YouTube connection.",
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
    onPopupClosed: async ({ expectedConnectionId, intent, platform }) => {
      const refreshed = await loadConnections(true);
      const connected = refreshed.some(
        (connection) =>
          connection.platform === platform &&
          connection.status === "connected" &&
          (intent !== "reconnect" || connection.id === expectedConnectionId),
      );

      if (connected) {
        const analyticsEnabled = refreshed.some(
          (connection) =>
            connection.platform === YOUTUBE_PLATFORM &&
            hasYouTubeAnalyticsScope(connection.scopes),
        );
        setMessage(
          analyticsEnabled
            ? "YouTube channel connected with upload and analytics access."
            : "YouTube channel connected. Reconnect once to enable channel performance in Analytics.",
        );
      }

      return connected;
    },
    onResult: async (result) => {
      if (result.status === "success" && result.platform === YOUTUBE_PLATFORM) {
        const refreshed = await loadConnections(true);
        const analyticsEnabled = refreshed.some(
          (connection) =>
            connection.platform === YOUTUBE_PLATFORM &&
            hasYouTubeAnalyticsScope(connection.scopes),
        );
        setMessage(
          analyticsEnabled
            ? "YouTube channel connected with upload and analytics access."
            : "YouTube channel connected. Reconnect once to enable channel performance in Analytics.",
        );
      }
    },
  });

  useEffect(() => {
    const timer = window.setTimeout(() => void loadConnections(), 0);

    return () => window.clearTimeout(timer);
  }, [loadConnections]);

  async function connect(connection?: SocialConnection) {
    setError(null);
    setMessage(null);
    clearPopupError();

    await startConnection({
      expectedConnectionId: connection?.id,
      forceConsent: Boolean(connection),
      intent: connection ? "reconnect" : "add",
      platform: YOUTUBE_PLATFORM,
      previousConnectionUpdatedAt: connection?.updatedAt ?? null,
      returnTo: "accounts",
    });
  }

  async function disconnect() {
    if (!pendingDisconnect) {
      return;
    }

    setDisconnecting(true);
    setError(null);

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in before disconnecting YouTube.");
      }

      const response = await fetch(
        `/api/social/connections/${encodeURIComponent(pendingDisconnect.id)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          method: "DELETE",
        },
      );
      const data = (await response.json().catch(() => null)) as
        | { message?: string; ok?: boolean }
        | null;

      if (!response.ok || data?.ok !== true) {
        throw new Error(data?.message ?? "Could not disconnect YouTube.");
      }

      setConnections((current) =>
        current.filter((connection) => connection.id !== pendingDisconnect.id),
      );
      removeAccountSocialConnection(
        queryClient,
        accountId,
        pendingDisconnect.id,
      );
      setPendingDisconnect(null);
      setMessage("YouTube channel disconnected.");
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error
          ? disconnectError.message
          : "Could not disconnect YouTube.",
      );
    } finally {
      setDisconnecting(false);
    }
  }

  const isConnecting = connectingPlatform === YOUTUBE_PLATFORM;

  return (
    <>
      <section
        aria-labelledby="youtube-accounts-title"
        className="overflow-hidden rounded-[22px] border border-border bg-card shadow-card"
      >
        <header className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:px-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-card-muted text-foreground ring-1 ring-inset ring-border">
              <SocialPlatformIcon className="size-5" platform="youtube" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3
                  id="youtube-accounts-title"
                  className="text-base font-bold text-foreground-strong"
                >
                  YouTube
                </h3>
                <Badge variant="outline">Beta</Badge>
              </div>
              <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
                Connect an approved channel to schedule video uploads and view
                channel performance in Analytics.
              </p>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={() => void connect()}
            disabled={loading || isConnecting}
            className="h-9 w-fit rounded-full px-4"
          >
            {isConnecting && connectingIntent === "add" ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : (
              <Plus data-icon="inline-start" />
            )}
            Connect YouTube
          </Button>
        </header>

        <div className="space-y-4 bg-card-muted/20 p-3 sm:p-4">
          {message ? (
            <Alert className="border-success/25 bg-success/5">
              <CheckCircle2 aria-hidden="true" className="text-success" />
              <AlertTitle className="text-success">YouTube updated</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}

          {error || popupError ? (
            <Alert variant="destructive">
              <AlertTitle>YouTube connection needs attention</AlertTitle>
              <AlertDescription>{error ?? popupError}</AlertDescription>
            </Alert>
          ) : null}

          {loading ? (
            <Skeleton className="h-24 rounded-[var(--radius-group)]" />
          ) : null}

          {!loading && connections.length === 0 ? (
            <div className="rounded-[var(--radius-group)] border border-dashed border-border-strong bg-card px-4 py-5 text-sm leading-6 text-muted">
              No YouTube channel is connected yet. Use Connect YouTube to add
              the approved beta channel.
            </div>
          ) : null}

          {!loading && connections.length > 0 ? (
            <div className="overflow-hidden rounded-[var(--radius-group)] border border-border bg-card">
              {connections.map((connection) => {
                const publishingBlock =
                  getConnectionPublishingBlockMessage(connection);
                const accountName =
                  connection.platformAccountUsername ||
                  connection.platformAccountName ||
                  connection.platformAccountId;
                const isReconnecting =
                  isConnecting &&
                  connectingIntent === "reconnect" &&
                  connectingConnectionId === connection.id;
                const needsAnalyticsConsent =
                  !hasYouTubeAnalyticsScope(connection.scopes);

                return (
                  <article
                    key={connection.id}
                    className="flex flex-col gap-4 border-b border-border px-4 py-4 last:border-b-0 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <SocialAccountAvatar connection={connection} size="lg" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-bold text-foreground">
                            {accountName}
                          </p>
                          <Badge
                            variant={
                              connection.status === "connected"
                                ? "connected"
                                : "destructive"
                            }
                          >
                            {connection.status === "connected"
                              ? "Connected"
                              : "Reconnect required"}
                          </Badge>
                        </div>
                        <p
                          className={
                            publishingBlock
                              ? "mt-1 text-xs font-semibold text-error"
                              : "mt-1 text-xs font-medium text-muted"
                          }
                        >
                          {publishingBlock ??
                            (needsAnalyticsConsent
                              ? "Reconnect once to enable channel performance in Analytics."
                              : "Video uploads and channel performance are enabled for this approved beta channel.")}
                        </p>
                      </div>
                    </div>

                    <div className="inline-flex w-full items-center rounded-full border border-border bg-card-muted/65 p-1 lg:w-auto">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void connect(connection)}
                        disabled={isConnecting}
                        className="h-8 flex-1 rounded-full px-3 lg:flex-none"
                      >
                        {isReconnecting ? (
                          <LoaderCircle
                            data-icon="inline-start"
                            className="animate-spin"
                          />
                        ) : (
                          <RefreshCw data-icon="inline-start" />
                        )}
                        Reconnect
                      </Button>
                      <span aria-hidden="true" className="h-5 w-px bg-border" />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setPendingDisconnect(connection)}
                        disabled={isConnecting}
                        className="h-8 flex-1 rounded-full px-3 text-destructive hover:bg-destructive/10 hover:text-destructive lg:flex-none"
                      >
                        <Trash2 data-icon="inline-start" />
                        Disconnect
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>

      <Dialog
        open={pendingDisconnect !== null}
        onOpenChange={(open) => {
          if (!open && !disconnecting) {
            setPendingDisconnect(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect YouTube?</DialogTitle>
            <DialogDescription>
              Scheduled YouTube uploads will need a connected channel before
              they can publish.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingDisconnect(null)}
              disabled={disconnecting}
              className="rounded-full"
            >
              Keep connected
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void disconnect()}
              disabled={disconnecting}
              className="rounded-full"
            >
              {disconnecting ? (
                <LoaderCircle data-icon="inline-start" className="animate-spin" />
              ) : (
                <Trash2 data-icon="inline-start" />
              )}
              Disconnect YouTube
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
