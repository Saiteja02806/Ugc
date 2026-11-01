"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { AiStudioCopyButton } from "@/components/generation/ai-studio-copy-button";
import { cn } from "@/lib/utils";
import resultLayout from "./video-results.module.css";

export function VideoPromptBubble({
  createdAt: _createdAt,
  prompt,
}: {
  createdAt?: string;
  prompt: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn("relative w-full min-w-0 rounded-[16px] border border-border/80 bg-card/75 backdrop-blur-sm shadow-xs transition-colors hover:border-border-strong overflow-hidden group", resultLayout.promptCard)}>
      {/* Top right corner Copy Action */}
      <div className="absolute top-3 right-3 z-10">
        <AiStudioCopyButton kind="prompt" value={prompt} />
      </div>

      {/* Expandable Prompt Text Button */}
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse video prompt" : "Show full video prompt"}
        onClick={() => setExpanded((current) => !current)}
        className={cn(
          resultLayout.promptToggle,
          "group/btn flex w-full flex-col text-left transition-colors hover:bg-muted/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none p-4 pb-3.5",
          expanded && "bg-muted/10",
        )}
      >
        <span
          data-expanded={expanded}
          className={cn(
            resultLayout.promptText,
            "min-w-0 w-full pr-16 whitespace-pre-wrap text-xs md:text-sm font-normal leading-relaxed text-foreground/90 [overflow-wrap:anywhere]",
            expanded ? "max-h-60 overflow-y-auto overscroll-contain pr-2" : "line-clamp-3",
          )}
        >
          {prompt}
        </span>
        <div className="mt-2.5 flex w-full items-center justify-end border-t border-border/30 pt-1.5 text-[11px] font-medium text-muted transition-colors group-hover/btn:text-foreground">
          <span className="flex items-center gap-1">
            <span>{expanded ? "Show less" : "Show full"}</span>
            {expanded ? (
              <ChevronUp className="size-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-3.5 transition-transform group-hover/btn:translate-y-0.5" aria-hidden="true" />
            )}
          </span>
        </div>
      </button>
    </div>
  );
}
