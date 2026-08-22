"use client";

import { Eye, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  InstagramEmbed,
  type InstagramEmbedSdkState,
} from "@/components/viral/instagram-embed";
import { Button } from "@/components/ui/button";
import {
  formatViewCount,
  type ViralReviewItem,
} from "@/lib/viral/hook-review";

export function HookReviewCard({
  item,
  sdkRevision,
  sdkState,
}: {
  item: ViralReviewItem;
  sdkRevision: number;
  sdkState: InstagramEmbedSdkState;
}) {
  const router = useRouter();

  function handleUseReference() {
    const refType = item.section === "wall_of_text" ? "wall_text" : "hook";
    const params = new URLSearchParams({
      mode: "videos",
      refId: item.id,
      refType,
      sourceUrl: item.sourceUrl,
    });
    router.push(`/ai-studio?${params.toString()}`);
  }

  const isWallText = item.section === "wall_of_text";
  const isSlideshow = item.section === "slideshow";
  const actionLabel = isWallText
    ? "Use It"
    : isSlideshow
      ? "Use This Slideshow"
      : "Use This Hook";

  return (
    <article className="group min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-border-strong hover:shadow-md">
      <div className="relative">
        <InstagramEmbed
          embedHtml={item.embedHtml}
          sdkRevision={sdkRevision}
          sdkState={sdkState}
        />
        {typeof item.views === "number" && item.views > 0 ? (
          <div
            className="pointer-events-none absolute bottom-2.5 right-2.5 z-10 flex items-center gap-1 rounded-md bg-black/75 px-2 py-0.5 text-[11px] font-semibold text-white/95 backdrop-blur-sm opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            aria-label={`${formatViewCount(item.views)} views`}
          >
            <Eye className="size-3 text-white/80" aria-hidden="true" />
            <span>{formatViewCount(item.views)}</span>
          </div>
        ) : null}
      </div>
      <div className="border-t border-border bg-card p-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleUseReference}
          disabled={isSlideshow}
          className="w-full text-xs font-semibold text-foreground hover:bg-card-muted hover:text-foreground-strong disabled:border-border-strong disabled:bg-card-muted/60 disabled:text-muted disabled:opacity-80"
        >
          <Sparkles data-icon="inline-start" className="size-3.5 text-primary" aria-hidden="true" />
          {actionLabel}
        </Button>
      </div>
    </article>
  );
}
