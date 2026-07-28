"use client";

import { ImageIcon, Lock, Sparkles, Video } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { VideoGenerationStudioPanel } from "@/components/video/video-generation-workspace";
import { ImageGenerationStudioPanel } from "@/components/workspace/ugc-chat-workspace";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type AIStudioMode = "images" | "videos";

const studioModes: Array<{
  description: string;
  label: string;
  value: AIStudioMode;
}> = [
  {
    description: "Posts, carousels, and story visuals",
    label: "Images",
    value: "images",
  },
  {
    description: "Reels and short-form video",
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

  function selectMode(nextMode: AIStudioMode) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", nextMode);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <section className="relative flex min-h-dvh flex-1 flex-col overflow-x-hidden bg-background px-4 py-5 text-foreground sm:px-6 lg:px-8 lg:py-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_70%_0%,color-mix(in_srgb,var(--instagram-rose)_10%,transparent),transparent_52%),radial-gradient(circle_at_28%_0%,color-mix(in_srgb,var(--instagram-orange)_8%,transparent),transparent_48%)]"
      />

      <div className="relative mx-auto flex min-h-0 w-full max-w-[1320px] flex-1 flex-col">
        <header className="flex flex-col gap-5 pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex max-w-3xl items-start gap-3.5">
              <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-[13px] border border-border bg-card-muted text-primary shadow-sm">
                <Sparkles className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                  Creation workspace
                </p>
                <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.03em] text-balance text-foreground sm:text-[2rem]">
                  AI Studio
                </h1>
                <p className="mt-1.5 max-w-2xl text-sm leading-6 text-pretty text-muted">
                  Shape the brief, format, and output for your next visual from
                  one focused workspace.
                </p>
              </div>
            </div>

            <Badge
              variant="secondary"
              className="w-fit border border-border bg-card/80 text-muted shadow-sm"
            >
              <Lock data-icon="inline-start" aria-hidden="true" />
              Preview workspace
            </Badge>
          </div>

          <AIStudioModeToggle value={mode} onChange={selectMode} />
        </header>

        <div className="min-h-0 flex-1 pt-4">
          <ImageGenerationStudioPanel active={mode === "images"} />
          <VideoGenerationStudioPanel active={mode === "videos"} />
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
      className="grid w-full max-w-[640px] grid-cols-2 gap-1 rounded-[var(--radius-card)] border border-border bg-card-muted/80 p-1"
      role="tablist"
      aria-label="AI Studio mode"
    >
      {studioModes.map((mode) => {
        const selected = value === mode.value;
        const Icon = mode.value === "images" ? ImageIcon : Video;
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
              "group flex min-h-12 min-w-0 items-center gap-3 rounded-[10px] px-3 py-2 text-left transition-[background-color,color,box-shadow] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:px-4",
              selected
                ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                : "bg-transparent text-muted hover:bg-card/55 hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-[9px] border transition-colors",
                selected
                  ? "border-primary/25 bg-brand-soft text-primary"
                  : "border-border bg-background/30 text-muted-subtle group-hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{mode.label}</span>
              <span className="hidden truncate text-[11px] leading-4 text-muted sm:block">
                {mode.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function toAIStudioMode(value: string | null | undefined): AIStudioMode {
  return value === "videos" ? "videos" : "images";
}
