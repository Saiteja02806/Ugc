"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { AiStudioCopyButton } from "@/components/generation/ai-studio-copy-button";
import { cn } from "@/lib/utils";
import resultLayout from "./video-results.module.css";

export function VideoPromptBubble({
  createdAt,
  prompt,
}: {
  createdAt: string;
  prompt: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="w-full min-w-0">
      <div className={cn(resultLayout.promptHeading, "mb-2 flex flex-wrap items-center justify-between gap-2 px-0.5 text-[11px] font-medium text-muted")}>
        <span className="text-foreground-strong">Prompt</span>
        <span>{formatGeneratedAt(createdAt)}</span>
      </div>
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse video prompt" : "Show full video prompt"}
        onClick={() => setExpanded((current) => !current)}
        className={cn(
          resultLayout.promptToggle,
          "group flex w-full items-start gap-3 rounded-[14px] border border-border bg-card-muted/50 px-3 py-2.5 text-left transition-colors hover:border-border-strong hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none",
          expanded && "bg-card",
        )}
      >
        <span
          data-expanded={expanded}
          className={cn(
            resultLayout.promptText,
            "min-w-0 flex-1 whitespace-pre-wrap text-sm font-normal leading-6 text-foreground [overflow-wrap:anywhere]",
            expanded ? "max-h-48 overflow-y-auto overscroll-contain pr-2" : "line-clamp-3",
          )}
        >
          {prompt}
        </span>
        {expanded ? (
          <ChevronUp className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
        ) : (
          <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted transition-transform group-hover:translate-y-0.5" aria-hidden="true" />
        )}
      </button>
      <div className="mt-1 flex justify-end"><AiStudioCopyButton kind="prompt" value={prompt} /></div>
    </div>
  );
}

function formatGeneratedAt(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Generated"
    : new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}
