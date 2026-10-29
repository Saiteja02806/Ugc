"use client";

import { useTalkingHeadReference } from "./use-talking-head-reference";
import { TalkingHeadReferences } from "./talking-head-references";
import { StartingFrameAnimationReferences } from "./starting-frame-animation-references";
import type { AIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { LazyHookStartingFrameWorkspace as HookStartingFrameWorkspace } from "./lazy-hook-starting-frame-workspace";
import { useStartingFramePhotos } from "./use-starting-frame-photos";
import { startingFramePhotoKey } from "@/lib/explore/starting-frame-photo-selection";
import { useHookComposerSelection } from "./use-hook-composer-selection";
import type { TalkingHeadReference } from "@/lib/explore/talking-head-reference";
import type { HookStartingFrameSelection } from "@/lib/explore/hook-keyframe-client";
import { hookStartingFrameDefaultDuration, hookStartingFrameFaceReferenceLimit, isHookStartingFrameVideoModel } from "@/worker/src/lib/hook-starting-frame-video";
import referenceStyles from "./talking-head-references.module.css";
import { Tabs } from "@base-ui/react/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAccountTimeZone } from "@/components/providers/account-timezone-provider";
import { useWorkflowSession } from "@/components/explore/use-workflow-session";
import { createWorkflowGenerationSettings, normalizeWorkflowGenerationSettings, type WorkflowGenerationSettings } from "@/lib/explore/workflow-generation-settings";
import { uploadHookVideoDemo } from "@/lib/trending/hook-video-client-upload";
import { uploadAIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import type { MediaAsset } from "@/lib/media/types";
import type { WorkflowSessionOptions } from "@/lib/explore/workflow-session";
import type { WorkflowDraftEntry } from "@/lib/explore/workflow-draft-lifecycle";

import { PendingExploreSchedulePanel, useBackgroundScheduleAvailability } from "./pending-schedule-panel";
import { HookWorkflowComposer } from "@/components/explore/hook-workflow-composer";
import { WorkflowCompositionPanel } from "@/components/explore/workflow-composition-panel";
import { WorkflowCreationPanel, type WorkflowSection } from "@/components/explore/workflow-creation-panel";
import { WorkflowEditWorkspace, WorkflowScheduleWorkspace } from "@/components/explore/workflow-edit-workspace";
import { WorkflowSchedulingPanel } from "@/components/explore/workflow-scheduling-panel";
import { WorkflowConnectedAccounts } from "@/components/explore/workflow-connected-accounts";
import { selectWorkflowAccount, workflowSelectedAccountIds, workflowSelectedPlatforms } from "@/lib/explore/workflow-scheduling-draft";
import { WorkflowPreviewCanvas } from "@/components/explore/workflow-preview-canvas";
import { WorkflowSectionNavigation, useWorkflowSectionOrientation } from "@/components/explore/workflow-section-navigation";
import { useWorkflowSourceVideo } from "@/components/explore/use-workflow-source-video";
import { WorkflowVideoSourceSection } from "@/components/explore/workflow-video-source-section";
import { WorkflowClipSourceActions } from "@/components/explore/workflow-clip-source-actions";
import { WorkflowVideoAssetPicker } from "@/components/explore/workflow-video-asset-picker";
import { WorkflowNavigationButton } from "@/components/layout/workflow-navigation";
import scrollbars from "@/components/ui/quiet-scrollbar.module.css";
import { useLocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";
import { useLocalWorkflowImages } from "@/components/explore/use-local-workflow-images";
import { getVideoReferencePolicy } from "@/lib/ai-studio/video-reference-policy";
import { WorkflowAccountBoundary, WorkflowGenerationBoundary } from "@/components/explore/workflow-generation-boundary";
import { WorkflowFinishingBoundary } from "@/components/explore/workflow-finishing-boundary";
import { TalkingHeadClipEditing } from "@/components/explore/talking-head-clip-editing";
import { TalkingHeadScheduleActions, TalkingHeadScheduleSummary } from "@/components/explore/talking-head-schedule-review";
import scheduleReview from "@/components/explore/workflow-schedule-review.module.css";
import scheduleLayout from "@/components/explore/talking-head-schedule-preview.module.css";
import studio from "@/components/explore/workflow-studio.module.css";
import creation from "@/components/explore/workflow-creation.module.css";
import sections from "@/components/explore/workflow-section-layout.module.css";
import { cn } from "@/lib/utils";
import type { AIStudioVideoModel } from "@/lib/ai-studio/generation-settings";
import type { ExploreBackgroundPlayback } from "@/worker/src/lib/explore-background-audio";
import type { DemoFraming } from "@/worker/src/lib/explore-finishing-contract";

export function HookWorkflowPreview({ initialDuration = 5, initialModel, generationEnabled = false, demoFramingEnabled = false, startingFrameEnabled = false, draftEntry }: { initialDuration?: number; initialModel?: AIStudioVideoModel; generationEnabled?: boolean; demoFramingEnabled?: boolean; startingFrameEnabled?: boolean; draftEntry?: WorkflowDraftEntry }) {
  return <WorkflowAccountBoundary enabled={generationEnabled}>{(ownerId) => <HookWorkflowLayout key={`${ownerId ?? "preview"}:${draftEntry?.id ?? "legacy"}`} ownerId={ownerId} initialDuration={initialDuration} initialModel={initialModel} generationEnabled={generationEnabled} demoFramingEnabled={demoFramingEnabled} startingFrameEnabled={startingFrameEnabled} draftEntry={draftEntry} />}</WorkflowAccountBoundary>;
}

function HookWorkflowLayout({ initialDuration, initialModel, generationEnabled, ownerId, demoFramingEnabled, startingFrameEnabled, draftEntry }: { initialDuration: number; initialModel?: AIStudioVideoModel; generationEnabled: boolean; ownerId: string | null; demoFramingEnabled: boolean; startingFrameEnabled: boolean; draftEntry?: WorkflowDraftEntry }) {
  const recovery = useWorkflowSession({ ownerId, enabled: generationEnabled, defaults: createWorkflowGenerationSettings(initialDuration, initialModel), draftEntry });
  if (generationEnabled && !ownerId) return <section className="p-6" role="status">Sign in to open your saved Talking Head + Demo workflow.</section>;
  if (!recovery.loaded) return <section className="p-6" role="status">Restoring your saved Talking Head + Demo workflow…</section>;
  if (recovery.error) return <section className="space-y-3 p-6"><p role="alert">{recovery.error}</p><Button type="button" variant="outline" onClick={recovery.retry}>Retry recovery</Button><Button type="button" variant="ghost" onClick={recovery.reset}>Reset saved workflow</Button><p className="text-xs text-muted">Accepted generation, video preparation and scheduling requests are kept.</p></section>;
  return <RestoredHookWorkflowLayout key={recovery.recoveryRevision} generationEnabled={generationEnabled} ownerId={ownerId} demoFramingEnabled={demoFramingEnabled} startingFrameEnabled={startingFrameEnabled} recovery={recovery} draftId={draftEntry?.id} />;
}

function RestoredHookWorkflowLayout({ generationEnabled, ownerId, demoFramingEnabled, startingFrameEnabled, recovery, draftId }: { generationEnabled: boolean; ownerId: string | null; demoFramingEnabled: boolean; startingFrameEnabled: boolean; recovery: ReturnType<typeof useWorkflowSession>; draftId?: string }) {
  const { acceptAsset, update: updateSession, clearMedia, clearProblem, markPending } = recovery;
  const searchParams = useSearchParams();
  const requestedSection = searchParams.get("section");
  const initialSection: WorkflowSection = requestedSection === "create" || requestedSection === "edit" || requestedSection === "schedule" ? requestedSection : recovery.session.section;
  const [section, setSection] = useState<WorkflowSection>(initialSection);
  const orientation = useWorkflowSectionOrientation();
  const [scheduleDraft, setLocalScheduleDraft] = useState(recovery.session.scheduleDraft);
  const timezone = useAccountTimeZone();
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [assetTarget, setAssetTarget] = useState<"opening" | "demo" | null>(null);
  const [replacementError, setReplacementError] = useState<string | null>(null);
  const [openingReplacementPending, setOpeningReplacementPending] = useState(false);
  const capability = useBackgroundScheduleAvailability(ownerId, generationEnabled);
  const backgroundScheduling = capability.data === true;
  const rememberSource = useCallback((asset: MediaAsset | null, _preview: unknown, mode: "upload" | "assets") => { if (asset) acceptAsset("source", asset, mode); }, [acceptAsset]);
  const selection = useWorkflowSourceVideo({ enabled: generationEnabled, ownerId, initialMode: recovery.session.sourceMode, onSelected: rememberSource });
  const initialSource = useRef(recovery.assets.source);
  const restoreSelection = useRef(() => selection.restoreOwned(initialSource.current, recovery.session.sourceMode));
  useEffect(() => { restoreSelection.current(); }, []); // Owner/recovery changes remount this verified session.
  const [audioMode, setAudioMode] = useState<"voice" | "recording">("voice");
  const [instructions, setLocalInstructions] = useState(recovery.session.instructions);
  const [generationSettings, setGenerationSettings] = useState(recovery.session.generationSettings);
  const changeGenerationSettings = useCallback((patch: Partial<WorkflowGenerationSettings>) => {
    setGenerationSettings(previous => normalizeWorkflowGenerationSettings({ ...previous, ...patch }));
    updateSession(previous => ({ ...previous, generationSettings: normalizeWorkflowGenerationSettings({ ...previous.generationSettings, ...patch }) }));
  }, [updateSession]);
  const generation = { settings: generationSettings, dirty: false, changeSettings: changeGenerationSettings };
  const references = useTalkingHeadReference({ ownerId, enabled: generationEnabled, session: recovery.session, updateSession, settings: generation.settings, onSettingsChange: generation.changeSettings });
  const videoReference = references.videoReference;
  const frameSelection = useHookComposerSelection(ownerId, generationEnabled && startingFrameEnabled, `talking_head:${draftId ?? "legacy"}`);
  const startingFrame = startingFrameEnabled ? frameSelection.frame : null;
  const [preparation, setPreparation] = useState<{ reference: TalkingHeadReference; draftId: string } | null>(null);
  const [facePhotoSelection, setFacePhotoSelection] = useState<{ key: string | null; photos: AIStudioReferenceMedia[] }>({ key: null, photos: [] });
  const photoKey = startingFrame ? startingFramePhotoKey(startingFrame) : null;
  const facePhotos = photoKey && facePhotoSelection.key === photoKey ? facePhotoSelection.photos : [];
  const framePhotos = useStartingFramePhotos(startingFrame ?? undefined, generation.settings.model, Boolean(generationEnabled && ownerId), photos => {
    setFacePhotoSelection({ key: photoKey, photos });
  });
  const activeFacePhotos = hookStartingFrameFaceReferenceLimit(generation.settings.model) ? facePhotos : [];
  const [facePending, setFacePending] = useState(false);
  const [faceError, setFaceError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const preparationDrafts = useRef(new Map<string, string>());
  const [createView, setCreateView] = useState<"references" | "videos">(() => recovery.session.sourceAssetId || recovery.session.generatedAssetId || recovery.session.demoAssetId || searchParams.get("hookJob") ? "videos" : "references");
  const [showGenerationResults, setShowGenerationResults] = useState(Boolean(searchParams.get("hookJob") && !recovery.session.generatedAssetId));
  const overviewActive = section === "edit" || section === "create" && createView === "videos" && !showGenerationResults;
  const hookAudio = useLocalWorkflowMedia("audio");
  const creator = useLocalWorkflowImages(getVideoReferencePolicy(generation.settings.model).maxImages);
  function approveStartingFrame(frame: HookStartingFrameSelection) {
    if (!preparation || frame.ownerId !== ownerId || frame.referenceId !== preparation.reference.id || frame.draftId !== preparation.draftId) return;
    if (!frameSelection.setFrame(frame)) return;
    setFaceError(null);
    videoReference.remove(); creator.remove();
    setReferenceReview(false);
    videoSelection.setMode("generate");
    const model = isHookStartingFrameVideoModel(generation.settings.model) ? generation.settings.model : "google_omni";
    generation.changeSettings({ model, duration: hookStartingFrameDefaultDuration(model), aspectRatio: frame.width > frame.height ? "16:9" : "9:16" });
    setPreparation(null);
  }
  const [referenceReview, setReferenceReview] = useState(recovery.session.localReferences);
  const hasLocalReferences = Boolean(creator.asset || videoReference.asset && !references.selectedId || hookAudio.asset || facePhotos.length);
  useEffect(() => {
    if (!referenceReview) updateSession(previous => ({ ...previous, localReferences: hasLocalReferences }));
  }, [referenceReview, hasLocalReferences, updateSession]);
  const localDemo = useLocalWorkflowMedia("video");
  const localDemoAudio = useLocalWorkflowMedia("audio");
  const [demoAudioPlayback, setLocalDemoAudioPlayback] = useState<ExploreBackgroundPlayback>(recovery.session.demoAudioPlayback);
  const [demoFraming, setLocalDemoFraming] = useState<{ frame: DemoFraming; aspect: number } | null>(recovery.session.demoFraming);
  const [demoUpload, setDemoUpload] = useState({ busy: false, error: null as string | null });
  const [audioUpload, setAudioUpload] = useState({ busy: false, error: null as string | null });
  const active = useRef(true), demoRevision = useRef(0), audioRevision = useRef(0);
  useEffect(() => {
    active.current = true;
    const demoRequests = demoRevision, audioRequests = audioRevision;
    return () => { active.current = false; demoRequests.current++; audioRequests.current++; };
  }, []);
  const previewAsset = (asset: MediaAsset | null) => asset ? { name: asset.title, url: asset.url, duration: asset.durationSeconds, width: asset.width, height: asset.height } : null;
  const demo = { ...localDemo, asset: previewAsset(recovery.assets.demo) ?? localDemo.asset, loading: demoUpload.busy || localDemo.loading,
    error: demoUpload.error ?? localDemo.error ?? recovery.problems.demo ?? null };
  const demoAudio = { ...localDemoAudio, asset: previewAsset(recovery.assets.demoAudio) ?? localDemoAudio.asset, loading: audioUpload.busy || localDemoAudio.loading,
    error: audioUpload.error ?? localDemoAudio.error ?? recovery.problems.demoAudio ?? null };
  const demoIdentity = recovery.session.demoAssetId ?? localDemo.asset?.url ?? null;
  const currentDemoIdentity = useRef(demoIdentity);
  useLayoutEffect(() => { currentDemoIdentity.current = demoIdentity; }, [demoIdentity]);
  const [clipsDirty, setClipsDirty] = useState(false);
  const markClipsDirty = useCallback(() => setClipsDirty(true), []);
  // Owned selections and unsent form/settings are saved synchronously. Browser
  // reference files still need a warning because a File cannot survive reload.
  const dirty = Boolean(hasLocalReferences || localDemo.asset || localDemoAudio.asset || demoUpload.busy || audioUpload.busy ||
    !generationEnabled && (clipsDirty || selection.dirty || instructions.length || demo.asset || demoAudio.asset || Object.values(scheduleDraft).some(Boolean)));

  const setScheduleDraft: typeof setLocalScheduleDraft = value => { const next = typeof value === "function" ? value(scheduleDraft) : value; setLocalScheduleDraft(next); recovery.update(previous => ({ ...previous, scheduleDraft: next })); };
  function setInstructions(value: string) { setLocalInstructions(value); recovery.update(previous => ({ ...previous, instructions: value })); }
  function setDemoAudioPlayback(value: ExploreBackgroundPlayback) { setLocalDemoAudioPlayback(value); recovery.update(previous => ({ ...previous, demoAudioPlayback: value })); }
  function setDemoFraming(value: typeof demoFraming) { setLocalDemoFraming(value); recovery.update(previous => ({ ...previous, demoFraming: value })); }
  const rememberOptions = useCallback((options: WorkflowSessionOptions) => updateSession(previous => ({ ...previous, options })), [updateSession]);
  const currentDemoAssetId = recovery.session.demoAssetId;
  const rememberDemo = useCallback((asset: MediaAsset) => { if (currentDemoAssetId !== asset.id) acceptAsset("demo", asset); }, [acceptAsset, currentDemoAssetId]);
  const rememberGenerated = useCallback((asset: MediaAsset | null) => {
    if (selection.mode !== "generate") return;
    if (asset) acceptAsset("source", asset, "generate");
    else updateSession(previous => ({ ...previous, generatedAssetId: null, generatedSelectionCleared: false, pendingSource: false }));
  }, [selection.mode, acceptAsset, updateSession]);
  const restoredImportedSource = recovery.session.sourceAssetId === recovery.assets.source?.id ? recovery.assets.source : null;
  const videoSelection = { ...selection,
    source: selection.source ?? (selection.mode !== "generate" && !recovery.session.pendingSource ? restoredImportedSource : null),
    preview: selection.preview ?? (selection.mode !== "generate" ? previewAsset(restoredImportedSource) : null),
    error: selection.error ?? recovery.problems.source ?? null,
    ready: selection.ready && !recovery.session.pendingSource && !recovery.problems.source,
    setMode: (mode: typeof selection.mode) => {
      const asset = selection.ownedForMode(mode);
      selection.setMode(mode);
      if (asset) acceptAsset("source", asset, mode);
      else updateSession(previous => ({ ...previous, sourceMode: mode, ...(mode !== "generate" ? { sourceAssetId: null } : {}), pendingSource: false }));
      clearProblem("source");
    },
    chooseUpload: async (file: File) => { markPending("source"); const accepted = await selection.chooseUpload(file); if (accepted) { setCreateView("videos"); setShowGenerationResults(false); } return accepted; },
    selectAsset: (asset: MediaAsset) => { const accepted = selection.selectAsset(asset); if (accepted) { setCreateView("videos"); setShowGenerationResults(false); } return accepted; },
    removeUpload: () => { selection.removeUpload(); clearMedia("source"); },
    clearUploadError: () => { selection.clearUploadError(); updateSession(previous => ({ ...previous, pendingSource: false })); clearProblem("source"); },
  };

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function changeSection(value: string) {
    if (value !== "create" && value !== "edit" && value !== "schedule") return;
    if (value === section) return;
    if (value === "create") setShowGenerationResults(false);
    workspaceRef.current?.querySelectorAll<HTMLMediaElement>("audio, video").forEach(player => player.pause());
    setSection(value);
    recovery.update(previous => ({ ...previous, section: value }));
    const params = new URLSearchParams(window.location.search);
    params.set("section", value);
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
    window.requestAnimationFrame(() => {
      workspaceRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
      workspaceRef.current?.querySelectorAll<HTMLElement>('[data-workflow-section-content], #hook-workflow-preview').forEach(panel => { panel.scrollTop = 0; });
      workspaceRef.current?.querySelector<HTMLButtonElement>('[role="tab"][data-active]')?.focus({ preventScroll: true });
    });
  }

  function removeDemo() {
    demoRevision.current++; audioRevision.current++;
    setDemoFraming(null);
    localDemoAudio.remove(); localDemo.remove();
    recovery.clearMedia("demo"); setDemoUpload({ busy: false, error: null }); setAudioUpload({ busy: false, error: null });
    setDemoAudioPlayback("once");
  }

  async function chooseDemo(file: File) {
    const request = ++demoRevision.current;
    // Replacing the demo cancels a pending audio candidate, but a rejected
    // replacement must not discard the audio already attached to the demo.
    audioRevision.current++; localDemoAudio.cancelPending(); setAudioUpload({ busy: false, error: null });
    updateSession(previous => ({ ...previous, pendingDemoAudio: false })); clearProblem("demoAudio");
    if (generationEnabled) recovery.markPending("demo");
    setDemoUpload({ busy: true, error: null });
    let accepted = false;
    try {
      if (!await localDemo.choose(file, { minDuration: 1, maxDuration: 60, maxBytes: 100 * 1024 ** 2 })) return false;
      if (generationEnabled) {
        if (!ownerId) throw new Error("Sign in to save your demo.");
        const result = { asset: await uploadHookVideoDemo(file, ownerId) };
        if (!active.current || request !== demoRevision.current) return false;
        if (!recovery.acceptAsset("demo", result.asset)) return false;
        localDemo.remove();
      }
      localDemoAudio.remove(); setDemoAudioPlayback("once"); setDemoFraming(null); accepted = true; return true;
    } catch (cause) { if (active.current && request === demoRevision.current) setDemoUpload({ busy: false, error: cause instanceof Error ? cause.message : "Could not upload the demo. Choose it again or remove it." }); return false; }
    finally { if (active.current && request === demoRevision.current) { setDemoUpload(previous => ({ ...previous, busy: false })); if (!accepted) updateSession(previous => ({ ...previous, pendingDemo: false })); } }
  }

  async function replaceOpening(file: File) {
    if (selection.busy || openingReplacementPending) return false;
    setReplacementError(null); setOpeningReplacementPending(true);
    // Retain the mounted generated/imported clip until its replacement is accepted.
    const accepted = await selection.chooseUpload(file);
    if (!active.current) return false;
    setOpeningReplacementPending(false);
    if (accepted) selection.setMode("upload");
    else setReplacementError("The replacement could not be added. Your previous hook is kept. Try another video.");
    return accepted;
  }

  function chooseDemoAsset(asset: MediaAsset) {
    if (asset.sourceType !== "demo_upload") return false;
    if (!recovery.acceptAsset("demo", asset)) return false;
    demoRevision.current++; audioRevision.current++;
    localDemo.cancelPending(); localDemo.remove(); localDemoAudio.remove(); recovery.clearMedia("demoAudio");
    setDemoAudioPlayback("once"); setDemoFraming(null);
    setDemoUpload({ busy: false, error: null }); setAudioUpload({ busy: false, error: null });
    return true;
  }

  async function chooseDemoAudio(file: File) {
    if (!demo.asset) return false;
    const boundDemo = demoIdentity;
    const request = ++audioRevision.current;
    if (generationEnabled) recovery.markPending("demoAudio");
    setAudioUpload({ busy: true, error: null });
    try {
      if (!await localDemoAudio.choose(file, { maxDuration: 600 })) return false;
      if (!active.current || request !== audioRevision.current || currentDemoIdentity.current !== boundDemo) return false;
      if (generationEnabled) {
        if (!ownerId) throw new Error("Sign in to save your demo audio.");
        const result = await uploadAIStudioReferenceMedia(file, "audio", 120, ownerId, { maxAudioDurationSeconds: 600, purpose: "explore-demo" });
        if (!active.current || request !== audioRevision.current || currentDemoIdentity.current !== boundDemo) return false;
        if (!recovery.acceptAsset("demoAudio", result.asset)) return false;
        localDemoAudio.remove();
      }
      setDemoAudioPlayback("once"); return true;
    } catch (cause) { if (active.current && request === audioRevision.current) setAudioUpload({ busy: false, error: cause instanceof Error ? cause.message : "Could not upload demo audio. Choose it again or remove it." }); return false; }
    finally { if (active.current && request === audioRevision.current) setAudioUpload(previous => ({ ...previous, busy: false })); }
  }

  function removeDemoAudio() {
    audioRevision.current++; localDemoAudio.remove(); recovery.clearMedia("demoAudio"); setAudioUpload({ busy: false, error: null });
    setDemoAudioPlayback("once");
  }

  return <WorkflowGenerationBoundary enabled={generationEnabled} ownerId={ownerId} draftId={draftId} restoredSelection={selection.mode === "generate" ? { assetId: recovery.session.generatedAssetId, asset: recovery.assets.source, ready: recovery.loaded && !recovery.session.pendingSource, allowAutomaticSelection: !recovery.session.generatedSelectionCleared } : undefined} onSelectionChange={rememberGenerated} draft={{ kind: "hook", instructions, referenceInstructions: startingFrame?.motionInstructions ?? references.instructions, settings: generation.settings, startingFrame, startingFramePhotos: activeFacePhotos.map(photo => ({ name: photo.asset.title, url: photo.asset.url, assetId: photo.asset.id })), creator: creator.asset, referenceImages: creator.assets, videoReference: videoReference.asset, audioReference: hookAudio.asset, referencesPending: framePhotos.pending || facePending || Boolean(preparation) || !frameSelection.ready || creator.loading || videoReference.loading || hookAudio.loading, referencesError: framePhotos.error || faceError || frameSelection.error || creator.error || videoReference.error || hookAudio.error || (referenceReview ? "Review your generation references. Browser files must be chosen again after returning to this workflow." : null) }}>{(run) => {
    const source = selection.mode === "generate" ? run?.selected ?? null : videoSelection.source;
    const sourcePreview = selection.mode === "generate" ? previewAsset(source) : videoSelection.preview;
    const generationView = run ? { ...run, onGenerate: () => { setCreateView("videos"); setShowGenerationResults(true); run.onGenerate(); } } : null;
    const outputAspect = source?.width && source.height ? source.width / source.height : generation.settings.aspectRatio === "16:9" ? 16 / 9 : 9 / 16;
    const framingError = demoFramingEnabled && demoFraming && Math.abs(demoFraming.aspect / outputAspect - 1) > .015 ? "Video shape changed. Record framing again for this shape, or reset it." : null;
    const demoSelectionError = openingReplacementPending ? "Wait for your replacement hook to finish uploading." : videoSelection.error ?? (demo.loading || demoAudio.loading ? "Wait for your selected demo media to finish loading." : demo.error || demoAudio.error || null);
    const currentFraming = demoFramingEnabled && !framingError ? demoFraming?.frame ?? null : null;
    const previewVisible = true;
    return <TalkingHeadClipEditing enabled={generationEnabled} ownerId={ownerId} draftId={draftId} source={source} sourcePreview={sourcePreview} demo={demo} demoSource={recovery.assets.demo} onDemoSourceReady={rememberDemo} demoFraming={currentFraming} active={overviewActive} backgroundScheduling={backgroundScheduling} onDirty={markClipsDirty} remixReferences={references.query.data}>{(clips) =>
    <WorkflowFinishingBoundary enabled={generationEnabled} ownerId={ownerId} kind="hook" source={clips.source} demo={clips.demo} demoSource={clips.demoSource} demoAudio={recovery.assets.demoAudio ? null : demoAudio.asset} demoAudioSource={recovery.assets.demoAudio} playback={recovery.assets.demoAudio ? demoAudioPlayback : clips.demoState?.backgroundAssetId ? clips.demoState.backgroundPlayback ?? "once" : demoAudioPlayback} demoAudioAssetId={recovery.assets.demoAudio ? null : clips.demoState?.backgroundAssetId ?? null} initialOptions={recovery.session.options} onOptionsChange={rememberOptions} scheduleDraft={scheduleDraft} scheduleTimezone={scheduleDraft.timezone ?? timezone} demoFraming={clips.demoFraming} demoFramingError={framingError ?? demoSelectionError ?? (recovery.assets.demoAudio && clips.demoState?.backgroundAssetId && recovery.assets.demoAudio.id !== clips.demoState.backgroundAssetId ? "Choose one demo audio track. Remove the separate Demo audio or remove the audio inside Edit demo video before preparing." : clips.error)} fastStatus backgroundScheduling={backgroundScheduling}
      draftId={draftId} onScheduled={recovery.complete}
      composition={{ version: 1, sourceEditing: clips.openingState?.editing ?? null, demoEditing: clips.demoState?.editing ?? null,
        sourceAudioAssetId: clips.openingState?.backgroundAssetId ?? null, sourceAudioPlayback: clips.openingState?.backgroundPlayback ?? "once" }}>{(finish) => <section className={cn(studio.studio, creation.shell, "min-w-0")}>
    {/* References and the current two-clip overview share the first-screen workspace. */}
    {Object.keys(recovery.problems).length ? <div className="space-y-2 px-5 py-3" role="alert"><p>{Object.values(recovery.problems).join(" ")}</p><Button type="button" size="sm" variant="outline" onClick={recovery.retry}>Retry recovery</Button>{recovery.problems.source ? <Button type="button" size="sm" variant="ghost" onClick={() => { selection.clearSelection(); recovery.clearMedia("source"); }}>Remove unavailable video</Button> : null}{recovery.problems.demo ? <Button type="button" size="sm" variant="ghost" onClick={removeDemo}>Remove unavailable demo</Button> : null}{recovery.problems.demoAudio ? <Button type="button" size="sm" variant="ghost" onClick={removeDemoAudio}>Remove unavailable audio</Button> : null}</div> : null}
    <Tabs.Root ref={workspaceRef} value={section} orientation={orientation} data-section={section} onValueChange={changeSection} data-hook-first-screen className={cn(sections.workspace, scheduleLayout.shell, scrollbars.surface, scrollbars.page)}>
        <header className={cn(creation.header, sections.header, "flex shrink-0 items-center gap-3 px-4 py-3 sm:px-6 lg:px-8")}>
          <WorkflowNavigationButton />
          {clips.editing ? <Button type="button" variant="ghost" aria-label="Back to videos overview" className="h-9 shrink-0 gap-2 px-2 text-sm" onClick={clips.closeEditor}><ArrowLeft className="size-4" aria-hidden="true" />Videos</Button> : <Link prefetch={true} href={generationEnabled ? "/explore" : "/explore?preview=1"} aria-label="Back to Explore" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" onClick={(event) => {
            if (!event.metaKey && !event.ctrlKey && dirty && !window.confirm("Leave this workflow? Your local changes are not saved.")) event.preventDefault();
          }}><ArrowLeft className="size-4" aria-hidden="true" /></Link>}
          <span className="hidden text-sm text-muted sm:block">{clips.editing ? null : "Explore"} <span className="ml-2" aria-hidden="true">/</span></span>
          <div className="min-w-0"><h1 className="text-base font-semibold tracking-tight text-foreground-strong sm:text-lg">Talking Head + Demo</h1></div>
          {clips.editing ? <Link href={generationEnabled ? "/explore" : "/explore?preview=1"} className="ml-auto shrink-0 rounded-md px-2 py-2 text-xs text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus" onClick={event => { if (!event.metaKey && !event.ctrlKey && dirty && !window.confirm("Leave this workflow? Your local changes are not saved.")) event.preventDefault(); }}>Explore</Link> : null}
          {draftId ? <Link href="/explore/create-hook?drafts=1" className="ml-auto text-sm text-primary">Saved drafts</Link> : null}
        </header>

      <div className={sections.layout}>
        <div className={sections.stage} data-preview-visible={previewVisible} data-focused-workflow data-stage={section} data-editing={clips.editing}>
        <WorkflowCreationPanel kind="hook" section={section} generation={selection.mode === "generate" ? generationView ?? undefined : undefined} create={selection.mode === "generate" ? undefined : { disabled: !videoSelection.ready, busy: selection.busy, message: videoSelection.ready ? "Your selected video is ready. Continue to add optional edits." : "Upload or choose a video to continue. Up to 120 seconds.", onAction: () => changeSection("edit") }} edit={generationEnabled ? finish.edit : undefined} schedule={generationEnabled ? finish.schedule : undefined}
          navigation={clips.editing ? undefined : <WorkflowSectionNavigation presentation="panel" editLabel="Demo" />}
          actionContent={section === "schedule" ? <></> : clips.editing ? clips.actions : undefined}
          >
          <Tabs.Panel value="create" keepMounted className={creation.sectionPanel}>
            <WorkflowVideoSourceSection kind="hook" label="Talking head video" hideHeading selection={videoSelection} />
            <div className={creation.generationFields} hidden={selection.mode !== "generate"}>
            <HookWorkflowComposer ownerId={ownerId} startingFrameMode={Boolean(startingFrame)} startingFrameControl={startingFrame || !frameSelection.ready || frameSelection.error ? <>
              {!frameSelection.ready || frameSelection.error ? <div className="space-y-2" role={frameSelection.error ? "alert" : "status"}><p>{frameSelection.error ?? "Restoring your starting frame…"}</p>{frameSelection.error ? <><Button type="button" variant="outline" onClick={frameSelection.retry}>Retry</Button><Button type="button" variant="ghost" onClick={() => frameSelection.setFrame(null)}>Clear saved starting frame</Button></> : null}</div> : null}
              {startingFrame ? <StartingFrameAnimationReferences compact frame={startingFrame} model={generation.settings.model} photos={facePhotos} onPhotosChange={photos => { framePhotos.remember(photos); setFacePhotoSelection({ key: photoKey, photos }); setFaceError(null); }} ownerId={ownerId ?? undefined} preview={!generationEnabled} active={section === "create"} disabled={Boolean(run?.busy || !frameSelection.ready)} onPendingChange={setFacePending} onErrorChange={setFaceError}
                onSelectFrame={frame => { if (frameSelection.setFrame(frame)) setFaceError(null); }} onClearFrame={() => { frameSelection.setFrame(null); setFacePhotoSelection({ key: null, photos: [] }); setFaceError(null); }}
                onPrepareFrame={() => { const reference = references.query.data?.find(item => item.id === startingFrame.referenceId); if (reference) setPreparation({ reference, draftId: startingFrame.draftId }); }} /> : null}
            </> : undefined} startingFrameSoundControl={startingFrame ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={run?.busy} checked={startingFrame.generateAudio} onChange={event => frameSelection.setFrame({ ...startingFrame, generateAudio: event.target.checked })} />Sound</label> : undefined} referenceInstructions={startingFrame ? { value: startingFrame.motionInstructions, onChange: value => frameSelection.setFrame({ ...startingFrame, motionInstructions: value }) } : references.selectedId ? { value: references.instructions, onChange: references.changeInstructions } : undefined} instructions={instructions} onInstructionsChange={setInstructions} creator={creator} imageReferences={creator} videoReference={videoReference} generationSettings={generation.settings} onGenerationSettingsChange={patch => {
              if (startingFrame && patch.model) { generation.changeSettings({ ...patch, duration: hookStartingFrameDefaultDuration(patch.model) }); }
              else generation.changeSettings(patch);
            }} audioLabel="Talking head audio" audio={hookAudio} audioMode={audioMode} onAudioModeChange={setAudioMode} />
            {references.selectedId ? <p role="status" className="mt-2 text-xs leading-5 text-muted">Reference: {references.query.data?.find(item => item.id === references.selectedId)?.durationSeconds.toFixed(1) ?? "…"}s · Generation: {generation.settings.duration}s. The selected model’s supported durations apply.</p> : null}
            {references.selectedId && videoReference.error ? <div className="space-y-2"><p role="alert" className="text-xs text-destructive">{videoReference.error}</p><Button type="button" variant="outline" size="sm" onClick={references.retry}>Retry reference</Button><Button type="button" variant="ghost" size="sm" onClick={videoReference.remove}>Remove reference</Button></div> : null}
            {referenceReview ? <div className="mt-3 space-y-2"><p role="alert" className="text-xs leading-5 text-muted">Your generation references were local files. Choose them again, then confirm the current references. Your saved video remains available.</p><Button type="button" size="sm" variant="outline" disabled={creator.loading || videoReference.loading || hookAudio.loading} onClick={() => { setReferenceReview(false); updateSession(previous => ({ ...previous, localReferences: hasLocalReferences })); }}>{hasLocalReferences ? "Use current references" : "Continue without references"}</Button></div> : null}
            </div>
          </Tabs.Panel>
          <Tabs.Panel value="edit" keepMounted className={creation.sectionPanel}>
            {clips.controls}
            <div hidden={clips.editing}>
            <WorkflowCompositionPanel videoLabel="Talking head" demoOriginalSound={clips.demoOriginalSound} demoSourceActions={<WorkflowClipSourceActions library="content" label="demo video" triggerLabel={demo.asset ? "Change" : undefined} disabled={finish.edit.busy || clips.busy} onUpload={chooseDemo} onChooseAssets={() => setAssetTarget("demo")} />} connected={generationEnabled} ownerId={ownerId} options={finish.options} onOptionsChange={finish.setOptions} backgroundMusic={finish.music} captions={{ ...finish.captions,
              onOpen: () => workspaceRef.current?.querySelectorAll<HTMLMediaElement>("audio, video").forEach(player => player.pause()),
              preview: <WorkflowScheduleWorkspace captionReview rawComposition draft={scheduleDraft} source={clips.source} sourcePreview={sourcePreview} demoSource={clips.demoSource} demo={demo.asset} demoAudio={demoAudio.asset} demoAudioPlayback={demoAudioPlayback} openingPreview={clips.openingPreview} demoPreview={clips.demoPreview} demoFraming={clips.demoFraming} rawDemoFraming={currentFraming} options={finish.options} backgroundSource={finish.options.backgroundMusic ? finish.music.source : null} backgroundPlayback={finish.music.playback} captions={finish.captions.transcript} ownerId={ownerId} enabled={generationEnabled} previewDisabledReason={framingError ?? demoSelectionError ?? finish.music.selectionError} previewWarning={clips.error} /> }}
              demoFramingEnabled={demoFramingEnabled} demoFraming={currentFraming} demoFramingError={framingError} onDemoFramingChange={frame => setDemoFraming(frame ? { frame, aspect: outputAspect } : null)} editingBusy={finish.edit?.busy}
              outputAspect={outputAspect} onDemoControlsOpen={() => workspaceRef.current?.querySelectorAll<HTMLMediaElement>("audio, video").forEach(player => player.pause())}
              demo={{ ...demo, choose: chooseDemo, remove: removeDemo }} demoAudio={{ ...demoAudio, choose: chooseDemoAudio, remove: removeDemoAudio,
                chooseRemote: (loadFile, options, acceptFile) => localDemoAudio.chooseRemote(loadFile, options, acceptFile ?? chooseDemoAudio) }} demoAudioPlayback={demoAudioPlayback} onDemoAudioPlaybackChange={setDemoAudioPlayback} />
            </div>
          </Tabs.Panel>
          <Tabs.Panel value="schedule" keepMounted className={creation.sectionPanel}>
            <div className={scheduleReview.panel}>
            <div hidden={Boolean(finish.pendingComposition && !finish.output)}><WorkflowSchedulingPanel ownerId={ownerId} captionEnabled={generationEnabled && section === "schedule" && !finish.schedule.busy} captionScope={draftId ?? "talking-head"} draft={scheduleDraft} onChange={setScheduleDraft} timezone={scheduleDraft.timezone ?? timezone} presentation="review" footer={<TalkingHeadScheduleActions action={finish.schedule} preparation={finish.output ? undefined : finish.edit} enabled={generationEnabled} onBackToEdit={() => changeSection("edit")} />} accountsControl={<WorkflowConnectedAccounts enabled={generationEnabled} active={section === "schedule"} ownerId={ownerId} platforms={workflowSelectedPlatforms(scheduleDraft)} selectedIds={workflowSelectedAccountIds(scheduleDraft)} onSelect={(platform, id) => setScheduleDraft(current => selectWorkflowAccount(current, platform, id))} />} /></div>
            {finish.pendingComposition && !finish.output && ownerId ? <PendingExploreSchedulePanel owner={ownerId} scope={draftId ? `talking-head-demo:${draftId}` : "talking-head-demo"} onScheduled={recovery.complete} composition={finish.pendingComposition}
              draft={scheduleDraft} onChange={setScheduleDraft} timezone={scheduleDraft.timezone ?? timezone ?? "UTC"} active={section === "schedule"} onBackToEdit={() => changeSection("edit")} /> : null}
            {!(finish.pendingComposition && !finish.output) ? <TalkingHeadScheduleSummary draft={scheduleDraft} timezone={scheduleDraft.timezone ?? timezone} /> : null}
            </div>
          </Tabs.Panel>
        </WorkflowCreationPanel>
        <section id="hook-workflow-preview" aria-label="Hook creation workspace" className={cn(creation.main, sections.preview)} hidden={!previewVisible}>
          <nav className={referenceStyles.tabs} aria-label="Creation views" hidden={section !== "create" || clips.editing}>
            <button type="button" aria-pressed={createView === "references"} onClick={() => setCreateView("references")}>References</button>
            <button type="button" disabled={!generationEnabled || Boolean(run?.busy)} onClick={() => { workspaceRef.current?.querySelectorAll<HTMLMediaElement>("audio, video").forEach(player => player.pause()); setHistoryOpen(true); }}>History</button>
            <button type="button" aria-pressed={createView === "videos"} onClick={() => { setCreateView("videos"); setShowGenerationResults(false); }}>Your videos</button>
          </nav>
          <div hidden={section !== "create" || createView !== "references"}>
            <TalkingHeadReferences startingFrameEnabled={startingFrameEnabled} items={references.query.data ?? []} loading={references.query.isPending && generationEnabled} failed={references.query.isError} selectedId={startingFrame?.referenceId ?? references.selectedId} model={generationSettings.model} disabled={Boolean(run?.busy || videoReference.loading || !frameSelection.ready)} onChoose={id => {
              if (!startingFrameEnabled) { void references.choose(id); return; }
                const reference = references.query.data?.find(item => item.id === id);
              if (reference) {
                const preparationDraftId = startingFrame?.referenceId === id ? startingFrame.draftId : draftId ?? preparationDrafts.current.get(id) ?? crypto.randomUUID();
                preparationDrafts.current.set(id, preparationDraftId);
                setPreparation({ reference, draftId: preparationDraftId });
              }
            }} onRetry={() => { void references.query.refetch(); }} />
          </div>
          <div hidden={section !== "create" || createView !== "videos" || !showGenerationResults}>
            <WorkflowPreviewCanvas kind="hook" generation={generationView ?? undefined} />
          </div>
          <div hidden={!overviewActive}>
            {clips.preview}<div hidden={clips.editing}><WorkflowEditWorkspace kind="hook" rawComposition openingPreview={clips.openingPreview} demoSegmentPreview={clips.demoPreview} demo={{ ...demo, choose: chooseDemo, remove: removeDemo }} demoAudio={demoAudio} generatedVideo={clips.source} sourcePreview={clips.source ? { name: clips.source.title, url: clips.source.url, duration: clips.source.durationSeconds } : sourcePreview} onChangeSource={() => changeSection("create")} sourceActions={<><WorkflowClipSourceActions label="hook video" triggerLabel={sourcePreview ? "Change" : undefined} disabled={openingReplacementPending || selection.busy || finish.edit.busy || clips.busy || Boolean(run?.busy)} onUpload={replaceOpening} onChooseAssets={() => { setReplacementError(null); setAssetTarget("opening"); }} onGenerate={() => { videoSelection.setMode("generate"); setCreateView("references"); changeSection("create"); }} />{replacementError ? <p role="alert" className="w-full text-xs text-destructive">{replacementError}</p> : null}</>} demoSourceActions={<WorkflowClipSourceActions library="content" label="demo video" triggerLabel={demo.asset || clips.demoSource ? "Change" : undefined} disabled={finish.edit.busy || clips.busy} onUpload={chooseDemo} onChooseAssets={() => setAssetTarget("demo")} />} finishedVideo={finish.output} demoFraming={clips.demoFraming} demoPreview={clips.demoSource ? { name: clips.demoSource.title, url: clips.demoSource.url, duration: clips.demoSource.durationSeconds } : undefined} onEditSource={clips.openOpening ? () => { changeSection("edit"); clips.openOpening?.(); } : undefined} onEditDemo={clips.openDemo ? () => { changeSection("edit"); void clips.openDemo?.(); } : undefined} editingBusy={finish.edit.busy || clips.busy} compositionPreview={finish.options.backgroundMusic || finish.options.subtitles || demoAudio.asset ? <WorkflowScheduleWorkspace editingPreview rawComposition draft={scheduleDraft} source={clips.source} sourcePreview={sourcePreview} demoSource={clips.demoSource} demo={demo.asset} demoAudio={demoAudio.asset} demoAudioPlayback={demoAudioPlayback} openingPreview={clips.openingPreview} demoPreview={clips.demoPreview} demoFraming={clips.demoFraming} rawDemoFraming={currentFraming} options={finish.options} backgroundSource={finish.options.backgroundMusic ? finish.music.source : null} backgroundPlayback={finish.music.playback} captions={finish.captions.transcript} ownerId={ownerId} enabled={generationEnabled} previewDisabledReason={framingError ?? demoSelectionError ?? finish.music.selectionError} previewWarning={clips.error} /> : null} /></div>
          </div>
          {section === "schedule" ? <WorkflowScheduleWorkspace rawComposition draft={scheduleDraft} finishedVideo={finish.output} source={clips.source} sourcePreview={sourcePreview} demoSource={clips.demoSource} demo={demo.asset} demoAudio={demoAudio.asset} demoAudioPlayback={demoAudioPlayback} openingPreview={clips.openingPreview} demoPreview={clips.demoPreview} demoFraming={clips.demoFraming} rawDemoFraming={currentFraming} options={finish.options} backgroundSource={finish.options.backgroundMusic ? finish.music.source : null} backgroundPlayback={finish.music.playback} captions={finish.captions.transcript} ownerId={ownerId} enabled={generationEnabled} previewDisabledReason={framingError ?? demoSelectionError ?? finish.music.selectionError} previewWarning={clips.error} active={section === "schedule"} /> : null}
          {section === "create" && selection.mode === "generate" && source ? <div className={cn(sections.nextStage, "mx-5 mb-5")}><Button type="button" className="h-11 rounded-xl font-semibold shadow-sm hover:shadow transition-shadow" onClick={() => changeSection("edit")}>Continue</Button></div> : section === "edit" && (finish.output || finish.pendingComposition && !finish.pendingComposition.error) && !clips.editing ? <div className={cn(sections.nextStage, "mx-5 mb-5")}><Button type="button" className="h-11 rounded-xl font-semibold shadow-sm hover:shadow transition-shadow" onClick={() => changeSection("schedule")}>Schedule video</Button></div> : null}
        </section>
        </div>

      </div>
    </Tabs.Root>
    {preparation ? <HookStartingFrameWorkspace reference={preparation.reference} ownerId={generationEnabled ? ownerId : null} draftId={preparation.draftId} preparationFormat="talking_head" presentation="recreation" onClose={() => setPreparation(null)} onUseStartingFrame={approveStartingFrame} /> : null}
    <WorkflowVideoAssetPicker library="generation_history" open={historyOpen} onOpenChange={setHistoryOpen} ownerId={ownerId} selectedId={source?.id} description="Choose an earlier generated video. Your Demo and script stay unchanged." onSelect={asset => { if (run?.busy || openingReplacementPending || selection.busy) return false; videoSelection.setMode("generate"); acceptAsset("source", asset, "generate"); setCreateView("videos"); setShowGenerationResults(true); return true; }} />
    <WorkflowVideoAssetPicker library={assetTarget === "demo" ? "content" : "creative_assets"} open={Boolean(assetTarget)} onOpenChange={open => { if (!open) setAssetTarget(null); }} ownerId={ownerId} selectedId={assetTarget === "demo" ? recovery.assets.demo?.id : recovery.assets.source?.id} description={assetTarget === "demo" ? "Choose a previously uploaded video from the Demo screen." : "Choose your talking head video from Creative Assets."} onSelect={asset => { if (openingReplacementPending || selection.busy || demo.loading) return false; const accepted = assetTarget === "demo" ? chooseDemoAsset(asset) : selection.selectAsset(asset); if (accepted && assetTarget === "opening") selection.setMode("assets"); return accepted; }} />

  </section>}</WorkflowFinishingBoundary>}</TalkingHeadClipEditing>;
  }}</WorkflowGenerationBoundary>;
}
