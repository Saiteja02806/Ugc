"use client";

import { ChevronDown } from "lucide-react";

import { SocialPlatformIcon } from "@/components/social/platform-icon";
import {
  getConnectionsForAnalyticsPlatform,
  getSocialConnectionAnalyticsLabel,
} from "@/lib/analytics/social-account-selection";
import type { SocialConnection, SocialPlatform } from "@/lib/social/types";
import { cn } from "@/lib/utils";

const platformOptions: Array<{
  label: string;
  platform: SocialPlatform;
}> = [
  { label: "Instagram", platform: "instagram" },
  { label: "TikTok", platform: "tiktok" },
  { label: "YouTube", platform: "youtube" },
];

export function SocialAnalyticsBetaControls({
  connections,
  onConnectionChange,
  onPlatformChange,
  platform,
  selectedConnectionId,
}: {
  connections: SocialConnection[];
  onConnectionChange: (connectionId: string) => void;
  onPlatformChange: (platform: SocialPlatform) => void;
  platform: SocialPlatform;
  selectedConnectionId: string;
}) {
  const platformConnections = getConnectionsForAnalyticsPlatform(
    connections,
    platform,
  );
  const platformLabel = platformOptions.find(
    (option) => option.platform === platform,
  )?.label ?? "Social";

  return (
    <section
      aria-label="Social analytics account selection"
      className="mt-6 rounded-[var(--radius-panel)] border border-border bg-card p-5 shadow-card sm:p-6"
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.82fr)_minmax(360px,1.18fr)] xl:items-end">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
            Analytics beta
          </p>
          <h2 className="mt-1 text-lg font-bold tracking-[-0.02em] text-foreground">
            Choose a social account
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Select a platform, then view one connected account or all accounts
            for that platform.
          </p>
        </div>

        <div className="rounded-[var(--radius-group)] border border-border bg-card-muted/35 p-2.5 shadow-[0_12px_28px_rgb(0_0_0_/_0.08)]">
          <div className="flex items-center justify-between gap-3 px-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
              1 · Platform
            </span>
            <span className="text-xs font-semibold text-muted">
              {platformConnections.length} connected
            </span>
          </div>

          <div
            aria-label="Social platform"
            className="mt-2 grid grid-cols-3 gap-1 rounded-[var(--radius-group)] border border-border bg-card p-1.5"
            role="group"
          >
            {platformOptions.map((option) => {
              const selected = option.platform === platform;

              return (
                <button
                  key={option.platform}
                  type="button"
                  aria-pressed={selected}
                  className={cn(
                    "inline-flex min-h-12 touch-manipulation items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-segment)] px-3 py-2 text-xs font-semibold transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                    selected
                      ? "bg-primary text-primary-foreground shadow-card"
                      : "text-muted hover:bg-card-muted hover:text-foreground-strong",
                  )}
                  onClick={() => onPlatformChange(option.platform)}
                >
                  <SocialPlatformIcon
                    className="size-3.5"
                    platform={option.platform}
                  />
                  {option.label}
                </button>
              );
            })}
          </div>

          <label className="mt-3 block">
            <span className="mb-1.5 block px-1 text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
              2 · {platformLabel} account
            </span>
            <span className="relative flex items-center">
              <SocialPlatformIcon
                className="pointer-events-none absolute left-3.5 size-4"
                platform={platform}
              />
              <select
                autoComplete="off"
                name="socialAnalyticsAccount"
                value={selectedConnectionId}
                onChange={(event) => onConnectionChange(event.target.value)}
                className="h-12 w-full appearance-none rounded-[var(--radius-action)] border border-border bg-card py-2 pr-10 pl-10 text-sm font-semibold text-foreground transition-[border-color,box-shadow] hover:border-border-strong focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
              >
                <option value="all">
                  {platformConnections.length === 0
                    ? `No ${platformLabel} accounts connected`
                    : `All ${platformLabel} accounts (${platformConnections.length})`}
                </option>
                {platformConnections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {getSocialConnectionAnalyticsLabel(connection)} — {getStatusLabel(connection.status)}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3.5 size-4 text-muted"
                aria-hidden="true"
              />
            </span>
          </label>
        </div>
      </div>
    </section>
  );
}

function getStatusLabel(status: SocialConnection["status"]) {
  if (status === "connected") return "Connected";
  if (status === "permission_missing") return "Permission needed";
  if (status === "expired") return "Expired";
  if (status === "revoked") return "Revoked";
  return "Connection error";
}
