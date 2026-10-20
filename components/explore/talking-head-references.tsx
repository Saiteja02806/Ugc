"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAIStudioAccess } from "@/components/generation/use-ai-studio-access";
import { ReferenceCard, ReferencePreviewDialog, ReferenceGridSkeleton, LoadError } from "./recreate-workspace";
import { talkingHeadReferenceSettings, type TalkingHeadReference } from "@/lib/explore/talking-head-reference";
import type { AIStudioVideoModel } from "@/lib/ai-studio/generation-settings";
import styles from "./talking-head-references.module.css";

export function TalkingHeadReferences({ items, loading, failed, disabled, selectedId, model, onChoose, onRetry }: {
  items: TalkingHeadReference[]; loading: boolean; failed: boolean; disabled: boolean;
  model: AIStudioVideoModel;
  selectedId: string | null; onChoose: (id: string) => void; onRetry: () => void;
}) {
  const access = useAIStudioAccess();
  const [preview, setPreview] = useState<TalkingHeadReference | null>(null);
  return <section className={styles.gallery} aria-label="Talking-head references">
    {loading ? <ReferenceGridSkeleton /> : failed ? <LoadError onRetry={onRetry} /> : items.length ? <div className={styles.grid}>{items.map(item => {
      let unavailable: string | null = null;
      try { talkingHeadReferenceSettings(model, item.durationSeconds); } catch (cause) { unavailable = cause instanceof Error ? cause.message : "Preview only"; }
      return <article key={item.id} className={styles.card}>
      <ReferenceCard reference={item} compact hideCaption overlayActions canOpenSource={access === "pro"} isSelected={selectedId === item.id} onPreview={() => setPreview(item)} onRecreate={() => { if (!disabled && !unavailable) onChoose(item.id); }} hideRecreate />
      <Button type="button" variant="outline" className={styles.referenceAction} disabled={disabled} title={unavailable ?? undefined} aria-describedby={unavailable ? `${item.id}-limit` : undefined} aria-pressed={selectedId === item.id} onClick={() => unavailable ? setPreview(item) : onChoose(item.id)}>{unavailable ? "Preview only" : selectedId === item.id ? "Selected reference" : "Use as reference"}</Button>
      {unavailable ? <span id={`${item.id}-limit`} className="sr-only">{unavailable}</span> : null}
    </article>; })}</div> : <p role="status">Talking-head references are being prepared. You can generate from your instructions or upload your own video.</p>}
    <ReferencePreviewDialog key={preview?.id} open={Boolean(preview)} reference={preview} onOpenChange={open => { if (!open) setPreview(null); }} />
  </section>;
}
