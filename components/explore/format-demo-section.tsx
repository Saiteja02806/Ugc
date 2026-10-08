"use client";
import { useQuery } from "@tanstack/react-query";
import { FolderOpen, Play, Upload, Video } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { WorkflowFilePicker, WorkflowMediaPlayer } from "@/components/explore/hook-workflow-media-controls";
import { WorkflowVideoAssetPicker } from "@/components/explore/workflow-video-asset-picker";
import { WorkflowDemoControls } from "@/components/explore/workflow-demo-controls";
import { WorkflowSavedAudioPicker } from "@/components/explore/workflow-saved-audio-picker";
import { useLocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";
import { useWorkflowSourceVideo } from "@/components/explore/use-workflow-source-video";
import { DEFAULT_FINISHING_OPTIONS, useWorkflowFinishing } from "@/components/explore/use-workflow-finishing";
import creation from "@/components/explore/workflow-creation.module.css";
import { useAuth } from "@/contexts/auth-context";
import { fetchAIStudioMediaAsset } from "@/lib/ai-studio/media-client";
import { uploadAIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { defaultDemoEdit, readFormatDemoDraft, trimmedDemoFraming, type FormatDemoDraft } from "@/lib/explore/format-demo";
import { formatVideoFromAsset } from "@/lib/explore/format-video-source";
import type { MediaAsset } from "@/lib/media/types";
import { parseExploreFormatEdit } from "@/worker/src/lib/explore-format-edit";
type VideoOutput = {
    id: string;
    kind: "media_asset";
    url: string;
    title: string;
};
type DemoSave = {
    opening: MediaAsset;
    openingRevision: number;
    demo: MediaAsset;
    audio: MediaAsset | null;
    draft: FormatDemoDraft;
};
const field = "w-full rounded-lg border border-border bg-card-muted px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-focus";
/** The demo uses existing owned-media edit and concatenation contracts. The
 * opening is already saved, so its text/audio cannot bleed into the demo. */
export function FormatDemoSection({ format, videoId, opening, openingRevision, enabled, active, controlsTarget, actionsTarget, resultsTarget, onDirty, onSelectionChange, onSaved, onSkip, onContinue, localPreview = false, previewAssets }: {
    format: "hook" | "wall_text";
    videoId: string | null;
    opening: VideoOutput | null;
    openingRevision: number;
    enabled: boolean;
    active: boolean;
    controlsTarget: HTMLElement | null;
    actionsTarget: HTMLElement | null;
    resultsTarget: HTMLElement | null;
    onDirty: () => void;
    onSelectionChange: (present: boolean) => void;
    onSaved: (output: VideoOutput) => void;
    onSkip: () => void;
    onContinue: () => void;
    localPreview?: boolean;
    previewAssets?: MediaAsset[];
}) {
    const { user } = useAuth();
    const owner = user?.uid ?? null;
    // The demo belongs to the workflow, even when the opening is not chosen
    // yet. Opening changes invalidate the final save, not the user's demo.
    const key = `ugc-explore:demo:${localPreview ? "preview:" : ""}v2:${owner}:${format}`;
    const [initial] = useState(() => { try {
        return typeof window === "undefined" ? null : readFormatDemoDraft(localStorage.getItem(key));
    }
    catch {
        return null;
    } });
    const [draft, setDraft] = useState<FormatDemoDraft>(initial ?? { version: 1, demoId: null, audioId: null, editing: defaultDemoEdit(5), framing: null, playback: "once" });
    const [assetsOpen, setAssetsOpen] = useState(false), [previewOpen, setPreviewOpen] = useState(false);
    const [uploadingAudio, setUploadingAudio] = useState(false), [audioError, setAudioError] = useState<string | null>(null);
    const [selectionChanged, setSelectionChanged] = useState(false);
    const [legacyChecked, setLegacyChecked] = useState<string | null>(null);
    const [save, setSave] = useState<DemoSave | null>(null), [saveBusy, setSaveBusy] = useState(false);
    const [final, setFinal] = useState<VideoOutput | null>(null);
    const [naturalDuration, setNaturalDuration] = useState(0);
    // Migrate an older opening-scoped draft once its opening becomes known.
    // Never replace a workflow draft or a selection already made this session.
    if (!localPreview && owner && videoId && legacyChecked !== videoId) {
        setLegacyChecked(videoId);
        if (!initial && !selectionChanged) {
            try {
                const stored = localStorage.getItem(key);
                const legacy = !stored ? readFormatDemoDraft(localStorage.getItem(`ugc-explore:demo:v1:${owner}:${format}:${videoId}`)) : null;
                if (legacy) setDraft(legacy);
            } catch { /* An unavailable local draft never prevents adding a demo. */ }
        }
    }
    useEffect(() => {
        if (owner && draft.demoId && !selectionChanged) {
            try { localStorage.setItem(key, JSON.stringify(draft)); } catch { /* Restored assets still require owned reads. */ }
        }
    }, [owner, key, draft, selectionChanged]);
    const alive = useRef(true), fileInput = useRef<HTMLInputElement>(null), previewPlayer = useRef<HTMLVideoElement>(null);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    useEffect(() => { if (!active)
        previewPlayer.current?.pause(); }, [active]);
    const selection = useWorkflowSourceVideo({ enabled, ownerId: owner, initialMode: "upload", minDuration: 1, onSelected: (asset, preview) => {
            const next: FormatDemoDraft = { version: 1, demoId: asset?.id ?? null, audioId: null, editing: defaultDemoEdit(preview.duration ?? 5), framing: null, playback: "once" };
            setDraft(next);
            setNaturalDuration(0);
            audio.remove();
            setAudioError(null);
            try {
                localStorage.setItem(key, JSON.stringify(next));
            }
            catch { /* Selecting media does not dispatch a render. */ }
        } });
    const audio = useLocalWorkflowMedia("audio");
    const loadAsset = async (id: string, kind: "video" | "audio") => {
        const token = await getCurrentUserIdToken(owner ?? undefined);
        if (!token)
            throw new Error("Sign in to restore your demo.");
        const asset = await fetchAIStudioMediaAsset(id, token);
        if (kind === "video")
            formatVideoFromAsset(asset);
        else if (asset.status !== "ready" || asset.collection !== "audio")
            throw new Error("Choose ready demo audio.");
        return asset;
    };
    const openingQuery = useQuery({ queryKey: ["format-demo-opening", owner, opening?.id], enabled: enabled && !!owner && !!opening, queryFn: () => loadAsset(opening!.id, "video") });
    const demoQuery = useQuery({ queryKey: ["format-demo-restore", owner, draft.demoId], enabled: enabled && !!owner && !!draft.demoId && !selectionChanged, queryFn: () => loadAsset(draft.demoId!, "video") });
    const audioQuery = useQuery({ queryKey: ["format-demo-audio", owner, draft.audioId], enabled: enabled && !!owner && !!draft.audioId, queryFn: () => loadAsset(draft.audioId!, "audio") });
    const demo = selection.source ?? (!selectionChanged ? demoQuery.data : null);
    const preview = selection.preview ?? (demo ? { name: demo.title, url: demo.url, duration: demo.durationSeconds } : null);
    const activeSave = save && opening?.id === save.opening.id && openingRevision === save.openingRevision ? save : null;
    const currentFinal = activeSave ? final : null;
    const saveContext = useRef<DemoSave | null>(activeSave);
    useLayoutEffect(() => { saveContext.current = activeSave; }, [activeSave]);
    const hasDemo = Boolean(preview || draft.demoId || selection.busy);
    useEffect(() => { onSelectionChange(hasDemo); }, [hasDemo, onSelectionChange]);
    const busy = Boolean(activeSave && saveBusy) || selection.busy || uploadingAudio;
    const duration = preview?.duration ?? naturalDuration;
    let validation: string | null = null;
    try {
        parseExploreFormatEdit(draft.editing);
        if (draft.editing.trimEndMs > duration * 1000 + 50)
            validation = "Keep the trim range inside your demo.";
    }
    catch (error) {
        validation = error instanceof Error ? error.message : "Review your demo trim.";
    }
    const openingAsset = openingQuery.data;
    if (!validation && draft.framing && demo?.width && demo.height && openingAsset?.width && openingAsset.height &&
        Math.abs((demo.width * draft.framing.width) / (demo.height * draft.framing.height) / (openingAsset.width / openingAsset.height) - 1) > .015) {
        validation = "Reframe your demo to match the opening, or reset framing to fit the full clip.";
    }
    const ready = !!openingQuery.data && !!demo && !selection.busy && !selection.error && !validation && !audioError && !uploadingAudio && (!draft.audioId || !!audioQuery.data);
    function change(next: FormatDemoDraft) { setDraft(next); setSave(null); setSaveBusy(false); setFinal(null); onDirty(); try {
        localStorage.setItem(key, JSON.stringify(next));
    }
    catch { /* Saving verifies its durable receipt independently. */ } }
    const prepareSelection = () => { setSelectionChanged(true); setSave(null); setSaveBusy(false); setFinal(null); onDirty(); };
    async function chooseVideo(file: File) {
        if (busy)
            return;
        prepareSelection();
        selection.setMode("upload");
        await selection.chooseUpload(file);
    }
    async function chooseAudio(file: File) {
        if (busy || !demo && !preview)
            return false;
        setUploadingAudio(true);
        setAudioError(null);
        setFinal(null);
        onDirty();
        try {
            if (!await audio.choose(file, { maxDuration: 600 }))
                return false;
            if (!enabled || !owner)
                return true;
            const uploaded = await uploadAIStudioReferenceMedia(file, "audio", 120, owner, { maxAudioDurationSeconds: 600, purpose: "explore-demo" });
            if (!alive.current)
                return false;
            change({ ...draft, audioId: uploaded.asset.id });
            return true;
        }
        catch (error) {
            if (alive.current)
                setAudioError(error instanceof Error ? error.message : "Could not upload demo audio.");
            return false;
        }
        finally {
            if (alive.current)
                setUploadingAudio(false);
        }
    }
    const audioAttachment = { ...audio, choose: chooseAudio, loading: uploadingAudio || audio.loading, remove: () => { audio.remove(); setAudioError(null); change({ ...draft, audioId: null, playback: "once" }); } };
    const saved = useCallback((output: VideoOutput) => {
        if (activeSave && saveContext.current === activeSave) { setFinal(output); onSaved(output); }
    }, [activeSave, onSaved]);
    const reportSaveBusy = useCallback((next: boolean) => {
        if (activeSave && saveContext.current === activeSave) setSaveBusy(next);
    }, [activeSave]);
    const removeDemo = () => { if (!busy) {
        setSave(null);
        setFinal(null);
        setSelectionChanged(true);
        selection.clearSelection();
        audio.remove();
        setAudioError(null);
        setNaturalDuration(0);
        change({ version: 1, demoId: null, audioId: null, editing: defaultDemoEdit(5), framing: null, playback: "once" });
    } };
    const skip = () => { if (!busy) {
        removeDemo();
        onSkip();
    } };
    const controls = <div className="space-y-4">
    <div><h2 className="text-sm font-semibold">Demo <span className="ml-1 text-xs font-normal text-muted">Optional</span></h2><p className="mt-1 text-xs leading-5 text-muted">Add a walkthrough after your {format === "wall_text" ? "wall-of-text video" : "hook"}.</p></div>
    <fieldset disabled={busy} className="space-y-4">
      <div className={creation.demoSourceCards}>
        {preview ? <Button type="button" variant="outline" className={creation.editUploadButton} onClick={() => setPreviewOpen(true)}><Play className="size-5" aria-hidden="true"/>Preview demo</Button> : <Button type="button" variant="outline" className={creation.editUploadButton} onClick={() => fileInput.current?.click()}><Upload className="size-5" aria-hidden="true"/>Upload demo</Button>}
        <Button type="button" variant="outline" className={creation.editUploadButton} onClick={() => setAssetsOpen(true)}><FolderOpen className="size-5" aria-hidden="true"/>Creative Assets</Button>
        <input ref={fileInput} type="file" accept="video/mp4,video/quicktime,video/webm" className="sr-only" aria-label="Upload demo video" onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file)
        void chooseVideo(file); }}/>
      </div>
      {preview ? <><div className="flex flex-wrap items-center gap-2"><p className="min-w-0 flex-1 truncate text-xs text-muted" title={preview.name}>{preview.name}</p><Button type="button" size="sm" variant="ghost" onClick={() => fileInput.current?.click()}>Replace</Button><Button type="button" size="sm" variant="ghost" onClick={removeDemo}>Remove</Button></div>
        <section className="space-y-3" aria-label="Demo trim"><h3 className="text-sm font-semibold">Trim demo</h3><div className="grid grid-cols-2 gap-3">{(["trimStartMs", "trimEndMs"] as const).map((name, index) => <label key={name} className="space-y-2 text-xs text-muted">{index === 0 ? "Start" : "End"} (seconds)<input type="number" aria-label={index === 0 ? "Demo trim start" : "Demo trim end"} min={0} max={duration} step={.1} value={draft.editing[name] / 1000} className={field} onChange={event => change({ ...draft, editing: { ...draft.editing, [name]: Math.round(Number(event.target.value) * 1000) } })}/></label>)}</div><p className="text-xs text-muted">Selected: {Math.max(0, draft.editing.trimEndMs - draft.editing.trimStartMs) / 1000}s</p></section>
        <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-sm font-medium">Framing & audio</summary><div className="mt-4 space-y-4">
          <p className="text-xs leading-5 text-muted">The full demo fits by default. Use Demo controls to crop, zoom or record a pan.</p><WorkflowDemoControls asset={preview} value={draft.framing} onChange={framing => change({ ...draft, framing })} outputAspect={openingQuery.data?.width && openingQuery.data.height ? openingQuery.data.width / openingQuery.data.height : 9 / 16} disabled={busy}/>
          <label className="block space-y-2 text-xs text-muted">Original sound · {Math.round(draft.editing.originalVolume * 100)}%<input type="range" aria-label="Demo original volume" min={0} max={100} value={draft.editing.originalVolume * 100} onChange={event => change({ ...draft, editing: { ...draft.editing, originalVolume: Number(event.target.value) / 100 } })} className="w-full accent-primary"/></label>
          <div className="flex flex-wrap gap-2"><WorkflowFilePicker attachment={audioAttachment} kind="audio" label="Upload demo audio" buttonLabel="Upload audio" disabled={busy}/><WorkflowSavedAudioPicker ownerId={owner} attachment={audioAttachment} disabled={busy || !enabled}/></div>
          {draft.audioId || audio.asset ? <><p className="break-words text-xs text-muted">{audioQuery.data?.title ?? audio.asset?.name}</p><Button type="button" size="sm" variant="ghost" onClick={audioAttachment.remove}>Remove audio</Button><label className="block space-y-2 text-xs text-muted">Added audio · {Math.round(draft.editing.musicVolume * 100)}%<input type="range" aria-label="Demo added audio volume" min={0} max={100} value={draft.editing.musicVolume * 100} className="w-full accent-primary" onChange={event => change({ ...draft, editing: { ...draft.editing, musicVolume: Number(event.target.value) / 100 } })}/></label><label className="block space-y-2 text-xs text-muted">Playback<select aria-label="Demo audio playback" value={draft.playback} className={field} onChange={event => change({ ...draft, playback: event.target.value as "once" | "repeat" })}><option value="once">Play once</option><option value="repeat">Repeat to fit demo</option></select></label><p className="text-xs leading-5 text-muted">Added audio plays during the demo only.</p></> : null}
        </div></details>
      </> : <p className="text-xs leading-5 text-muted">MP4, MOV or WebM · 1–120 seconds · Up to 250 MB.</p>}
    </fieldset>
    {selection.error || audioError || audio.error || preview && validation ? <p role="alert" className="text-xs text-destructive">{selection.error ?? audioError ?? audio.error ?? validation}</p> : null}
    {demoQuery.isError || audioQuery.isError || openingQuery.isError ? <p role="alert" className="text-xs text-destructive">Could not restore a saved clip or audio. <button type="button" className="underline" onClick={() => { void openingQuery.refetch(); void demoQuery.refetch(); void audioQuery.refetch(); }}>Retry</button></p> : null}
    {!opening ? <p className="text-xs leading-5 text-muted">You can add your demo now. Save your {format === "wall_text" ? "wall-of-text video" : "hook"} in Edit video when you’re ready to combine them.</p> : null}
    {preview && draft.framing ? <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => change({ ...draft, framing: null })}>Reset demo framing</Button> : null}
  </div>;
    const actions = <div className="space-y-2">{activeSave ? <DemoSaveRun key={JSON.stringify([activeSave.opening.id, activeSave.openingRevision, activeSave.demo.id, activeSave.draft])} save={activeSave} ownerId={owner} format={format} enabled={enabled} onBusy={reportSaveBusy} onSaved={saved} onContinue={onContinue}/> : <><Button type="button" className="h-11 w-full rounded-lg" disabled={!enabled || !ready} onClick={() => { if (ready) {
        setSaveBusy(true);
        setFinal(null);
        setSave({ opening: openingQuery.data!, openingRevision, demo: demo!, audio: audioQuery.data ?? null, draft: { ...draft, demoId: demo!.id } });
    } }}>Save final video</Button><p className="text-xs leading-5 text-muted">{!enabled ? "Preview · video saving disabled" : selection.busy ? "Uploading your demo…" : ready ? "Save to join the opening and demo into one video." : !opening ? "Add your demo here. Saving the combined video requires a saved opening." : validation && preview ? validation : "Upload or choose a demo to continue."}</p></>}
    {opening ? <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={skip}>Continue without demo</Button> : null}
  </div>;
    const results = <section className="mx-auto w-full max-w-3xl space-y-5 p-4 sm:p-6" aria-label="Opening and demo preview"><h2 className="text-base font-semibold">{currentFinal ? "Your final video" : "Your video sequence"}</h2>{currentFinal ? <video src={currentFinal.url} controls playsInline aria-label="Merged final video" className="mx-auto max-h-[65dvh] max-w-full rounded-xl"/> : <div className="grid grid-cols-1 gap-5 sm:grid-cols-2"><figure><figcaption className="mb-3 text-sm font-medium">1 · {format === "wall_text" ? "Wall of text" : "Hook"}</figcaption>{opening ? <video src={opening.url} controls playsInline preload="metadata" aria-label="Saved opening video" className="max-h-80 w-full rounded-xl bg-black object-contain"/> : <div className="flex min-h-48 items-center justify-center rounded-xl border border-border p-5 text-center text-sm text-muted">Save your opening in Edit video.</div>}</figure><figure><figcaption className="mb-3 text-sm font-medium">2 · Demo</figcaption>{preview ? <video ref={previewPlayer} src={preview.url} controls playsInline preload="metadata" aria-label="Selected demo video" className="max-h-80 w-full rounded-xl bg-black object-contain" onLoadedMetadata={event => { const length = event.currentTarget.duration; if (Number.isFinite(length) && length >= 1 && length <= 120) {
        setNaturalDuration(length);
        if (preview.duration === null && draft.editing.trimStartMs === 0 && draft.editing.trimEndMs === 5000 && initial?.demoId !== demo?.id)
            change({ ...draft, editing: defaultDemoEdit(length) });
    } event.currentTarget.currentTime = draft.editing.trimStartMs / 1000; event.currentTarget.volume = draft.editing.originalVolume; }} onPlay={event => { event.currentTarget.volume = draft.editing.originalVolume; if (event.currentTarget.currentTime < draft.editing.trimStartMs / 1000 || event.currentTarget.currentTime >= draft.editing.trimEndMs / 1000)
        event.currentTarget.currentTime = draft.editing.trimStartMs / 1000; }} onTimeUpdate={event => { if (event.currentTarget.currentTime * 1000 >= draft.editing.trimEndMs) {
        event.currentTarget.pause();
        event.currentTarget.currentTime = draft.editing.trimStartMs / 1000;
    } }}/> : <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-5 text-sm text-muted"><Video aria-hidden="true"/>Add an optional demo</div>}</figure></div>}<p className="text-center text-sm text-muted">{preview && opening ? `Opening → Demo · ${Math.round(((openingQuery.data?.durationSeconds ?? 0) + (draft.editing.trimEndMs - draft.editing.trimStartMs) / 1000) * 10) / 10}s total` : "The demo plays after your saved opening."}</p>{format === "wall_text" ? <p className="text-center text-xs leading-5 text-muted">Your wall of text stays on the opening. The demo uses its own sound and framing.</p> : null}</section>;
    return <>{active && controlsTarget ? createPortal(controls, controlsTarget) : null}{active && resultsTarget ? createPortal(results, resultsTarget) : null}{actionsTarget ? createPortal(actions, actionsTarget) : null}<WorkflowVideoAssetPicker open={assetsOpen} onOpenChange={setAssetsOpen} ownerId={owner} selectedId={demo?.id} description="Choose a ready video to play after your opening." previewAssets={previewAssets} onSelect={asset => { if (busy || !selection.selectAsset(asset))
        return false; prepareSelection(); selection.setMode("assets"); return true; }}/><Dialog open={previewOpen && active} onOpenChange={setPreviewOpen}><DialogContent><DialogTitle>Demo preview</DialogTitle><DialogDescription>Original uploaded clip. Trim and framing are applied when you save.</DialogDescription>{preview ? <WorkflowMediaPlayer asset={preview} kind="video" label="Full demo preview" className="max-h-[65dvh]"/> : null}</DialogContent></Dialog></>;
}
/** An explicit Save freezes the inputs. Each stage has its own durable receipt;
 * reloading/retrying reuses it, and a failed preparation cannot start the join. */
export function DemoSaveRun({ save, ownerId, format, enabled, onBusy, onSaved, onContinue }: {
    save: DemoSave;
    ownerId: string | null;
    format: "hook" | "wall_text";
    enabled: boolean;
    onBusy: (busy: boolean) => void;
    onSaved: (output: VideoOutput) => void;
    onContinue: () => void;
}) {
    const prep = useWorkflowFinishing({ ownerId, enabled, kind: "hook", source: save.demo, demo: null, demoAudio: null, playback: "once", options: DEFAULT_FINISHING_OPTIONS, editing: { ...save.draft.editing, musicVolume: .2 }, scope: `format-demo-prep:${format}:${save.opening.id}:${save.demo.id}` });
    // Start added audio at the trimmed demo's beginning, not at its raw
    // source timestamp. This optional pass never touches the opening audio.
    const sound = useWorkflowFinishing({ ownerId, enabled: enabled && !!save.audio, kind: "hook", source: prep.output, demo: null, demoAudio: null, playback: "once", options: DEFAULT_FINISHING_OPTIONS, editing: { ...save.draft.editing, trimStartMs: 0, trimEndMs: save.draft.editing.trimEndMs - save.draft.editing.trimStartMs, originalVolume: 1 }, backgroundSource: save.audio, backgroundPlayback: save.draft.playback, scope: `format-demo-sound:${format}:${save.opening.id}:${save.demo.id}`, demoFramingError: !prep.output ? "Preparing your demo…" : null });
    const prepared = save.audio ? sound.output : prep.output;
    const framing = trimmedDemoFraming(save.draft.framing, save.draft.editing);
    const join = useWorkflowFinishing({ ownerId, enabled, kind: "hook", source: save.opening, demo: null, demoSource: prepared, demoAudio: null, playback: "once", options: DEFAULT_FINISHING_OPTIONS, demoFraming: framing, scope: `format-demo:${format}:${save.opening.id}`, demoFramingError: !prepared ? "Preparing the demo before joining…" : null });
    const attempted = useRef({ prep: false, sound: false, join: false });
    const current = prepared ? join : prep.output && save.audio ? sound : prep;
    const action = current.action;
    const error = action.error;
    useEffect(() => { if (!prep.output && !prep.action.disabled && !attempted.current.prep) {
        attempted.current.prep = true;
        prep.action.onAction();
    } }, [prep.output, prep.action]);
    useEffect(() => { if (save.audio && prep.output && !sound.output && !sound.action.disabled && !attempted.current.sound) {
        attempted.current.sound = true;
        sound.action.onAction();
    } }, [save.audio, prep.output, sound.output, sound.action]);
    useEffect(() => { if (prepared && !join.output && !join.action.disabled && !attempted.current.join) {
        attempted.current.join = true;
        join.action.onAction();
    } }, [prepared, join.output, join.action]);
    useEffect(() => { onBusy(!join.output && !error && !["failed", "cancelled"].includes(current.status?.outcome ?? "")); }, [join.output, error, current.status, onBusy]);
    useEffect(() => { if (join.output)
        onSaved({ id: join.output.id, kind: "media_asset", url: join.output.url, title: join.output.title }); }, [join.output, onSaved]);
    if (join.output)
        return <><Button type="button" className="h-11 w-full rounded-lg" onClick={onContinue}>Continue to Schedule</Button><p role="status" className="text-xs text-muted">Your opening and demo are saved as one video.</p></>;
    return <><Button type="button" className="h-11 w-full rounded-lg" disabled={!error && action.disabled} onClick={action.onAction}>{error || ["failed", "cancelled"].includes(current.status?.outcome ?? "") ? "Retry final video" : prepared ? "Joining your video…" : "Preparing your demo…"}</Button><p role="status" className="text-xs leading-5 text-muted">{action.message}</p>{error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}<Button type="button" variant="ghost" size="sm" onClick={action.refresh} disabled={action.busy}>Refresh save status</Button>{action.cancel ? <Button type="button" variant="ghost" size="sm" onClick={action.cancel}>Cancel save</Button> : null}</>;
}
