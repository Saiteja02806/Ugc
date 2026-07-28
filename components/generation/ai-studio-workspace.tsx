"use client";

import { Loader2, Lock, Sparkles } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useAIStudioAccess } from "@/components/generation/use-ai-studio-access";
import { VideoGenerationStudioPanel } from "@/components/video/video-generation-workspace";
import { ImageGenerationStudioPanel } from "@/components/workspace/ugc-chat-workspace";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type AIStudioMode = "images" | "videos";

const studioModes: Array<{
  label: string;
  value: AIStudioMode;
}> = [
  {
    label: "Images",
    value: "images",
  },
  {
    label: "Videos",
    value: "videos",
  },
];

export function AIStudioWorkspace({
  initialMode,
}: {
  initialMode: AIStudioMode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = toAIStudioMode(searchParams.get("mode") ?? initialMode);
  const accessState = useAIStudioAccess();

  function selectMode(nextMode: AIStudioMode) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", nextMode);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <section className="relative flex min-h-[calc(100dvh-4rem)] flex-1 flex-col overflow-x-hidden bg-background px-4 py-4 text-foreground sm:px-6 md:h-dvh md:min-h-0 md:overflow-hidden lg:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_70%_0%,color-mix(in_srgb,var(--instagram-rose)_10%,transparent),transparent_52%),radial-gradient(circle_at_28%_0%,color-mix(in_srgb,var(--instagram-orange)_8%,transparent),transparent_48%)]"
      />

      <div className="relative mx-auto flex min-h-0 w-full max-w-[1480px] flex-1 flex-col">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] border border-border bg-card-muted text-primary shadow-sm">
              <Sparkles className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-[-0.025em] text-foreground sm:text-xl">
                AI Studio
              </h1>
              <p className="hidden text-xs text-muted sm:block">
                Create and review your next visual.
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Badge
              variant="secondary"
              className={cn(
                "hidden w-fit border bg-card/80 shadow-sm sm:inline-flex",
                accessState === "pro"
                  ? "border-primary/30 text-primary"
                  : "border-border text-muted",
              )}
            >
              {accessState === "pro" ? (
                <>
                  <Sparkles data-icon="inline-start" aria-hidden="true" />
                  Pro access
                </>
              ) : accessState === "checking" ? (
                <>
                  <Loader2
                    data-icon="inline-start"
                    className="animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  Checking access
                </>
              ) : (
                <>
                  <Lock data-icon="inline-start" aria-hidden="true" />
                  Preview workspace
                </>
              )}
            </Badge>
            <AIStudioModeToggle value={mode} onChange={selectMode} />
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          <ImageGenerationStudioPanel
            accessState={accessState}
            active={mode === "images"}
          />
          <VideoGenerationStudioPanel
            accessState={accessState}
            active={mode === "videos"}
          />
        </div>
      </div>
    </section>
  );
}

function AIStudioModeToggle({
  onChange,
  value,
}: {
  onChange: (mode: AIStudioMode) => void;
  value: AIStudioMode;
}) {
  return (
    <div
      className="inline-grid grid-cols-2 gap-1 rounded-full border border-border bg-card-muted/80 p-1 shadow-sm"
      role="tablist"
      aria-label="AI Studio mode"
    >
      {studioModes.map((mode) => {
        const selected = value === mode.value;
        const panelId = `ai-studio-${mode.value}-panel`;
        const tabId = `ai-studio-${mode.value}-tab`;

        return (
          <button
            key={mode.value}
            id={tabId}
            type="button"
            role="tab"
            aria-controls={panelId}
            aria-selected={selected}
            onClick={() => onChange(mode.value)}
            className={cn(
              "inline-flex h-8 min-w-[72px] items-center justify-center rounded-full px-3 text-sm font-semibold transition-[background-color,color,box-shadow] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:h-9 sm:min-w-[82px] sm:px-4",
              selected
                ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                : "bg-transparent text-muted hover:bg-card/55 hover:text-foreground",
            )}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}

export function toAIStudioMode(value: string | null | undefined): AIStudioMode {
  return value === "videos" ? "videos" : "images";
}
