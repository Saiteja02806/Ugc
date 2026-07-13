"use client";

import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  Plug,
  Trash2,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { cn } from "@/lib/utils";

type SocialPlatform = "instagram" | "tiktok" | "youtube";

type Connection = {
  connectedAt: string;
  expiresAt: string | null;
  id: string;
  platform: SocialPlatform;
  platformAccountId: string;
  platformAccountName: string | null;
  platformAccountUsername: string | null;
  scopes: string[];
  updatedAt: string;
};

type ConnectionsResponse = {
  connections?: Connection[];
  message?: string;
  ok?: boolean;
};

const platforms: Array<{
  description: string;
  label: string;
  value: SocialPlatform;
}> = [
  {
    description: "Connect TikTok for creator authorization and publishing access.",
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
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionPlatform, setActionPlatform] = useState<SocialPlatform | null>(
    null,
  );
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const connectedPlatform = searchParams.get("connected");
  const callbackError = searchParams.get("error");
  const callbackMessage = connectedPlatform
    ? `${getPlatformLabel(connectedPlatform)} account connected.`
    : null;
  const callbackErrorMessage = callbackError
    ? `Connection failed: ${callbackError}`
    : null;
  const displayedMessage = message ?? callbackMessage;
  const displayedError = error ?? callbackErrorMessage;

  useEffect(() => {
    void loadConnections();
  }, []);

  const groupedConnections = useMemo(() => {
    return platforms.map((platform) => ({
      ...platform,
      connections: connections.filter(
        (connection) => connection.platform === platform.value,
      ),
    }));
  }, [connections]);

  async function loadConnections() {
    setLoading(true);
    setError(null);

    try {
      const token = await getRequiredToken();
      const response = await fetch("/api/social/connections", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json().catch(() => null)) as
        | ConnectionsResponse
        | null;

      if (!response.ok || !data?.ok) {
        throw new Error(data?.message ?? "Could not load connected accounts.");
      }

      setConnections(data.connections ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load connected accounts.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function connectPlatform(platform: SocialPlatform) {
    setActionPlatform(platform);
    setError(null);
    setMessage(null);

    try {
      const token = await getRequiredToken();
      const response = await fetch(`/api/auth/${platform}/start`, {
        body: JSON.stringify({ redirectTo: "/connected-accounts" }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const data = (await response.json().catch(() => null)) as
        | { message?: string; ok?: boolean; url?: string }
        | null;

      if (!response.ok || !data?.ok || !data.url) {
        throw new Error(data?.message ?? `Could not start ${platform} OAuth.`);
      }

      window.location.assign(data.url);
    } catch (connectError) {
      setError(
        connectError instanceof Error
          ? connectError.message
          : "Could not start account connection.",
      );
      setActionPlatform(null);
    }
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
              before scheduling or publishing posts.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadConnections()}
            disabled={loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border-strong bg-white px-4 text-sm font-bold text-foreground transition hover:bg-card-muted disabled:cursor-not-allowed disabled:opacity-60"
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
              className="rounded-[12px] border border-border bg-white p-5 shadow-[0_12px_28px_rgb(24_24_27_/_0.05)]"
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
                disabled={Boolean(actionPlatform)}
                className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-foreground-strong px-4 text-sm font-bold text-white transition hover:bg-[#2a2a30] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {actionPlatform === platform.value ? (
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
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-xs font-bold text-success">
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
          Connected
        </span>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted">
        Connected {formatDate(connection.connectedAt)}
      </p>
      <button
        type="button"
        onClick={onDisconnect}
        disabled={disconnecting}
        className="mt-4 inline-flex h-9 items-center gap-2 rounded-md border border-border-strong bg-white px-3 text-xs font-bold text-error transition hover:bg-error/5 disabled:cursor-not-allowed disabled:opacity-60"
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

function getPlatformLabel(value: string) {
  return (
    platforms.find((platform) => platform.value === value)?.label ??
    "Social"
  );
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
