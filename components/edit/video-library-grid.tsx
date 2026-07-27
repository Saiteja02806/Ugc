import { FolderOpen, Loader2, Plus } from "lucide-react";
import Link from "next/link";

import { type EditableVideo } from "@/lib/edit/video-library";
import { VideoCard } from "@/components/edit/video-card";
import { buttonClassName } from "@/components/ui/button";

export function VideoLibraryGrid({
  loading = false,
  videos,
}: {
  loading?: boolean;
  videos: EditableVideo[];
}) {
  if (loading) {
    return <LoadingVideoLibrary />;
  }

  if (videos.length === 0) {
    return <EmptyVideoLibrary />;
  }

  return (
    <section
      aria-label="Editable videos"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </section>
  );
}

function LoadingVideoLibrary() {
  return (
    <section
      aria-label="Loading editable videos"
      className="flex min-h-[420px] flex-1 items-center justify-center rounded-[var(--radius-panel)] border border-border bg-card px-5 py-10 text-center"
    >
      <div>
        <div className="mx-auto flex size-12 items-center justify-center rounded-control border border-border-strong bg-card-muted text-primary">
          <Loader2 className="size-6 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        </div>
        <h2 className="mt-5 text-lg font-bold text-foreground">
          Loading edit library.
        </h2>
      </div>
    </section>
  );
}

function EmptyVideoLibrary() {
  return (
    <section
      aria-label="No editable videos"
      className="flex min-h-[420px] flex-1 items-center justify-center rounded-[var(--radius-panel)] border border-border bg-card px-5 py-10 text-center"
    >
      <div>
        <div className="mx-auto flex size-12 items-center justify-center rounded-control border border-border-strong bg-card-muted text-primary">
          <FolderOpen className="size-6" aria-hidden="true" />
        </div>
        <h2 className="mt-5 text-lg font-bold text-foreground">
          No Edit projects yet.
        </h2>
        <p className="mt-2 max-w-sm text-sm font-medium leading-6 text-muted">
          Open an original video from Creative Assets to start an Edit project.
        </p>
        <Link
          href="/avatars?tab=videos"
          className={buttonClassName({
            variant: "primary",
            className: "mt-5 gap-2",
          })}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add videos
        </Link>
      </div>
    </section>
  );
}
