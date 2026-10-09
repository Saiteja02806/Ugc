"use client";

import { useQuery } from "@tanstack/react-query";
import { FolderOpen, Upload, Video, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { WorkflowMediaPlayer } from "@/components/explore/hook-workflow-media-controls";
import { FormatVideoEditor, type FormatPreparationStatus } from "@/components/explore/format-video-editor";
import { FormatVideoEditFrame } from "@/components/explore/format-video-edit-frame";
import { WorkflowVideoAssetPicker } from "@/components/explore/workflow-video-asset-picker";
import { WorkflowVideoStartActions } from "@/components/explore/workflow-video-start-actions";
import { useWorkflowSourceVideo } from "@/components/explore/use-workflow-source-video";
import { DEFAULT_FINISHING_OPTIONS, useWorkflowFinishing } from "@/components/explore/use-workflow-finishing";
import type { LocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";
import creation from "@/components/explore/workflow-creation.module.css";
import { Button } from "@/components/ui/button";
import { fetchAIStudioMediaAsset } from "@/lib/ai-studio/media-client";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { formatVideoFromAsset, type FormatVideoSource } from "@/lib/explore/format-video-source";
import type { WorkflowVideoMode } from "@/lib/explore/workflow-source-video";
import type { MediaAsset } from "@/lib/media/types";
import type { ExploreFinishDraft } from "@/worker/src/lib/explore-finishing-contract";
import { readFormatDemoSelection } from "@/lib/explore/format-demo-selection";

type VideoOutput = { id: string; kind: "media_asset" | "library_item"; url: string; title: string };
export function FormatDemoWorkspace({ ownerId, enabled, localPreview, active, opening, sourcePreview, controlsTarget, resultsTarget, actionsTarget, previewAssets, onChooseSource, onDemoChange, onSaved, onContinue, scheduleResultsTarget, scheduleActive = false, prepareRequest = 0, finalOutput = null, openingPreparation, onEditOpening, sourceAssetId = null, onPreparationChange }: {
  ownerId: string | null; enabled: boolean; localPreview: boolean; active: boolean;
  opening: VideoOutput | null; sourcePreview: LocalWorkflowMedia | null;
  controlsTarget: HTMLElement | null; resultsTarget: HTMLElement | null; actionsTarget: HTMLElement | null;
  previewAssets?: MediaAsset[]; onChooseSource: (mode: WorkflowVideoMode) => void;
  onDemoChange: (present: boolean) => void; onSaved: (output: VideoOutput) => void; onContinue: () => void;
  scheduleResultsTarget?: HTMLElement | null; scheduleActive?: boolean; prepareRequest?: number; finalOutput?: VideoOutput | null;
  openingPreparation?: FormatPreparationStatus; onEditOpening?: () => void;
  sourceAssetId?: string | null;
  onPreparationChange?: (status: FormatPreparationStatus) => void;
}) {
  const demo = useWorkflowSourceVideo({ enabled: !localPreview, ownerId, minDuration: 1, initialMode: "upload" });
  const input = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [restoredDemoId, setRestoredDemoId] = useState<string | null>(null);
  const [editingDemo, setEditingDemo] = useState(false);
  const [demoDirty, setDemoDirty] = useState(false);
  const [editedDemo, setEditedDemo] = useState<VideoOutput | null>(null);
  const [restoredEditedDemoId, setRestoredEditedDemoId] = useState<string | null>(null);
  const [demoPreparation, setDemoPreparation] = useState<FormatPreparationStatus | null>(null);
  const [editorControls, setEditorControls] = useState<HTMLDivElement | null>(null);
  const [editorPreview, setEditorPreview] = useState<HTMLDivElement | null>(null);
  const [editorActions, setEditorActions] = useState<HTMLDivElement | null>(null);
  const locallyChanged = useRef(false);
  const selectionKey = ownerId && sourceAssetId ? `ugc-explore:demo-selection:v1:${ownerId}:${sourceAssetId}` : null;
  useEffect(() => {
    if (!selectionKey || !ownerId || !sourceAssetId || localPreview || locallyChanged.current) return;
    const timer = setTimeout(() => {
      if (locallyChanged.current) return;
      try {
        const selection = readFormatDemoSelection(localStorage.getItem(selectionKey), ownerId, sourceAssetId);
        if (selection) {
          setRestoredDemoId(selection.demoAssetId); setRestoredEditedDemoId(selection.editedDemoAssetId); setDemoDirty(selection.dirty);
          onDemoChange(Boolean(selection.demoAssetId));
        }
      } catch { /* Asset ownership is checked by the owned-media endpoints. */ }
    }, 0);
    return () => clearTimeout(timer);
  }, [selectionKey, ownerId, sourceAssetId, localPreview, onDemoChange]);
  const preview = useRef<HTMLDivElement>(null);
  const openingQuery = useQuery({ queryKey: ["explore-demo-opening", ownerId, opening?.id], enabled: enabled && Boolean(ownerId && opening), queryFn: async () => {
    const token = await getCurrentUserIdToken(ownerId ?? undefined);
    if (!token || !opening) throw new Error("Sign in to load your saved hook.");
    const asset = await fetchAIStudioMediaAsset(opening.id, token);
    formatVideoFromAsset(asset);
    return asset;
  }});
  const restoredDemoQuery = useQuery({ queryKey: ["explore-demo-restore", ownerId, restoredDemoId], enabled: enabled && Boolean(ownerId && restoredDemoId), queryFn: async () => {
    const token = await getCurrentUserIdToken(ownerId ?? undefined);
    if (!token || !restoredDemoId) throw new Error("Sign in to restore your demo.");
    const asset = await fetchAIStudioMediaAsset(restoredDemoId, token);
    formatVideoFromAsset(asset);
    return asset;
  }});
  const restoreDraft = useCallback((draft: ExploreFinishDraft) => {
    if (locallyChanged.current || restoredDemoId || !draft.demoAssetId) return;
    setRestoredDemoId(draft.demoAssetId); onDemoChange(true);
  }, [onDemoChange, restoredDemoId]);
  const demoSource = demo.source ?? (restoredDemoId ? restoredDemoQuery.data ?? null : null);
  const demoPreview = demo.preview ?? (demoSource ? { name: demoSource.title, url: demoSource.url, duration: demoSource.durationSeconds } : null);
  const demoReady = demo.ready || Boolean(demoSource);
  const editedDemoId = editedDemo?.id ?? restoredEditedDemoId;
  const editedDemoQuery = useQuery({ queryKey: ["explore-demo-edited", ownerId, editedDemoId], enabled: enabled && Boolean(ownerId && editedDemoId), queryFn: async () => {
    const token = await getCurrentUserIdToken(ownerId ?? undefined);
    if (!token || !editedDemoId) throw new Error("Sign in to load your edited demo.");
    const asset = await fetchAIStudioMediaAsset(editedDemoId, token); formatVideoFromAsset(asset); return asset;
  }});
  const combinedDemoSource = editedDemoId ? editedDemoQuery.data ?? null : demoSource;
  const displayedDemo = editedDemo ?? (editedDemoQuery.data ? { id: editedDemoQuery.data.id, kind: "media_asset" as const, url: editedDemoQuery.data.url, title: editedDemoQuery.data.title } : null);
  const markDemoDirty = useCallback(() => { locallyChanged.current = true; setDemoDirty(true); setEditedDemo(null); setRestoredEditedDemoId(null); onDemoChange(true); }, [onDemoChange]);
  const acceptDemoEdits = useCallback((output: VideoOutput) => { setEditedDemo(output); setRestoredEditedDemoId(null); setDemoDirty(false); }, []);
  const restoreDemoEdits = useCallback(() => {
    // A saved edited asset remains valid until the user changes its original
    // draft. Restoring the draft alone must not discard that finished asset.
    if (!editedDemoId) { setDemoDirty(true); onDemoChange(true); }
  }, [editedDemoId, onDemoChange]);
  useEffect(() => {
    if (!selectionKey || !ownerId || !sourceAssetId || localPreview || !locallyChanged.current) return;
    try { localStorage.setItem(selectionKey, JSON.stringify({ version: 1, ownerId, sourceAssetId, demoAssetId: demoSource?.id ?? null, editedDemoAssetId: editedDemoId, dirty: demoDirty })); } catch { /* Saving the render receipt still occurs before dispatch. */ }
  }, [selectionKey, ownerId, sourceAssetId, localPreview, demoSource?.id, editedDemoId, demoDirty]);
  const reportDemoPreparation = useCallback((status: FormatPreparationStatus) => setDemoPreparation(status), []);
  const demoVideo: FormatVideoSource | null = demoSource ? formatVideoFromAsset(demoSource) : demoPreview ? {
    id: demoPreview.url, mediaAssetId: null, title: demoPreview.name, url: demoPreview.url,
    createdAt: "", durationSeconds: demoPreview.duration ?? null, ratio: "9:16", status: "Ready", prompt: "",
  } : null;
  const finishing = useWorkflowFinishing({ ownerId, enabled, kind: "hook", source: openingQuery.data ?? null,
    demo: null, demoSource: combinedDemoSource, demoAudio: null, playback: "once", options: DEFAULT_FINISHING_OPTIONS, onRestoreDraft: restoreDraft,
    scope: `format:hook:demo:${opening?.id ?? "empty"}`, demoFramingError: demo.error ?? (demoDirty ? "Preparing your demo edits…" : demo.busy ? "Preparing your demo…" : editedDemoId && !combinedDemoSource ? "Loading your edited demo…" : restoredDemoQuery.isError ? "Your saved demo could not be loaded." : null) });
  const handledPrepareRequest = useRef(0);
  useEffect(() => {
    if (!prepareRequest || handledPrepareRequest.current === prepareRequest || !demoSource || demoDirty || !combinedDemoSource || finishing.output || finishing.action.disabled || openingQuery.data?.id !== opening?.id) return;
    handledPrepareRequest.current = prepareRequest;
    finishing.action.onAction();
  }, [prepareRequest, demoSource, demoDirty, combinedDemoSource, finishing.output, finishing.action, openingQuery.data?.id, opening?.id]);
  useEffect(() => {
    if (finishing.output && opening && openingQuery.data?.id === opening.id && demoReady) onSaved({ id: finishing.output.id, kind: "media_asset", url: finishing.output.url, title: finishing.output.title });
  }, [finishing.output, opening, openingQuery.data?.id, demoReady, onSaved]);
  useEffect(() => {
    if (!active || editingDemo) {
      preview.current?.querySelectorAll("video").forEach(player => player.pause());
    }
  }, [active, editingDemo]);

  const hookPreview = opening ? { name: opening.title, url: opening.url, duration: openingQuery.data?.durationSeconds ?? null } : sourcePreview;
  const hasDemo = Boolean(demoPreview || restoredDemoId);
  const waitingForDemo = demoDirty || demo.busy || Boolean(editedDemoId && !combinedDemoSource);
  const error = demo.error ?? (openingQuery.isError ? "Your saved hook could not be loaded. Try again." : restoredDemoQuery.isError ? "Your saved demo could not be loaded. Try again." : waitingForDemo ? null : finishing.action.error);
  const preparationBusy = Boolean(demoPreparation?.busy || finishing.action.busy || finishing.action.cancel);
  useEffect(() => { onPreparationChange?.({ busy: preparationBusy, error, message: "Preparing your video sequence…" }); }, [onPreparationChange, preparationBusy, error]);
  async function chooseUpload(file: File) {
    locallyChanged.current = true; setRestoredDemoId(null);
    setEditedDemo(null); setRestoredEditedDemoId(null); setDemoDirty(false); setEditingDemo(false);
    demo.setMode("upload"); onDemoChange(true);
    const accepted = await demo.chooseUpload(file);
    if (!accepted && !demo.preview) onDemoChange(false);
  }
  function selectAsset(asset: MediaAsset) {
    if (!demo.selectAsset(asset)) return false;
    locallyChanged.current = true; setRestoredDemoId(null);
    setEditedDemo(null); setRestoredEditedDemoId(null); setDemoDirty(false); setEditingDemo(false);
    demo.setMode("assets"); onDemoChange(true); return true;
  }
  const controls = <section className="space-y-4" aria-label="Demo controls">
    <h2 className="text-sm font-medium">Demo <span className="ml-1 text-xs font-normal text-muted">Optional</span></h2>
    <input ref={input} type="file" accept="video/mp4,video/quicktime,video/webm" aria-label="Upload demo video" hidden onChange={event => {
      const file = event.target.files?.[0]; if (file) void chooseUpload(file); event.target.value = "";
    }} />
    <div className={creation.demoSourceActions}>
      <Button type="button" variant="outline" disabled={demo.busy || finishing.action.busy} onClick={() => input.current?.click()}><Upload className="size-5" aria-hidden="true" />{hasDemo ? "Replace demo" : "Upload demo"}</Button>
      <Button type="button" variant="outline" disabled={demo.busy || finishing.action.busy} onClick={() => setPickerOpen(true)}><FolderOpen className="size-5" aria-hidden="true" />Creative Assets</Button>
    </div>
    {demoPreview ? <div className={creation.sourceSummary}><Video className="size-4 shrink-0 text-muted" aria-hidden="true" /><p className="min-w-0 flex-1 truncate text-sm" title={demoPreview.name}>{demoPreview.name}</p><Button type="button" variant="ghost" size="icon-sm" aria-label="Remove demo" disabled={demo.busy || finishing.action.busy} onClick={() => { locallyChanged.current = true; setRestoredDemoId(null); setEditedDemo(null); setRestoredEditedDemoId(null); setDemoDirty(false); setEditingDemo(false); demo.removeUpload(); demo.setMode("upload"); onDemoChange(false); }}><X className="size-4" aria-hidden="true" /></Button></div> : null}
    {demo.busy ? <p role="status" className="text-xs text-muted">Preparing your demo…</p> : null}
    {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    {openingQuery.isError ? <Button type="button" variant="outline" size="sm" onClick={() => void openingQuery.refetch()}>Retry hook</Button> : null}
    {restoredDemoQuery.isError ? <Button type="button" variant="outline" size="sm" onClick={() => void restoredDemoQuery.refetch()}>Retry demo</Button> : null}
    <WorkflowVideoAssetPicker open={active && pickerOpen} onOpenChange={setPickerOpen} ownerId={ownerId} selectedId={demoSource?.id} onSelect={selectAsset} description="Choose a demo to play after your hook." previewAssets={localPreview ? previewAssets : undefined} />
  </section>;
  const sequence = <section ref={preview} className={creation.demoSequence} aria-label="Video sequence preview">
    <h2 className={creation.sectionTitle}>Your video sequence</h2>
    <div className={creation.demoPreviewGrid}>
      <section className="min-w-0 space-y-3" aria-label="Hook segment"><h3 className="text-sm font-medium">1 · Hook</h3>
        {hookPreview ? <><WorkflowMediaPlayer asset={hookPreview} kind="video" label="Hook preview" className={creation.sequencePlayer} /><Button type="button" variant="outline" onClick={onEditOpening}>Edit hook video</Button></> : <div className={creation.sequencePlaceholder}><WorkflowVideoStartActions onChoose={onChooseSource} /></div>}
      </section>
      <section className="min-w-0 space-y-3" aria-label="Demo segment"><h3 className="text-sm font-medium">2 · Demo</h3>
        {demoPreview ? <><WorkflowMediaPlayer asset={displayedDemo ? { ...demoPreview, url: displayedDemo.url } : demoPreview} kind="video" label="Demo preview" className={creation.sequencePlayer} /><Button type="button" variant="outline" disabled={demo.busy || finishing.action.busy} onClick={() => setEditingDemo(true)}>Edit demo video</Button></> : <Button type="button" variant="outline" className={creation.sequencePlaceholder} disabled={demo.busy} onClick={() => input.current?.click()}><Upload className="size-5" aria-hidden="true" />{restoredDemoQuery.isFetching ? "Loading demo…" : "Upload demo"}</Button>}
      </section>
    </div>
  </section>;
  const actions = <div className="space-y-2">
    <Button type="button" className="h-11 w-full rounded-lg" disabled={!hookPreview || demo.busy} onClick={onContinue}>Schedule</Button>
    <p className="text-xs leading-5 text-muted">Review your {hasDemo ? "hook and demo" : "hook"} and choose when to post. Your final video is prepared in Schedule.</p>
    {finishing.action.cancel ? <Button type="button" variant="outline" size="sm" onClick={finishing.action.cancel}>Cancel save</Button> : null}
    {error ? <Button type="button" variant="outline" size="sm" onClick={finishing.action.refresh}>Check saved request</Button> : null}
  </div>;
  const editPanel = <FormatVideoEditFrame clip="demo" onBack={() => setEditingDemo(false)} backLabel="Back to previews" controlsRef={setEditorControls} previewRef={setEditorPreview} actionsRef={setEditorActions} />;
  const preparationError = openingPreparation?.error ?? (demoDirty ? demoPreparation?.error : null) ?? (editedDemoQuery.isError ? "Could not load your edited demo. Return to Demo and try again." : error);
  const schedulePreview = <section className="space-y-5 p-5" aria-label="Schedule video preview">
    <h2 className="text-base font-semibold">{hasDemo ? "Your hook and demo" : "Your hook video"}</h2>
    <p className="text-sm text-muted">{hasDemo ? "The hook plays first, followed by the demo, in one scheduled post." : "Review your video before confirming its schedule."}</p>
    <div className={creation.demoPreviewGrid}>
      {hookPreview ? <section aria-label="Scheduled hook"><h3 className="mb-3 text-sm font-medium">1 · Hook</h3><WorkflowMediaPlayer asset={hookPreview} kind="video" label="Scheduled hook preview" className={creation.sequencePlayer} /></section> : <WorkflowVideoStartActions onChoose={onChooseSource} />}
      {demoPreview ? <section aria-label="Scheduled demo"><h3 className="mb-3 text-sm font-medium">2 · Demo</h3><WorkflowMediaPlayer asset={displayedDemo ? { ...demoPreview, url: displayedDemo.url } : demoPreview} kind="video" label="Scheduled demo preview" className={creation.sequencePlayer} /></section> : null}
    </div>
    {finalOutput ? <section className="space-y-3" aria-label="Final post preview"><h3 className="text-sm font-semibold">Final post preview</h3><video src={finalOutput.url} controls playsInline className="mx-auto max-h-[55dvh] max-w-full rounded-xl" /></section> : <div className="space-y-3">
      {preparationError ? <p role="alert" className="text-sm text-destructive">{preparationError}</p> : <p role="status" className="text-sm text-muted">{localPreview ? "Preview · preparing and scheduling are disabled." : !hookPreview ? "Add a hook video to continue." : !opening ? openingPreparation?.message ?? "Preparing your hook…" : demoDirty ? demoPreparation?.message ?? "Preparing your demo edits…" : finishing.action.message}</p>}
      {!localPreview && hookPreview ? <Button type="button" variant="outline" disabled={openingPreparation?.busy || demoPreparation?.busy || finishing.action.busy || Boolean(finishing.action.cancel)} onClick={onContinue}>{preparationError ? "Retry preparation" : "Prepare final video"}</Button> : null}
    </div>}
  </section>;
  return <>{controlsTarget ? createPortal(controls, controlsTarget) : null}{resultsTarget ? createPortal(active && editingDemo ? editPanel : sequence, resultsTarget) : null}{actionsTarget ? createPortal(actions, actionsTarget) : null}
    {scheduleActive && scheduleResultsTarget ? createPortal(schedulePreview, scheduleResultsTarget) : null}
    {demoVideo ? <FormatVideoEditor key={`${ownerId}:demo:${demoVideo.id}`} format="hook" segment="demo" video={demoVideo} active={active && editingDemo} enabled={enabled} controlsTarget={editorControls} resultsTarget={editorPreview} actionsTarget={editorActions} onDirty={markDemoDirty} onDraftRestored={restoreDemoEdits} onSaved={acceptDemoEdits} onContinue={() => setEditingDemo(false)} prepareRequest={opening && demoDirty ? prepareRequest : 0} onPreparationChange={reportDemoPreparation} onBackToPreview={() => setEditingDemo(false)} previewSide backLabel="Back to previews" /> : null}
  </>;
}
