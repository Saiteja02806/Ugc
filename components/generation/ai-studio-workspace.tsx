"use client";

import { ImageIcon, Lock, Video } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { VideoGenerationStudioPanel } from "@/components/video/video-generation-workspace";
import { ImageGenerationStudioPanel } from "@/components/workspace/ugc-chat-workspace";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type AIStudioMode = "images" | "videos";

const studioModes: Array<{
  label: string;
  value: AIStudioMode;
}> = [
  { label: "Images", value: "images" },
  { label: "Videos", value: "videos" },
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
    <section className="flex min-h-dvh flex-1 flex-col bg-background px-4 py-5 text-foreground sm:px-6 lg:h-dvh lg:px-8 lg:py-7">
      <div className="mx-auto flex min-h-0 w-full max-w-[1240px] flex-1 flex-col">
        <header className="flex flex-col gap-5 border-b border-border pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Instagram creation
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-balance text-foreground sm:text-[2rem]">
                Create for Instagram
              </h1>
              <p className="mt-2 text-sm leading-6 text-pretty text-muted">
                Configure image and short-form video ideas now. Generation stays locked during development.
              </p>
            </div>

            <Badge variant="secondary">
              <Lock data-icon="inline-start" aria-hidden="true" />
              Preview mode
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
      className="inline-flex h-10 w-full max-w-full items-center rounded-[var(--radius-control)] border border-border bg-card-muted p-1 sm:w-fit"
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
              "inline-flex h-8 flex-1 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-[background-color,color,box-shadow] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:flex-none",
              selected
                ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                : "bg-transparent text-muted hover:bg-card/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
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
