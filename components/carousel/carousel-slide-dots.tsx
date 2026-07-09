"use client";

import { cn } from "@/lib/utils";

type CarouselSlideDotsProps = {
  activeIndex: number;
  total: number;
  onSelect: (index: number) => void;
};

export function CarouselSlideDots({
  activeIndex,
  total,
  onSelect,
}: CarouselSlideDotsProps) {
  const safeTotal = Math.max(0, total);
  const safeIndex = safeTotal === 0 ? 0 : Math.min(Math.max(activeIndex, 0), safeTotal - 1);

  if (safeTotal === 0) {
    return (
      <span aria-live="polite" className="sr-only">
        No slides available
      </span>
    );
  }

  return (
    <div className="inline-flex max-w-full items-center rounded-full border border-white/15 bg-black/40 px-2 py-1.5 shadow-[0_8px_22px_rgb(0_0_0_/_0.24)] backdrop-blur-md">
      <span aria-live="polite" className="sr-only">
        Slide {safeIndex + 1} of {safeTotal}
      </span>
      <div
        className="flex min-w-0 items-center justify-center gap-1"
        role="group"
        aria-label="Choose a slide in this version"
      >
        {Array.from({ length: safeTotal }, (_, index) => {
          const isActive = index === safeIndex;

          return (
            <button
              key={index}
              type="button"
              aria-label={`View slide ${index + 1}`}
              aria-current={isActive ? "true" : undefined}
              onClick={(event) => {
                event.stopPropagation();
                onSelect(index);
              }}
              className="group inline-flex size-5 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1 focus-visible:ring-offset-black"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-1.5 rounded-full transition-[background-color,width] duration-200",
                  isActive
                    ? "w-5 bg-primary shadow-[0_0_0_1px_rgb(255_255_255_/_0.22)]"
                    : "w-1.5 bg-white/45 group-hover:bg-white/75",
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
