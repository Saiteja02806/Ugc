"use client";

import { useQuery } from "@tanstack/react-query";
import { FolderOpen, Upload, Video, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { WorkflowMediaPlayer } from "@/components/explore/hook-workflow-media-controls";
import { WorkflowVideoAssetPicker } from "@/components/explore/workflow-video-asset-picker";
import { WorkflowVideoStartActions } from "@/components/explore/workflow-video-start-actions";
import { useWorkflowSourceVideo } from "@/components/explore/use-workflow-source-video";
import { DEFAULT_FINISHING_OPTIONS, useWorkflowFinishing } from "@/components/explore/use-workflow-finishing";
import type { LocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";
import creation from "@/components/explore/workflow-creation.module.css";
import { Button } from "@/components/ui/button";
import { fetchAIStudioMediaAsset } from "@/lib/ai-studio/media-client";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { formatVideoFromAsset } from "@/lib/explore/format-video-source";
import type { WorkflowVideoMode } from "@/lib/explore/workflow-source-video";
import type { MediaAsset } from "@/lib/media/types";
import type { ExploreFinishDraft } from "@/worker/src/lib/explore-finishing-contract";

type VideoOutput = { id: string; kind: "media_asset" | "library_item"; url: string; title: string };
export function FormatDemoWorkspace({ ownerId, enabled, localPreview, active, opening, sourcePreview, controlsTarget, resultsTarget, actionsTarget, previewAssets, onChooseSource, onDemoChange, onSaved, onContinue }: {
  ownerId: string | null; enabled: boolean; localPreview: boolean; active: boolean;
  opening: VideoOutput | null; sourcePreview: LocalWorkflowMedia | null;
  controlsTarget: HTMLElement | null; resultsTarget: HTMLElement | null; actionsTarget: HTMLElement | null;
  previewAssets?: MediaAsset[]; onChooseSource: (mode: WorkflowVideoMode) => void;
  onDemoChange: (present: boolean) => void; onSaved: (output: VideoOutput) => void; onContinue: () => void;
}) {
  const demo = useWorkflowSourceVideo({ enabled: !localPreview, ownerId, minDuration: 1, initialMode: "upload" });
  const input = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [restoredDemoId, setRestoredDemoId] = useState<string | null>(null);
  const locallyChanged = useRef(false);
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
    if (locallyChanged.current || !draft.demoAssetId) return;
    setRestoredDemoId(draft.demoAssetId); onDemoChange(true);
  }, [onDemoChange]);
  const demoSource = demo.source ?? (restoredDemoId ? restoredDemoQuery.data ?? null : null);
  const demoPreview = demo.preview ?? (demoSource ? { name: demoSource.title, url: demoSource.url, duration: demoSource.durationSeconds } : null);
  const demoReady = demo.ready || Boolean(demoSource);
  const finishing = useWorkflowFinishing({ ownerId, enabled, kind: "hook", source: openingQuery.data ?? null,
    demo: null, demoSource, demoAudio: null, playback: "once", options: DEFAULT_FINISHING_OPTIONS, onRestoreDraft: restoreDraft,
    scope: `format:hook:demo:${opening?.id ?? "empty"}`, demoFramingError: demo.error ?? (demo.busy ? "Preparing your demo…" : restoredDemoQuery.isError ? "Your saved demo could not be loaded." : null) });
  useEffect(() => {
    if (finishing.output && opening && openingQuery.data?.id === opening.id && demoReady) onSaved({ id: finishing.output.id, kind: "media_asset", url: finishing.output.url, title: finishing.output.title });
  }, [finishing.output, opening, openingQuery.data?.id, demoReady, onSaved]);
  useEffect(() => {
    if (!active) {
      preview.current?.querySelectorAll("video").forEach(player => player.pause());
    }
  }, [active]);

  const hookPreview = opening ? { name: opening.title, url: opening.url, duration: openingQuery.data?.durationSeconds ?? null } : sourcePreview;
  const hasDemo = Boolean(demoPreview || restoredDemoId);
  const error = demo.error ?? (openingQuery.isError ? "Your saved hook could not be loaded. Try again." : finishing.action.error);
  async function chooseUpload(file: File) {
    locallyChanged.current = true; setRestoredDemoId(null);
    demo.setMode("upload"); onDemoChange(true);
    const accepted = await demo.chooseUpload(file);
    if (!accepted && !demo.preview) onDemoChange(false);
  }
  function selectAsset(asset: MediaAsset) {
    if (!demo.selectAsset(asset)) return false;
    locallyChanged.current = true; setRestoredDemoId(null);
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
    {demoPreview ? <div className={creation.sourceSummary}><Video className="size-4 shrink-0 text-muted" aria-hidden="true" /><p className="min-w-0 flex-1 truncate text-sm" title={demoPreview.name}>{demoPreview.name}</p><Button type="button" variant="ghost" size="icon-sm" aria-label="Remove demo" disabled={demo.busy || finishing.action.busy} onClick={() => { locallyChanged.current = true; setRestoredDemoId(null); demo.removeUpload(); demo.setMode("upload"); onDemoChange(false); }}><X className="size-4" aria-hidden="true" /></Button></div> : null}
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
        {hookPreview ? <WorkflowMediaPlayer asset={hookPreview} kind="video" label="Hook preview" className={creation.sequencePlayer} /> : <div className={creation.sequencePlaceholder}><WorkflowVideoStartActions onChoose={onChooseSource} /></div>}
      </section>
      <section className="min-w-0 space-y-3" aria-label="Demo segment"><h3 className="text-sm font-medium">2 · Demo</h3>
        {demoPreview ? <WorkflowMediaPlayer asset={demoPreview} kind="video" label="Demo preview" className={creation.sequencePlayer} /> : <Button type="button" variant="outline" className={creation.sequencePlaceholder} disabled={demo.busy} onClick={() => input.current?.click()}><Upload className="size-5" aria-hidden="true" />{restoredDemoQuery.isFetching ? "Loading demo…" : "Upload demo"}</Button>}
      </section>
    </div>
  </section>;
  const canContinue = Boolean(opening && (!hasDemo || finishing.output && demoReady && !error && openingQuery.data?.id === opening.id));
  const actions = <div className="space-y-2">
    <Button type="button" className="h-11 w-full rounded-lg" disabled={canContinue ? false : !hasDemo || !demoReady || finishing.action.disabled || !openingQuery.data} onClick={canContinue ? onContinue : finishing.action.onAction}>
      {canContinue ? "Continue to Schedule" : finishing.action.busy ? "Saving…" : "Save final video"}
    </Button>
    {hasDemo && !opening ? <p role="status" className="text-xs leading-5 text-muted">Save your hook edits to combine these videos.</p> : null}
    {hasDemo && opening && localPreview ? <p className="text-xs text-muted">Preview · saving disabled</p> : null}
    {finishing.action.cancel ? <Button type="button" variant="outline" size="sm" onClick={finishing.action.cancel}>Cancel save</Button> : null}
    {finishing.action.error ? <Button type="button" variant="outline" size="sm" onClick={finishing.action.refresh}>Check saved request</Button> : null}
  </div>;
  return <>{controlsTarget ? createPortal(controls, controlsTarget) : null}{resultsTarget ? createPortal(sequence, resultsTarget) : null}{actionsTarget ? createPortal(actions, actionsTarget) : null}</>;
}
