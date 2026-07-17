"use client";

import { Sparkles, Video, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type TrendingMode = "carousels" | "hook_videos";

const modes: Array<{
  Icon: LucideIcon;
  label: string;
  value: TrendingMode;
}> = [
  {
    Icon: Sparkles,
    label: "Carousels",
    value: "carousels",
  },
  {
    Icon: Video,
    label: "Hook videos",
    value: "hook_videos",
  },
];

export function TrendingModeSelector({
  className,
  onChange,
  value,
}: {
  className?: string;
  onChange: (value: TrendingMode) => void;
  value: TrendingMode;
}) {
  return (
    <div
      className={cn(
        "inline-flex w-fit max-w-full rounded-full border border-border bg-card-muted p-1",
        className,
      )}
      role="tablist"
      aria-label="Trending creative mode"
    >
      {modes.map(({ Icon, label, value: modeValue }) => {
        const selected = value === modeValue;

        return (
          <button
            key={modeValue}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(modeValue)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-full px-3.5 text-sm font-semibold transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
              selected
                ? "bg-card text-foreground-strong shadow-[0_1px_2px_rgb(23_23_27_/_0.08)]"
                : "text-muted hover:bg-card/70 hover:text-foreground-strong",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
