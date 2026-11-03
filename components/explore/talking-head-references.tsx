"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { useAIStudioAccess } from "@/components/generation/use-ai-studio-access";
import { ReferenceCard, ReferencePreviewDialog, ReferenceGridSkeleton, LoadError } from "./recreate-workspace";
import { visibleTalkingHeadReferences, type TalkingHeadReference } from "@/lib/explore/talking-head-reference";
import type { AIStudioVideoModel } from "@/lib/ai-studio/generation-settings";
import styles from "./talking-head-references.module.css";
import studio from "./workflow-studio.module.css";
import { preloadHookStartingFrameWorkspace } from "./lazy-hook-starting-frame-workspace";

export function TalkingHeadReferences({ items, loading, failed, disabled, selectedId, onChoose, onRetry, startingFrameEnabled = false }: {
  items: TalkingHeadReference[]; loading: boolean; failed: boolean; disabled: boolean;
  model: AIStudioVideoModel;
  startingFrameEnabled?: boolean;
  selectedId: string | null; onChoose: (id: string) => void; onRetry: () => void;
}) {
  const access = useAIStudioAccess();
  const [preview, setPreview] = useState<TalkingHeadReference | null>(null);
  const visibleItems = visibleTalkingHeadReferences(items);
  const warmPreparation = () => { if (startingFrameEnabled && !disabled) void preloadHookStartingFrameWorkspace().catch(() => undefined); };
  return <section className={styles.gallery} aria-label="Talking-head references">
    {loading ? <ReferenceGridSkeleton /> : failed ? <LoadError onRetry={onRetry} /> : visibleItems.length ? <div className={styles.grid}>{visibleItems.map(item => {
      let unavailable: string | null = null;
      if (startingFrameEnabled && !item.sourceSha256) unavailable = "This reference is awaiting source-frame verification.";
      if (!startingFrameEnabled && item.durationSeconds > 30) unavailable = "Video references support up to 30 seconds. This original is available for preview.";
      return <article key={item.id} className={styles.card}>
      <ReferenceCard reference={item} compact hideCaption overlayActions canOpenSource={access === "pro"} isSelected={selectedId === item.id} onPreview={() => setPreview(item)} onRecreate={() => { if (!disabled && !unavailable) onChoose(item.id); }} hideRecreate />
      <button type="button" className={studio.referenceRecreateButton} data-reference-recreate data-reference-recreate-overlay data-selected={selectedId === item.id || undefined} disabled={disabled} onPointerEnter={warmPreparation} onFocus={warmPreparation} title={unavailable ?? "Recreate this reference"} aria-describedby={unavailable ? `${item.id}-limit` : undefined} aria-label={unavailable ? `Preview ${item.title}` : `Recreate ${item.title}`} onClick={() => unavailable ? setPreview(item) : onChoose(item.id)}><RotateCcw aria-hidden="true" /><span>{unavailable ? "Preview only" : "Recreate"}</span></button>
      {unavailable ? <span id={`${item.id}-limit`} className="sr-only">{unavailable}</span> : null}
    </article>; })}</div> : <p role="status">Talking-head references are being prepared. You can generate from your instructions or upload your own video.</p>}
    <ReferencePreviewDialog key={preview?.id} open={Boolean(preview)} reference={preview} onOpenChange={open => { if (!open) setPreview(null); }} />
  </section>;
}
