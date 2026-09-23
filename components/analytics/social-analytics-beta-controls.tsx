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
      className="mt-6 rounded-[var(--radius-panel)] border border-border bg-card p-4 shadow-card sm:p-5"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
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

        <div
          aria-label="Social platform"
          className="inline-flex w-fit max-w-full overflow-x-auto rounded-control border border-border bg-card-muted/50 p-1"
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
                  "inline-flex min-h-11 touch-manipulation items-center gap-2 whitespace-nowrap rounded-[7px] px-3 py-1.5 text-xs font-semibold transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                  selected
                    ? "bg-primary text-primary-foreground shadow-card"
                    : "text-muted hover:bg-card hover:text-foreground-strong",
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
      </div>

      <label className="mt-4 block max-w-md">
        <span className="mb-1.5 block text-xs font-bold text-muted">
          {platformLabel} account
        </span>
        <span className="relative flex items-center">
          <SocialPlatformIcon
            className="pointer-events-none absolute left-3 size-4"
            platform={platform}
          />
          <select
            autoComplete="off"
            name="socialAnalyticsAccount"
            value={selectedConnectionId}
            onChange={(event) => onConnectionChange(event.target.value)}
            className="h-11 w-full appearance-none rounded-control border border-border bg-card py-2 pr-9 pl-9 text-sm font-semibold text-foreground outline-none transition hover:border-border-strong focus:border-primary focus:ring-2 focus:ring-primary/15"
          >
            <option value="all">
              All {platformLabel} accounts ({platformConnections.length})
            </option>
            {platformConnections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {getSocialConnectionAnalyticsLabel(connection)} — {getStatusLabel(connection.status)}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 size-4 text-muted"
            aria-hidden="true"
          />
        </span>
      </label>
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
