"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, LoaderCircle, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { SocialAccountAvatar } from "@/components/social/social-account-avatar";
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
        setMessage("YouTube channel connected.");
      }

      return connected;
    },
    onResult: async (result) => {
      if (result.status === "success" && result.platform === YOUTUBE_PLATFORM) {
        await loadConnections(true);
        setMessage("YouTube channel connected.");
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
    <div className="border-t border-border bg-card-muted/30 px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground">YouTube beta</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            Connect the approved YouTube channel to schedule video uploads and
            grant the upload permission used for unattended publishing.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => void connect()}
          disabled={loading || isConnecting}
        >
          {isConnecting && connectingIntent === "add" ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" />
          ) : (
            <Plus data-icon="inline-start" />
          )}
          Connect YouTube
        </Button>
      </div>

      {message ? (
        <Alert className="mt-4 border-success/25 bg-success/5">
          <CheckCircle2 aria-hidden="true" className="text-success" />
          <AlertTitle className="text-success">YouTube updated</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      {error || popupError ? (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>YouTube connection needs attention</AlertTitle>
          <AlertDescription>{error ?? popupError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-4 grid gap-3">
        {loading ? <Skeleton className="h-20 rounded-card" /> : null}
        {!loading && connections.length === 0 ? (
          <p className="rounded-card border border-dashed border-border bg-card px-4 py-4 text-sm font-medium text-muted">
            No YouTube channel is connected yet.
          </p>
        ) : null}
        {connections.map((connection) => {
          const publishingBlock = getConnectionPublishingBlockMessage(connection);
          const accountName =
            connection.platformAccountUsername ||
            connection.platformAccountName ||
            connection.platformAccountId;
          const isReconnecting =
            isConnecting &&
            connectingIntent === "reconnect" &&
            connectingConnectionId === connection.id;

          return (
            <div
              key={connection.id}
              className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-card p-3.5"
            >
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
                {publishingBlock ? (
                  <p className="mt-1 text-xs font-semibold text-error">
                    {publishingBlock}
                  </p>
                ) : (
                  <p className="mt-1 text-xs font-medium text-muted">
                    Video uploads are available for the approved beta account.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void connect(connection)}
                  disabled={isConnecting}
                >
                  {isReconnecting ? (
                    <LoaderCircle data-icon="inline-start" className="animate-spin" />
                  ) : (
                    <RefreshCw data-icon="inline-start" />
                  )}
                  Reconnect
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setPendingDisconnect(connection)}
                  disabled={isConnecting}
                >
                  <Trash2 data-icon="inline-start" />
                  Disconnect
                </Button>
              </div>
            </div>
          );
        })}
      </div>

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
            >
              Keep connected
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void disconnect()}
              disabled={disconnecting}
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
    </div>
  );
}
