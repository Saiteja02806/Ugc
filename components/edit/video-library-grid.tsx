import { FolderOpen, Loader2 } from "lucide-react";

import { type EditableVideo } from "@/lib/edit/video-library";
import { VideoCard } from "@/components/edit/video-card";

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
      className="flex min-h-[420px] flex-1 items-center justify-center rounded-[28px] border border-border/70 bg-white/35 px-5 py-10 text-center"
    >
      <div>
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-border bg-white text-primary shadow-sm">
          <Loader2 className="size-6 animate-spin" aria-hidden="true" />
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
      className="flex min-h-[420px] flex-1 items-center justify-center rounded-[28px] border border-border/70 bg-white/35 px-5 py-10 text-center"
    >
      <div>
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-border bg-white text-primary shadow-sm">
          <FolderOpen className="size-6" aria-hidden="true" />
        </div>
        <h2 className="mt-5 text-lg font-bold text-foreground">
          No videos to edit yet.
        </h2>
        <p className="mt-2 max-w-sm text-sm font-medium leading-6 text-muted">
          Generate a video or upload a demo to start.
        </p>
      </div>
    </section>
  );
}
