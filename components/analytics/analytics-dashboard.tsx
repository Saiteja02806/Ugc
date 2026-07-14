"use client";

import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { SidebarIcon } from "@/components/icons/sidebar-icon";
import { buttonClassName } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type {
  SocialConnection,
  SocialConnectionStatus,
  SocialPlatform,
} from "@/lib/social/types";

type AnalyticsLoadState = "error" | "loading" | "ready";

type ConnectionsResponse = {
  connections?: SocialConnection[];
  message?: string;
  ok?: boolean;
};

const platformLabels: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

const connectionStatusLabels: Record<SocialConnectionStatus, string> = {
  connected: "Connected",
  error: "Connection error",
  expired: "Expired",
  permission_missing: "Permission needed",
  revoked: "Access revoked",
};

export function AnalyticsDashboard() {
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<AnalyticsLoadState>("loading");

  const loadConnections = useCallback(async (signal?: AbortSignal) => {
    try {
      const token = await getCurrentUserIdToken();

      if (signal?.aborted) {
        return;
      }

      // Production routes require authentication. Treat a missing token as an
      // empty workspace so local previews never need fabricated account data.
      if (!token) {
        setConnections([]);
        setErrorMessage(null);
        setLoadState("ready");
        return;
      }

      const response = await fetch("/api/social/connections", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal,
      });
      const data = (await response.json().catch(() => null)) as ConnectionsResponse | null;

      if (signal?.aborted) {
        return;
      }

      if (!response.ok || !data?.ok) {
        throw new Error(data?.message || "We could not load your connected accounts.");
      }

      setConnections(Array.isArray(data.connections) ? data.connections : []);
      setErrorMessage(null);
      setLoadState("ready");
    } catch (error) {
      if (signal?.aborted) {
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We could not load your connected accounts.",
      );
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        void loadConnections(controller.signal);
      }
    });

    return () => controller.abort();
  }, [loadConnections]);

  const retryConnections = useCallback(() => {
    setErrorMessage(null);
    setLoadState("loading");
    void loadConnections();
  }, [loadConnections]);

  const activeConnections = connections.filter(
    (connection) => connection.status === "connected",
  );

  return (
    <section className="min-h-dvh flex-1 bg-background px-4 py-5 text-foreground sm:px-6 lg:px-8 lg:py-7 xl:px-10">
      <div className="mx-auto w-full max-w-[1360px]">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-control bg-brand-soft text-primary">
              <SidebarIcon name="analytics" className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.025em] text-foreground-strong sm:text-[30px]">
                Analytics
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
                Performance data reported by your connected publishing accounts.
              </p>
            </div>
          </div>

          <span className="inline-flex w-fit items-center gap-2 text-xs font-semibold text-muted">
            <ShieldCheck className="size-4 text-success" aria-hidden="true" />
            Real account data only
          </span>
        </header>

        <div
          className="mt-6 overflow-hidden rounded-card border border-border bg-card"
          aria-live="polite"
        >
          {loadState === "loading" ? <AnalyticsLoadingState /> : null}
          {loadState === "error" ? (
            <AnalyticsErrorState message={errorMessage} onRetry={retryConnections} />
          ) : null}
          {loadState === "ready" && connections.length === 0 ? (
            <NoAccountsState />
          ) : null}
          {loadState === "ready" && connections.length > 0 && activeConnections.length === 0 ? (
            <AccountsNeedAttentionState connections={connections} />
          ) : null}
          {loadState === "ready" && activeConnections.length > 0 ? (
            <ConnectedAccountsState connections={activeConnections} />
          ) : null}
        </div>

        <div className="mt-4 flex items-start gap-2.5 px-1 text-xs leading-5 text-muted">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-subtle" aria-hidden="true" />
          <p>
            UGC Pilot does not estimate views, engagement, rankings, or creative recommendations.
            Analytics will appear only after verified platform data is available.
          </p>
        </div>
      </div>
    </section>
  );
}

function AnalyticsLoadingState() {
  return (
    <div className="p-5 sm:p-7" aria-label="Loading analytics account status" role="status">
      <div className="flex items-start gap-4">
        <Skeleton className="size-11 shrink-0 rounded-control" />
        <div className="w-full max-w-xl space-y-3">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
      <div className="mt-8 divide-y divide-border border-y border-border">
        {[0, 1].map((item) => (
          <div key={item} className="flex items-center gap-3 py-4">
            <Skeleton className="size-9 shrink-0 rounded-control" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-52 max-w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsErrorState({
  message,
  onRetry,
}: {
  message: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="p-5 sm:p-7">
      <StateHeading
        icon={<AlertCircle className="size-5" aria-hidden="true" />}
        iconClassName="bg-destructive/10 text-destructive"
        title="Analytics could not load"
        description={
          message || "We could not check your connected accounts. Your account data was not changed."
        }
      />
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onRetry}
          className={buttonClassName({ className: "gap-2" })}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Try again
        </button>
        <ManageAccountsLink />
      </div>
    </div>
  );
}

function NoAccountsState() {
  return (
    <div className="p-5 sm:p-7">
      <div className="max-w-2xl">
        <StateHeading
          icon={<BarChart3 className="size-5" aria-hidden="true" />}
          title="Connect an account to start measuring performance"
          description="Analytics begins with a publishing account you control. We will never fill this screen with sample, estimated, or invented results."
        />
        <Link
          href="/connected-accounts"
          className={buttonClassName({ className: "mt-6 gap-2" })}
        >
          Connect accounts
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-8 border-t border-border pt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
          What real analytics will include
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3 sm:gap-6">
          <AnalyticsPromise
            title="Post performance"
            description="Verified views and engagement for published content."
          />
          <AnalyticsPromise
            title="Platform comparison"
            description="Results separated by the account and platform that reported them."
          />
          <AnalyticsPromise
            title="Publishing outcomes"
            description="A clear link between scheduled content and its reported results."
          />
        </div>
      </div>
    </div>
  );
}

function AccountsNeedAttentionState({
  connections,
}: {
  connections: SocialConnection[];
}) {
  return (
    <div className="p-5 sm:p-7">
      <StateHeading
        icon={<AlertCircle className="size-5" aria-hidden="true" />}
        iconClassName="bg-warning/10 text-warning"
        title="Your connected accounts need attention"
        description="These publishing connections are not currently active. Review the accounts below so they are ready before verified analytics syncing is enabled."
      />
      <ConnectionList connections={connections} />
      <ManageAccountsLink className="mt-6" label="Review accounts" />
    </div>
  );
}

function ConnectedAccountsState({
  connections,
}: {
  connections: SocialConnection[];
}) {
  return (
    <div>
      <div className="p-5 sm:p-7">
        <StateHeading
          icon={<CheckCircle2 className="size-5" aria-hidden="true" />}
          iconClassName="bg-success/10 text-success"
          title="Accounts connected; performance sync is not enabled yet"
          description="UGC Pilot verified these publishing connections. This version does not import post metrics yet, so no charts, totals, or recommendations are shown."
        />
        <ConnectionList connections={connections} />
        <ManageAccountsLink className="mt-6" />
      </div>

      <div className="flex flex-col gap-2 border-t border-border bg-card-muted/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div>
          <p className="text-sm font-semibold text-foreground-strong">Performance sync status</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Connected accounts are ready for the verified analytics integration.
          </p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-muted">
          Not enabled yet
        </span>
      </div>
    </div>
  );
}

function StateHeading({
  description,
  icon,
  iconClassName = "bg-brand-soft text-primary",
  title,
}: {
  description: string;
  icon: React.ReactNode;
  iconClassName?: string;
  title: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <span
        className={`flex size-11 shrink-0 items-center justify-center rounded-control ${iconClassName}`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-[-0.015em] text-foreground-strong">
          {title}
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">{description}</p>
      </div>
    </div>
  );
}

function ConnectionList({ connections }: { connections: SocialConnection[] }) {
  return (
    <div className="mt-7 border-y border-border">
      {connections.map((connection, index) => {
        const isConnected = connection.status === "connected";

        return (
          <div
            key={connection.id}
            className={`flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between ${
              index > 0 ? "border-t border-border" : ""
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-card-muted text-xs font-bold uppercase text-foreground-strong">
                {platformLabels[connection.platform].slice(0, 2)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground-strong">
                  {getConnectionName(connection)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {platformLabels[connection.platform]} · {formatConnectionDate(connection.connectedAt)}
                </p>
              </div>
            </div>
            <span
              className={`inline-flex w-fit items-center gap-1.5 text-xs font-semibold ${
                isConnected ? "text-success" : "text-muted"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${isConnected ? "bg-success" : "bg-muted-subtle"}`}
                aria-hidden="true"
              />
              {connectionStatusLabels[connection.status]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function AnalyticsPromise({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-foreground-strong">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
    </div>
  );
}

function ManageAccountsLink({
  className = "",
  label = "Manage accounts",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <Link
      href="/connected-accounts"
      className={buttonClassName({
        className: `w-fit gap-2 ${className}`,
        variant: "secondary",
      })}
    >
      {label}
      <ArrowRight className="size-4" aria-hidden="true" />
    </Link>
  );
}

function getConnectionName(connection: SocialConnection) {
  if (connection.platformAccountName?.trim()) {
    return connection.platformAccountName.trim();
  }

  if (connection.platformAccountUsername?.trim()) {
    return `@${connection.platformAccountUsername.trim().replace(/^@/, "")}`;
  }

  return `${platformLabels[connection.platform]} account`;
}

function formatConnectionDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Connection date unavailable";
  }

  return `Connected ${new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date)}`;
}
