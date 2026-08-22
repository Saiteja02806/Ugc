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
      className="flex flex-col gap-6"
    >
      <h2 id="saved-creative-assets-heading" className="sr-only">
        Saved content
      </h2>

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
        className="grid w-full grid-cols-2 gap-2 sm:ml-auto sm:flex sm:w-fit sm:flex-wrap"
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

      <div className="flex flex-col gap-8">
        {activeFilter === "all" || activeFilter === "hook_video" ? (
          <HookVideoLibraryTab embedded />
        ) : null}
        {activeFilter === "all" || activeFilter === "wall_text" ? (
          <WallTextLibraryTab embedded />
        ) : null}
        {activeFilter === "all" || activeFilter === "carousel" ? (
          <CarouselLibraryTab embedded />
        ) : null}
      </div>
    </section>
  );
}
