"use client";

import {
  AlignLeft,
  Bookmark,
  GalleryHorizontal,
  Layers,
  Sparkles,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

import { CarouselLibraryTab } from "@/components/library/library-workspace";
import { HookVideoLibraryTab } from "@/components/library/hook-video-library-tab";
import { WallTextLibraryTab } from "@/components/library/wall-text-library-tab";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";

type SavedCreativeFilter = "all" | "carousel" | "hook_video" | "wall_text";

const savedCreativeFilters: Array<{
  icon: typeof Layers;
  label: string;
  value: SavedCreativeFilter;
}> = [
  { icon: Layers, label: "All", value: "all" },
  { icon: Video, label: "Hook videos", value: "hook_video" },
  { icon: AlignLeft, label: "Wall-of-Text", value: "wall_text" },
  { icon: GalleryHorizontal, label: "Carousels", value: "carousel" },
];

export function SavedCreativeAssetsTab() {
  const [activeFilter, setActiveFilter] =
    useState<SavedCreativeFilter>("all");
  const [hookState, setHookState] = useState<{ count: number; loading: boolean }>({
    count: 0,
    loading: true,
  });
  const [wallState, setWallState] = useState<{ count: number; loading: boolean }>({
    count: 0,
    loading: true,
  });
  const [carouselState, setCarouselState] = useState<{ count: number; loading: boolean }>({
    count: 0,
    loading: true,
  });

  const handleHookLoaded = useCallback((count: number, loading: boolean) => {
    setHookState({ count, loading });
  }, []);

  const handleWallLoaded = useCallback((count: number, loading: boolean) => {
    setWallState({ count, loading });
  }, []);

  const handleCarouselLoaded = useCallback((count: number, loading: boolean) => {
    setCarouselState({ count, loading });
  }, []);

  const isAllEmpty =
    !hookState.loading &&
    !wallState.loading &&
    !carouselState.loading &&
    hookState.count === 0 &&
    wallState.count === 0 &&
    carouselState.count === 0;

  return (
    <section
      aria-labelledby="saved-creative-assets-heading"
      className="flex flex-col gap-6"
    >
      <h2 id="saved-creative-assets-heading" className="sr-only">
        Saved content
      </h2>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ToggleGroup
          aria-label="Filter saved content"
          value={[activeFilter]}
          onValueChange={(value) => {
            const nextFilter = value[0] as SavedCreativeFilter | undefined;

            if (nextFilter) {
              setActiveFilter(nextFilter);
            }
          }}
          spacing={1}
          className="inline-flex w-full rounded-full border border-border/80 bg-card-muted/80 p-1 shadow-xs sm:w-auto"
        >
          {savedCreativeFilters.map((filter) => {
            const Icon = filter.icon;
            const isActive = activeFilter === filter.value;

            return (
              <ToggleGroupItem
                key={filter.value}
                value={filter.value}
                aria-current={isActive ? "page" : undefined}
                className="h-8 flex-1 gap-1.5 rounded-full px-3.5 text-xs font-medium text-muted transition-all hover:text-foreground aria-pressed:bg-card aria-pressed:font-semibold aria-pressed:text-foreground aria-pressed:shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] aria-pressed:ring-1 aria-pressed:ring-border/60 sm:flex-none"
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {filter.label}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </div>

      <div className="flex flex-col gap-8">
        {activeFilter === "all" ? (
          <>
            <HookVideoLibraryTab
              embedded
              hideIfEmpty
              onLoadedCount={handleHookLoaded}
            />
            <WallTextLibraryTab
              embedded
              hideIfEmpty
              onLoadedCount={handleWallLoaded}
            />
            <CarouselLibraryTab
              embedded
              hideIfEmpty
              onLoadedCount={handleCarouselLoaded}
            />
            {isAllEmpty ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border/80 bg-card/60 p-8 sm:p-12 text-center shadow-xs">
                <div className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-primary ring-4 ring-primary/10 shadow-xs">
                  <Bookmark className="size-5" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  No saved content yet
                </h3>
                <p className="mt-1.5 max-w-md text-xs sm:text-sm text-muted">
                  Save reviewed Reel hooks, Wall-of-Text videos, or Carousels from Trending, and they will appear here ready to schedule.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/dashboard"
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),0_1px_3px_rgba(0,0,0,0.12)] transition-all hover:bg-primary-hover active:scale-95"
                  >
                    <Sparkles className="size-3.5" aria-hidden="true" />
                    Explore Trending
                  </Link>
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {activeFilter === "hook_video" ? (
          <HookVideoLibraryTab embedded onLoadedCount={handleHookLoaded} />
        ) : null}
        {activeFilter === "wall_text" ? (
          <WallTextLibraryTab embedded onLoadedCount={handleWallLoaded} />
        ) : null}
        {activeFilter === "carousel" ? (
          <CarouselLibraryTab embedded onLoadedCount={handleCarouselLoaded} />
        ) : null}
      </div>
    </section>
  );
}
