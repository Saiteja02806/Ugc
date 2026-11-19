"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { useAIStudioAccess } from "@/components/generation/use-ai-studio-access";
import { ReferenceCard, ReferencePreviewDialog, ReferenceGridSkeleton, LoadError, FilterMenu } from "./recreate-workspace";
import { ReferenceFeedUpgrade, useFullVideoReferenceFeed } from "./reference-feed-upgrade";
import { filterReferences, referenceCategories } from "@/lib/explore/recreate-types";
import { filterReferenceViews, sortReferenceViews, videoReferencePreview, type ReferenceViewSort, type ReferenceViewFilter } from "@/lib/explore/video-reference-feed";
import { visibleTalkingHeadReferences, type TalkingHeadReference } from "@/lib/explore/talking-head-reference";
import type { AIStudioVideoModel } from "@/lib/ai-studio/generation-settings";
import styles from "./talking-head-references.module.css";
import studio from "./workflow-studio.module.css";
import { preloadHookStartingFrameWorkspace } from "./lazy-hook-starting-frame-workspace";
import { useStartingFramePreload } from "./use-starting-frame-preload";

export function TalkingHeadReferences({ items, loading, failed, disabled, selectedId, onChoose, onRetry, startingFrameEnabled = false }: {
  items: TalkingHeadReference[]; loading: boolean; failed: boolean; disabled: boolean;
  model: AIStudioVideoModel;
  startingFrameEnabled?: boolean;
  selectedId: string | null; onChoose: (id: string) => void; onRetry: () => void;
}) {
  const access = useAIStudioAccess();
  const feedAccess = useFullVideoReferenceFeed();
  const [viewSort, setViewSort] = useState<ReferenceViewSort>("highest");
  const [viewFilter, setViewFilter] = useState<ReferenceViewFilter>("all");
  const [categories, setCategories] = useState<string[]>([]);
  const preloadFrame = useStartingFramePreload();
  const [preview, setPreview] = useState<TalkingHeadReference | null>(null);
  const activeItems = visibleTalkingHeadReferences(items);
  const previewItems = videoReferencePreview(activeItems, feedAccess.unlimited);
  const visibleItems = sortReferenceViews(filterReferenceViews(filterReferences(previewItems, "hook", categories), viewFilter), viewSort) as TalkingHeadReference[];
  const clearFilters = () => { setCategories([]); setViewSort("highest"); setViewFilter("all"); };
  const warmPreparation = () => { if (startingFrameEnabled && !disabled) void preloadHookStartingFrameWorkspace().catch(() => undefined); };
  return <section className={styles.gallery} aria-label="Talking-head references">
    {!loading && !failed ? <div className="flex justify-end"><FilterMenu activeCategories={categories} categories={referenceCategories(activeItems, "hook")} count={visibleItems.length} disabled={disabled} onToggle={(category, checked) => setCategories(current => checked ? [...current, category] : current.filter(value => value !== category))} onClear={clearFilters} views={{ sort: viewSort, filter: viewFilter, onSort: setViewSort, onFilter: setViewFilter }} /></div> : null}
    {loading ? <ReferenceGridSkeleton /> : failed ? <LoadError onRetry={onRetry} /> : visibleItems.length ? <div className={styles.grid}>{visibleItems.map(item => {
      let unavailable: string | null = null;
      if (startingFrameEnabled && !item.sourceSha256) unavailable = "This reference is awaiting source-frame verification.";
      if (!startingFrameEnabled && item.durationSeconds > 30) unavailable = "Video references support up to 30 seconds. This original is available for preview.";
      return <article key={item.id} className={styles.card}>
      <ReferenceCard reference={item} compact hideCaption overlayActions canOpenSource={access === "pro"} isSelected={selectedId === item.id} onPreview={() => setPreview(item)} onRecreate={() => { if (!disabled && !unavailable) onChoose(item.id); }} hideRecreate />
      <button type="button" className={studio.referenceRecreateButton} data-reference-recreate data-reference-recreate-overlay data-selected={selectedId === item.id || undefined} disabled={disabled} onPointerEnter={() => { warmPreparation(); if (startingFrameEnabled && !disabled && !unavailable) preloadFrame(item); }} onFocus={() => { warmPreparation(); if (startingFrameEnabled && !disabled && !unavailable) preloadFrame(item); }} onPointerDown={() => { if (startingFrameEnabled && !disabled && !unavailable) preloadFrame(item); }} title={unavailable ?? "Recreate this reference"} aria-describedby={unavailable ? `${item.id}-limit` : undefined} aria-label={unavailable ? `Preview ${item.title}` : `Recreate ${item.title}`} onClick={() => { if (startingFrameEnabled && !disabled && !unavailable) preloadFrame(item); if (unavailable) setPreview(item); else onChoose(item.id); }}><RotateCcw aria-hidden="true" /><span>{unavailable ? "Preview only" : "Recreate"}</span></button>
      {unavailable ? <span id={`${item.id}-limit`} className="sr-only">{unavailable}</span> : null}
    </article>; })}</div> : activeItems.length ? <div role="status"><p>No references match these filters.</p><button type="button" className="mt-2 underline" onClick={clearFilters}>Clear filters</button></div> : <p role="status">Talking-head references are being prepared. You can generate from your instructions or upload your own video.</p>}
    {!loading && !failed && !feedAccess.unlimited && activeItems.length > 10 ? <ReferenceFeedUpgrade {...feedAccess} /> : null}
    <ReferencePreviewDialog key={preview?.id} open={Boolean(preview)} reference={preview} onOpenChange={open => { if (!open) setPreview(null); }} />
  </section>;
}
