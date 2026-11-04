"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiStudioCopyButton } from "@/components/generation/ai-studio-copy-button";
import { getAIStudioVideoResults } from "@/lib/ai-studio/media-results";
import type { WorkflowGenerationView } from "./workflow-generation-boundary";
import { WorkflowMediaPlayer, formatMediaSeconds } from "./hook-workflow-media-controls";
import { WorkflowPreviewCanvas } from "./workflow-preview-canvas";
import styles from "./talking-head-result-review.module.css";

/** Presentation only: selection and the Demo transition remain owned by the workflow. */
export function TalkingHeadResultReview({ generation, onContinue }: {
  generation?: WorkflowGenerationView;
  onContinue: () => void;
}) {
  const results = generation?.results.filter(asset => asset.collection === "video" && asset.status === "ready" && Boolean(asset.url?.trim())) ?? [];
  if (!generation || !results.length) {
    const unavailable = generation && generation.results.length > 0;
    return <>
      <WorkflowPreviewCanvas kind="hook" generation={unavailable ? { ...generation, results: [], selected: null, error: generation.error || "Your generated video is unavailable. Refresh status or choose another video from History." } : generation} />
      {unavailable ? <Button type="button" variant="outline" className={styles.refresh} disabled={generation.busy} onClick={generation.refreshStatus}>Refresh status</Button> : null}
    </>;
  }

  // Previewing a candidate never silently restores an explicitly cleared/missing selection.
  const selected = results.find(asset => asset.id === generation.selected?.id && generation.selected.status === "ready");
  const asset = selected ?? results[0];
  const details = getAIStudioVideoResults([asset], 1)[0];
  const prompt = typeof asset.metadata?.prompt === "string" ? asset.metadata.prompt : "";
  const facts = [
    details?.modelLabel,
    typeof asset.durationSeconds === "number" && Number.isFinite(asset.durationSeconds) && asset.durationSeconds > 0 ? formatMediaSeconds(asset.durationSeconds) : null,
    details?.resolution,
    asset.ratio !== "other" ? asset.ratio : null,
  ].filter(Boolean);

  return <section className={styles.workspace} aria-label="Generated talking-head preview" aria-busy={generation.busy}>
    <header className={styles.heading}>
      <div><h2>Your video is ready</h2><p>Review your clip, then continue to Demo.</p></div>
      <span className={styles.count}>{results.length} {results.length === 1 ? "video" : "videos"}</span>
    </header>
    {results.length > 1 ? <div className={styles.versions} role="group" aria-label="Choose generated video">
      {results.map((result, index) => <Button key={result.id} type="button" variant="outline" aria-pressed={selected?.id === result.id} onClick={() => generation.selectResult(result.id)}>Video {index + 1}</Button>)}
    </div> : null}
    <div className={styles.review} data-ratio={asset.ratio}>
      <WorkflowMediaPlayer key={asset.id} asset={{ name: asset.title, url: asset.url, duration: asset.durationSeconds, width: asset.width ?? undefined, height: asset.height ?? undefined }} kind="video" label="Talking-head video preview" className={styles.player} />
      <div className={styles.info}>
        {facts.length ? <ul className={styles.facts} aria-label="Generated video details">{facts.map(fact => <li key={fact}>{fact}</li>)}</ul> : null}
        {!selected && results.length === 1 ? <Button type="button" variant="outline" onClick={() => generation.selectResult(asset.id)}>Use this video</Button> : null}
        <Button type="button" className={styles.continue} disabled={!selected} onClick={() => { if (selected) onContinue(); }}>Continue to Demo<ArrowRight size={16} aria-hidden="true" /></Button>
        <p className={styles.help}>Add an optional demo or refine this clip next.</p>
        {prompt ? <details key={asset.id} className={styles.prompt}>
          <summary>Generation prompt</summary>
          <div className={styles.promptCopy}><AiStudioCopyButton kind="prompt" value={prompt} /></div>
          <p className={styles.promptText}>{prompt}</p>
        </details> : null}
      </div>
    </div>
    {generation.busy ? <p role="status" className={styles.help}>{generation.message}</p> : null}
    {generation.error ? <p role="alert" className={styles.error}>{generation.error}</p> : null}
  </section>;
}
