"use client";

import { ArrowRight, AudioLines, Pencil, Video } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { RemoveMediaButton, WorkflowFilePicker, WorkflowMediaPlayer, type WorkflowAttachment } from "@/components/explore/hook-workflow-media-controls";
import { SCHEDULE_PLATFORMS, type WorkflowScheduleDraft } from "@/components/explore/workflow-scheduling-panel";
import creation from "@/components/explore/workflow-creation.module.css";
import { Button } from "@/components/ui/button";
import type { LocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";
import type { MediaAsset } from "@/lib/media/types";
import { workflowSelectedPlatforms } from "@/lib/explore/workflow-scheduling-draft";
import { WorkflowDemoPreview } from "@/components/explore/workflow-demo-controls";
import type { DemoFraming } from "@/worker/src/lib/explore-finishing-contract";
import type { FormatOpeningPreview } from "@/components/explore/format-video-editor";
import type { FinishingOptions } from "@/components/explore/use-workflow-finishing";
import { WorkflowSequencePreview } from "@/components/explore/workflow-sequence-preview";
import { mapSequencePreviewDemoReference, mapSequencePreviewDemoAudio, type SequencePreviewAudio, type SequencePreviewSegment } from "@/lib/explore/sequence-preview";
import { getReferenceAudioPreview } from "@/lib/explore/reference-audio-preview";
import { loadWorkflowDefaultMusic } from "@/lib/explore/workflow-default-music-client";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import schedulePreview from "@/components/explore/talking-head-schedule-preview.module.css";
import type { SubtitleTranscript } from "@/worker/src/subtitles/contracts";

/** Shows only user-selected demo media, never a stock or pretend generated video. */
export function WorkflowEditWorkspace({ kind, demo, demoAudio, generatedVideo, sourcePreview, onChangeSource, finishedVideo, demoFraming, demoPreview, openingPreview, demoSegmentPreview, rawComposition = false, onAddDemo, onEditSource, onEditDemo, editingBusy = false, compositionPreview }: {
  kind: "hook" | "phone";
  demo: WorkflowAttachment;
  demoAudio: WorkflowAttachment;
  generatedVideo?: MediaAsset | null;
  sourcePreview?: LocalWorkflowMedia | null;
  onChangeSource?: () => void;
  finishedVideo?: MediaAsset | null;
  demoFraming?: DemoFraming | null;
  demoPreview?: LocalWorkflowMedia;
  openingPreview?: FormatOpeningPreview | null;
  demoSegmentPreview?: FormatOpeningPreview | null;
  rawComposition?: boolean;
  onAddDemo?: () => void;
  onEditSource?: () => void;
  onEditDemo?: () => void;
  editingBusy?: boolean;
  compositionPreview?: ReactNode;
}) {
  const videoLabel = kind === "hook" ? "Hook video" : "Phone video";
  const sourceEditLabel = kind === "hook" ? "Edit hook video" : "Edit phone video";
  const hasDemo = Boolean(demo.asset || demoPreview);
  const editedOpening = openingPreview && (generatedVideo
    ? openingPreview.segment.id === generatedVideo.id
    : sourcePreview && openingPreview.segment.url === sourcePreview.url) ? openingPreview : null;
  const editedDemo = demoSegmentPreview ? mapSequencePreviewDemoAudio(demoSegmentPreview.segment, { rawComposition }) : null;
  const outputWidth = editedOpening?.segment.width ?? generatedVideo?.width ?? undefined;
  const outputHeight = editedOpening?.segment.height ?? generatedVideo?.height ?? undefined;
  if (finishedVideo && kind !== "hook") return <section aria-label="Saved finished video" className={creation.editWorkspace}><h2 className={creation.sectionTitle}>Your finished video</h2><WorkflowMediaPlayer asset={{ name: finishedVideo.title, url: finishedVideo.url, duration: finishedVideo.durationSeconds, width: finishedVideo.width, height: finishedVideo.height }} kind="video" label="Finished video preview" /><p className="text-xs text-muted">Saved to your Library. Review the rendered subtitles and audio before scheduling.</p>{onEditSource || onEditDemo ? <div className={creation.segmentActions}>{onEditSource ? <Button type="button" variant="outline" aria-label={sourceEditLabel} disabled={editingBusy} onClick={onEditSource}><Pencil className="size-3.5" aria-hidden="true" />{sourceEditLabel}</Button> : null}{onEditDemo ? <Button type="button" variant="outline" aria-label="Edit demo video" disabled={editingBusy} onClick={onEditDemo}><Pencil className="size-3.5" aria-hidden="true" />Edit demo video</Button> : null}</div> : null}</section>;
  return <section aria-label="Video editing workspace" className={creation.editWorkspace}>
    <div>
      <h2 className={creation.sectionTitle}>{kind === "hook" ? "Edit your videos" : hasDemo ? "Your video sequence" : "Your video"}</h2>
      <p className={creation.sectionHelp}>{kind === "hook" ? "Your hook plays first. Add a demo after it, or continue with just the hook." : hasDemo ? `${videoLabel} first, then Demo.` : "Publish this video on its own, or add an optional demo."}</p>
      {kind !== "hook" && !hasDemo && onAddDemo ? <Button type="button" variant="outline" className="mt-3" disabled={editingBusy} onClick={onAddDemo}>Add optional demo</Button> : null}
    </div>
    <div data-workflow-sequence data-demo-selected={hasDemo} data-kind={kind} className={creation.sequenceGrid}>
      <section aria-label={`${videoLabel} segment`} className={creation.segment}>
        <div className={creation.segmentHeader}>
          <h3 className="text-sm font-medium">{videoLabel}</h3>
          <div className={creation.segmentActions}>
            {onChangeSource ? <Button type="button" variant="ghost" disabled={editingBusy} onClick={onChangeSource}>{kind === "hook" ? "Change hook" : "Change video"}</Button> : null}
          </div>
        </div>
        {editedOpening ? <WorkflowSequencePreview segments={[editedOpening.segment]} backgroundAudio={editedOpening.referenceAudio} className={creation.editSequence} playbackDisabledReason={editedOpening.disabledReason} /> : sourcePreview ? <WorkflowMediaPlayer asset={sourcePreview} kind="video" label={`${videoLabel} segment preview`} className={creation.demoPlayer} /> : generatedVideo ? <WorkflowMediaPlayer asset={{ name: generatedVideo.title, url: generatedVideo.url, duration: generatedVideo.durationSeconds, width: generatedVideo.width, height: generatedVideo.height }} kind="video" label={`${videoLabel} segment preview`} className={creation.demoPlayer} />
          : <div data-workflow-empty-segment className={creation.segmentEmpty}><Video className="size-5 text-muted" aria-hidden="true" /><p>Your generated {videoLabel.toLowerCase()} will appear here.</p></div>}
        {onEditSource ? <div className={creation.segmentActions}><Button type="button" variant="outline" disabled={editingBusy} onClick={onEditSource}><Pencil className="size-3.5" aria-hidden="true" />{sourceEditLabel}</Button></div> : null}
      </section>
      {hasDemo || kind === "hook" ? <><ArrowRight className={creation.sequenceArrow} aria-hidden="true" />
      <section aria-label="Demo segment" className={creation.segment}>
        <div className={creation.segmentHeader}>
          <h3 className="text-sm font-medium">Demo video <span className="text-xs font-normal text-muted">Optional</span></h3>
          {kind === "hook" && demo.asset ? <div className={creation.segmentActions}><WorkflowFilePicker attachment={demo} kind="video" label="Replace demo video" disabled={editingBusy} /><RemoveMediaButton label="demo" onClick={demo.remove} /></div> : null}
        </div>
        {editedDemo ? <WorkflowSequencePreview segments={[{ ...editedDemo, framing: demoFraming }]} outputWidth={outputWidth} outputHeight={outputHeight} backgroundAudio={demoSegmentPreview?.referenceAudio} className={creation.editSequence} playbackDisabledReason={demoSegmentPreview?.disabledReason} /> : demo.asset ? <>{demoFraming ? <WorkflowDemoPreview key={`${(demoPreview ?? demo.asset).url}:${JSON.stringify(demoFraming)}`} asset={demoPreview ?? demo.asset} framing={demoFraming} /> : <WorkflowMediaPlayer asset={demoPreview ?? demo.asset} kind="video" label="Video sequence demo preview" className={creation.demoPlayer} />}<p className="truncate text-xs text-muted" title={demo.asset.name}>{demo.asset.name}</p></>
          : demoPreview ? <WorkflowMediaPlayer asset={demoPreview} kind="video" label="Video sequence demo preview" className={creation.demoPlayer} />
          : <div data-workflow-empty-segment className={creation.segmentEmpty}><Video className="size-5 text-muted" aria-hidden="true" /><p>Show your product or app after the hook. You can skip this.</p><WorkflowFilePicker attachment={demo} kind="video" label="Upload demo video" disabled={editingBusy} /><p>Up to 120 seconds</p></div>}
        {hasDemo && onEditDemo ? <div className={creation.segmentActions}><Button type="button" variant="outline" disabled={editingBusy} onClick={onEditDemo}><Pencil className="size-3.5" aria-hidden="true" />Edit demo video</Button></div> : null}
        {demo.error ? <p role="alert" className="text-sm text-destructive">{demo.error}</p> : null}
      </section></> : null}
    </div>
    {hasDemo ? <section aria-label="Demo audio summary" className={creation.audioSummary}>
      <AudioLines className="size-4 shrink-0 text-muted" aria-hidden="true" />
      <div className="min-w-0"><h3 className="text-sm font-medium">Demo audio <span className="ml-1 text-xs font-normal text-muted">Optional</span></h3><p className="mt-1 truncate text-xs text-muted" title={demoAudio.asset?.name}>{demoAudio.asset?.name ?? (demo.asset ? "Original demo sound preserved. Extra audio is optional." : "Add a demo before choosing its audio.")}</p></div>
    </section> : null}
    {compositionPreview}
    <p className="text-xs leading-5 text-muted">{kind === "hook" ? finishedVideo ? "Your final video is ready. Open Schedule to review it, or edit a clip to make changes." : "Edit each clip separately, then choose Prepare final video to combine your clips, subtitles and audio." : "Editing preview. Save your clip edits, then prepare the final video to review rendered subtitles and the complete audio mix."}</p>
  </section>;
}

export function WorkflowScheduleWorkspace({ draft, finishedVideo, source, sourcePreview, demoSource, demo, demoAudio, demoAudioPlayback = "once", openingPreview, demoPreview, demoFraming, rawDemoFraming, options, ownerId = null, enabled = false, previewDisabledReason, active = true, captions, captionReview = false, rawComposition = false, editingPreview = false, kind = "hook", onChangeSource }: {
  draft: WorkflowScheduleDraft; finishedVideo?: MediaAsset | null;
  source?: MediaAsset | null; sourcePreview?: LocalWorkflowMedia | null;
  demoSource?: MediaAsset | null; demo?: LocalWorkflowMedia | null; demoAudio?: LocalWorkflowMedia | null;
  demoAudioPlayback?: "once" | "repeat"; openingPreview?: FormatOpeningPreview | null; demoPreview?: FormatOpeningPreview | null;
  demoFraming?: DemoFraming | null; rawDemoFraming?: DemoFraming | null; options?: FinishingOptions;
  ownerId?: string | null; enabled?: boolean; previewDisabledReason?: string | null; active?: boolean;
  captions?: SubtitleTranscript | null;
  captionReview?: boolean;
  rawComposition?: boolean;
  editingPreview?: boolean;
  kind?: "hook" | "phone";
  onChangeSource?: () => void;
}) {
  const openingLabel = kind === "phone" ? "Phone video" : "Talking head";
  const [sizes, setSizes] = useState<Record<string, { width: number; height: number; duration: number }>>({});
  const [sizeErrors, setSizeErrors] = useState<Record<string, boolean>>({});
  const [music, setMusic] = useState<{ key: string; audio: SequencePreviewAudio | null; error: string | null } | null>(null);
  const [watched, setWatched] = useState<string | null>(null), [finishedSelected, setFinishedSelected] = useState<string | null>(null);
  const preparedOpening = !!source && source.id !== openingPreview?.segment.id;
  const openingReference = preparedOpening ? getReferenceAudioPreview(source) : null;
  const referenceAudio: SequencePreviewAudio | null = openingReference ? { url: openingReference.audioUrl, volume: openingReference.volume, playback: "repeat" }
    : openingPreview?.referenceAudio ?? null;
  const needsMusic = !!options?.backgroundMusic && !referenceAudio;
  const musicKey = needsMusic ? JSON.stringify([ownerId, enabled]) : null;
  useEffect(() => {
    if (!musicKey || !enabled || !ownerId) return;
    let stopped = false, url: string | null = null;
    const assertActive = () => { if (stopped) throw new Error("This music preview is no longer active."); };
    void loadWorkflowDefaultMusic({ token: () => getCurrentUserIdToken(ownerId), fetch, assertActive }).then(track => {
      if (stopped) return;
      url = URL.createObjectURL(track.file);
      setMusic({ key: musicKey, audio: { url, volume: .2, playback: track.playback }, error: null });
    }).catch(error => { if (!stopped) setMusic({ key: musicKey, audio: null, error: error instanceof Error ? error.message : "Could not preview background music. Turn it off or try again." }); });
    return () => { stopped = true; if (url) URL.revokeObjectURL(url); };
  }, [musicKey, enabled, ownerId]);
  const musicState = music?.key === musicKey ? music : null;
  const backgroundAudio = referenceAudio ?? musicState?.audio ?? null;
  const sourceUrl = source?.url ?? sourcePreview?.url;
  const demoUrl = demoSource?.url ?? demo?.url;
  const sourceSize = sourceUrl ? sizes[sourceUrl] : null, demoSize = demoUrl ? sizes[demoUrl] : null;
  const opening: SequencePreviewSegment | null = openingPreview && !preparedOpening ? { ...openingPreview.segment, id: `opening:${openingPreview.segment.id}`, label: openingLabel }
    : sourceUrl && (source?.durationSeconds ?? sourcePreview?.duration ?? sourceSize?.duration ?? 0) > 0 ? {
      id: `opening:${source?.id ?? sourceUrl}`, label: openingLabel, url: openingReference?.cleanVideoUrl ?? sourceUrl,
      durationSeconds: source?.durationSeconds ?? sourcePreview?.duration ?? sourceSize?.duration ?? 0,
      width: source?.width ?? sourceSize?.width ?? 1080, height: source?.height ?? sourceSize?.height ?? 1920,
      ...(openingReference && !openingReference.cleanVideoUrl ? { editing: { version: 1 as const, format: "hook" as const, trimStartMs: 0, trimEndMs: Math.round((source?.durationSeconds ?? 0) * 1000), originalVolume: 0, musicVolume: openingReference.volume, text: null } } : {}),
    } : null;
  const preparedDemo = !!demoSource && demoSource.id !== demoPreview?.segment.id;
  let secondary: SequencePreviewSegment | null = demoPreview && !preparedDemo ? { ...demoPreview.segment, id: `demo:${demoPreview.segment.id}`, label: "Demo", framing: rawDemoFraming, referenceAudio: referenceAudio ? null : demoPreview.referenceAudio }
    : demoUrl && (demoSource?.durationSeconds ?? demo?.duration ?? demoSize?.duration ?? 0) > 0 ? {
      id: `demo:${demoSource?.id ?? demoUrl}`, label: "Demo", url: demoUrl,
      durationSeconds: demoSource?.durationSeconds ?? demo?.duration ?? demoSize?.duration ?? 0,
      width: demoSource?.width ?? demoSize?.width ?? 1080, height: demoSource?.height ?? demoSize?.height ?? 1920, framing: preparedDemo ? demoFraming : rawDemoFraming,
    } : null;
  // Final joining replaces a Demo's paired reference only when the opening has
  // its own continuous reference. Prepared clips already contain their edits.
  if (secondary && referenceAudio) secondary = mapSequencePreviewDemoReference(secondary, getReferenceAudioPreview(demoSource), { openingHasReference: true, requiresPreparation: false });
  if (secondary && !preparedDemo) secondary = mapSequencePreviewDemoAudio(secondary, { rawComposition });
  const extraAudio: SequencePreviewAudio | null = demoAudio ? { url: demoAudio.url, volume: .2, playback: demoAudioPlayback } : null;
  const extraAudioNeedsSavedMix = Boolean(secondary?.addedAudio && secondary?.referenceAudio && extraAudio);
  if (secondary && extraAudio) secondary = secondary.addedAudio ? { ...secondary, referenceAudio: secondary.referenceAudio ?? extraAudio } : { ...secondary, addedAudio: extraAudio };
  const segments = opening ? secondary ? [opening, secondary] : [opening] : [];
  const sequenceKey = JSON.stringify([segments, backgroundAudio]);
  const showFinished = !editingPreview && !!finishedVideo && (watched !== sequenceKey || finishedSelected === finishedVideo.id);
  const sizePending = !openingPreview && sourceUrl && (!source?.width || !source?.height) && !sourceSize || !demoPreview && demoUrl && (!demoSource?.width || !demoSource?.height) && !demoSize;
  const disabledReason = previewDisabledReason ?? (!preparedOpening ? openingPreview?.disabledReason : null) ?? (!preparedDemo ? demoPreview?.disabledReason : null)
    ?? (sourceUrl && sizeErrors[sourceUrl] || demoUrl && sizeErrors[demoUrl] ? "A preview clip could not load. Go back to Edit and replace it or try again." : null)
    ?? (extraAudioNeedsSavedMix ? "Save the demo's clip audio edits before previewing all its audio layers together." : null)
    ?? (sizePending ? "Loading video dimensions for your preview…" : needsMusic && !backgroundAudio ? !enabled || !ownerId ? "Sign in to preview selected background music, or turn it off." : musicState?.error ?? "Loading your background music…" : null);
  function readSize(url: string, video: HTMLVideoElement) {
    if (video.videoWidth >= 64 && video.videoHeight >= 64 && Number.isFinite(video.duration) && video.duration > 0) setSizes(previous => ({ ...previous, [url]: { width: video.videoWidth, height: video.videoHeight, duration: video.duration } }));
  }
  const platform = workflowSelectedPlatforms(draft).map(value => SCHEDULE_PLATFORMS.find(option => option.value === value)?.label).filter(Boolean).join(" + ");
  return <section aria-label={editingPreview ? "Combined editing preview" : captionReview ? "Caption video preview" : "Post preview"} className={captionReview ? "flex h-full min-h-0 flex-col gap-3" : `${creation.editWorkspace} ${segments.length ? schedulePreview.workspace : ""}`}>
    {sourceUrl && !openingPreview && (!source?.width || !source?.height) ? <video key={`source:${sourceUrl}`} src={sourceUrl} preload="metadata" hidden aria-hidden="true" onLoadedMetadata={event => readSize(sourceUrl, event.currentTarget)} onError={() => setSizeErrors(previous => ({ ...previous, [sourceUrl]: true }))} /> : null}
    {demoUrl && !demoPreview && (!demoSource?.width || !demoSource?.height) ? <video key={`demo:${demoUrl}`} src={demoUrl} preload="metadata" hidden aria-hidden="true" onLoadedMetadata={event => readSize(demoUrl, event.currentTarget)} onError={() => setSizeErrors(previous => ({ ...previous, [demoUrl]: true }))} /> : null}
    <div><h2 className={creation.sectionTitle}>{editingPreview ? "Combined preview" : captionReview ? "Video preview" : showFinished ? "Prepared publishing video" : segments.length ? "Editing preview" : "Post preview"}</h2><p className={creation.sectionHelp}>{editingPreview ? "Your current clips, audio and subtitles. Changes appear here as you edit." : captionReview ? `${openingLabel}${secondary ? " → Demo" : ""}` : platform || "Choose a platform in Schedule."}</p></div>
    {onChangeSource ? <Button type="button" variant="ghost" className="self-end" onClick={onChangeSource}>Change video</Button> : null}
    {showFinished ? <WorkflowMediaPlayer asset={{ name: finishedVideo!.title, url: finishedVideo!.url, duration: finishedVideo!.durationSeconds, width: finishedVideo!.width, height: finishedVideo!.height }} kind="video" label="Scheduled finished video preview" /> : segments.length ? <>
      <WorkflowSequencePreview segments={segments} backgroundAudio={backgroundAudio} active={active} className={schedulePreview.sequence} playbackDisabledReason={disabledReason} onPlaybackStart={() => setWatched(sequenceKey)} showDescription={false}
        captions={options?.subtitles && captions && !disabledReason ? { transcript: captions, style: options.style, placement: options.placement ?? "bottom", corrections: options.corrections } : null} />
      <p role="status" className="text-xs leading-5 text-muted">{editingPreview ? "Play to check the complete video with your current settings." : captionReview ? "Play or scrub the video to check your words. Corrections appear in this preview." : <>{openingLabel}{secondary ? " → Demo" : ""} · Preview. {finishedVideo ? "Your publishing file is ready." : "Choose Prepare final video to save your publishing file."}{options?.subtitles ? captions ? " Captions are shown in this preview. Review the rendered style in your final file." : " Generate captions in Edit to preview and correct the words." : ""}</>}</p>
      {finishedVideo ? <Button type="button" variant="outline" className="self-center" onClick={() => setFinishedSelected(finishedVideo.id)}>View finished video</Button> : null}
    </> : <div data-workflow-empty-post className={creation.postEmpty}><Video className="size-6 text-muted" aria-hidden="true" /><h3 className="text-lg font-semibold">Your finished video will appear here.</h3><p className={creation.sectionHelp}>Apply edits to save a finished video before scheduling.</p></div>}
    {!segments.length ? <section aria-label="Post caption preview" className={creation.captionPreview}>
      <h3 className="text-sm font-medium">Post caption</h3>
      <p>{draft.caption || "Write a caption in Schedule to preview it here."}</p>
    </section> : null}
  </section>;
}
