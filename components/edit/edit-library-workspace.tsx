"use client";

import { useSyncExternalStore } from "react";

import { VideoLibraryGrid } from "@/components/edit/video-library-grid";
import {
  getEditableVideos,
  listenToEditableVideoLibrary,
  type EditableVideo,
} from "@/lib/edit/video-library";

export function EditLibraryWorkspace() {
  const editableVideos = useSyncExternalStore(
    subscribeToEditableVideoLibrary,
    getEditableVideos,
    getEmptyEditableVideos,
  );

  return (
    <section className="flex min-h-screen flex-1 flex-col bg-background px-4 py-4 text-foreground sm:px-6 lg:h-screen lg:px-10 lg:py-6">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-normal text-foreground sm:text-3xl">
            Edit
          </h1>
          <p className="mt-1 text-sm font-medium leading-6 text-[#405977]">
            Choose a video to trim, add text, or prepare for scheduling.
          </p>
        </div>

        <div className="inline-flex h-8 w-fit items-center gap-2 rounded-full border border-border/80 bg-white/70 px-3 text-xs font-semibold text-[#405977] shadow-sm">
          <span className="size-2 rounded-full bg-success" />
          Library
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col pt-5">
        <VideoLibraryGrid videos={editableVideos} />
      </div>
    </section>
  );
}

function subscribeToEditableVideoLibrary(onStoreChange: () => void) {
  return listenToEditableVideoLibrary(() => {
    onStoreChange();
  });
}

function getEmptyEditableVideos(): EditableVideo[] {
  return [];
}
