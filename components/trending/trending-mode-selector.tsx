"use client";

import { cn } from "@/lib/utils";

export type TrendingMode = "carousels" | "hook_videos";

const modes: Array<{
  label: string;
  value: TrendingMode;
}> = [
  {
    label: "Carousel posts",
    value: "carousels",
  },
  {
    label: "Reel hooks",
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
        "inline-flex h-11 w-full max-w-full items-center rounded-[12px] border border-border bg-card-muted p-1 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.03)] sm:w-fit",
        className,
      )}
      role="tablist"
      aria-label="Trending creative mode"
    >
      {modes.map(({ label, value: modeValue }, index) => {
        const selected = value === modeValue;

        return (
          <button
            key={modeValue}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(modeValue)}
            className={cn(
              "relative inline-flex h-9 flex-1 shrink-0 items-center justify-center rounded-[8px] px-4 text-sm font-semibold transition-[background-color,color,box-shadow] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:flex-none",
              selected
                ? "bg-foreground text-primary-foreground shadow-[0_8px_22px_rgb(0_0_0_/_0.24)]"
                : "bg-transparent text-muted hover:bg-surface-subtle hover:text-primary",
            )}
          >
            {index > 0 && !selected ? (
              <span
                aria-hidden="true"
                className="absolute left-0 top-1/2 h-4 -translate-y-1/2 border-l border-border"
              />
            ) : null}
            {label}
          </button>
        );
      })}
    </div>
  );
}
