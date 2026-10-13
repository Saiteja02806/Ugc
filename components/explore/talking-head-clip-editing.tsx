"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction, type ReactNode } from "react";
import { FormatVideoEditor, type FormatOpeningPreview, type WorkflowClipEditState } from "@/components/explore/format-video-editor";
import type { WorkflowAttachment } from "@/components/explore/hook-workflow-media-controls";
import type { LocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";
import { uploadAIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { trimmedDemoFraming } from "@/lib/explore/format-demo";
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

/** Prepare each clip with the shared editor, then retain the existing final
 * composition/subtitle/scheduling pipeline. Unsaved edits never reach it. */
export function TalkingHeadClipEditing({ enabled, ownerId, source, sourcePreview, demo, demoFraming, active, onDirty, children, backgroundScheduling = false }: {
  enabled: boolean; ownerId: string | null; source: MediaAsset | null; sourcePreview: LocalWorkflowMedia | null;
  demo: WorkflowAttachment; demoFraming: DemoFraming | null; active: boolean; onDirty: () => void;
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
  const ownedDemo = demoInput?.url === demo.asset?.url ? demoInput?.asset ?? null : null;
  const demoVideo = ownedDemo ? formatVideoFromAsset(ownedDemo) : demo.asset ? previewVideo(demo.asset, demo.asset.url) : null;
  const openingKey = opening?.mediaAssetId ?? opening?.id;
  const selectedOpeningState = openingState?.sourceId === openingKey ? openingState : null;
  const selectedDemoState = demoState?.sourceId === (demoVideo?.mediaAssetId ?? demoVideo?.id) ? demoState : null;
  const uploadState = upload?.url === demo.asset?.url ? upload : null;
  const target = requested && requested.key === (requested.target === "opening" ? openingKey : demo.asset?.url) ? requested.target : null;
  const editing = active && Boolean(target);
  const preparedDemo = selectedDemoState?.output ?? ownedDemo;
  const error = uploadState?.busy ? "Preparing your demo for editing…" : uploadState?.error
    ?? (backgroundScheduling && source && !selectedOpeningState || backgroundScheduling && ownedDemo && demoStarted === demo.asset?.url && !selectedDemoState ? "Loading your saved clip edits…" : null)
    ?? (selectedOpeningState?.busy || selectedDemoState?.busy ? "Wait for your clip edits to finish saving." : null)
    ?? selectedOpeningState?.error ?? selectedDemoState?.error
    ?? ((backgroundScheduling ? selectedOpeningState?.needsSaving && selectedOpeningState?.needsDraftSaving : selectedOpeningState?.needsSaving) ? "Save your talking-head clip edits before applying finishing options." : null)
    ?? ((backgroundScheduling ? selectedDemoState?.needsSaving && selectedDemoState?.needsDraftSaving : selectedDemoState?.needsSaving) ? "Save your demo clip edits before applying finishing options." : null);

  async function openDemo() {
    const media = demo.asset;
    if (!media || uploading.current) return;
    if (!enabled || ownedDemo) { setDemoStarted(media.url); setRequested({ target: "demo", key: media.url }); return; }
    if (!ownerId || !media.file) { setUpload({ url: media.url, busy: false, error: "Choose your demo file again before editing it." }); return; }
    uploading.current = true; setUpload({ url: media.url, busy: true, error: null });
    try {
      const uploaded = await uploadAIStudioReferenceMedia(media.file, "video", 120, ownerId, { requireVideoReferenceRatio: false, purpose: "explore-demo" });
      const asset = uploaded.asset;
      formatVideoFromAsset(asset);
      if (!alive.current) return;
      setDemoInput({ url: media.url, asset }); setDemoStarted(media.url); setRequested({ target: "demo", key: media.url });
      setUpload({ url: media.url, busy: false, error: null });
    } catch (e) { if (alive.current) setUpload({ url: media.url, busy: false, error: e instanceof Error ? e.message : "Could not prepare the demo. Choose Edit demo video to retry." }); }
    finally { uploading.current = false; }
  }
  return <>
    <ClipEditingView value={{
      source: backgroundScheduling ? source : selectedOpeningState?.output ?? source,
      rawSource: source, rawDemoSource: ownedDemo, openingState: selectedOpeningState, demoState: selectedDemoState,
      demoSource: backgroundScheduling ? ownedDemo : preparedDemo,
      demo: (backgroundScheduling ? ownedDemo : preparedDemo) ? null : demo.asset,
      demoFraming: !backgroundScheduling && selectedDemoState?.output && demoFraming ? trimmedDemoFraming(demoFraming, selectedDemoState.editing) : demoFraming,
      error, editing, busy: Boolean(uploadState?.busy || selectedOpeningState?.busy || selectedDemoState?.busy),
      controls: <div hidden={!editing} ref={setControlsTarget} className={sections.clipControls} />,
      preview: <div hidden={!editing} ref={setResultsTarget} className={sections.clipPreview} />,
      actions: <div ref={setActionsTarget} />,
      openOpening: openingKey ? () => setRequested({ target: "opening", key: openingKey }) : undefined,
      openDemo: demo.asset ? () => { void openDemo(); } : undefined,
      openingPreview: openingPreview?.segment.id === openingKey ? openingPreview : null,
      demoPreview: demoPreview?.segment.id === (demoVideo?.mediaAssetId ?? demoVideo?.id) ? demoPreview : null,
    }}>{children}</ClipEditingView>
    {opening ? <FormatVideoEditor key={`opening:${openingKey}`} format="hook" video={opening} active={editing && target === "opening"} controlsTarget={controlsTarget} resultsTarget={resultsTarget} actionsTarget={actionsTarget} enabled={enabled}
      draftScope="talking-head-opening" videoLabel="Talking-head video" continueLabel="Back to sequence" onDirty={onDirty} onSaved={ignoreSaved} onContinue={close} onBackToPreview={close} onClipStateChange={reportOpening} onPreviewChange={reportOpeningPreview} /> : null}
    {demoVideo && demoStarted === demo.asset?.url ? <FormatVideoEditor key={`demo:${demoVideo.mediaAssetId ?? demoVideo.id}`} format="hook" video={demoVideo} active={editing && target === "demo"} controlsTarget={controlsTarget} resultsTarget={resultsTarget} actionsTarget={actionsTarget} enabled={enabled}
      draftScope="talking-head-demo" videoLabel="Demo video" continueLabel="Back to sequence" allowRemix={false} onDirty={onDirty} onSaved={ignoreSaved} onContinue={close} onBackToPreview={close} onClipStateChange={reportDemo} onPreviewChange={reportDemoPreview} /> : null}
  </>;
}
