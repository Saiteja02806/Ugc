"use client";

import { Check, Copy, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { copyAIStudioImage, copyAIStudioPrompt, getAIStudioClipboardError } from "@/lib/ai-studio/clipboard";
import { cn } from "@/lib/utils";

export function AiStudioCopyButton({ kind, value, className }: {
  kind: "image" | "prompt";
  value: string;
  className?: string;
}) {
  const [status, setStatus] = useState<"idle" | "copying" | "copied" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
  }, []);

  async function handleCopy() {
    if (status === "copying") return;
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    setStatus("copying");
    setErrorMessage("");
    try {
      if (kind === "image") await copyAIStudioImage(value);
      else await copyAIStudioPrompt(value);
      setStatus("copied");
      resetTimerRef.current = setTimeout(() => setStatus("idle"), 2000);
    } catch (error) {
      setErrorMessage(getAIStudioClipboardError(error, kind));
      setStatus("error");
    }
  }

  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
      <button
        type="button"
        aria-label={`Copy ${kind}`}
        title={status === "copied" ? `${kind === "image" ? "Image" : "Prompt"} copied` : `Copy ${kind}`}
        disabled={status === "copying"}
        onClick={() => void handleCopy()}
        className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted-subtle transition-colors hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-wait motion-reduce:transition-none", className)}
      >
        {status === "copying" ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          : status === "copied" ? <Check className="size-3.5 text-primary" aria-hidden="true" />
            : <Copy className="size-3.5" aria-hidden="true" />}
      </button>
      {status === "error" ? (
        <span role="alert" className="max-w-xs text-[11px] leading-4 text-destructive [overflow-wrap:anywhere]">{errorMessage}</span>
      ) : (
        <span role="status" className="sr-only">{status === "copied" ? `${kind === "image" ? "Image" : "Prompt"} copied` : ""}</span>
      )}
    </span>
  );
}
