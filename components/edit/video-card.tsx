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
  const statusLabel = getEditableVideoStatusLabel(video.status);

  return (
    <Link
      href={getEditableVideoHref(video)}
      className="group min-w-0 rounded-2xl border border-border bg-white p-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgb(16_32_51_/_0.10)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div
        className="flex items-center justify-center overflow-hidden rounded-xl bg-[#102033] text-white"
        style={{ aspectRatio: video.ratio.replace(":", " / ") }}
      >
        {video.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnailUrl}
            alt=""
            className="size-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <PlaySquare
            className="size-8 text-white/75 transition group-hover:scale-105"
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
                video.status === "ready"
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
