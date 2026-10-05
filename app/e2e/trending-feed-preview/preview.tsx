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

export function TrendingFeedPreview() {
  const [reviewedAssignments, setReviewedAssignments] = useState<string[]>([]);
  const [deckVersion, setDeckVersion] = useState(0);
  const postHistory = usePostReviewHistory<ComponentProps<typeof TrendingDeck>["candidates"][number]>();
  const decisions = reviewedAssignments.length;
  return <main className="flex min-h-dvh flex-col bg-background px-6 py-5">
    <header><h1 className="text-[32px] font-semibold leading-10">Trending</h1><p className="mt-1 text-[15px] leading-[22px] text-muted">Development preview · {decisions} reviewed</p>
      <button type="button" className="text-xs text-muted" onClick={() => setDeckVersion(version => version + 1)}>Reopen review deck</button>
    </header>
    <section className="mt-4 flex min-h-0 flex-1 items-center py-3">
    <TrendingDeck key={deckVersion} reviewHistory={postHistory}
      candidates={candidates.filter(candidate => !reviewedAssignments.includes(candidate.item.assignmentId))}
      activeSlideByCarouselId={{}} enqueueDecision={entry => setReviewedAssignments(current => [...current, entry.assignmentId])}
      failure={null} headerActionsRoot={null} onActiveSlideChange={() => {}} onActiveSlideMove={() => {}}
      onHookCompose={() => {}} onRetry={() => {}} pendingSlotCount={0} remainingCount={3 - decisions} userId={null} upgradeRequired={false} />
    </section>
  </main>;
}
