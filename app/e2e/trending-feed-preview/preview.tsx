"use client";

import { useState, type ComponentProps } from "react";
import { TrendingDeck } from "@/components/trending/trending-workspace";
import { usePostReviewHistory } from "@/components/trending/use-post-review-history";

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
  const slides = [0, 1, 2].map(slide => ({ headline: "Layout preview", renderedUrl: "/explore/characters/creator-office-v2.webp", slideNumber: slide + 1, slideType: "body", status: "ready" as const, subtext: null }));
  const carousel = { candidateIndex: index, carouselId: `preview-carousel-${index}`, categorySlug: null, generationBatchId: "preview", projectId: "preview", readySlideCount: 3,
    selectedAngle: `Preview slideshow ${index + 1}`, slideCount: 3, slides, status: "completed" as const, thumbnailUrl: slides[0].renderedUrl, updatedAt: "2026-10-05T00:00:00Z" };
  return { format: "carousel", carousel, slides, item: { ...candidates[index].item, format: "carousel", creative: carousel } };
});

export function TrendingFeedPreview() {
  const [reviewedAssignments, setReviewedAssignments] = useState<string[]>([]);
  const [deckVersion, setDeckVersion] = useState(0);
  const [format, setFormat] = useState("reaction");
  const [activeSlideByCarouselId, setActiveSlideByCarouselId] = useState<Record<string, number>>({});
  const postHistory = usePostReviewHistory<ComponentProps<typeof TrendingDeck>["candidates"][number]>();
  const decisions = reviewedAssignments.length;
  return <section className="flex min-h-dvh flex-col bg-background px-6 py-5">
    <header className="flex items-start justify-between"><div><h1 className="text-[32px] font-semibold leading-10">Trending</h1><p className="mt-1 text-[15px] leading-[22px] text-muted">Development preview · {decisions} reviewed</p></div>
      <div className="flex gap-3"><select aria-label="Preview format" value={format} onChange={event => { setFormat(event.target.value); setReviewedAssignments([]); postHistory.clear(); setDeckVersion(version => version + 1); }}>
        <option value="reaction">Reaction Reel</option><option value="carousel">Slideshow</option></select>
        <button type="button" className="text-xs text-muted" onClick={() => setDeckVersion(version => version + 1)}>Reopen review deck</button></div>
    </header>
    <section className="mt-4 flex min-h-0 flex-1 items-center py-3">
    <TrendingDeck key={deckVersion} reviewHistory={postHistory}
      candidates={(format === "carousel" ? carouselCandidates : candidates).filter(candidate => !reviewedAssignments.includes(candidate.item.assignmentId))}
      activeSlideByCarouselId={activeSlideByCarouselId} enqueueDecision={entry => setReviewedAssignments(current => [...current, entry.assignmentId])}
      failure={null} headerActionsRoot={null} onActiveSlideChange={(id, index) => setActiveSlideByCarouselId(current => ({ ...current, [id]: index }))}
      onActiveSlideMove={(id, direction, count) => setActiveSlideByCarouselId(current => ({ ...current, [id]: ((current[id] ?? 0) + direction + count) % count }))}
      onHookCompose={() => {}} onRetry={() => {}} pendingSlotCount={0} remainingCount={3 - decisions} userId={null} upgradeRequired={false} />
    </section>
  </section>;
}
