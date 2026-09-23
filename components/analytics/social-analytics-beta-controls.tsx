"use client";

import { ChevronDown, Layers } from "lucide-react";
import { useState } from "react";

import { SocialAccountAvatar } from "@/components/social/social-account-avatar";
import { SocialPlatformIcon } from "@/components/social/platform-icon";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  const [openPlatform, setOpenPlatform] = useState<SocialPlatform | null>(
    null,
  );

  return (
    <section
      aria-label="Social analytics account selection"
      className="mt-6 rounded-[var(--radius-panel)] border border-border bg-card p-5 shadow-card sm:p-6"
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
            Analytics beta
          </p>
          <h2 className="mt-1 text-lg font-bold tracking-[-0.02em] text-foreground">
            Choose a social account
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
            Select a platform icon, then choose all connected accounts or one
            specific account from its menu.
          </p>
        </div>

        <div
          aria-label="Choose a social platform and account"
          className="inline-flex w-fit max-w-full items-center rounded-full border border-border bg-card-muted/45 p-1.5 shadow-[0_12px_28px_rgb(0_0_0_/_0.08)]"
          role="group"
        >
          {platformOptions.map((option) => {
            const selected = option.platform === platform;
            const platformConnections = getConnectionsForAnalyticsPlatform(
              connections,
              option.platform,
            );

            return (
              <PlatformAccountMenu
                key={option.platform}
                connections={platformConnections}
                label={option.label}
                onConnectionChange={(connectionId) => {
                  onPlatformChange(option.platform);
                  onConnectionChange(connectionId);
                  setOpenPlatform(null);
                }}
                onOpenChange={(open) =>
                  setOpenPlatform(open ? option.platform : null)
                }
                onPlatformChange={() => {
                  if (!selected) {
                    onPlatformChange(option.platform);
                  }
                }}
                open={openPlatform === option.platform}
                platform={option.platform}
                selected={selected}
                selectedConnectionId={
                  selected ? selectedConnectionId : "all"
                }
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PlatformAccountMenu({
  connections,
  label,
  onConnectionChange,
  onOpenChange,
  onPlatformChange,
  open,
  platform,
  selected,
  selectedConnectionId,
}: {
  connections: SocialConnection[];
  label: string;
  onConnectionChange: (connectionId: string) => void;
  onOpenChange: (open: boolean) => void;
  onPlatformChange: () => void;
  open: boolean;
  platform: SocialPlatform;
  selected: boolean;
  selectedConnectionId: string;
}) {
  const selectAccount = (connectionId: string) => {
    onConnectionChange(connectionId);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        type="button"
        aria-label={`${label}: choose analytics account`}
        aria-pressed={selected}
        className={cn(
          "inline-flex size-12 touch-manipulation items-center justify-center rounded-full text-muted transition-[background-color,color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-card hover:text-foreground-strong active:scale-[0.97] motion-reduce:transition-none",
          selected &&
            "w-auto min-w-16 gap-1.5 bg-primary px-3.5 text-primary-foreground shadow-card hover:bg-primary-hover hover:text-primary-foreground",
        )}
        title={`${label} accounts`}
        onClick={onPlatformChange}
      >
        <SocialPlatformIcon className="size-5" platform={platform} />
        {selected ? <ChevronDown className="size-3.5" aria-hidden="true" /> : null}
        <span className="sr-only">{label}</span>
      </PopoverTrigger>

      <PopoverContent
        align="center"
        sideOffset={10}
        className="w-[min(20rem,calc(100vw-2rem))] gap-3 rounded-[var(--radius-group)] p-2.5"
      >
        <div className="flex items-center gap-3 px-1.5 pt-1">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card-muted">
            <SocialPlatformIcon className="size-5" platform={platform} />
          </span>
          <div className="min-w-0">
            <PopoverTitle className="text-sm font-bold text-foreground-strong">
              {label} accounts
            </PopoverTitle>
            <p className="text-xs text-muted">
              {connections.length === 1
                ? "1 connected account"
                : `${connections.length} connected accounts`}
            </p>
          </div>
        </div>

        {connections.length > 0 ? (
          <div className="grid gap-1 border-t border-border pt-2">
            <AccountMenuOption
              icon={<Layers className="size-4" aria-hidden="true" />}
              label="All accounts"
              meta={`${connections.length}`}
              onClick={() => selectAccount("all")}
              selected={selectedConnectionId === "all"}
            />
            {connections.map((connection) => (
              <AccountMenuOption
                key={connection.id}
                icon={<SocialAccountAvatar connection={connection} size="sm" />}
                label={getSocialConnectionAnalyticsLabel(connection)}
                meta={getStatusLabel(connection.status)}
                onClick={() => selectAccount(connection.id)}
                selected={selectedConnectionId === connection.id}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-[var(--radius-segment)] border border-dashed border-border px-3 py-3 text-xs leading-5 text-muted">
            No {label} accounts are connected yet.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

function AccountMenuOption({
  icon,
  label,
  meta,
  onClick,
  selected,
}: {
  icon: React.ReactNode;
  label: string;
  meta: string;
  onClick: () => void;
  selected: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-segment)] px-3 py-2 text-left text-sm transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "bg-primary text-primary-foreground shadow-card"
          : "text-foreground hover:bg-card-muted",
      )}
      onClick={onClick}
    >
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center",
          selected ? "text-primary-foreground" : "text-muted",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate font-semibold">{label}</span>
      <span
        className={cn(
          "shrink-0 text-[11px] font-semibold",
          selected ? "text-primary-foreground/80" : "text-muted",
        )}
      >
        {meta}
      </span>
    </button>
  );
}

function getStatusLabel(status: SocialConnection["status"]) {
  if (status === "connected") return "Connected";
  if (status === "permission_missing") return "Permission needed";
  if (status === "expired") return "Expired";
  if (status === "revoked") return "Revoked";
  return "Connection error";
}
