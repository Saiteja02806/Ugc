"use client";

import { useState, type ComponentProps } from "react";
import { TrendingDeck, TrendingPostSkeleton } from "@/components/trending/trending-workspace";
import { usePostReviewHistory } from "@/components/trending/use-post-review-history";
import reviewLayout from "@/components/trending/trending-review-layout.module.css";
import { WALL_TEXT_CONTENT_LAYOUT_VERSION, WALL_TEXT_LAYOUT_VERSION } from "@/lib/trending/wall-text-types";

const candidates: ComponentProps<typeof TrendingDeck>["candidates"] = [0, 1, 2].map(index => ({
  format: "reaction",
  item: {
    id: `preview-post-${index}`, assignmentId: `preview-assignment-${index}`, creativeId: `preview-creative-${index}`,
    feedItemId: `preview-post-${index}`, format: "reaction", position: index, readiness: "preview_ready", source: "new",
    creative: { aspectRatio: "9:16", caption: "A preview post", clipAssetId: "preview", durationSeconds: 10,
      mediaAssetId: "preview", previewUrl: "/marketing/showcase-part2/hook2-preview.mp4",
      primaryReaction: "preview", thumbnailUrl: null, title: `Preview post ${index + 1}` },
  },
}));

const carouselCandidates: ComponentProps<typeof TrendingDeck>["candidates"] = [0, 1, 2].map(index => {
  const slides = [0, 1, 2].map(slide => ({ headline: "Layout preview", renderedUrl: `/marketing/showcase-part2/slideshow/image_${slide}.jpg`, slideNumber: slide + 1, slideType: "body", status: "ready" as const, subtext: null }));
  const carousel = { candidateIndex: index, carouselId: `preview-carousel-${index}`, categorySlug: null, generationBatchId: "preview", projectId: "preview", readySlideCount: 3,
    selectedAngle: `Preview slideshow ${index + 1}`, slideCount: 3, slides, status: "completed" as const, thumbnailUrl: slides[0].renderedUrl, updatedAt: "2026-10-05T00:00:00Z" };
  return { format: "carousel", carousel, slides, item: { ...candidates[index].item, format: "carousel", creative: carousel } };
});

const wallCandidates: ComponentProps<typeof TrendingDeck>["candidates"] = [0, 1, 2].map(index => ({
  format: "wall_text",
  item: { ...candidates[index].item, format: "wall_text", creative: {
    aspectRatio: "9:16", durationSeconds: 10, previewUrl: "/try-ugcpilot/media/videos/card-29.mp4",
    thumbnailUrl: null, title: `Preview Wall ${index + 1}`,
    audio: { assetDurationSeconds: 10, assetId: "preview", audioUrl: "/try-ugcpilot/media/streaming/audio/track-29.mp3",
      cueStartSeconds: 0, fadeOutSeconds: 0, fitMode: "trim", matchingVersion: "preview", outputDurationSeconds: 10, selectionId: "preview" },
    layout: { alignment: "center", placement: "upper-middle", placementSource: "visual-group-fallback",
      safeArea: { bottom: 0.08, left: 0.04, right: 0.04, top: 0.08 },
      textBox: { height: 0.3, width: 0.9, x: 0.05, y: 0.08 }, version: WALL_TEXT_LAYOUT_VERSION },
    text: { fullText: "Small windows need enough room. Every saved line stays visible. The post uses the space left after the header and controls. The card gets taller when the browser has more height. Both actions stay on screen. You can return to earlier posts.", kind: "wall_text",
      layoutVersion: WALL_TEXT_CONTENT_LAYOUT_VERSION, pattern: "freeform", renderFontSize: 52,
      segments: [{ role: "lead", lines: ["Small windows need enough room.", "Every saved line stays visible.", "The post uses the space left", "after the header and controls.", "The card gets taller when", "the browser has more height.", "Both actions stay on screen.", "You can return to earlier posts."] }] },
  } },
}));

export function TrendingFeedPreview() {
  const [reviewedAssignments, setReviewedAssignments] = useState<string[]>([]);
  const [deckVersion, setDeckVersion] = useState(0);
  const [format, setFormat] = useState("reaction");
  const [activeSlideByCarouselId, setActiveSlideByCarouselId] = useState<Record<string, number>>({});
  const postHistory = usePostReviewHistory<ComponentProps<typeof TrendingDeck>["candidates"][number]>();
  const decisions = reviewedAssignments.length;
  return <section className={`min-h-dvh flex-1 bg-background px-4 py-4 text-foreground sm:px-6 lg:px-8 lg:py-5 xl:px-10 ${reviewLayout.workspace}`}>
    <div className={`mx-auto flex min-h-[calc(100dvh-2rem)] max-w-[1360px] flex-col lg:min-h-[calc(100dvh-2.5rem)] ${reviewLayout.workspaceContent}`}>
    <header className="flex items-start justify-between gap-4"><div className="min-w-0"><h1 className="text-[30px] font-semibold leading-9 sm:text-[32px] sm:leading-10">Trending</h1><p data-trending-intro className="mt-1 max-w-2xl text-[14px] leading-[20px] text-muted sm:text-[15px] sm:leading-[22px]">Explore Carousel, Hook, Wall-of-text, and Reaction Reel content made from your business profile.</p></div>
      <div className="flex shrink-0 gap-3"><select aria-label="Preview format" value={format} onChange={event => { setFormat(event.target.value); setReviewedAssignments([]); postHistory.clear(); setDeckVersion(version => version + 1); }}>
        <option value="reaction">Reaction Reel</option><option value="carousel">Slideshow</option><option value="wall_text">Wall of Text</option></select>
        <button type="button" className="text-xs text-muted" onClick={() => setDeckVersion(version => version + 1)}>Reopen review deck</button></div>
    </header>
    <span data-preview-reviewed className="sr-only" aria-live="polite">Development preview · {decisions} reviewed</span>
    <section className={`mt-4 flex min-h-0 flex-1 items-center py-3 ${reviewLayout.contentSection} ${reviewLayout.feedTransition}`}>
    <div className={`min-w-0 flex-1 ${reviewLayout.feedLayer}`}>
    <div className={`relative grid w-full ${reviewLayout.feedGallery}`}>
    <div aria-hidden="true" className={`pointer-events-none col-start-1 row-start-1 opacity-0 ${reviewLayout.feedLayer} ${reviewLayout.skeletonLayer}`}>
      <TrendingPostSkeleton active={false} />
    </div>
    <div className={`col-start-1 row-start-1 ${reviewLayout.feedLayer}`}>
    <div className={`flex w-full flex-col ${reviewLayout.feedLayer}`}>
    <TrendingDeck key={deckVersion} reviewHistory={postHistory}
      candidates={(format === "carousel" ? carouselCandidates : format === "wall_text" ? wallCandidates : candidates).filter(candidate => !reviewedAssignments.includes(candidate.item.assignmentId))}
      activeSlideByCarouselId={activeSlideByCarouselId} enqueueDecision={entry => setReviewedAssignments(current => [...current, entry.assignmentId])}
      failure={null} headerActionsRoot={null} onActiveSlideChange={(id, index) => setActiveSlideByCarouselId(current => ({ ...current, [id]: index }))}
      onActiveSlideMove={(id, direction, count) => setActiveSlideByCarouselId(current => ({ ...current, [id]: ((current[id] ?? 0) + direction + count) % count }))}
      onHookCompose={() => {}} onRetry={() => {}} pendingSlotCount={0} remainingCount={3 - decisions} userId={null} upgradeRequired={false} />
    </div></div></div></div>
    </section>
    </div>
  </section>;
}
