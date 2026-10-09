"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FormatVideoTextFields, trimFormatVideoEdit } from "@/components/explore/format-video-text-fields";
import { Button } from "@/components/ui/button";
import { WorkflowFilePicker } from "@/components/explore/hook-workflow-media-controls";
import { WorkflowSavedAudioPicker } from "@/components/explore/workflow-saved-audio-picker";
import { useLocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";
import { DEFAULT_FINISHING_OPTIONS, useWorkflowFinishing } from "@/components/explore/use-workflow-finishing";
import { useAuth } from "@/contexts/auth-context";
import { fetchAIStudioMediaAsset } from "@/lib/ai-studio/media-client";
import { formatVideoFromAsset, type FormatVideoSource } from "@/lib/explore/format-video-source";
import { uploadAIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { ExploreFinishDraft } from "@/worker/src/lib/explore-finishing-contract";
import { formatTextLayout, formatTextOverlays, parseExploreFormatEdit, type ExploreFormatEdit } from "@/worker/src/lib/explore-format-edit";
import { prepareFormatEditForExport, readFormatEditDraft } from "@/lib/explore/format-edit-draft";
import { canReuseUnchangedHookSource } from "@/lib/explore/unchanged-hook-source";
import { isExploreUuid } from "@/worker/src/lib/explore-finishing-contract";
import styles from "@/components/explore/format-workspace.module.css";
import type { CSSProperties, ReactNode } from "react";

const field = "w-full rounded-lg border border-border bg-card-muted px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-focus";
const defaultEdit = (format: "hook" | "wall_text", duration: number): ExploreFormatEdit => ({ version: 1, format, trimStartMs: 0, trimEndMs: Math.round(duration * 1000), originalVolume: 1, musicVolume: .2, text: null });
export type FormatPreparationStatus = { busy: boolean; error: string | null; message: string };

export function FormatVideoEditor({ format, video, active, controlsTarget, resultsTarget, actionsTarget, enabled, onDirty, onSaved, onContinue, pendingSource = false, editingActive = true, onEdit, previewActions, prepareRequest = 0, onPreparationChange, onBackToPreview }: {
  format: "hook" | "wall_text"; video: FormatVideoSource; active: boolean; controlsTarget: HTMLElement | null; resultsTarget: HTMLElement | null; enabled: boolean;
  pendingSource?: boolean;
  onDirty: () => void; onSaved: (output: { id: string; kind: "media_asset"; url: string; title: string }) => void; onContinue: () => void;
  actionsTarget?: HTMLElement | null;
  editingActive?: boolean; onEdit?: () => void;
  previewActions?: ReactNode;
  prepareRequest?: number; onPreparationChange?: (status: FormatPreparationStatus) => void; onBackToPreview?: () => void;
}) {
  const { user } = useAuth();
  const owner = user?.uid ?? null;
  const draftKey = `ugc-explore:format-draft:v1:${owner}:${format}:${video.mediaAssetId ?? video.id}`;
  const [initialDraft] = useState(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(draftKey) : null;
      if (raw && raw.length < 65536) {
        const value = JSON.parse(raw);
        const editing = readFormatEditDraft(value.editing ?? value);
        if (editing.format === format) return { editing, backgroundId: isExploreUuid(value.backgroundId) ? value.backgroundId as string : null, playback: value.playback === "repeat" ? "repeat" as const : "once" as const, restored: true };
      }
    } catch { /* An invalid local draft cannot replace the server receipt. */ }
    return { editing: defaultEdit(format, video.durationSeconds ?? 5), backgroundId: null, playback: "once" as "once" | "repeat", restored: false };
  });
  const [editing, setEditing] = useState(initialDraft.editing);
  const localDraftExists = useRef(initialDraft.restored);
  const [duration, setDuration] = useState(video.durationSeconds ?? 5);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [time, setTime] = useState(0);
  const [backgroundId, setBackgroundId] = useState<string | null>(initialDraft.backgroundId);
  const [playback, setPlayback] = useState<"once" | "repeat">(initialDraft.playback);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const localAudio = useLocalWorkflowMedia("audio");
  const player = useRef<HTMLVideoElement | null>(null);
  const soundtrack = useRef<HTMLAudioElement | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const sourceQuery = useQuery({ queryKey: ["explore-edit-source", owner, video.mediaAssetId], enabled: Boolean(owner && video.mediaAssetId && enabled), queryFn: async () => {
    const token = await getCurrentUserIdToken(owner ?? undefined); if (!token || !video.mediaAssetId) throw new Error("Sign in to edit this saved video.");
    const asset = await fetchAIStudioMediaAsset(video.mediaAssetId, token);
    formatVideoFromAsset(asset);
    return asset;
  }});
  const backgroundQuery = useQuery({ queryKey: ["explore-edit-audio", owner, backgroundId], enabled: Boolean(owner && backgroundId), queryFn: async () => {
    const token = await getCurrentUserIdToken(owner ?? undefined); if (!token || !backgroundId) throw new Error("Sign in to load this audio.");
    const asset = await fetchAIStudioMediaAsset(backgroundId, token);
    if (asset.status !== "ready" || asset.collection !== "audio") throw new Error("Choose ready background audio.");
    return asset;
  }});
  const width = sourceQuery.data?.width ?? naturalSize?.width ?? video.width ?? 1080;
  const height = sourceQuery.data?.height ?? naturalSize?.height ?? video.height ?? (video.ratio === "16:9" ? 608 : video.ratio === "1:1" ? 1080 : video.ratio === "4:5" ? 1350 : 1920);
  const exportEditing = prepareFormatEditForExport(editing);
  const overlays = formatTextOverlays(exportEditing);
  const textLayouts = overlays.map(text => formatTextLayout(text, width, height));
  let validation: string | null = null;
  try { parseExploreFormatEdit(exportEditing); } catch (error) { validation = error instanceof Error ? error.message : "Review your edits."; }
  if (editing.trimEndMs > duration * 1000 + 50) validation = "Keep the trim range inside this video.";
  if (textLayouts.some(layout => !layout.fits)) validation = "Your text does not fit. Reduce its size or move it higher.";
  if (format === "wall_text" && !overlays.some(text => text.value.trim())) validation = "Add your wall of text before saving.";
  const restore = useCallback((draft: ExploreFinishDraft) => {
    if (localDraftExists.current || !draft.editing || draft.editing.format !== format || draft.sourceAssetId !== video.mediaAssetId) return;
    setEditing(draft.editing); setBackgroundId(draft.backgroundAssetId); setPlayback(draft.backgroundPlayback);
  }, [format, video.mediaAssetId]);
  const finishing = useWorkflowFinishing({ ownerId: owner, enabled, kind: "hook", source: sourceQuery.data ?? null, demo: null, demoAudio: null, playback: "once", options: DEFAULT_FINISHING_OPTIONS,
    editing: exportEditing, backgroundSource: backgroundQuery.data ?? null, backgroundPlayback: playback, scope: `format:${format}:${video.mediaAssetId}`, onRestoreDraft: restore,
    reuseUnchangedSource: canReuseUnchangedHookSource(sourceQuery.data ?? null, exportEditing, backgroundId),
    demoFramingError: validation ?? uploadError ?? (uploading ? "Uploading background audio…" : backgroundId && !backgroundQuery.data ? "Loading your background audio…" : null),
  });
  const preparationBusy = pendingSource || finishing.action.busy || Boolean(finishing.action.cancel);
  const preparationError = validation ?? finishing.action.error ?? (sourceQuery.isError ? "Could not load this video. Return to the editor and retry." : null);
  const preparationMessage = finishing.action.message;
  useEffect(() => { onPreparationChange?.({ busy: preparationBusy, error: preparationError, message: preparationMessage }); }, [onPreparationChange, preparationBusy, preparationError, preparationMessage]);
  const handledPrepareRequest = useRef(0);
  useEffect(() => {
    if (!prepareRequest || handledPrepareRequest.current === prepareRequest || pendingSource || finishing.output || finishing.action.disabled || !sourceQuery.data) return;
    handledPrepareRequest.current = prepareRequest;
    finishing.action.onAction();
  }, [prepareRequest, pendingSource, finishing.output, finishing.action, sourceQuery.data]);
  useEffect(() => {
    if (finishing.output) onSaved({ id: finishing.output.id, kind: "media_asset", url: finishing.output.url, title: finishing.output.title });
  }, [finishing.output, onSaved]);
  useEffect(() => {
    if (!active) { player.current?.pause(); soundtrack.current?.pause(); }
  }, [active]);

  function persistDraft(next: ExploreFormatEdit, audioId = backgroundId, mode = playback) {
    localDraftExists.current = true;
    try { localStorage.setItem(draftKey, JSON.stringify({ version: 1, editing: next, backgroundId: audioId, playback: mode })); } catch { /* No provider request is made by editing. */ }
  }
  function change(next: ExploreFormatEdit) {
    setEditing(next);
    if (JSON.stringify(prepareFormatEditForExport(next)) !== JSON.stringify(exportEditing)) onDirty();
    persistDraft(next);
  }
  function trim(startMs: number, endMs: number) {
    change(trimFormatVideoEdit(editing, startMs, endMs));
    setTime(0); soundtrack.current?.pause();
    if (player.current) player.current.currentTime = startMs / 1000;
  }
  async function chooseAudio(file: File) {
    if (!owner || uploading || pendingSource || !enabled) return false;
    setUploading(true); setUploadError(null); onDirty();
    persistDraft(editing);
    try {
      if (!await localAudio.choose(file, { maxDuration: 600 })) return false;
      const result = await uploadAIStudioReferenceMedia(file, "audio", 120, owner, { maxAudioDurationSeconds: 600, purpose: "explore-demo" });
      if (!alive.current) return false;
      setBackgroundId(result.asset.id); persistDraft(editing, result.asset.id); return true;
    } catch (error) { if (alive.current) setUploadError(error instanceof Error ? error.message : "Could not upload audio."); return false; }
    finally { if (alive.current) setUploading(false); }
  }
  const attachment = { ...localAudio, choose: chooseAudio, loading: uploading || localAudio.loading, remove: () => { localAudio.remove(); setBackgroundId(null); setUploadError(null); persistDraft(editing, null); onDirty(); } };
  const background = backgroundQuery.data;
  const previewAudioUrl = background?.url ?? localAudio.asset?.url;
  function synchronizeSound() {
    const audio = soundtrack.current, videoPlayer = player.current;
    if (!audio || !videoPlayer) return;
    audio.volume = editing.musicVolume;
    const length = audio.duration;
    const elapsed = Math.max(0, videoPlayer.currentTime - editing.trimStartMs / 1000);
    const expected = playback === "repeat" && Number.isFinite(length) && length > 0 ? elapsed % length : elapsed;
    if (Math.abs(audio.currentTime - expected) > .15 && Number.isFinite(expected)) audio.currentTime = expected;
    if (playback === "once" && Number.isFinite(length) && expected >= length) { audio.pause(); return; }
    if (!videoPlayer.paused) void audio.play().catch(() => {});
  }
  if (!active || !controlsTarget || !resultsTarget) return null;
  const actions = <div className="space-y-2">
    {validation || finishing.action.error ? <p role="alert" className="text-xs leading-5 text-destructive">{validation ?? finishing.action.error}</p> : null}
    <div className="flex flex-wrap items-center gap-2">{finishing.output ? <Button type="button" disabled={pendingSource} onClick={onContinue} className="h-10 rounded-lg px-4">Continue to Demo</Button> : <Button type="button" disabled={pendingSource || finishing.action.disabled || !sourceQuery.data} onClick={() => { if (!pendingSource) finishing.action.onAction(); }} className="h-10 min-w-28 rounded-lg px-4">{finishing.action.busy || finishing.action.cancel ? "Saving…" : "Save edits"}</Button>}{onBackToPreview ? <Button type="button" variant="outline" onClick={onBackToPreview} className="h-10 rounded-lg px-3"><ArrowLeft className="size-4" aria-hidden="true" />Back to previews</Button> : null}</div>
    <p role="status" className="text-xs leading-5 text-muted">{enabled ? finishing.output ? "Your final video is saved in Library." : finishing.action.message : "Video saving is unavailable in this preview."}</p>
    {sourceQuery.isError ? <p role="alert" className="text-xs text-destructive">Could not load this saved video. <button type="button" onClick={() => void sourceQuery.refetch()} className="rounded underline focus-visible:outline-2 focus-visible:outline-focus">Retry</button></p> : null}
    {finishing.action.cancel ? <Button type="button" variant="ghost" onClick={finishing.action.cancel}>Cancel save</Button> : null}
    {enabled && !finishing.output ? <Button type="button" size="sm" variant="ghost" onClick={finishing.action.refresh} disabled={finishing.action.busy}>Refresh save status</Button> : null}
  </div>;
  const controls = <div className="space-y-5 p-4">
    <div className="flex min-w-0 items-center justify-between gap-2"><p className="truncate text-xs text-muted" title={video.title}>{video.title}</p><span className="shrink-0 text-xs text-muted">{duration}s</span></div>
    <fieldset className="space-y-5" disabled={uploading || pendingSource}>
    <section className="space-y-3" aria-label="Trim"><h2 className="text-sm font-semibold">Trim</h2>
      <div className="grid grid-cols-2 gap-3"><label className="space-y-2 text-xs text-muted">Start (seconds)<input aria-label="Trim start" type="number" min={0} max={Math.max(0, editing.trimEndMs / 1000 - 1)} step={.1} value={editing.trimStartMs / 1000} onChange={event => trim(Math.round(Number(event.target.value) * 1000), editing.trimEndMs)} className={field} /></label><label className="space-y-2 text-xs text-muted">End (seconds)<input aria-label="Trim end" type="number" min={editing.trimStartMs / 1000 + 1} max={duration} step={.1} value={editing.trimEndMs / 1000} onChange={event => trim(editing.trimStartMs, Math.round(Number(event.target.value) * 1000))} className={field} /></label></div>
      <input aria-label="Trim start handle" type="range" min={0} max={Math.max(0, editing.trimEndMs - 1000)} step={100} value={editing.trimStartMs} onChange={event => trim(Number(event.target.value), editing.trimEndMs)} className="w-full accent-primary" />
      <input aria-label="Trim end handle" type="range" min={editing.trimStartMs + 1000} max={Math.round(duration * 1000)} step={100} value={editing.trimEndMs} onChange={event => trim(editing.trimStartMs, Number(event.target.value))} className="w-full accent-primary" />
      <p className="text-xs text-muted">Selected: {Math.max(0, editing.trimEndMs - editing.trimStartMs) / 1000}s</p>
    </section>
    <FormatVideoTextFields editing={editing} onChange={change} timeMs={time} onSeek={timeMs => { if (player.current) player.current.currentTime = (editing.trimStartMs + timeMs) / 1000; setTime(timeMs); }} />
    <details className={styles.demoOptions}><summary>Sound <span>{previewAudioUrl ? "Audio added" : `${Math.round(editing.originalVolume * 100)}% original`}</span></summary><section className="mt-3 space-y-3" aria-label="Audio">
      <label className="block space-y-2 text-xs text-muted">Original volume · {Math.round(editing.originalVolume * 100)}%<input aria-label="Original volume" type="range" min={0} max={100} value={editing.originalVolume * 100} onChange={event => change({ ...editing, originalVolume: Number(event.target.value) / 100 })} className="w-full accent-primary" /></label>
      <div className="flex flex-wrap gap-2"><WorkflowFilePicker attachment={attachment} kind="audio" label="Upload background audio" buttonLabel="Upload audio" disabled={!enabled} /><WorkflowSavedAudioPicker ownerId={owner} attachment={attachment} disabled={!enabled || uploading} /></div>
      {previewAudioUrl ? <><p className="break-words text-xs text-muted">{background?.title ?? localAudio.asset?.name}</p><Button type="button" size="sm" variant="ghost" onClick={attachment.remove}>Remove audio</Button><label className="block space-y-2 text-xs text-muted">Music volume · {Math.round(editing.musicVolume * 100)}%<input aria-label="Music volume" type="range" min={0} max={100} value={editing.musicVolume * 100} onChange={event => change({ ...editing, musicVolume: Number(event.target.value) / 100 })} className="w-full accent-primary" /></label><label className="block space-y-2 text-xs text-muted">Playback<select aria-label="Music playback" value={playback} onChange={event => { const mode = event.target.value as "once" | "repeat"; setPlayback(mode); persistDraft(editing, backgroundId, mode); onDirty(); }} className={field}><option value="once">Play once</option><option value="repeat">Repeat to fit</option></select></label></> : null}
    </section></details>
    </fieldset>
    {!actionsTarget ? actions : null}
  </div>;
  const clipLabel = format === "wall_text" ? "Wall-of-text video" : "Hook video";
  const preview = <section className="flex flex-col items-center gap-4" aria-label="Video edit preview"><h3 className="self-start text-sm font-semibold">{onEdit ? clipLabel : "Live preview"}</h3>
    <div data-clip-media className="relative max-h-[65dvh] w-full max-w-[min(420px,55dvh)] overflow-hidden rounded-xl bg-black" style={{ aspectRatio: `${width}/${height}`, "--clip-aspect": width / height } as CSSProperties}>
      <video ref={player} src={sourceQuery.data?.url ?? video.url} playsInline controls preload="metadata" className="size-full object-contain" onLoadedMetadata={event => {
        const d = event.currentTarget.duration;
        const { videoWidth, videoHeight } = event.currentTarget;
        if (videoWidth > 0 && videoHeight > 0) setNaturalSize({ width: videoWidth, height: videoHeight });
        if (Number.isFinite(d) && d >= 1) { setDuration(d); if (!localDraftExists.current && !video.durationSeconds && editing.trimEndMs === 5000) setEditing(current => ({ ...current, trimEndMs: Math.round(d * 1000) })); }
        event.currentTarget.volume = editing.originalVolume;
        if (Number.isFinite(d) && d >= 1) event.currentTarget.currentTime = Math.min(editing.trimStartMs / 1000, d - .001);
        setTime(0);
      }} onPlay={event => { event.currentTarget.volume = editing.originalVolume; if (event.currentTarget.currentTime < editing.trimStartMs / 1000 || event.currentTarget.currentTime >= editing.trimEndMs / 1000) event.currentTarget.currentTime = editing.trimStartMs / 1000; synchronizeSound(); }} onPause={() => soundtrack.current?.pause()} onSeeked={synchronizeSound} onTimeUpdate={event => {
        event.currentTarget.volume = editing.originalVolume;
        setTime(event.currentTarget.currentTime * 1000 - editing.trimStartMs);
        if (event.currentTarget.currentTime * 1000 >= editing.trimEndMs) { event.currentTarget.pause(); event.currentTarget.currentTime = editing.trimStartMs / 1000; }
        synchronizeSound();
      }} />
      {overlays.map((text, overlayIndex) => { const layout = textLayouts[overlayIndex]; return time >= text.startMs && time < text.endMs ? <svg key={overlayIndex} aria-label={`Text overlay ${overlayIndex + 1} preview`} viewBox={`0 0 ${width} ${height}`} className="pointer-events-none absolute inset-0 size-full"><g fill={text.color} stroke="black" strokeWidth={width / 540} paintOrder="stroke" fontFamily="Arial, sans-serif" fontWeight={700} fontSize={layout.fontSize} textAnchor="middle">{layout.lines.map((line, index) => <text key={index} x={width / 2} y={layout.y + index * layout.lineHeight + layout.fontSize}>{line}</text>)}</g></svg> : null; })}
    </div>
    {previewAudioUrl ? <audio ref={soundtrack} src={previewAudioUrl} loop={playback === "repeat"} preload="metadata" aria-label="Background audio preview" /> : null}
    {!editingActive && onEdit ? <><p className="max-w-full truncate text-xs text-muted" title={video.title}>{video.title}</p><div className={styles.clipCardActions}><Button type="button" variant="outline" data-edit-clip="opening" disabled={pendingSource || uploading} onClick={onEdit}>Edit {format === "wall_text" ? "wall-of-text video" : "hook video"}</Button>{previewActions}</div></> : <p className="max-w-md text-center text-xs leading-5 text-muted">Trim, text and sound apply to this video only.</p>}
    {editingActive && finishing.output ? <div className="w-full max-w-sm space-y-2"><h3 className="text-sm font-medium">Saved video</h3><video src={finishing.output.url} controls playsInline className="max-h-80 w-full rounded-xl" /></div> : null}
  </section>;
  return <>{editingActive ? createPortal(controls, controlsTarget) : null}{createPortal(preview, resultsTarget)}{actionsTarget ? createPortal(actions, actionsTarget) : null}</>;
}
