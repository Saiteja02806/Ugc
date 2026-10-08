"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { formatTextLayout, parseExploreFormatEdit, type ExploreFormatEdit } from "@/worker/src/lib/explore-format-edit";
import { isExploreUuid } from "@/worker/src/lib/explore-finishing-contract";

const field = "w-full rounded-lg border border-border bg-card-muted px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-focus";
const defaultEdit = (format: "hook" | "wall_text", duration: number): ExploreFormatEdit => ({ version: 1, format, trimStartMs: 0, trimEndMs: Math.round(duration * 1000), originalVolume: 1, musicVolume: .2, text: null });

export function FormatVideoEditor({ format, video, active, controlsTarget, resultsTarget, actionsTarget, enabled, onDirty, onSaved, onContinue }: {
  format: "hook" | "wall_text"; video: FormatVideoSource; active: boolean; controlsTarget: HTMLElement | null; resultsTarget: HTMLElement | null; enabled: boolean;
  onDirty: () => void; onSaved: (output: { id: string; kind: "media_asset"; url: string; title: string }) => void; onContinue: () => void;
  actionsTarget?: HTMLElement | null;
}) {
  const { user } = useAuth();
  const owner = user?.uid ?? null;
  const draftKey = `ugc-explore:format-draft:v1:${owner}:${format}:${video.mediaAssetId ?? video.id}`;
  const [initialDraft] = useState(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(draftKey) : null;
      if (raw && raw.length < 16384) {
        const value = JSON.parse(raw);
        const editing = parseExploreFormatEdit(value.editing ?? value);
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
  const textLayout = editing.text ? formatTextLayout(editing.text, width, height) : null;
  let validation: string | null = null;
  try { parseExploreFormatEdit(editing); } catch (error) { validation = error instanceof Error ? error.message : "Review your edits."; }
  if (editing.trimEndMs > duration * 1000 + 50) validation = "Keep the trim range inside this video.";
  if (textLayout && !textLayout.fits) validation = "Your text does not fit. Reduce its size or move it higher.";
  if (format === "wall_text" && !editing.text?.value.trim()) validation = "Add your wall of text before saving.";
  const restore = useCallback((draft: ExploreFinishDraft) => {
    if (localDraftExists.current || !draft.editing || draft.editing.format !== format || draft.sourceAssetId !== video.mediaAssetId) return;
    setEditing(draft.editing); setBackgroundId(draft.backgroundAssetId); setPlayback(draft.backgroundPlayback);
  }, [format, video.mediaAssetId]);
  const finishing = useWorkflowFinishing({ ownerId: owner, enabled, kind: "hook", source: sourceQuery.data ?? null, demo: null, demoAudio: null, playback: "once", options: DEFAULT_FINISHING_OPTIONS,
    editing, backgroundSource: backgroundQuery.data ?? null, backgroundPlayback: playback, scope: `format:${format}:${video.mediaAssetId}`, onRestoreDraft: restore,
    demoFramingError: validation ?? uploadError ?? (uploading ? "Uploading background audio…" : backgroundId && !backgroundQuery.data ? "Loading your background audio…" : null),
  });
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
    setEditing(next); onDirty();
    persistDraft(next);
  }
  function trim(startMs: number, endMs: number) {
    const length = endMs - startMs;
    change({ ...editing, trimStartMs: startMs, trimEndMs: endMs, text: editing.text ? { ...editing.text, startMs: Math.min(editing.text.startMs, Math.max(0, length - 1)), endMs: Math.min(editing.text.endMs, length) } : null });
    if (player.current) player.current.currentTime = startMs / 1000;
  }
  function updateText(value: string) {
    change({ ...editing, text: value ? { ...(editing.text ?? { width: .8, y: .18, fontSize: 48, color: "#ffffff", startMs: 0, endMs: editing.trimEndMs - editing.trimStartMs }), value } : null });
  }
  async function chooseAudio(file: File) {
    if (!owner || uploading || !enabled) return false;
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
    const expected = playback === "repeat" && Number.isFinite(length) && length > 0 ? videoPlayer.currentTime % length : videoPlayer.currentTime;
    if (Math.abs(audio.currentTime - expected) > .15 && Number.isFinite(expected)) audio.currentTime = expected;
    if (playback === "once" && Number.isFinite(length) && expected >= length) { audio.pause(); return; }
    if (!videoPlayer.paused) void audio.play().catch(() => {});
  }
  if (!active || !controlsTarget || !resultsTarget) return null;
  const actions = <div className="space-y-2">
    {validation || finishing.action.error ? <p role="alert" className="text-xs leading-5 text-destructive">{validation ?? finishing.action.error}</p> : null}
    {finishing.output ? <Button type="button" size="lg" onClick={onContinue} className="h-11 w-full rounded-lg">Continue to Schedule</Button> : <Button type="button" size="lg" disabled={finishing.action.disabled || !sourceQuery.data} onClick={finishing.action.onAction} className="h-11 w-full rounded-lg">{finishing.action.busy ? "Saving…" : "Save edits"}</Button>}
    <p role="status" className="text-xs leading-5 text-muted">{enabled ? finishing.output ? "Your final video is saved in Library." : finishing.action.message : "Video saving is unavailable in this preview."}</p>
    {sourceQuery.isError ? <p role="alert" className="text-xs text-destructive">Could not load this saved video. <button type="button" onClick={() => void sourceQuery.refetch()} className="rounded underline focus-visible:outline-2 focus-visible:outline-focus">Retry</button></p> : null}
    {finishing.action.cancel ? <Button type="button" variant="ghost" onClick={finishing.action.cancel}>Cancel save</Button> : null}
    {enabled && !finishing.output ? <Button type="button" size="sm" variant="ghost" onClick={finishing.action.refresh} disabled={finishing.action.busy}>Refresh save status</Button> : null}
  </div>;
  const controls = <div className="space-y-5 p-4">
    <div className="flex min-w-0 items-center justify-between gap-2"><p className="truncate text-xs text-muted" title={video.title}>{video.title}</p><span className="shrink-0 text-xs text-muted">{duration}s</span></div>
    <fieldset className="space-y-5" disabled={uploading}>
    <section className="space-y-3" aria-label="Trim"><h2 className="text-sm font-semibold">Trim</h2>
      <div className="grid grid-cols-2 gap-3"><label className="space-y-2 text-xs text-muted">Start (seconds)<input aria-label="Trim start" type="number" min={0} max={Math.max(0, editing.trimEndMs / 1000 - 1)} step={.1} value={editing.trimStartMs / 1000} onChange={event => trim(Math.round(Number(event.target.value) * 1000), editing.trimEndMs)} className={field} /></label><label className="space-y-2 text-xs text-muted">End (seconds)<input aria-label="Trim end" type="number" min={editing.trimStartMs / 1000 + 1} max={duration} step={.1} value={editing.trimEndMs / 1000} onChange={event => trim(editing.trimStartMs, Math.round(Number(event.target.value) * 1000))} className={field} /></label></div>
      <input aria-label="Trim start handle" type="range" min={0} max={Math.max(0, editing.trimEndMs - 1000)} step={100} value={editing.trimStartMs} onChange={event => trim(Number(event.target.value), editing.trimEndMs)} className="w-full accent-primary" />
      <input aria-label="Trim end handle" type="range" min={editing.trimStartMs + 1000} max={Math.round(duration * 1000)} step={100} value={editing.trimEndMs} onChange={event => trim(editing.trimStartMs, Number(event.target.value))} className="w-full accent-primary" />
      <p className="text-xs text-muted">Selected: {Math.max(0, editing.trimEndMs - editing.trimStartMs) / 1000}s</p>
    </section>
    <section className="space-y-3" aria-label="Text"><h2 className="text-sm font-semibold">{format === "wall_text" ? "Your wall of text" : "Text overlay"}</h2>
      <textarea aria-label={format === "wall_text" ? "Wall of text" : "Overlay text"} value={editing.text?.value ?? ""} onChange={event => updateText(event.target.value)} rows={6} maxLength={600} placeholder={format === "wall_text" ? "Write your message. Keep your line breaks and paragraphs…" : "Add an optional heading…"} className={field} />
      {editing.text ? <><div className="grid grid-cols-2 gap-3"><label className="space-y-2 text-xs text-muted">Position<select aria-label="Text position" value={editing.text.y} onChange={event => change({ ...editing, text: { ...editing.text!, y: Number(event.target.value) } })} className={field}><option value={.1}>Top</option><option value={.3}>Middle</option><option value={.55}>Lower</option><option value={.18}>Default</option></select></label><label className="space-y-2 text-xs text-muted">Color<input type="color" aria-label="Text color" value={editing.text.color} onChange={event => change({ ...editing, text: { ...editing.text!, color: event.target.value } })} className={field} /></label></div>
      <label className="block space-y-2 text-xs text-muted">Width · {Math.round(editing.text.width * 100)}%<input type="range" aria-label="Text width" min={40} max={94} value={editing.text.width * 100} onChange={event => change({ ...editing, text: { ...editing.text!, width: Number(event.target.value) / 100 } })} className="w-full accent-primary" /></label>
      <label className="block space-y-2 text-xs text-muted">Text size · {editing.text.fontSize}<input type="range" aria-label="Text size" min={24} max={84} value={editing.text.fontSize} onChange={event => change({ ...editing, text: { ...editing.text!, fontSize: Number(event.target.value) } })} className="w-full accent-primary" /></label>
      <div className="grid grid-cols-2 gap-3"><label className="space-y-2 text-xs text-muted">Show from (s)<input type="number" aria-label="Text start time" min={0} step={.1} value={editing.text.startMs / 1000} onChange={event => change({ ...editing, text: { ...editing.text!, startMs: Math.round(Number(event.target.value) * 1000) } })} className={field} /></label><label className="space-y-2 text-xs text-muted">Until (s)<input type="number" aria-label="Text end time" min={.1} max={(editing.trimEndMs - editing.trimStartMs) / 1000} step={.1} value={editing.text.endMs / 1000} onChange={event => change({ ...editing, text: { ...editing.text!, endMs: Math.round(Number(event.target.value) * 1000) } })} className={field} /></label></div></> : null}
      <p className="text-xs leading-5 text-muted">This overlay stays editable. Text already inside the original video is part of the footage.</p>
    </section>
    <section className="space-y-3" aria-label="Audio"><h2 className="text-sm font-semibold">Audio</h2>
      <label className="block space-y-2 text-xs text-muted">Original volume · {Math.round(editing.originalVolume * 100)}%<input aria-label="Original volume" type="range" min={0} max={100} value={editing.originalVolume * 100} onChange={event => change({ ...editing, originalVolume: Number(event.target.value) / 100 })} className="w-full accent-primary" /></label>
      <div className="flex flex-wrap gap-2"><WorkflowFilePicker attachment={attachment} kind="audio" label="Upload background audio" buttonLabel="Upload audio" disabled={!enabled} /><WorkflowSavedAudioPicker ownerId={owner} attachment={attachment} disabled={!enabled || uploading} /></div>
      {previewAudioUrl ? <><p className="break-words text-xs text-muted">{background?.title ?? localAudio.asset?.name}</p><Button type="button" size="sm" variant="ghost" onClick={attachment.remove}>Remove audio</Button><label className="block space-y-2 text-xs text-muted">Music volume · {Math.round(editing.musicVolume * 100)}%<input aria-label="Music volume" type="range" min={0} max={100} value={editing.musicVolume * 100} onChange={event => change({ ...editing, musicVolume: Number(event.target.value) / 100 })} className="w-full accent-primary" /></label><label className="block space-y-2 text-xs text-muted">Playback<select aria-label="Music playback" value={playback} onChange={event => { const mode = event.target.value as "once" | "repeat"; setPlayback(mode); persistDraft(editing, backgroundId, mode); onDirty(); }} className={field}><option value="once">Play once</option><option value="repeat">Repeat to fit</option></select></label></> : null}
    </section>
    </fieldset>
    {!actionsTarget ? actions : null}
  </div>;
  const preview = <section className="flex flex-col items-center gap-4" aria-label="Video edit preview"><h2 className="self-start text-base font-semibold">Live preview</h2>
    <div className="relative max-h-[65dvh] w-full max-w-[min(420px,55dvh)] overflow-hidden rounded-xl bg-black" style={{ aspectRatio: `${width}/${height}` }}>
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
      {editing.text && textLayout && time >= editing.text.startMs && time < editing.text.endMs ? <svg aria-label="Text overlay preview" viewBox={`0 0 ${width} ${height}`} className="pointer-events-none absolute inset-0 size-full"><g fill={editing.text.color} stroke="black" strokeWidth={width / 540} paintOrder="stroke" fontFamily="Arial, sans-serif" fontWeight={700} fontSize={textLayout.fontSize} textAnchor="middle">{textLayout.lines.map((line, index) => <text key={index} x={width / 2} y={textLayout.y + index * textLayout.lineHeight + textLayout.fontSize}>{line}</text>)}</g></svg> : null}
    </div>
    {previewAudioUrl ? <audio ref={soundtrack} src={previewAudioUrl} loop={playback === "repeat"} preload="metadata" aria-label="Background audio preview" /> : null}
    <p className="max-w-md text-center text-xs leading-5 text-muted">Save edits to create your final video in Library.</p>
    {finishing.output ? <div className="w-full max-w-sm space-y-2"><h3 className="text-sm font-medium">Saved final video</h3><video src={finishing.output.url} controls playsInline className="max-h-80 w-full rounded-xl" /></div> : null}
  </section>;
  return <>{createPortal(controls, controlsTarget)}{createPortal(preview, resultsTarget)}{actionsTarget ? createPortal(actions, actionsTarget) : null}</>;
}
