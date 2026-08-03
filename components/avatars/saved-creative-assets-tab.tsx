"use client";

import { BookmarkCheck, FileText, Images, Video } from "lucide-react";
import { useState } from "react";

import { CarouselLibraryTab } from "@/components/library/library-workspace";
import { HookVideoLibraryTab } from "@/components/library/hook-video-library-tab";
import { WallTextLibraryTab } from "@/components/library/wall-text-library-tab";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";

type SavedCreativeFilter = "all" | "carousel" | "hook_video" | "wall_text";

const savedCreativeFilters: Array<{
  icon: typeof BookmarkCheck;
  label: string;
  value: SavedCreativeFilter;
}> = [
  { icon: BookmarkCheck, label: "All", value: "all" },
  { icon: Video, label: "Hook videos", value: "hook_video" },
  { icon: FileText, label: "Wall-of-Text", value: "wall_text" },
  { icon: Images, label: "Carousels", value: "carousel" },
];

export function SavedCreativeAssetsTab() {
  const [activeFilter, setActiveFilter] =
    useState<SavedCreativeFilter>("all");

  return (
    <section
      aria-labelledby="saved-creative-assets-heading"
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-brand-soft text-primary ring-1 ring-inset ring-primary/10">
            <BookmarkCheck className="size-[18px]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2
              id="saved-creative-assets-heading"
              className="text-base font-semibold text-foreground"
            >
              Saved content
            </h2>
            <p className="mt-0.5 max-w-2xl text-sm leading-5 text-muted">
              Every reviewed creative you save from Trending stays here for
              preview and scheduling.
            </p>
          </div>
        </div>

        <ToggleGroup
          aria-label="Filter saved content"
          value={[activeFilter]}
          onValueChange={(value) => {
            const nextFilter = value[0] as SavedCreativeFilter | undefined;

            if (nextFilter) {
              setActiveFilter(nextFilter);
            }
          }}
          size="sm"
          variant="outline"
          className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-fit sm:flex-wrap"
        >
          {savedCreativeFilters.map((filter) => {
            const Icon = filter.icon;

            return (
              <ToggleGroupItem
                key={filter.value}
                value={filter.value}
                className="w-full justify-start sm:w-auto sm:justify-center"
              >
                <Icon aria-hidden="true" />
                {filter.label}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </div>

      <div className="flex flex-col gap-5">
        {activeFilter === "all" || activeFilter === "hook_video" ? (
          <HookVideoLibraryTab />
        ) : null}
        {activeFilter === "all" || activeFilter === "wall_text" ? (
          <WallTextLibraryTab />
        ) : null}
        {activeFilter === "all" || activeFilter === "carousel" ? (
          <CarouselLibraryTab />
        ) : null}
      </div>
    </section>
  );
}
