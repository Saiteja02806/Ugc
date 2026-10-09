"use client";

/* eslint-disable @next/next/no-img-element */
import { useQuery } from "@tanstack/react-query";
import { Tabs } from "@base-ui/react/tabs";
import { ArrowLeft, Check, Film, Images, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";

import { useBillingSubscription } from "@/components/billing/use-billing-subscription";
import { useAIStudioAccess } from "@/components/generation/use-ai-studio-access";
import { EmptyReferences, fetchRecreateReferences, FilterMenu, LoadError, ProReferenceGate, ReferenceCard, ReferenceGridSkeleton, ReferencePreviewDialog } from "@/components/explore/recreate-workspace";
import styles from "@/components/explore/format-workspace.module.css";
import creation from "@/components/explore/workflow-creation.module.css";
import { FormatVideoEditor, type FormatPreparationStatus } from "@/components/explore/format-video-editor";
import { FormatVideoEditFrame } from "@/components/explore/format-video-edit-frame";
import { FormatDemoWorkspace } from "@/components/explore/format-demo-workspace";
import { WorkflowVideoStartActions } from "@/components/explore/workflow-video-start-actions";
import { FormatSlideshowEditor, type SlideshowEditorController } from "@/components/explore/format-slideshow-editor";
import { FormatSchedulePanel } from "@/components/explore/format-schedule-panel";
import { WorkflowVideoSourceSection } from "@/components/explore/workflow-video-source-section";
import { WorkflowMediaPlayer } from "@/components/explore/hook-workflow-media-controls";
import { useWorkflowSourceVideo } from "@/components/explore/use-workflow-source-video";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { getAIStudioAccessMessage } from "@/lib/ai-studio/access-policy";
import { type AIStudioImageResult, type AIStudioVideoResult } from "@/lib/ai-studio/media-results";
import { formatVideoFromAsset, type FormatVideoSource } from "@/lib/explore/format-video-source";
import type { WorkflowVideoMode } from "@/lib/explore/workflow-source-video";
import type { MediaAsset } from "@/lib/media/types";
import { fetchAIStudioMediaAsset } from "@/lib/ai-studio/media-client";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { isExploreUuid } from "@/worker/src/lib/explore-finishing-contract";
import { filterReferences, interleaveReferenceCategories, referenceCategories, type RecreateFormat, type RecreateReference } from "@/lib/explore/recreate-types";
import { cn } from "@/lib/utils";

const ImagePanel = dynamic(() => import("@/components/workspace/ugc-chat-workspace").then(module => module.ImageGenerationStudioPanel));
const VideoPanel = dynamic(() => import("@/components/video/video-generation-workspace").then(module => module.VideoGenerationStudioPanel));
const EMPTY: RecreateReference[] = [];
const TITLES = { hook: "Hook video", wall_text: "Wall of text", slideshow: "Slideshows" };
type SavedOutput = { id: string; kind: "media_asset" | "library_item"; url: string; title: string; slides?: string[] };

type FormatWorkspaceProps = {
  format: RecreateFormat; previewReferences?: RecreateReference[]; finishingEnabled?: boolean; slideshowSavingEnabled?: boolean; previewVideo?: AIStudioVideoResult; previewAssets?: MediaAsset[];
  videoEditorLayout?: "controls" | "preview";
};
export function FormatWorkspace(props: FormatWorkspaceProps) {
  const { user } = useAuth();
  return <OwnedFormatWorkspace key={user?.uid ?? "signed-out"} {...props} />;
}
function OwnedFormatWorkspace({ format, previewReferences, finishingEnabled = false, slideshowSavingEnabled = false, previewVideo, previewAssets, videoEditorLayout = "controls" }: FormatWorkspaceProps) {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const localPreview = previewReferences !== undefined;
  const classic = format !== "slideshow";
  // Hook uses the chosen preview-side layout. A remains available in local comparisons.
  const previewSideEditor = classic && (localPreview ? videoEditorLayout === "preview" : format === "hook");
  const sectionTabs = format === "hook" ? previewSideEditor ? ["create", "demo", "schedule"] as const : ["create", "edit", "demo", "schedule"] as const : previewSideEditor ? ["create", "schedule"] as const : ["create", "edit", "schedule"] as const;
  const subscription = useBillingSubscription();
  const accountAccess = useAIStudioAccess();
  const accessState = localPreview ? "locked" : accountAccess;
  const editVideoId = searchParams.get("editVideoId");
  const initialMode = searchParams.get("videoSource") ?? (localPreview && previewVideo?.mediaAssetId ? "assets" : null);
  const source = useWorkflowSourceVideo({ enabled: !localPreview, ownerId: user?.uid ?? null, minDuration: 1,
    initialMode: initialMode === "upload" || initialMode === "assets" ? initialMode : "generate" });
  const [step, setStep] = useState<"create" | "edit" | "demo" | "schedule">(() => format !== "slideshow" && (localPreview && previewVideo || isExploreUuid(editVideoId)) ? "edit" : "create");
  const [hookEditOrigin, setHookEditOrigin] = useState<"create" | "demo">("create");
  const [view, setView] = useState<"references" | "results">(() => searchParams.get(`explore-${format}Job`) ? "results" : "references");
  const [controlsTarget, setControlsTarget] = useState<HTMLDivElement | null>(null);
  const [resultsTarget, setResultsTarget] = useState<HTMLDivElement | null>(null);
  const [editControlsTarget, setEditControlsTarget] = useState<HTMLDivElement | null>(null);
  const [editResultsTarget, setEditResultsTarget] = useState<HTMLDivElement | null>(null);
  const [createActionsTarget, setCreateActionsTarget] = useState<HTMLDivElement | null>(null);
  const [editActionsTarget, setEditActionsTarget] = useState<HTMLDivElement | null>(null);
  const [scheduleActionsTarget, setScheduleActionsTarget] = useState<HTMLDivElement | null>(null);
  const [demoControlsTarget, setDemoControlsTarget] = useState<HTMLDivElement | null>(null);
  const [demoResultsTarget, setDemoResultsTarget] = useState<HTMLDivElement | null>(null);
  const [demoActionsTarget, setDemoActionsTarget] = useState<HTMLDivElement | null>(null);
  const [scheduleResultsTarget, setScheduleResultsTarget] = useState<HTMLDivElement | null>(null);
  const [scheduleRequest, setScheduleRequest] = useState(0);
  const [openingPreparation, setOpeningPreparation] = useState<FormatPreparationStatus | undefined>();
  const reportOpeningPreparation = useCallback((status: FormatPreparationStatus) => setOpeningPreparation(status), []);
  const [demoPreparation, setDemoPreparation] = useState<FormatPreparationStatus | undefined>();
  const reportDemoPreparation = useCallback((status: FormatPreparationStatus) => setDemoPreparation(status), []);
  const [categories, setCategories] = useState<string[]>([]);
  const [referencePage, setReferencePage] = useState({ key: "", limit: 12 });
  const [selectedReference, setReference] = useState<RecreateReference | null>(null);
  const [generating, setGenerating] = useState(false);
  const reportBusy = useCallback((busy: boolean) => setGenerating(busy), []);
  const [slideshowSaving, setSlideshowSaving] = useState(false);
  const reportSlideshowBusy = useCallback((busy: boolean) => setSlideshowSaving(busy), []);
  const [previewReference, setPreviewReference] = useState<RecreateReference | null>(null);
  const mainArea = useRef<HTMLDivElement | null>(null);
  const controlsArea = useRef<HTMLElement | null>(null);
  const [slideIndex, setSlideIndex] = useState(() => { const value = Number(searchParams.get("slide")); return Number.isInteger(value) && value >= 1 && value <= 50 ? value - 1 : 0; });
  const [pickedVideo, setSelectedVideo] = useState<FormatVideoSource | null>(localPreview ? previewVideo ?? null : null);
  const restoredVideo = useQuery({ queryKey: ["explore-edit-restore", user?.uid, format, initialMode, editVideoId], enabled: !localPreview && !pickedVideo && Boolean(user) && format !== "slideshow" && isExploreUuid(editVideoId), queryFn: async () => {
    const token = await getCurrentUserIdToken(user?.uid); if (!token || !editVideoId) throw new Error("Sign in to restore your video edit.");
    const asset = await fetchAIStudioMediaAsset(editVideoId, token);
    if (initialMode !== "upload" && initialMode !== "assets" && asset.metadata.exploreFormat !== format) throw new Error("Choose a video from this workflow.");
    formatVideoFromAsset(asset); return asset;
  } });
  const selectedVideo = pickedVideo ?? (restoredVideo.data ? formatVideoFromAsset(restoredVideo.data) : null);
  const previewSource = localPreview && previewVideo?.mediaAssetId ? previewAssets?.find(asset => asset.id === previewVideo.mediaAssetId) : undefined;
  const restoredSource = !source.dirty && source.mode === initialMode ? restoredVideo.data ?? previewSource : undefined;
  const importedSource = source.source ?? restoredSource;
  const importedPreview = source.preview ?? (restoredSource ? { name: restoredSource.title, url: restoredSource.url, duration: restoredSource.durationSeconds } : null);
  const importedReady = source.ready || Boolean(restoredSource);
  const slideshowEditor = useRef<SlideshowEditorController | null>(null);
  const [slideshowRegenerationImage, setSlideshowRegenerationImage] = useState<AIStudioImageResult | null>(null);
  const [openingOutput, setSavedOutput] = useState<SavedOutput | null>(null);
  const [combinedOutput, setCombinedOutput] = useState<SavedOutput | null>(null);
  const [demoAdded, setDemoAdded] = useState(false);
  const savedOutput = format === "hook" && demoAdded ? combinedOutput : openingOutput;
  const markDirty = useCallback(() => { setSavedOutput(null); setCombinedOutput(null); }, []);
  const acceptOutput = useCallback((output: SavedOutput) => setSavedOutput(output), []);
  const acceptCombinedOutput = useCallback((output: SavedOutput) => setCombinedOutput(output), []);
  const changeDemo = useCallback((present: boolean) => { setDemoAdded(present); setCombinedOutput(null); }, []);
  const referencesQuery = useQuery({
    enabled: !localPreview && !authLoading && Boolean(user),
    queryKey: ["recreate-references", 2, user?.uid ?? "signed-out"],
    queryFn: ({ signal }) => fetchRecreateReferences(signal), staleTime: 30 * 60_000, retry: 1,
  });
  const references = previewReferences ?? referencesQuery.data ?? EMPTY;
  const reference = selectedReference ?? references.find(item => item.id === searchParams.get("refId") && item.format === format) ?? null;
  const options = useMemo(() => referenceCategories(references, format), [references, format]);
  const filtered = useMemo(() => {
    const result = filterReferences(references, format, categories);
    return format === "slideshow" ? interleaveReferenceCategories(result) : result;
  }, [references, format, categories]);
  const canBrowseAllReferences = format === "hook" || localPreview || subscription.data?.isActive === true;
  const filterKey = `${format}:${categories.join(":")}`;
  const visible = filtered.slice(0, canBrowseAllReferences ? referencePage.key === filterKey ? referencePage.limit : 12 : 1);
  const loading = !localPreview && (authLoading || referencesQuery.isFetching && !referencesQuery.data);
  const activeSlideIndex = reference ? Math.min(slideIndex, Math.max(0, reference.slides.length - 1)) : 0;
  const sourceImage = format === "slideshow" ? slideshowRegenerationImage?.url ?? reference?.slides[activeSlideIndex]?.url : reference?.posterUrl;
  const resultLabel = format === "slideshow" ? "Your Slides" : "Your Video";

  function revealOnMobile(target: "controls" | "preview") {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    requestAnimationFrame(() => (target === "controls" ? controlsArea : mainArea).current?.scrollIntoView({ block: "start", behavior: "instant" }));
  }
  function browseReferences() { setStep("create"); setView("references"); revealOnMobile("preview"); }
  function backToVideoPreview() { setStep(format === "hook" && hookEditOrigin === "demo" ? "demo" : "create"); setView("results"); revealOnMobile("preview"); }

  function clearVideoEdit() {
    setSelectedVideo(null); markDirty();
    const params = new URLSearchParams(window.location.search); params.delete("editVideoId");
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
  }
  function setVideoMode(mode: WorkflowVideoMode) {
    if (generating || source.busy) return;
    source.setMode(mode);
    if (previewSideEditor && step === "edit") setStep("create");
    const params = new URLSearchParams(window.location.search); params.set("videoSource", mode);
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
    setView(mode === "generate" ? "references" : "results");
  }
  function editVideo(video: FormatVideoSource, mode: WorkflowVideoMode) {
    if (selectedVideo?.id !== video.id || selectedVideo.mediaAssetId !== video.mediaAssetId) {
      setSelectedVideo(video); markDirty();
    }
    setHookEditOrigin("create"); setStep("edit");
    revealOnMobile(previewSideEditor ? "preview" : "controls");
    const params = new URLSearchParams(window.location.search); params.set("videoSource", mode);
    if (video.mediaAssetId) params.set("editVideoId", video.mediaAssetId); else params.delete("editVideoId");
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
  }
  function chooseVideoSource(mode: WorkflowVideoMode) {
    if (generating || source.busy) return;
    setVideoMode(mode); setStep("create"); revealOnMobile("controls");
  }
  function requestSchedule() {
    if (format === "hook") {
      if (!selectedVideo && importedSource) setSelectedVideo(formatVideoFromAsset(importedSource));
      setScheduleRequest(current => current + 1);
    }
    setStep("schedule"); revealOnMobile("controls");
  }
  function editImportedVideo() {
    if (!importedReady || !importedPreview) return;
    editVideo(importedSource ? formatVideoFromAsset(importedSource) : {
      id: `local:${importedPreview.url}`, mediaAssetId: null, createdAt: "", durationSeconds: importedPreview.duration,
      ratio: "9:16", status: "Ready", title: importedPreview.name, prompt: "", url: importedPreview.url,
    }, source.mode);
  }
  function editHookFromDemo() {
    if (!selectedVideo) editImportedVideo();
    else setStep("edit");
    setHookEditOrigin("demo"); revealOnMobile("preview");
  }
  const videoSelection = { ...source, source: importedSource ?? null, preview: importedPreview, ready: importedReady, setMode: setVideoMode,
    chooseUpload: async (file: File) => {
      if (generating) return false;
      clearVideoEdit(); setStep("create"); setView("results"); revealOnMobile("preview");
      return source.chooseUpload(file);
    },
    selectAsset: (asset: MediaAsset) => {
      if (generating || !source.selectAsset(asset)) return false;
      clearVideoEdit(); setStep("create"); setView("results"); revealOnMobile("preview"); return true;
    },
    removeUpload: () => { if (generating) return; clearVideoEdit(); setStep("create"); source.removeUpload(); },
  };

  function selectReference(next: RecreateReference) {
    if (generating || slideshowSaving) return;
    if (reference?.id !== next.id && format !== "slideshow") { setSavedOutput(null); }
    slideshowEditor.current?.startNewSlide();
    setSlideshowRegenerationImage(null);
    setReference(next); setSlideIndex(0);
    revealOnMobile("controls");
    const params = new URLSearchParams(window.location.search);
    for (const key of ["refType", "refId", "sourceUrl", "exploreRecreate", "slide"]) params.delete(key);
    params.set("refId", next.id);
    if (format !== "slideshow") {
      params.set("refType", format); params.set("refId", next.id); params.set("sourceUrl", next.videoUrl ?? ""); params.set("exploreRecreate", "1");
    }
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }
  function chooseSlide(index: number) {
    if (generating || slideshowSaving) return;
    slideshowEditor.current?.startNewSlide(); setSlideshowRegenerationImage(null);
    setSlideIndex(index);
    const params = new URLSearchParams(window.location.search); params.set("slide", String(index + 1));
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
  }

  function clearStyleReference() {
    if (generating || slideshowSaving) return;
    setReference(null);
    slideshowEditor.current?.startNewSlide();
    setSlideshowRegenerationImage(null);
    const params = new URLSearchParams(window.location.search);
    for (const key of ["refType", "refId", "sourceUrl", "exploreRecreate"]) params.delete(key);
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
  }
  const contextBanner = format !== "slideshow" ? undefined : <section className="space-y-3" aria-label="Selected reference">
    <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-medium">{format === "slideshow" ? "Choose a slideshow" : "Choose a reference"}</h2><button type="button" disabled={generating || slideshowSaving} className="rounded px-1 text-xs text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50" onClick={browseReferences}>{reference ? "Change" : "Browse"}</button></div>
    {reference ? <button type="button" onClick={() => setPreviewReference(reference)} className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left focus-visible:outline-2 focus-visible:outline-focus">
      <img src={sourceImage} alt="" width={36} height={48} className="h-12 w-9 rounded object-contain" />
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{reference.title}</span><span className="text-xs text-muted">{format === "slideshow" ? `${reference.slides.length} slides · Style reference` : "Style reference"}</span></span><Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
    </button> : <p className="text-xs leading-5 text-muted">Choose a slideshow for layout guidance, or attach your own image in Your instructions.</p>}
    {format === "slideshow" && reference ? <div className="flex gap-2 overflow-x-auto p-1">{reference.slides.map((slide, index) => <button key={slide.id} type="button" disabled={generating || slideshowSaving} aria-label={`Recreate slide ${index + 1}`} aria-pressed={index === activeSlideIndex} onClick={() => chooseSlide(index)} className={cn("w-10 shrink-0 overflow-hidden rounded bg-card-muted disabled:opacity-50", index === activeSlideIndex && "ring-2 ring-primary")}><img src={slide.url} alt="" width={40} height={50} className="aspect-[4/5] object-contain" /><span className="block text-[10px] text-muted">{index + 1}</span></button>)}</div> : null}
  </section>;
  const recreateView = {
    contextBanner, referenceImageUrl: sourceImage, referenceTitle: reference?.title, onClearReference: clearStyleReference, preview: localPreview,
    emptyContent: <div className={styles.emptyResult}><span className={styles.emptyIcon}>{format === "slideshow" ? <Images aria-hidden="true" /> : <Film aria-hidden="true" />}</span><h2 className="text-lg font-semibold">{format === "slideshow" ? "Your images will appear here" : "Your video will appear here"}</h2><p className="max-w-sm text-sm leading-6 text-muted">{format === "slideshow" ? "Choose a layout reference or attach your own image, then describe your changes in Create." : "Add your instructions in Create. You can use a style example or attach your own image or video."} Your generation will appear here, ready to edit.</p><Button type="button" variant="outline" onClick={browseReferences}>Browse references</Button></div>,
    workflow: { format, controlsTarget, controlsActive: step === "create" && (format === "slideshow" || source.mode === "generate"), resultsTarget, actionsTarget: createActionsTarget, onBusyChange: reportBusy, editingBusy: slideshowSaving,
      onGenerationStart: () => { setStep("create"); setView("results"); revealOnMobile("preview"); },
      onSelectVideo: (video: AIStudioVideoResult) => {
        editVideo(video, "generate");
      },
      onSelectImage: (image: AIStudioImageResult) => { if (slideshowEditor.current?.useImage(image)) setSlideshowRegenerationImage(null); setStep("edit"); revealOnMobile("controls"); },
    },
  };

  return <Tabs.Root className={cn(styles.workspace, classic && creation.shell, classic && styles.classicWorkspace)} value={previewSideEditor && step === "edit" ? format === "hook" ? hookEditOrigin : "create" : step} onValueChange={value => { if (value === "schedule") requestSchedule(); else if (value === "create" || value === "edit" || value === "demo" && format === "hook") { setStep(value); revealOnMobile("controls"); } }}>
    <header className={classic ? cn(creation.header, "flex shrink-0 items-center gap-3 px-4 py-3 sm:px-6 lg:px-8") : styles.header}>
      {classic ? <><Link href={localPreview ? "/explore?preview=1" : "/explore"} aria-label="Back to Explore" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><ArrowLeft className="size-4" aria-hidden="true" /></Link><span className="hidden text-sm text-muted sm:block">Explore <span className="ml-2" aria-hidden="true">/</span></span><div className="min-w-0"><h1 className="text-base font-semibold tracking-tight text-foreground-strong sm:text-lg">{TITLES[format]}</h1></div></> : <><Link href={localPreview ? "/explore?preview=1" : "/explore"} className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" />Explore</Link><span aria-hidden="true" className="text-sm text-muted">/</span><div className={styles.heading}><h1 className="text-lg font-semibold tracking-tight">{TITLES[format]}</h1></div></>}
      {!classic ? <span className={styles.mediaBadge}><Images className="size-3.5" aria-hidden="true" />Images only</span> : null}
    </header>
    <div className={classic ? creation.layout : styles.body}>
      <aside ref={controlsArea} data-section={step} className={classic ? cn(creation.controls, previewSideEditor && step === "edit" && styles.previewEditingControls) : styles.controls} aria-label={`${TITLES[format]} controls`}>
        <Tabs.List className={cn(classic ? creation.sectionTabs : styles.sectionTabs, format === "hook" && !previewSideEditor && creation.fourSectionTabs)} aria-label="Workflow sections" activateOnFocus>{sectionTabs.map(value => <Tabs.Tab key={value} value={value} className={classic ? creation.sectionTab : styles.sectionTab}>{value === "create" ? "Create" : value === "edit" ? format === "slideshow" ? "Edit slides" : "Edit video" : value === "demo" ? "Demo" : "Schedule"}</Tabs.Tab>)}</Tabs.List>
        <div className={classic ? creation.controlContent : styles.controlContent}>
        <Tabs.Panel value="create" keepMounted className={classic ? creation.sectionPanel : styles.sectionPanel}>
        {format !== "slideshow" ? <div>
          <WorkflowVideoSourceSection kind="hook" label={TITLES[format]} selection={videoSelection} disabled={generating} description="Choose a video to trim, add text and save in this workflow." previewAssets={localPreview ? previewAssets : undefined} />
        </div> : null}
        <div ref={setControlsTarget} className={classic ? creation.generationFields : styles.createControls} hidden={format !== "slideshow" && source.mode !== "generate"} />
        </Tabs.Panel>
        {!previewSideEditor ? <Tabs.Panel value="edit" keepMounted className={classic ? creation.sectionPanel : styles.sectionPanel}>
        <div ref={setEditControlsTarget} className={styles.editControls} />
        {step === "edit" && !selectedVideo && format !== "slideshow" ? <div className="space-y-4">
          <h2 className="text-sm font-medium">Add a video</h2>
          {restoredVideo.isFetching ? <p role="status" className="text-xs text-muted">Restoring your video edit…</p> : <WorkflowVideoStartActions onChoose={chooseVideoSource} disabled={generating || source.busy} />}
          {restoredVideo.isError ? <p role="alert" className="text-xs text-destructive">This saved video is unavailable. Choose another video.</p> : null}
          {importedReady ? <Button type="button" variant="outline" className="w-full" onClick={editImportedVideo}>Edit selected video</Button> : null}
        </div> : null}
        </Tabs.Panel> : null}
        {format === "hook" ? <Tabs.Panel value="demo" keepMounted className={creation.sectionPanel}><div ref={setDemoControlsTarget} /></Tabs.Panel> : null}
        <Tabs.Panel value="schedule" keepMounted className={classic ? cn(creation.sectionPanel, styles.classicSchedule) : styles.sectionPanel}>
        <FormatSchedulePanel key={format} actionsTarget={scheduleActionsTarget} active={step === "schedule"} output={savedOutput} localPreview={localPreview} imageOnly={format === "slideshow"} preparing={format === "hook" && Boolean(selectedVideo || importedPreview) && !savedOutput} />
        </Tabs.Panel>
        </div>
        <footer hidden={previewSideEditor && (step === "edit" || step === "create" && source.mode !== "generate")} className={classic ? creation.actionFooter : styles.actionFooter} aria-label="Workflow action">
          <div ref={setCreateActionsTarget} hidden={step !== "create" || format !== "slideshow" && source.mode !== "generate"} />
          {!previewSideEditor ? <div ref={setEditActionsTarget} hidden={step !== "edit"} /> : null}
          <div ref={setScheduleActionsTarget} hidden={step !== "schedule"} />
          {format === "hook" ? <div ref={setDemoActionsTarget} hidden={step !== "demo"} /> : null}
          {step === "create" && format !== "slideshow" && source.mode !== "generate" ? <div className="space-y-2"><Button type="button" className="h-11 w-full rounded-lg" disabled={!importedReady} onClick={editImportedVideo}>Edit this video</Button><p role="status" className="text-xs leading-5 text-muted">{source.busy ? "Preparing your video…" : importedReady ? "Your video is ready to edit." : "Upload or choose a video to continue."}{localPreview ? " Preview · uploads stay on your device." : ""}</p></div> : null}
          {step === "edit" && !selectedVideo && format !== "slideshow" ? <Button type="button" disabled className="h-11 w-full rounded-lg">Save edits</Button> : null}
        </footer>
      </aside>
      <div ref={mainArea} role="region" aria-label="Workflow preview" className={classic ? cn(creation.main, styles.classicMain) : styles.main}>
        {previewSideEditor ? selectedVideo ? <FormatVideoEditFrame active={step === "edit"} clip={format === "hook" ? "hook" : "video"} onBack={backToVideoPreview} backLabel={format === "hook" && hookEditOrigin === "demo" ? "Back to previews" : "Back to preview"} previewRef={setEditResultsTarget} controlsRef={setEditControlsTarget} actionsRef={setEditActionsTarget} /> : <section hidden={step !== "edit"} className={styles.emptyResult} aria-label="Choose a video to edit"><h2 className="text-lg font-semibold">Choose a video to edit</h2>{restoredVideo.isFetching ? <p role="status" className="text-sm text-muted">Restoring your video edit…</p> : <WorkflowVideoStartActions onChoose={chooseVideoSource} disabled={generating || source.busy} />}{restoredVideo.isError ? <p role="alert" className="text-sm text-destructive">This saved video is unavailable. Choose another video.</p> : null}</section> : <div ref={setEditResultsTarget} hidden={step !== "edit"} className={styles.results}>
          {step === "edit" && !selectedVideo && format !== "slideshow" ? <div className={styles.emptyResult}><span className={styles.emptyIcon}><Film aria-hidden="true" /></span><h2 className="text-xl font-semibold">Choose a video to edit</h2></div> : null}
        </div>}
        {format === "hook" ? <div ref={setDemoResultsTarget} hidden={step !== "demo"} className="min-w-0 flex-1" /> : null}
        {format === "hook" ? <div ref={setScheduleResultsTarget} hidden={step !== "schedule"} className="min-w-0 flex-1" /> : null}
        <div hidden={step !== "create"} className="flex min-h-0 flex-1 flex-col">
          <nav className={styles.resultTabs} aria-label="Creation views">{(["references", "results"] as const).map(value => <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)} className={cn(styles.resultTab, view === value && styles.active)}>{value === "references" ? "References" : resultLabel}</button>)}</nav>
          <section hidden={view !== "references"} aria-label="References" className={styles.referenceArea}>
            <div className="mb-5 flex items-center justify-between gap-3"><p className="text-sm text-muted">Preview a reference, or select <RotateCcw className="inline-block size-3.5 align-middle text-foreground" role="img" aria-label="Recreate" /> to recreate it.</p><FilterMenu activeCategories={categories} categories={options} count={filtered.length} disabled={loading} onClear={() => setCategories([])} onToggle={(category, checked) => setCategories(current => checked ? [...current, category] : current.filter(value => value !== category))} /></div>
            {loading ? <ReferenceGridSkeleton /> : referencesQuery.isError && !localPreview ? <LoadError onRetry={() => void referencesQuery.refetch()} /> : visible.length ? <div className={styles.referenceGrid}>{visible.map(item => <ReferenceCard key={item.id} reference={item} compact isSelected={reference?.id === item.id} onPreview={() => setPreviewReference(item)} onRecreate={() => selectReference(item)} />)}</div> : <EmptyReferences format={format} hasFilters={categories.length > 0} onClear={() => setCategories([])} />}
            {!canBrowseAllReferences && filtered.length > 1 ? <ProReferenceGate /> : null}
            {canBrowseAllReferences && filtered.length > 0 ? <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4"><p className="text-xs text-muted">{visible.length} of {filtered.length} references</p>{visible.length < filtered.length ? <Button type="button" variant="outline" size="sm" onClick={() => setReferencePage({ key: filterKey, limit: visible.length + 12 })}>Show more references</Button> : null}</div> : null}
          </section>
          <div ref={setResultsTarget} hidden={view !== "results" || format !== "slideshow" && source.mode !== "generate"} className={styles.results} />
          {format !== "slideshow" && source.mode !== "generate" ? <section hidden={view !== "results"} aria-label="Selected video" className={styles.results}>
            <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-6">
              {importedPreview ? <><WorkflowMediaPlayer asset={importedPreview} kind="video" label="Your selected video" className="max-h-[60dvh] max-w-full rounded-xl" /><h2 className="max-w-full break-words text-center text-base font-semibold">{importedPreview.name}</h2>{previewSideEditor ? <div className="flex flex-wrap justify-center gap-2"><Button type="button" onClick={editImportedVideo} disabled={!importedReady}>{format === "hook" ? "Edit hook video" : "Edit video"}</Button>{format === "hook" ? <Button type="button" variant="outline" onClick={() => { setStep("demo"); revealOnMobile("preview"); }}>Continue to Demo</Button> : null}</div> : <p className="text-sm text-muted">Use Edit this video to open the editor.</p>}</> : <div className={styles.emptyResult}><span className={styles.emptyIcon}><Film aria-hidden="true" /></span><h2 className="text-lg font-semibold">Your video will appear here</h2><p className="max-w-sm text-center text-sm leading-6 text-muted">{source.mode === "upload" ? "Upload your video in Create, then use Edit below its preview to trim or add text." : "Choose an existing video from Creative Assets to start editing."}</p></div>}
              {source.busy ? <p role="status" className="text-sm text-muted">{localPreview ? "Reading your video…" : "Uploading your video…"}</p> : null}
            </div>
          </section> : null}
        </div>
        {step === "schedule" && format !== "hook" ? savedOutput ? <div className={styles.savedPreview}><h2 className="mb-4 text-base font-semibold">Post preview</h2>{savedOutput.kind === "media_asset" ? <video src={savedOutput.url} controls playsInline className="max-h-[65dvh] max-w-full rounded-xl" /> : <div className="grid w-full grid-cols-2 gap-4 xl:grid-cols-3">{(savedOutput.slides ?? [savedOutput.url]).map((url, index) => <figure key={`${index}:${url}`}><img src={url} alt={`Saved slide ${index + 1}`} width={1080} height={1350} className="aspect-[4/5] w-full rounded-xl object-contain" /><figcaption className="mt-2 text-center text-xs text-muted">{index + 1}</figcaption></figure>)}</div>}<p className="mt-3 text-sm text-muted">{savedOutput.title}</p></div> : <div className={styles.emptyResult}><span className={styles.emptyIcon}>{format === "slideshow" ? <Images aria-hidden="true" /> : <Film aria-hidden="true" />}</span><h2 className="text-xl font-semibold">Your final post</h2><p className="max-w-sm text-sm leading-6 text-muted">Save your {format === "slideshow" ? "slideshow" : "video"} in Edit {format === "slideshow" ? "slides" : "video"}. Your finished content will appear here before you schedule it.</p><Button type="button" variant="outline" onClick={() => setStep("edit")}>Go to Edit {format === "slideshow" ? "slides" : "video"}</Button></div> : null}
      </div>
    </div>
    {/* Mounted across steps so job polling and drafts survive navigation. */}
    <div className="contents">
      {controlsTarget && resultsTarget ? format === "slideshow" ? <ImagePanel active accessState={accessState} accessMessage={localPreview ? "Preview · generation disabled" : getAIStudioAccessMessage(accessState)} creditCost={subscription.data?.imageGenerationCreditCost ?? 1} creditsRemaining={subscription.data?.creditsRemaining ?? null} recreateView={recreateView} /> : <VideoPanel active accessState={accessState} accessMessage={localPreview ? "Preview · generation disabled" : getAIStudioAccessMessage(accessState)} creditsPerSecond={subscription.data?.videoGenerationCreditsPerSecond} creditsRemaining={subscription.data?.creditsRemaining ?? null} recreateView={recreateView} /> : null}
    </div>
    {format !== "slideshow" && selectedVideo ? <FormatVideoEditor key={`${user?.uid}:${selectedVideo.id}`} format={format} video={selectedVideo} active={step === "edit"} controlsTarget={editControlsTarget} actionsTarget={editActionsTarget} resultsTarget={editResultsTarget} enabled={finishingEnabled && !localPreview} onDirty={markDirty} onSaved={acceptOutput} onContinue={() => setStep(format === "hook" ? "demo" : "schedule")} prepareRequest={format === "hook" && step === "schedule" && !demoPreparation?.busy ? scheduleRequest : 0} onPreparationChange={reportOpeningPreparation} onBackToPreview={backToVideoPreview} previewSide={previewSideEditor} backLabel={previewSideEditor && format === "hook" && hookEditOrigin === "demo" ? "Back to previews" : "Back to preview"} /> : null}
    {format === "hook" ? <FormatDemoWorkspace ownerId={user?.uid ?? null} enabled={finishingEnabled && !localPreview} localPreview={localPreview} active={step === "demo"} opening={openingOutput} sourcePreview={selectedVideo ? { name: selectedVideo.title, url: selectedVideo.url, duration: selectedVideo.durationSeconds } : importedPreview} controlsTarget={demoControlsTarget} resultsTarget={demoResultsTarget} actionsTarget={demoActionsTarget} previewAssets={previewAssets} onChooseSource={chooseVideoSource} onDemoChange={changeDemo} onSaved={acceptCombinedOutput} onContinue={requestSchedule} scheduleActive={step === "schedule"} scheduleResultsTarget={scheduleResultsTarget} prepareRequest={step === "schedule" ? scheduleRequest : 0} finalOutput={savedOutput} openingPreparation={openingPreparation} onEditOpening={editHookFromDemo} sourceAssetId={selectedVideo?.mediaAssetId ?? importedSource?.id ?? null} onPreparationChange={reportDemoPreparation} /> : null}
    {format === "slideshow" ? <FormatSlideshowEditor key={`${user?.uid}:slideshow`} reference={reference} legacyReferences={references} controllerRef={slideshowEditor} slideIndex={activeSlideIndex} active={step === "edit"} generationBusy={generating} controlsTarget={editControlsTarget} actionsTarget={editActionsTarget} resultsTarget={editResultsTarget} localPreview={localPreview} savingEnabled={slideshowSavingEnabled} onDirty={markDirty} onSaved={acceptOutput} onContinue={() => setStep("schedule")} onBackToPreview={() => { setStep("create"); setView("results"); revealOnMobile("preview"); }} onGoToCreate={() => { setStep("create"); revealOnMobile("controls"); }} onBusyChange={reportSlideshowBusy} onRegenerate={(_index, image) => { if (generating || slideshowSaving) return; setSlideshowRegenerationImage(image); setStep("create"); setView("results"); revealOnMobile("controls"); }} /> : null}
    <ReferencePreviewDialog open={Boolean(previewReference)} onOpenChange={open => { if (!open) setPreviewReference(null); }} reference={previewReference} />
  </Tabs.Root>;
}
