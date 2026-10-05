"use client";

import { ArrowRight, AudioLines, Video } from "lucide-react";

import { WorkflowMediaPlayer, type WorkflowAttachment } from "@/components/explore/hook-workflow-media-controls";
import { SCHEDULE_PLATFORMS, type WorkflowScheduleDraft } from "@/components/explore/workflow-scheduling-panel";
import creation from "@/components/explore/workflow-creation.module.css";
import type { MediaAsset } from "@/lib/media/types";

/** Shows only user-selected demo media, never a stock or pretend generated video. */
export function WorkflowEditWorkspace({ kind, demo, demoAudio, generatedVideo, finishedVideo }: {
  kind: "hook" | "phone";
  demo: WorkflowAttachment;
  demoAudio: WorkflowAttachment;
  generatedVideo?: MediaAsset | null;
  finishedVideo?: MediaAsset | null;
}) {
  const videoLabel = kind === "hook" ? "Hook" : "Phone video";
  if (finishedVideo) return <section aria-label="Saved finished video" className={creation.editWorkspace}><h2 className={creation.sectionTitle}>Your finished video</h2><WorkflowMediaPlayer asset={{ name: finishedVideo.title, url: finishedVideo.url, duration: finishedVideo.durationSeconds }} kind="video" label="Finished video preview" /><p className="text-xs text-muted">Saved to your Library. Review the rendered subtitles and audio before scheduling.</p></section>;
  return <section aria-label="Video editing workspace" className={creation.editWorkspace}>
    <div>
      <h2 className={creation.sectionTitle}>Your video sequence</h2>
      <p className={creation.sectionHelp}>{videoLabel} first. Demo optional.</p>
    </div>
    <div className={creation.sequenceGrid}>
      <section aria-label={`${videoLabel} segment`} className={creation.segment}>
        <h3 className="text-sm font-medium">{videoLabel}</h3>
        {generatedVideo ? <WorkflowMediaPlayer asset={{ name: generatedVideo.title, url: generatedVideo.url, duration: generatedVideo.durationSeconds }} kind="video" label={`${videoLabel} segment preview`} className={creation.demoPlayer} />
          : <div className={creation.segmentEmpty}><Video className="size-5 text-muted" aria-hidden="true" /><p>Your generated {videoLabel.toLowerCase()} will appear here.</p></div>}
      </section>
      <ArrowRight className={creation.sequenceArrow} aria-hidden="true" />
      <section aria-label="Demo segment" className={creation.segment}>
        <h3 className="text-sm font-medium">Demo <span className="text-xs font-normal text-muted">Optional</span></h3>
        {demo.asset ? <><WorkflowMediaPlayer asset={demo.asset} kind="video" label="Video sequence demo preview" className={creation.demoPlayer} /><p className="truncate text-xs text-muted" title={demo.asset.name}>{demo.asset.name}</p></>
          : <div className={creation.segmentEmpty}><Video className="size-5 text-muted" aria-hidden="true" /><p>Add a demo in Edit video, or keep your {videoLabel.toLowerCase()} on its own.</p></div>}
      </section>
    </div>
    <section aria-label="Demo audio summary" className={creation.audioSummary}>
      <AudioLines className="size-4 shrink-0 text-muted" aria-hidden="true" />
      <div className="min-w-0"><h3 className="text-sm font-medium">Demo audio</h3><p className="mt-1 truncate text-xs text-muted" title={demoAudio.asset?.name}>{demoAudio.asset?.name ?? (demo.asset ? "Original demo sound preserved. Extra audio is optional." : "Add a demo before choosing its audio.")}</p></div>
    </section>
    <p className="text-xs leading-5 text-muted">This is a sequence preview, not a rendered video. Subtitle style applies to spoken audio across both segments.</p>
  </section>;
}

export function WorkflowScheduleWorkspace({ draft, finishedVideo }: { draft: WorkflowScheduleDraft; finishedVideo?: MediaAsset | null }) {
  const platform = SCHEDULE_PLATFORMS.find((option) => option.value === draft.platform)?.label;
  return <section aria-label="Post preview" className={creation.editWorkspace}>
    <div><h2 className={creation.sectionTitle}>Post preview</h2><p className={creation.sectionHelp}>{platform ?? "Choose a platform in Schedule."}</p></div>
    {finishedVideo ? <WorkflowMediaPlayer asset={{ name: finishedVideo.title, url: finishedVideo.url, duration: finishedVideo.durationSeconds }} kind="video" label="Scheduled finished video preview" /> : <div className={creation.postEmpty}><Video className="size-6 text-muted" aria-hidden="true" /><h3 className="text-lg font-semibold">Your finished video will appear here.</h3><p className={creation.sectionHelp}>Apply edits to save a finished video before scheduling.</p></div>}
    <section aria-label="Post caption preview" className={creation.captionPreview}>
      <h3 className="text-sm font-medium">Post caption</h3>
      <p>{draft.caption || "Write a caption in Schedule to preview it here."}</p>
    </section>
  </section>;
}
