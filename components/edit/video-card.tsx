import { Clock3, Film, PlaySquare } from "lucide-react";
import Link from "next/link";

import {
  formatVideoDuration,
  getEditableVideoHref,
  getEditableVideoSourceLabel,
  getEditableVideoStatusLabel,
  type EditableVideo,
} from "@/lib/edit/video-library";
import { cn } from "@/lib/utils";

export function VideoCard({ video }: { video: EditableVideo }) {
  const statusLabel =
    video.status === "draft" && video.renderedVideoUrl
      ? "Changes not saved"
      : getEditableVideoStatusLabel(video.status);

  return (
    <Link
      href={getEditableVideoHref(video)}
      className="group min-w-0 rounded-card border border-border bg-card p-2 transition-[border-color,background-color] hover:border-border-strong hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
    >
      <div
        className="flex items-center justify-center overflow-hidden rounded-control bg-[#102033] text-white"
        style={{ aspectRatio: video.ratio.replace(":", " / ") }}
      >
        {video.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnailUrl}
            alt=""
            width={720}
            height={1280}
            className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.015] motion-reduce:transition-none"
          />
        ) : (
          <PlaySquare
            className="size-8 text-white/75 transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none"
            aria-hidden="true"
          />
        )}
      </div>
      <div className="mt-3 space-y-3 px-1 pb-1">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h2 className="truncate text-sm font-bold text-foreground">
              {video.title}
            </h2>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-1 text-[11px] font-bold",
                video.status === "failed"
                  ? "bg-error/10 text-error"
                  : video.status === "rendering"
                    ? "bg-primary/10 text-primary"
                    : video.status === "ready"
                      ? "bg-success/10 text-[#087443]"
                      : video.status === "rendered"
                        ? "bg-primary/10 text-primary"
                        : "bg-card-muted text-muted",
              )}
            >
              {statusLabel}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
            <span className="inline-flex items-center gap-1">
              <Film className="size-3" aria-hidden="true" />
              {getEditableVideoSourceLabel(video.source)}
            </span>
            <span>{video.ratio}</span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-3" aria-hidden="true" />
              {formatVideoDuration(video.durationSeconds)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
