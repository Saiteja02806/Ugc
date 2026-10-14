"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction, type ReactNode } from "react";
import { FormatVideoEditor, type FormatOpeningPreview, type WorkflowClipEditState } from "@/components/explore/format-video-editor";
import type { WorkflowAttachment } from "@/components/explore/hook-workflow-media-controls";
import type { LocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";
import { uploadAIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { formatVideoFromAsset, type FormatVideoSource } from "@/lib/explore/format-video-source";
import type { MediaAsset } from "@/lib/media/types";
import type { DemoFraming } from "@/worker/src/lib/explore-finishing-contract";
import sections from "@/components/explore/workflow-section-layout.module.css";

type ClipEditingView = {
  source: MediaAsset | null; demoSource: MediaAsset | null; demo: LocalWorkflowMedia | null;
  rawSource: MediaAsset | null; rawDemoSource: MediaAsset | null; openingState: WorkflowClipEditState | null; demoState: WorkflowClipEditState | null;
  demoFraming: DemoFraming | null; error: string | null; editing: boolean; busy: boolean;
  controls: ReactNode; preview: ReactNode; actions: ReactNode;
  openOpening: (() => void) | undefined; openDemo: (() => void) | undefined;
  openingPreview: FormatOpeningPreview | null; demoPreview: FormatOpeningPreview | null;
};
const ignoreSaved = () => {};
function reportState(set: Dispatch<SetStateAction<WorkflowClipEditState | null>>, value: WorkflowClipEditState) {
  set(previous => JSON.stringify(previous) === JSON.stringify(value) ? previous : value);
}
function previewVideo(media: LocalWorkflowMedia, id: string): FormatVideoSource {
  return { id, mediaAssetId: null, createdAt: "", durationSeconds: media.duration, ratio: "9:16", modelLabel: null, resolution: null, thumbnailUrl: null, status: "Ready", title: media.name, prompt: "", url: media.url };
}
function ClipEditingView({ value, children }: { value: ClipEditingView; children: (value: ClipEditingView) => ReactNode }) { return children(value); }

/** Save independent clip drafts; final preparation consumes their exact raw
 * composition. Saving does not require a separate per-clip render. */
export function TalkingHeadClipEditing({ enabled, ownerId, source, sourcePreview, demo, demoSource = null, onDemoSourceReady, demoFraming, active, onDirty, children }: {
  enabled: boolean; ownerId: string | null; source: MediaAsset | null; sourcePreview: LocalWorkflowMedia | null;
  demo: WorkflowAttachment; demoFraming: DemoFraming | null; active: boolean; onDirty: () => void;
  demoSource?: MediaAsset | null; onDemoSourceReady?: (asset: MediaAsset) => void;
  children: (view: ClipEditingView) => ReactNode; backgroundScheduling?: boolean;
}) {
  const [requested, setRequested] = useState<{ target: "opening" | "demo"; key: string } | null>(null);
  const [openingState, setOpeningState] = useState<WorkflowClipEditState | null>(null);
  const [demoState, setDemoState] = useState<WorkflowClipEditState | null>(null);
  const [openingPreview, setOpeningPreview] = useState<FormatOpeningPreview | null>(null);
  const [demoPreview, setDemoPreview] = useState<FormatOpeningPreview | null>(null);
  const [demoInput, setDemoInput] = useState<{ url: string; asset: MediaAsset } | null>(null);
  const [demoStarted, setDemoStarted] = useState<string | null>(null);
  const [upload, setUpload] = useState<{ url: string; busy: boolean; error: string | null } | null>(null);
  const [controlsTarget, setControlsTarget] = useState<HTMLDivElement | null>(null);
  const [resultsTarget, setResultsTarget] = useState<HTMLDivElement | null>(null);
  const [actionsTarget, setActionsTarget] = useState<HTMLDivElement | null>(null);
  const alive = useRef(true), uploading = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const reportOpening = useCallback((value: WorkflowClipEditState) => reportState(setOpeningState, value), []);
  const reportDemo = useCallback((value: WorkflowClipEditState) => reportState(setDemoState, value), []);
  const reportOpeningPreview = useCallback((value: FormatOpeningPreview) => setOpeningPreview(previous => JSON.stringify(previous) === JSON.stringify(value) ? previous : value), []);
  const reportDemoPreview = useCallback((value: FormatOpeningPreview) => setDemoPreview(previous => JSON.stringify(previous) === JSON.stringify(value) ? previous : value), []);
  const close = useCallback(() => setRequested(null), []);
  const opening = source ? formatVideoFromAsset(source) : sourcePreview ? previewVideo(sourcePreview, sourcePreview.url) : null;
  const ownedDemo = demoSource ?? (demoInput?.url === demo.asset?.url ? demoInput?.asset ?? null : null);
  const demoVideo = ownedDemo ? formatVideoFromAsset(ownedDemo) : demo.asset ? previewVideo(demo.asset, demo.asset.url) : null;
  const demoKey = ownedDemo?.id ?? demo.asset?.url;
  const openingKey = opening?.mediaAssetId ?? opening?.id;
  const selectedOpeningState = openingState?.sourceId === openingKey ? openingState : null;
  const selectedDemoState = demoState?.sourceId === (demoVideo?.mediaAssetId ?? demoVideo?.id) ? demoState : null;
  const uploadState = upload?.url === demo.asset?.url ? upload : null;
  const target = requested && requested.key === (requested.target === "opening" ? openingKey : demoKey) ? requested.target : null;
  const editing = active && Boolean(target);
  useEffect(() => {
    if (!editing) return;
    // The overview and clip editor share these scroll areas. Always open the
    // selected clip at its first field/frame, even after scrolling the overview.
    controlsTarget?.closest<HTMLElement>("[data-workflow-section-content]")?.scrollTo({ top: 0 });
    resultsTarget?.closest<HTMLElement>("#hook-workflow-preview")?.scrollTo({ top: 0 });
  }, [editing, target, controlsTarget, resultsTarget]);
  const draftBusy = Boolean((selectedOpeningState?.draftBusy ?? selectedOpeningState?.busy) || (selectedDemoState?.draftBusy ?? selectedDemoState?.busy));
  const draftError = (selectedOpeningState?.draftError !== undefined ? selectedOpeningState.draftError : selectedOpeningState?.error)
    ?? (selectedDemoState?.draftError !== undefined ? selectedDemoState.draftError : selectedDemoState?.error);
  const error = uploadState?.busy ? "Preparing your demo for editing…" : uploadState?.error
    ?? (source && !selectedOpeningState || ownedDemo && !selectedDemoState ? "Loading your saved clip edits…" : null)
    ?? (draftBusy ? "Wait for your clip edits to finish saving." : null)
    ?? draftError
    ?? (selectedOpeningState?.needsDraftSaving && (selectedOpeningState.needsSaving || selectedOpeningState.savedDraft) ? "Save your talking-head clip edits before preparing the final video." : null)
    ?? (selectedDemoState?.needsDraftSaving && (selectedDemoState.needsSaving || selectedDemoState.savedDraft) ? "Save your demo clip edits before preparing the final video." : null);

  async function openDemo() {
    const media = demo.asset;
    if (uploading.current) return;
    if (ownedDemo) { setDemoStarted(ownedDemo.id); setRequested({ target: "demo", key: ownedDemo.id }); return; }
    if (!media) return;
    if (!enabled) { setDemoStarted(media.url); setRequested({ target: "demo", key: media.url }); return; }
    if (!ownerId || !media.file) { setUpload({ url: media.url, busy: false, error: "Choose your demo file again before editing it." }); return; }
    uploading.current = true; setUpload({ url: media.url, busy: true, error: null });
    try {
      const uploaded = await uploadAIStudioReferenceMedia(media.file, "video", 120, ownerId, { requireVideoReferenceRatio: false, purpose: "explore-demo" });
      const asset = uploaded.asset;
      formatVideoFromAsset(asset);
      if (!alive.current) return;
      setDemoInput({ url: media.url, asset }); setDemoStarted(asset.id); setRequested({ target: "demo", key: asset.id });
      onDemoSourceReady?.(asset);
      setUpload({ url: media.url, busy: false, error: null });
    } catch (e) { if (alive.current) setUpload({ url: media.url, busy: false, error: e instanceof Error ? e.message : "Could not prepare the demo. Choose Edit demo video to retry." }); }
    finally { uploading.current = false; }
  }
  return <>
    <ClipEditingView value={{
      source,
      rawSource: source, rawDemoSource: ownedDemo, openingState: selectedOpeningState, demoState: selectedDemoState,
      demoSource: ownedDemo,
      demo: ownedDemo ? null : demo.asset,
      demoFraming,
      error, editing, busy: Boolean(uploadState?.busy || draftBusy),
      controls: <div hidden={!editing} ref={setControlsTarget} className={sections.clipControls} />,
      preview: <div hidden={!editing} ref={setResultsTarget} className={sections.clipPreview} />,
      actions: <div ref={setActionsTarget} />,
      openOpening: openingKey ? () => setRequested({ target: "opening", key: openingKey }) : undefined,
      openDemo: demo.asset || ownedDemo ? () => { void openDemo(); } : undefined,
      openingPreview: openingPreview?.segment.id === openingKey ? openingPreview : null,
      demoPreview: demoPreview?.segment.id === (demoVideo?.mediaAssetId ?? demoVideo?.id) ? demoPreview : null,
    }}>{children}</ClipEditingView>
    {opening ? <FormatVideoEditor key={`opening:${openingKey}`} format="hook" video={opening} active={editing && target === "opening"} controlsTarget={controlsTarget} resultsTarget={resultsTarget} actionsTarget={actionsTarget} enabled={enabled}
      draftScope="talking-head-opening" videoLabel="Talking-head video" continueLabel="Back to sequence" onDirty={onDirty} onSaved={ignoreSaved} onContinue={close} onBackToPreview={close} onClipStateChange={reportOpening} onPreviewChange={reportOpeningPreview} /> : null}
    {demoVideo && (ownedDemo || demoStarted === demoKey) ? <FormatVideoEditor key={`demo:${demoVideo.mediaAssetId ?? demoVideo.id}`} format="hook" video={demoVideo} active={editing && target === "demo"} controlsTarget={controlsTarget} resultsTarget={resultsTarget} actionsTarget={actionsTarget} enabled={enabled}
      draftScope="talking-head-demo" videoLabel="Demo video" continueLabel="Back to sequence" allowRemix={false} onDirty={onDirty} onSaved={ignoreSaved} onContinue={close} onBackToPreview={close} onClipStateChange={reportDemo} onPreviewChange={reportDemoPreview} /> : null}
  </>;
}
