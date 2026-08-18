"use client";

import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  MoreHorizontal,
  Save,
  Sparkles,
} from "lucide-react";
import { useState, type FormEvent } from "react";

import {
  InstagramEmbed,
  type InstagramEmbedSdkState,
} from "@/components/viral/instagram-embed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import {
  formatHookEndSeconds,
  normalizeHookEndSeconds,
  type ViralReviewItem,
  type ViralReviewTiming,
  ViralHookTimingInputError,
} from "@/lib/viral/hook-review";

type SaveTimingResponse = {
  message?: unknown;
  ok?: unknown;
  timing?: ViralReviewTiming;
};

export function HookReviewCard({
  item,
  onTimingSaved,
  sdkRevision,
  sdkState,
}: {
  item: ViralReviewItem;
  onTimingSaved: (referenceId: string, timing: ViralReviewTiming) => void;
  sdkRevision: number;
  sdkState: InstagramEmbedSdkState;
}) {
  const [endingSeconds, setEndingSeconds] = useState(
    item.timing ? formatHookEndSeconds(item.timing.hookEndMs) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSavedMessage(null);

    const numericSeconds = Number(endingSeconds);
    try {
      normalizeHookEndSeconds(numericSeconds);
    } catch (validationError) {
      setError(
        validationError instanceof ViralHookTimingInputError
          ? validationError.message
          : "Enter a valid ending time.",
      );
      return;
    }

    setIsSaving(true);

    try {
      const token = await getCurrentUserIdToken();
      if (!token) {
        throw new Error("Your sign-in session is unavailable. Refresh and try again.");
      }

      const response = await fetch(`/api/admin/viral/${item.id}/review`, {
        body: JSON.stringify({ hookEndSeconds: numericSeconds }),
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });
      const data = (await response.json().catch(() => null)) as
        | SaveTimingResponse
        | null;

      if (!response.ok || data?.ok !== true || !data.timing) {
        throw new Error(
          typeof data?.message === "string"
            ? data.message
            : "Could not save this ending time. Try again.",
        );
      }

      onTimingSaved(item.id, data.timing);
      setEndingSeconds(formatHookEndSeconds(data.timing.hookEndMs));
      setSavedMessage("Ending time saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save this ending time. Try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <InstagramEmbed
        embedHtml={item.embedHtml}
        sdkRevision={sdkRevision}
        sdkState={sdkState}
      />

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 border-t border-border px-4 py-5 sm:px-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground-strong">
              Hook timing
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              Play the opening, then mark the exact frame where the hook ends.
            </p>
          </div>
          <Badge className="shrink-0" variant={item.timing ? "success" : "draft"}>
            {item.timing ? (
              <CheckCircle2 data-icon="inline-start" aria-hidden="true" />
            ) : null}
            {item.timing ? "Timing saved" : "Needs timing"}
          </Badge>
        </div>

        <div
          className="rounded-lg border border-border bg-card-muted px-3 py-3.5"
          aria-label={
            item.timing
              ? `Hook starts at 0 seconds and ends at ${formatHookEndSeconds(item.timing.hookEndMs)} seconds.`
              : "Hook starts at 0 seconds. Ending time is not saved yet."
          }
        >
          <div className="flex items-center gap-2.5 text-xs font-semibold text-muted">
            <span className="shrink-0 tabular-nums text-foreground-strong">
              0.000s
            </span>
            <div
              className="h-0.5 flex-1 rounded-full bg-primary/35"
              aria-hidden="true"
            />
            <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="shrink-0 tabular-nums text-foreground-strong">
              {item.timing
                ? `${formatHookEndSeconds(item.timing.hookEndMs)}s`
                : "Set ending"}
            </span>
          </div>
        </div>

        <FieldGroup>
          <Field data-invalid={Boolean(error)}>
            <FieldLabel htmlFor={`hook-end-${item.id}`}>Hook ends at</FieldLabel>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <Input
                id={`hook-end-${item.id}`}
                type="number"
                inputMode="decimal"
                min="0.001"
                max="3600"
                step="0.001"
                value={endingSeconds}
                onChange={(event) => {
                  setEndingSeconds(event.target.value);
                  setError(null);
                  setSavedMessage(null);
                }}
                placeholder="5.27"
                aria-invalid={Boolean(error)}
                disabled={isSaving}
              />
              <span className="text-sm font-medium text-muted">seconds</span>
            </div>
            <FieldDescription>
              Start time is permanently fixed at 0 seconds. Enter the exact
              moment when the opening hook finishes.
            </FieldDescription>
            <FieldError>{error}</FieldError>
          </Field>
        </FieldGroup>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p
            className="min-h-5 text-xs font-medium text-success"
            role="status"
            aria-live="polite"
          >
            {savedMessage}
          </p>
          <Button type="submit" size="lg" disabled={isSaving}>
            {isSaving ? (
              <LoaderCircle
                data-icon="inline-start"
                className="animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <Save data-icon="inline-start" aria-hidden="true" />
            )}
            {isSaving
              ? "Saving..."
              : item.timing
                ? "Update ending time"
                : "Save ending time"}
          </Button>
        </div>
      </form>

      <footer className="flex items-center gap-2 border-t border-border px-4 py-3 sm:px-5">
        <Button type="button" className="flex-1" disabled>
          <Sparkles data-icon="inline-start" aria-hidden="true" />
          Use This Hook
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="More options are not available yet"
          disabled
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </footer>
    </article>
  );
}
