"use client";

import { AlertCircle, ArrowDown, RotateCcw } from "lucide-react";
import { useId } from "react";

import { Button } from "@/components/ui/button";

export function VideoGenerationFailure({
  title,
  message,
  jobId,
  onDismiss,
  dismissLabel = "Dismiss",
  onEditPrompt,
  onRetry,
  retrying = false,
  retryDisabled = retrying,
}: {
  title: string;
  message: string;
  jobId?: string;
  onDismiss?: () => void;
  dismissLabel?: string;
  onEditPrompt?: () => void;
  onRetry?: () => void;
  retrying?: boolean;
  retryDisabled?: boolean;
}) {
  const titleId = useId();
  const messageId = useId();

  return (
    <div
      role="alert"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      className="w-full min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
    >
      <div className="flex items-start gap-3.5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <AlertCircle className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          <p id={messageId} className="mt-2 text-sm leading-6 break-words text-muted [overflow-wrap:anywhere]">
            {message}
          </p>
        </div>
      </div>

      {onRetry || onEditPrompt || onDismiss ? (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {onRetry ? (
            <Button type="button" size="lg" disabled={retryDisabled} onClick={onRetry} className="px-3.5">
              <RotateCcw className="size-4" aria-hidden="true" />
              {retrying ? "Retrying…" : "Retry generation"}
            </Button>
          ) : null}
          {onEditPrompt ? (
            <Button type="button" variant={onRetry ? "outline" : "default"} size="lg" onClick={onEditPrompt} className="px-3.5">
              <ArrowDown className="size-4" aria-hidden="true" />
              Edit prompt
            </Button>
          ) : null}
          {onDismiss ? (
            <Button type="button" variant="ghost" size="lg" onClick={onDismiss} className="px-3.5 sm:ml-auto">
              {dismissLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
      {jobId ? (
        <p className="mt-4 text-[11px] leading-4 text-muted">
          Job ID <span className="ml-1 font-mono break-all select-all">{jobId}</span>
        </p>
      ) : null}
    </div>
  );
}
