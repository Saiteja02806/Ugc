"use client";

import {
  CircleAlert,
  Clapperboard,
  Images,
  Loader2,
  RotateCcw,
  ScanText,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import {
  allocateTrendingContent,
  DEFAULT_TRENDING_CONTENT_MIX,
  type TrendingContentMix,
  validateTrendingContentMix,
} from "@/lib/trending/content-mix";
import { rebalanceTrendingContentMix } from "@/lib/trending/content-mix-editor";
import type { TrendingFeedFormat } from "@/lib/trending/feed-items";
import { cn } from "@/lib/utils";

type ContentMixPayload = {
  editable: boolean;
  entitlement: {
    dailyLimit: number;
    displayName: string;
    planKey: string;
  };
  limits: TrendingContentMix;
  ok: true;
  preference: {
    mix: TrendingContentMix;
    preferenceVersion: number;
    updatedAt: string | null;
  };
};

type ContentMixSavePayload = {
  applied: "next_day" | "today";
  message: string;
  ok: true;
  preference: ContentMixPayload["preference"];
};

type ContentMixErrorPayload = {
  message?: string;
  ok?: false;
};

type LoadState = "error" | "idle" | "loading" | "ready";

const MIX_ROWS: Array<{
  accentColor: string;
  barClass: string;
  format: TrendingFeedFormat;
  icon: typeof Images;
  iconClass: string;
  iconSurfaceClass: string;
  label: string;
  valueClass: string;
}> = [
  {
    accentColor: "var(--primary)",
    barClass: "bg-primary",
    format: "carousel",
    icon: Images,
    iconClass: "text-primary",
    iconSurfaceClass: "border-primary/15 bg-brand-soft",
    label: "Slideshows",
    valueClass: "text-primary",
  },
  {
    accentColor: "var(--accent-purple)",
    barClass: "bg-accent-purple",
    format: "wall_text",
    icon: ScanText,
    iconClass: "text-accent-purple",
    iconSurfaceClass: "border-accent-purple/15 bg-accent-purple/10",
    label: "Wall-of-Text",
    valueClass: "text-accent-purple",
  },
  {
    accentColor: "var(--info)",
    barClass: "bg-info",
    format: "hook_video",
    icon: Clapperboard,
    iconClass: "text-info",
    iconSurfaceClass: "border-info/15 bg-info/10",
    label: "Hooks",
    valueClass: "text-info",
  },
];

const CONTENT_MIX_RANGE_CLASS =
  "mt-2 h-2 w-full cursor-pointer appearance-none rounded-full outline-none transition-[filter,opacity] focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-80 [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-card [&::-webkit-slider-thumb]:bg-[var(--mix-accent)] [&::-webkit-slider-thumb]:shadow-[0_0_0_1px_var(--mix-accent)] [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-card [&::-moz-range-thumb]:bg-[var(--mix-accent)]";

export function TrendingContentMixDialog({
  onApplied,
  onOpenChange,
  open,
}: {
  onApplied: (applied: ContentMixSavePayload["applied"]) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [loadRevision, setLoadRevision] = useState(0);
  const [payload, setPayload] = useState<ContentMixPayload | null>(null);
  const [mix, setMix] = useState<TrendingContentMix>({
    ...DEFAULT_TRENDING_CONTENT_MIX,
  });
  const [savedMix, setSavedMix] = useState<TrendingContentMix>({
    ...DEFAULT_TRENDING_CONTENT_MIX,
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();

    async function loadContentMix() {
      setLoadState("loading");
      setError(null);
      setNotice(null);

      try {
        const token = await getCurrentUserIdToken();

        if (!token) {
          throw new Error("Sign in before adjusting Trending.");
        }

        const response = await fetch("/api/trending/content-mix", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => null)) as
          | ContentMixErrorPayload
          | ContentMixPayload
          | null;

        if (!response.ok || data?.ok !== true) {
          throw new Error(
            getContentMixErrorMessage(
              data,
              "Could not load your content mix right now.",
            ),
          );
        }

        if (controller.signal.aborted) return;

        setPayload(data);
        setMix({ ...data.preference.mix });
        setSavedMix({ ...data.preference.mix });
        setLoadState("ready");
      } catch (loadError) {
        if (controller.signal.aborted) return;

        setPayload(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load your content mix right now.",
        );
        setLoadState("error");
      }
    }

    void loadContentMix();
    return () => controller.abort();
  }, [loadRevision, open]);

  const allocation = useMemo(() => {
    if (!payload || !validateTrendingContentMix(mix)) return null;

    return allocateTrendingContent({
      dailyLimit: payload.entitlement.dailyLimit,
      localDate: getBrowserLocalDate(),
      mix,
    });
  }, [mix, payload]);
  const hasChanges = MIX_ROWS.some(
    ({ format }) => mix[format] !== savedMix[format],
  );

  function updateMix(format: TrendingFeedFormat, nextValue: number) {
    setNotice(null);
    setError(null);
    setMix((current) =>
      rebalanceTrendingContentMix(current, format, nextValue),
    );
  }

  async function saveContentMix() {
    if (!payload?.editable || !hasChanges || saving) return;

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in before adjusting Trending.");
      }

      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const response = await fetch("/api/trending/content-mix", {
        body: JSON.stringify({ ...mix, timezone }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "PUT",
      });
      const data = (await response.json().catch(() => null)) as
        | ContentMixErrorPayload
        | ContentMixSavePayload
        | null;

      if (!response.ok || data?.ok !== true) {
        throw new Error(
          getContentMixErrorMessage(
            data,
            "Could not save your content mix right now.",
          ),
        );
      }

      setSavedMix({ ...data.preference.mix });
      setMix({ ...data.preference.mix });
      setNotice(data.message);
      onApplied(data.applied);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save your content mix right now.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(760px,calc(100dvh-2rem))] gap-0 overflow-y-auto p-0 sm:max-w-[560px]">
        <DialogHeader className="border-b border-border px-5 py-5 pr-14 sm:px-6">
          <DialogTitle className="text-lg font-semibold text-foreground-strong">
            Adjust content mix
          </DialogTitle>
          <DialogDescription className="leading-5">
            Choose the balance of formats prepared for your daily Trending
            feed. Editing an individual creative remains under Edit.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-5 sm:px-6">
          {loadState === "loading" || loadState === "idle" ? (
            <div
              aria-live="polite"
              className="flex min-h-56 items-center justify-center gap-3 text-sm font-medium text-muted"
              role="status"
            >
              <Loader2
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              Loading content mix…
            </div>
          ) : loadState === "error" ? (
            <div className="flex min-h-56 flex-col items-center justify-center text-center">
              <CircleAlert className="size-6 text-error" aria-hidden="true" />
              <p className="mt-3 max-w-sm text-sm leading-6 text-muted">
                {error}
              </p>
              <Button
                className="mt-4"
                type="button"
                variant="outline"
                onClick={() => setLoadRevision((current) => current + 1)}
              >
                Try again
              </Button>
            </div>
          ) : payload ? (
            <>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-subtle">
                    Daily composition
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {payload.entitlement.displayName} ·{" "}
                    {payload.entitlement.dailyLimit} ideas per day
                  </p>
                </div>
                {payload.editable && hasChanges ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setMix({ ...savedMix })}
                  >
                    <RotateCcw data-icon="inline-start" aria-hidden="true" />
                    Undo
                  </Button>
                ) : null}
              </div>

              <div
                aria-label="Selected daily content mix"
                className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-card-muted"
                role="img"
              >
                {MIX_ROWS.map(({ barClass, format }) => (
                  <span
                    key={format}
                    className={cn("h-full transition-[width]", barClass)}
                    style={{ width: `${mix[format]}%` }}
                  />
                ))}
              </div>

              {!payload.editable ? (
                <div className="mt-5 rounded-xl border border-border bg-card-muted px-4 py-3">
                  <p className="text-sm font-semibold text-foreground-strong">
                    Your Free mix is fixed
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    Free includes 3 Slideshows, 4 Wall-of-Text posts, and 3
                    Hooks each day. Upgrade to customize this balance.
                  </p>
                </div>
              ) : null}

              <div className="mt-5 space-y-5">
                {MIX_ROWS.map(
                  ({
                    accentColor,
                    format,
                    icon: Icon,
                    iconClass,
                    iconSurfaceClass,
                    label,
                    valueClass,
                  }) => {
                    const sliderFillPercent =
                      (mix[format] / Math.max(payload.limits[format], 1)) * 100;

                    return (
                      <label key={format} className="block">
                      <span className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <span
                            className={cn(
                              "flex size-7 shrink-0 items-center justify-center rounded-lg border",
                              iconClass,
                              iconSurfaceClass,
                            )}
                          >
                            <Icon className="size-3.5" aria-hidden="true" />
                          </span>
                          {label}
                        </span>
                        <span className="flex items-baseline gap-2">
                          <output
                            className={cn(
                              "min-w-10 text-right text-sm font-semibold tabular-nums",
                              valueClass,
                            )}
                          >
                            {mix[format]}%
                          </output>
                          {allocation ? (
                            <span className="min-w-14 text-right text-xs tabular-nums text-muted-subtle">
                              {allocation[format]}/day
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <input
                        aria-label={`${label} percentage`}
                        aria-valuetext={`${mix[format]} percent, ${allocation?.[format] ?? 0} per day`}
                        className={CONTENT_MIX_RANGE_CLASS}
                        disabled={!payload.editable || saving}
                        max={payload.limits[format]}
                        min={0}
                        step={1}
                        style={
                          {
                            "--mix-accent": accentColor,
                            background: `linear-gradient(to right, ${accentColor} 0 ${sliderFillPercent}%, var(--card-muted) ${sliderFillPercent}% 100%)`,
                          } as CSSProperties
                        }
                        type="range"
                        value={mix[format]}
                        onChange={(event) =>
                          updateMix(format, Number(event.target.value))
                        }
                      />
                      </label>
                    );
                  },
                )}
              </div>

              <div aria-live="polite" className="mt-4 min-h-5">
                {error ? (
                  <p
                    className="text-xs font-medium leading-5 text-error"
                    role="alert"
                  >
                    {error}
                  </p>
                ) : notice ? (
                  <p
                    className="text-xs font-medium leading-5 text-success"
                    role="status"
                  >
                    {notice}
                  </p>
                ) : payload.editable ? (
                  <p className="text-xs leading-5 text-muted-subtle">
                    If today&apos;s pack is already prepared, the new balance
                    starts tomorrow.
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        <DialogFooter className="m-0 rounded-none px-5 py-4 sm:px-6">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {payload?.editable ? "Cancel" : "Close"}
          </Button>
          {payload && !payload.editable ? (
            <Button
              render={<Link href="/pricing" />}
              onClick={() => onOpenChange(false)}
            >
              View plans
            </Button>
          ) : payload?.editable ? (
            <Button
              type="button"
              disabled={!hasChanges || saving}
              onClick={() => void saveContentMix()}
            >
              {saving ? (
                <Loader2
                  data-icon="inline-start"
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : null}
              {saving ? "Saving…" : "Save mix"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getBrowserLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getContentMixErrorMessage(
  data: ContentMixErrorPayload | ContentMixPayload | ContentMixSavePayload | null,
  fallback: string,
) {
  return data && "message" in data && typeof data.message === "string"
    ? data.message
    : fallback;
}
