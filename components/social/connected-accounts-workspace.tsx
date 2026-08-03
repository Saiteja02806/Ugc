"use client";

import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  Plug,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useSocialOAuthPopup } from "@/components/social/use-social-oauth-popup";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type {
  SocialConnection as Connection,
  SocialPlatform,
} from "@/lib/social/types";
import { cn } from "@/lib/utils";

type ConnectionsResponse = {
  connections?: Connection[];
  message?: string;
  ok?: boolean;
};

type OAuthTraceInput = {
  callbackHost?: string;
  correlationId?: string;
  platform?: SocialPlatform;
};

const platforms: Array<{
  description: string;
  label: string;
  value: SocialPlatform;
}> = [
  {
    description:
      "Connect TikTok for creator authorization, publishing, and public video analytics access.",
    label: "TikTok",
    value: "tiktok",
  },
  {
    description: "Connect an Instagram professional account through Meta.",
    label: "Instagram",
    value: "instagram",
  },
  {
    description: "Connect YouTube for Shorts/video upload authorization.",
    label: "YouTube",
    value: "youtube",
  },
];

const platformStyles: Record<SocialPlatform, string> = {
  instagram: "border-[#f6c4d7] bg-[#fff5fa] text-[#9d174d]",
  tiktok: "border-[#c7d2fe] bg-[#f5f7ff] text-[#3730a3]",
  youtube: "border-[#fecaca] bg-[#fff5f5] text-[#b91c1c]",
};

export function ConnectedAccountsWorkspace() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renderTrace, setRenderTrace] = useState<OAuthTraceInput | null>(null);
  const {
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
        setMessage(`${getPlatformLabel(platform)} account connected.`);
        return true;
      }

      return false;
    },
    onResult: async (result) => {
      if (result.status !== "success") {
        return;
      }

      await loadConnections({
        callbackHost: result.callbackHost,
        correlationId: result.correlationId,
        platform: result.platform,
      });
      setRenderTrace({
        callbackHost: result.callbackHost,
        correlationId: result.correlationId,
        platform: result.platform,
      });
      setMessage(`${getPlatformLabel(result.platform)} account connected.`);
    },
  });
  const displayedMessage = message;
  const displayedError = error ?? popupError;

  useEffect(() => {
    void loadConnections();
  }, []);

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

  const groupedConnections = useMemo(() => {
    return platforms.map((platform) => ({
      ...platform,
      connections: connections.filter(
        (connection) => connection.platform === platform.value,
      ),
    }));
  }, [connections]);

  async function loadConnections(trace?: OAuthTraceInput) {
    setLoading(true);
    setError(null);

    try {
      const token = await getRequiredToken();
      const response = await fetch("/api/social/connections", {
        cache: "no-store",
        headers: getConnectionHeaders(token, trace),
      });
      const data = (await response.json().catch(() => null)) as
        | ConnectionsResponse
        | null;

      if (!response.ok || !data?.ok) {
        throw new Error(data?.message ?? "Could not load connected accounts.");
      }

      const nextConnections = data.connections ?? [];
      setConnections(nextConnections);
      return nextConnections;
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load connected accounts.",
      );
      return [];
    } finally {
      setLoading(false);
    }
  }

  async function connectPlatform(platform: SocialPlatform) {
    setError(null);
    setMessage(null);
    await startConnection({
      forceConsent: connections.some(
        (connection) => connection.platform === platform,
      ),
      platform,
      previousConnectionUpdatedAt:
        connections
          .filter((connection) => connection.platform === platform)
          .sort(
            (left, right) =>
              Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
          )[0]?.updatedAt ?? null,
      returnTo: "accounts",
    });
  }

  async function disconnectConnection(connectionId: string) {
    setDisconnectingId(connectionId);
    setError(null);
    setMessage(null);

    try {
      const token = await getRequiredToken();
      const response = await fetch(`/api/social/connections/${connectionId}`, {
        headers: { Authorization: `Bearer ${token}` },
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as
        | { message?: string; ok?: boolean }
        | null;

      if (!response.ok || !data?.ok) {
        throw new Error(data?.message ?? "Could not disconnect account.");
      }

      setConnections((current) =>
        current.filter((connection) => connection.id !== connectionId),
      );
      setMessage("Account disconnected.");
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error
          ? disconnectError.message
          : "Could not disconnect account.",
      );
    } finally {
      setDisconnectingId(null);
    }
  }

  return (
    <section className="min-w-0 flex-1 px-5 py-6 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-5 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold text-primary">Publishing setup</p>
            <h1 className="mt-2 text-3xl font-black leading-tight tracking-normal text-foreground-strong sm:text-4xl">
              Connected accounts
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              Connect user-approved TikTok, Instagram, and YouTube accounts
              before scheduling, publishing, or syncing supported account analytics.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadConnections()}
            disabled={loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border-strong bg-card px-4 text-sm font-bold text-foreground transition hover:bg-card-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plug className="size-4" aria-hidden="true" />
            )}
            Refresh
          </button>
        </header>

        {displayedMessage ? (
          <StatusNotice
            tone="success"
            message={displayedMessage}
            className="mt-5"
          />
        ) : null}

        {displayedError ? (
          <StatusNotice tone="error" message={displayedError} className="mt-5" />
        ) : null}

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {groupedConnections.map((platform) => (
            <article
              key={platform.value}
              className="rounded-[12px] border border-border bg-card p-5 shadow-card"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-3 py-1 text-xs font-black",
                      platformStyles[platform.value],
                    )}
                  >
                    {platform.label}
                  </span>
                  <p className="mt-4 text-sm leading-6 text-muted">
                    {platform.description}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {loading ? (
                  <div className="rounded-lg border border-dashed border-border p-4 text-sm font-semibold text-muted">
                    Checking account status...
                  </div>
                ) : platform.connections.length > 0 ? (
                  platform.connections.map((connection) => (
                    <ConnectionCard
                      key={connection.id}
                      connection={connection}
                      disconnecting={disconnectingId === connection.id}
                      onDisconnect={() =>
                        void disconnectConnection(connection.id)
                      }
                    />
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-4 text-sm leading-6 text-muted">
                    No account connected yet.
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => void connectPlatform(platform.value)}
                disabled={Boolean(connectingPlatform)}
                className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {connectingPlatform === platform.value ? (
                  <LoaderCircle
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <ExternalLink className="size-4" aria-hidden="true" />
                )}
                {platform.connections.length > 0 ? "Reconnect" : "Connect"}
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ConnectionCard({
  connection,
  disconnecting,
  onDisconnect,
}: {
  connection: Connection;
  disconnecting: boolean;
  onDisconnect: () => void;
}) {
  const connected = connection.status === "connected";
  const StatusIcon = connected ? CheckCircle2 : AlertCircle;

  return (
    <div className="rounded-lg border border-border bg-surface-subtle p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-foreground-strong">
            {connection.platformAccountName ??
              connection.platformAccountUsername ??
              connection.platformAccountId}
          </p>
          {connection.platformAccountUsername ? (
            <p className="mt-1 truncate text-xs font-semibold text-muted">
              {connection.platformAccountUsername}
            </p>
          ) : null}
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-bold",
            connected
              ? "bg-success/10 text-success"
              : "bg-error/10 text-error",
          )}
        >
          <StatusIcon className="size-3.5" aria-hidden="true" />
          {getConnectionStatusLabel(connection.status)}
        </span>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted">
        Connected {formatDate(connection.connectedAt)}
      </p>
      <button
        type="button"
        onClick={onDisconnect}
        disabled={disconnecting}
        className="mt-4 inline-flex h-9 items-center gap-2 rounded-md border border-border-strong bg-card px-3 text-xs font-bold text-error transition hover:bg-error/5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {disconnecting ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Trash2 className="size-4" aria-hidden="true" />
        )}
        Disconnect
      </button>
    </div>
  );
}

function StatusNotice({
  className,
  message,
  tone,
}: {
  className?: string;
  message: string;
  tone: "error" | "success";
}) {
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-md border px-4 py-3 text-sm font-semibold leading-6",
        tone === "error"
          ? "border-error/20 bg-error/5 text-error"
          : "border-success/20 bg-success/5 text-success",
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

async function getRequiredToken() {
  const token = await getCurrentUserIdToken();

  if (!token) {
    throw new Error("Sign in before managing connected accounts.");
  }

  return token;
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

function getPlatformLabel(value: string) {
  return (
    platforms.find((platform) => platform.value === value)?.label ??
    "Social"
  );
}

function getConnectionStatusLabel(status: Connection["status"]) {
  if (status === "connected") return "Connected";
  if (status === "permission_missing") return "Permission needed";
  if (status === "expired") return "Expired";
  if (status === "revoked") return "Disconnected";
  return "Connection error";
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}
