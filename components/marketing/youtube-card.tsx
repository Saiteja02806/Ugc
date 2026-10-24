import { YouTubeLite } from "@/components/marketing/lite-embed";
import type { BrandYouTubeVideo } from "@/lib/marketing/brand-videos";

export function YouTubeCard({ video }: { video: BrandYouTubeVideo }) {
  return (
    <article className="rounded-[28px] border border-border bg-card p-5 shadow-card sm:p-6">
      <YouTubeLite videoId={video.id} title={video.title} thumbnailUrl={video.thumbnailUrl} width={video.width} height={video.height} />
      <h3 className="mt-5 text-lg font-semibold leading-6 text-foreground-strong">{video.title}</h3>
      <p className="mt-2 text-sm text-muted">{video.authorName}</p>
      <p className="mt-3 text-sm leading-6 text-muted">{video.note}</p>
      <a href={video.pageUrl} className="mt-4 inline-flex text-sm font-semibold text-primary" rel="noopener noreferrer" target="_blank">
        Open on YouTube
      </a>
    </article>
  );
}
