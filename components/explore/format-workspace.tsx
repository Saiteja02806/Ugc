"use client";

/* eslint-disable @next/next/no-img-element */
import { useQuery } from "@tanstack/react-query";
import { Tabs } from "@base-ui/react/tabs";
import { ArrowLeft, Film, Images, RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo, useRef, useState } from "react";

import { useBillingSubscription } from "@/components/billing/use-billing-subscription";
import { useAIStudioAccess } from "@/components/generation/use-ai-studio-access";
import { EmptyReferences, fetchRecreateReferences, FilterMenu, LoadError, ProReferenceGate, ReferenceCard, ReferenceGridSkeleton, ReferencePreviewDialog } from "@/components/explore/recreate-workspace";
import styles from "@/components/explore/format-workspace.module.css";
import creation from "@/components/explore/workflow-creation.module.css";
import { FormatVideoEditor } from "@/components/explore/format-video-editor";
import { FormatSlideshowEditor, type SlideshowEditorController } from "@/components/explore/format-slideshow-editor";
import { SlideshowReferencePicker } from "@/components/explore/slideshow-reference-picker";
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
import { alignReferenceLimit, referenceBatchSize } from "@/lib/explore/reference-pagination";
import { cn } from "@/lib/utils";

const ImagePanel = dynamic(() => import("@/components/workspace/ugc-chat-workspace").then(module => module.ImageGenerationStudioPanel));
const VideoPanel = dynamic(() => import("@/components/video/video-generation-workspace").then(module => module.VideoGenerationStudioPanel));
const EMPTY: RecreateReference[] = [];
const TITLES = { hook: "Hook video", wall_text: "Wall of text", slideshow: "Slideshows" };
type SavedOutput = { id: string; kind: "media_asset" | "library_item"; url: string; title: string; slides?: string[] };

type FormatWorkspaceProps = {
  format: RecreateFormat; previewReferences?: RecreateReference[]; finishingEnabled?: boolean; slideshowSavingEnabled?: boolean; previewVideo?: AIStudioVideoResult; previewAssets?: MediaAsset[];
};
export function FormatWorkspace(props: FormatWorkspaceProps) {
  const { user } = useAuth();
  return <OwnedFormatWorkspace key={user?.uid ?? "signed-out"} {...props} />;
}
function OwnedFormatWorkspace({ format, previewReferences, finishingEnabled = false, slideshowSavingEnabled = false, previewVideo, previewAssets }: FormatWorkspaceProps) {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const localPreview = previewReferences !== undefined;
  const classic = true;
  const subscription = useBillingSubscription();
  const accountAccess = useAIStudioAccess();
  const accessState = localPreview ? "locked" : accountAccess;
  const editVideoId = searchParams.get("editVideoId");
  const initialMode = searchParams.get("videoSource");
  const source = useWorkflowSourceVideo({ enabled: !localPreview, ownerId: user?.uid ?? null, minDuration: 1,
    initialMode: initialMode === "upload" || initialMode === "assets" ? initialMode : "generate" });
  const [step, setStep] = useState<"create" | "edit" | "schedule">(() => format !== "slideshow" && (localPreview && previewVideo || isExploreUuid(editVideoId)) ? "edit" : "create");
  const [view, setView] = useState<"references" | "results">(() => searchParams.get(`explore-${format}Job`) ? "results" : "references");
  const [controlsTarget, setControlsTarget] = useState<HTMLDivElement | null>(null);
  const [resultsTarget, setResultsTarget] = useState<HTMLDivElement | null>(null);
  const [editControlsTarget, setEditControlsTarget] = useState<HTMLDivElement | null>(null);
  const [editResultsTarget, setEditResultsTarget] = useState<HTMLDivElement | null>(null);
  const [createActionsTarget, setCreateActionsTarget] = useState<HTMLDivElement | null>(null);
  const [editActionsTarget, setEditActionsTarget] = useState<HTMLDivElement | null>(null);
  const [scheduleActionsTarget, setScheduleActionsTarget] = useState<HTMLDivElement | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [referencePage, setReferencePage] = useState({ key: "", limit: 12 });
  const [referenceColumns, setReferenceColumns] = useState(1);
  const uploadedReferenceKey = `ugc-explore:uploaded-slideshow:${user?.uid}`;
  const [selectedReference, setReference] = useState<RecreateReference | null>(() => {
    if (format !== "slideshow" || localPreview || typeof window === "undefined" || !user) return null;
    try {
      const raw = localStorage.getItem(uploadedReferenceKey);
      if (!raw || raw.length > 32_768) return null;
      const value = JSON.parse(raw) as RecreateReference;
      if (value.id !== searchParams.get("refId") || !value.id.startsWith("uploaded:") || !isExploreUuid(value.id.slice(9)) || value.format !== "slideshow" || !Array.isArray(value.slides) || value.slides.length < 2 || value.slides.length > 10 || new Set(value.slides.map(slide => slide.id)).size !== value.slides.length || value.slides.some(slide => !isExploreUuid(slide.id) || typeof slide.url !== "string" || !slide.url.startsWith("https://") || !Number.isFinite(slide.width) || !Number.isFinite(slide.height) || slide.width <= 0 || slide.height <= 0)) return null;
      return { ...value, title: "Your uploaded slideshow" };
    } catch { return null; }
  });
  const [generating, setGenerating] = useState(false);
  const [slideshowUploadBusy, setSlideshowUploadBusy] = useState(false);
  const reportBusy = useCallback((busy: boolean) => setGenerating(busy), []);
  const [previewReference, setPreviewReference] = useState<RecreateReference | null>(null);
  const mainArea = useRef<HTMLDivElement | null>(null);
  const controlsArea = useRef<HTMLElement | null>(null);
  const [slideIndex, setSlideIndex] = useState(() => { const value = Number(searchParams.get("slide")); return Number.isInteger(value) && value >= 1 && value <= 10 ? value - 1 : 0; });
  const [pickedVideo, setSelectedVideo] = useState<FormatVideoSource | null>(localPreview ? previewVideo ?? null : null);
  const restoredVideo = useQuery({ queryKey: ["explore-edit-restore", user?.uid, format, initialMode, editVideoId], enabled: !localPreview && !pickedVideo && Boolean(user) && format !== "slideshow" && isExploreUuid(editVideoId), queryFn: async () => {
    const token = await getCurrentUserIdToken(user?.uid); if (!token || !editVideoId) throw new Error("Sign in to restore your video edit.");
    const asset = await fetchAIStudioMediaAsset(editVideoId, token);
    if (initialMode !== "upload" && initialMode !== "assets" && asset.metadata.exploreFormat !== format) throw new Error("Choose a video from this workflow.");
    formatVideoFromAsset(asset); return asset;
  } });
  const selectedVideo = pickedVideo ?? (restoredVideo.data ? formatVideoFromAsset(restoredVideo.data) : null);
  const restoredSource = !source.dirty && source.mode === initialMode ? restoredVideo.data : undefined;
  const importedSource = source.source ?? restoredSource;
  const importedPreview = source.preview ?? (restoredSource ? { name: restoredSource.title, url: restoredSource.url, duration: restoredSource.durationSeconds } : null);
  const importedReady = source.ready || Boolean(restoredSource);
  const slideshowEditor = useRef<SlideshowEditorController | null>(null);
  const [savedOutput, setSavedOutput] = useState<SavedOutput | null>(null);
  const markDirty = useCallback(() => setSavedOutput(null), []);
  const acceptOutput = useCallback((output: SavedOutput) => setSavedOutput(output), []);
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
  const fullAccess = localPreview || subscription.data?.isActive === true;
  const filterKey = `${format}:${categories.join(":")}`;
  const observeReferenceGrid = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    function measure() {
      if (!node || node.clientWidth === 0) return;
      const tracks = window.getComputedStyle(node).gridTemplateColumns.trim();
      if (!tracks || tracks === "none") return;
      const columns = tracks.split(/\s+/).length;
      setReferenceColumns(columns);
      setReferencePage(current => {
        const limit = alignReferenceLimit(current.key === filterKey ? current.limit : 12, columns);
        return current.key === filterKey && current.limit === limit ? current : { key: filterKey, limit };
      });
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [filterKey]);
  const visible = filtered.slice(0, fullAccess ? alignReferenceLimit(referencePage.key === filterKey ? referencePage.limit : 12, referenceColumns) : 1);
  const loading = !localPreview && (authLoading || referencesQuery.isFetching && !referencesQuery.data);
  const activeSlideIndex = reference ? Math.min(slideIndex, Math.max(0, reference.slides.length - 1)) : 0;
  const sourceImage = format === "slideshow" ? reference?.slides[activeSlideIndex]?.url : reference?.posterUrl;
  const resultLabel = format === "slideshow" ? "Your Slides" : "Your Video";

  function revealOnMobile(target: "controls" | "preview") {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    requestAnimationFrame(() => (target === "controls" ? controlsArea : mainArea).current?.scrollIntoView({ block: "start", behavior: "instant" }));
  }
  function browseReferences() { setStep("create"); setView("references"); revealOnMobile("preview"); }

  function clearVideoEdit() {
    setSelectedVideo(null); setSavedOutput(null);
    const params = new URLSearchParams(window.location.search); params.delete("editVideoId");
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
  }
  function setVideoMode(mode: WorkflowVideoMode) {
    if (generating || source.busy) return;
    source.setMode(mode);
    const params = new URLSearchParams(window.location.search); params.set("videoSource", mode);
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
    setView(mode === "generate" ? "references" : "results");
  }
  function editVideo(video: FormatVideoSource, mode: WorkflowVideoMode) {
    setSelectedVideo(video); setSavedOutput(null); setStep("edit");
    revealOnMobile("controls");
    const params = new URLSearchParams(window.location.search); params.set("videoSource", mode);
    if (video.mediaAssetId) params.set("editVideoId", video.mediaAssetId); else params.delete("editVideoId");
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
  }
  function editImportedVideo() {
    if (!importedReady || !importedPreview) return;
    editVideo(importedSource ? formatVideoFromAsset(importedSource) : {
      id: `local:${importedPreview.url}`, modelLabel: null, resolution: null, thumbnailUrl: null, mediaAssetId: null, createdAt: "", durationSeconds: importedPreview.duration,
      ratio: "9:16", status: "Ready", title: importedPreview.name, prompt: "", url: importedPreview.url,
    }, source.mode);
  }
  const videoSelection = { ...source, source: importedSource ?? null, preview: importedPreview, ready: importedReady, setMode: setVideoMode,
    chooseUpload: async (file: File) => {
      if (generating) return false;
      clearVideoEdit(); setView("results"); revealOnMobile("preview");
      return source.chooseUpload(file);
    },
    selectAsset: (asset: MediaAsset) => {
      if (generating || !source.selectAsset(asset)) return false;
      clearVideoEdit(); setView("results"); revealOnMobile("preview"); return true;
    },
    removeUpload: () => { if (generating) return; clearVideoEdit(); source.removeUpload(); },
  };

  function selectReference(next: RecreateReference, fromUpload = false) {
    if (generating || slideshowUploadBusy && !fromUpload) return;
    if (reference?.id !== next.id) { setSavedOutput(null); }
    setReference(next); setSlideIndex(0);
    if (!localPreview && format === "slideshow" && next.id.startsWith("uploaded:")) {
      try { localStorage.setItem(uploadedReferenceKey, JSON.stringify(next)); } catch { /* This session remains usable. */ }
    }
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
    if (generating) return;
    setSlideIndex(index);
    const params = new URLSearchParams(window.location.search); params.set("slide", String(index + 1));
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
  }

  function clearStyleReference() {
    if (generating) return;
    setReference(null);
    const params = new URLSearchParams(window.location.search);
    for (const key of ["refType", "refId", "sourceUrl", "exploreRecreate"]) params.delete(key);
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
  }
  const contextBanner = format !== "slideshow" ? undefined : <SlideshowReferencePicker reference={reference} slideIndex={activeSlideIndex} disabled={generating} localPreview={localPreview} onBrowse={browseReferences} onSlide={chooseSlide} onBusy={setSlideshowUploadBusy} onEdit={() => { setStep("edit"); revealOnMobile("controls"); }} onUpload={next => { selectReference(next, true); setStep("edit"); setView("results"); }} />;
  const recreateView = {
    contextBanner, referenceImageUrl: format === "slideshow" && !slideshowUploadBusy ? sourceImage : undefined,
    styleVideo: format !== "slideshow" && reference?.videoUrl ? { url: reference.videoUrl, name: reference.title, duration: null } : undefined,
    referenceTitle: reference?.title, onClearReference: clearStyleReference, preview: localPreview,
    emptyContent: <div className={styles.emptyResult}><span className={styles.emptyIcon}>{format === "slideshow" ? <Images aria-hidden="true" /> : <Film aria-hidden="true" />}</span><h2 className="text-lg font-semibold">{format === "slideshow" ? "Your images will appear here" : "Your video will appear here"}</h2><p className="max-w-sm text-sm leading-6 text-muted">{format === "slideshow" ? "Choose a reference and describe your changes in Create." : "Add your instructions in Create. You can use a style example or attach your own image or video."} Your generation will appear here, ready to edit.</p><Button type="button" variant="outline" onClick={browseReferences}>Browse references</Button></div>,
    workflow: { format, controlsTarget, controlsActive: step === "create" && (format === "slideshow" || source.mode === "generate"), resultsTarget, actionsTarget: createActionsTarget, onBusyChange: reportBusy,
      onGenerationStart: () => { setStep("create"); setView("results"); revealOnMobile("preview"); },
      onSelectVideo: (video: AIStudioVideoResult) => {
        editVideo(video, "generate");
      },
      onSelectImage: (image: AIStudioImageResult) => { slideshowEditor.current?.useImage(image, activeSlideIndex); setStep("edit"); },
    },
  };

  return <><Tabs.Root data-format={format} className={cn(styles.workspace, classic && creation.shell, classic && styles.classicWorkspace)} value={step} onValueChange={value => { if (value === "create" || value === "edit" || value === "schedule") { setStep(value); revealOnMobile("controls"); } }}>
    <header className={classic ? cn(creation.header, "flex shrink-0 items-center gap-3 px-4 py-3 sm:px-6 lg:px-8") : styles.header}>
      {classic ? <><Link prefetch={true} href={localPreview ? "/explore?preview=1" : "/explore"} aria-label="Back to Explore" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><ArrowLeft className="size-4" aria-hidden="true" /></Link><span className="hidden text-sm text-muted sm:block">Explore <span className="ml-2" aria-hidden="true">/</span></span><div className="min-w-0"><h1 className="text-base font-semibold tracking-tight text-foreground-strong sm:text-lg">{TITLES[format]}</h1></div></> : <><Link prefetch={true} href={localPreview ? "/explore?preview=1" : "/explore"} className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" />Explore</Link><span aria-hidden="true" className="text-sm text-muted">/</span><div className={styles.heading}><h1 className="text-lg font-semibold tracking-tight">{TITLES[format]}</h1></div></>}
      {!classic ? <span className={styles.mediaBadge}><Images className="size-3.5" aria-hidden="true" />Images only</span> : null}
    </header>
    <div className={classic ? creation.layout : styles.body}>
      <aside ref={controlsArea} data-section={step} className={classic ? creation.controls : styles.controls} aria-label={`${TITLES[format]} controls`}>
        <Tabs.List className={classic ? creation.sectionTabs : styles.sectionTabs} aria-label="Workflow sections" activateOnFocus>{(["create", "edit", "schedule"] as const).map(value => <Tabs.Tab key={value} value={value} className={classic ? creation.sectionTab : styles.sectionTab}>{value === "create" ? "Create" : value === "edit" ? format === "slideshow" ? "Edit slides" : "Edit video" : "Schedule"}</Tabs.Tab>)}</Tabs.List>
        <div className={classic ? creation.controlContent : styles.controlContent}>
        <Tabs.Panel value="create" keepMounted className={classic ? creation.sectionPanel : styles.sectionPanel}>
        {format !== "slideshow" ? <div>
          <WorkflowVideoSourceSection kind="hook" label={TITLES[format]} selection={videoSelection} disabled={generating} description="Choose a video to trim, add text and save in this workflow." previewAssets={localPreview ? previewAssets : undefined} />
          {source.mode !== "generate" ? <p className="mb-4 text-xs leading-5 text-muted">MP4, MOV or WebM · 1–120 seconds · Up to 250 MB. Open your selected clip in Edit video to trim or add text.</p> : null}
        </div> : null}
        <div ref={setControlsTarget} className={classic ? creation.generationFields : styles.createControls} hidden={format !== "slideshow" && source.mode !== "generate"} />
        </Tabs.Panel>
        <Tabs.Panel value="edit" keepMounted className={classic ? creation.sectionPanel : styles.sectionPanel}>
        <div ref={setEditControlsTarget} className={styles.editControls} />
        {step === "edit" && !selectedVideo && format !== "slideshow" ? <p className="p-5 text-sm leading-6 text-muted">{restoredVideo.isFetching ? "Restoring your video edit…" : restoredVideo.isError ? "This saved video is unavailable. Choose another video in Create." : "Generate, upload or choose a video from Creative Assets in Create, then open it in the editor."}</p> : null}
        </Tabs.Panel>
        <Tabs.Panel value="schedule" keepMounted className={classic ? cn(creation.sectionPanel, styles.classicSchedule) : styles.sectionPanel}>
        <FormatSchedulePanel key={`${format}:${savedOutput?.id ?? "empty"}`} actionsTarget={scheduleActionsTarget} active={step === "schedule"} output={savedOutput} localPreview={localPreview} imageOnly={format === "slideshow"} />
        </Tabs.Panel>
        </div>
        <footer className={classic ? creation.actionFooter : styles.actionFooter} aria-label="Workflow action">
          <div ref={setCreateActionsTarget} hidden={step !== "create" || format !== "slideshow" && source.mode !== "generate"} />
          <div ref={setEditActionsTarget} hidden={step !== "edit"} />
          <div ref={setScheduleActionsTarget} hidden={step !== "schedule"} />
          {step === "create" && format !== "slideshow" && source.mode !== "generate" ? <div className="space-y-2"><Button type="button" className="h-11 w-full rounded-lg" disabled={!importedReady} onClick={editImportedVideo}>Edit this video</Button><p role="status" className="text-xs leading-5 text-muted">{source.busy ? "Preparing your video…" : importedReady ? "Your video is ready to edit." : "Upload or choose a video to continue."}{localPreview ? " Preview · uploads stay on your device." : ""}</p></div> : null}
          {step === "edit" && !selectedVideo && format !== "slideshow" ? <Button type="button" disabled className="h-11 w-full rounded-lg">Save edits</Button> : null}
        </footer>
      </aside>
      <div ref={mainArea} role="region" aria-label="Workflow preview" className={classic ? cn(creation.main, styles.classicMain) : styles.main}>
        <div ref={setEditResultsTarget} hidden={step !== "edit"} className={styles.results}>
          {step === "edit" && !selectedVideo && format !== "slideshow" ? <div className={styles.emptyResult}><span className={styles.emptyIcon}><Film aria-hidden="true" /></span><h2 className="text-xl font-semibold">Choose a video to edit</h2><p className="max-w-sm text-sm leading-6 text-muted">Generate a clip, upload your own or choose from Creative Assets. You can then trim it, add text and adjust audio.</p><Button type="button" variant="outline" onClick={() => setStep("create")}>Go to Create</Button></div> : null}
        </div>
        <div hidden={step !== "create"} className="flex min-h-0 flex-1 flex-col">
          <nav className={styles.resultTabs} aria-label="Creation views">{(["references", "results"] as const).map(value => <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)} className={cn(styles.resultTab, view === value && styles.active)}>{value === "references" ? "References" : resultLabel}</button>)}</nav>
          <section hidden={view !== "references"} aria-label="References" className={styles.referenceArea}>
            <div className="mb-5 flex items-center justify-between gap-3"><p className="text-sm text-muted">Preview a reference, or select <RotateCcw className="inline-block size-3.5 align-middle text-foreground" role="img" aria-label="Recreate" /> to recreate it.</p><FilterMenu activeCategories={categories} categories={options} count={filtered.length} disabled={loading} onClear={() => setCategories([])} onToggle={(category, checked) => setCategories(current => checked ? [...current, category] : current.filter(value => value !== category))} /></div>
            {loading ? <ReferenceGridSkeleton /> : referencesQuery.isError && !localPreview ? <LoadError onRetry={() => void referencesQuery.refetch()} /> : visible.length ? <div ref={observeReferenceGrid} className={styles.referenceGrid}>{visible.map(item => <ReferenceCard key={item.id} reference={item} compact hideCaption={format === "wall_text"} isSelected={reference?.id === item.id} onPreview={() => setPreviewReference(item)} onRecreate={() => selectReference(item)} />)}</div> : <EmptyReferences format={format} hasFilters={categories.length > 0} onClear={() => setCategories([])} />}
            {!fullAccess && filtered.length > 1 ? <ProReferenceGate /> : null}
            {fullAccess && filtered.length > 0 ? <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4"><p className="text-xs text-muted">{visible.length} of {filtered.length} references</p>{visible.length < filtered.length ? <Button type="button" variant="outline" size="sm" onClick={() => setReferencePage({ key: filterKey, limit: visible.length + referenceBatchSize(referenceColumns) })}>Show more references</Button> : null}</div> : null}
          </section>
          <div ref={setResultsTarget} hidden={view !== "results" || format !== "slideshow" && source.mode !== "generate"} className={styles.results} />
          {format !== "slideshow" && source.mode !== "generate" ? <section hidden={view !== "results"} aria-label="Selected video" className={styles.results}>
            <div className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center gap-4 py-6">
              {importedPreview ? <><WorkflowMediaPlayer asset={importedPreview} kind="video" label="Your selected video" className="max-h-[60dvh] max-w-full rounded-xl" /><h2 className="max-w-full break-words text-center text-base font-semibold">{importedPreview.name}</h2><p className="text-sm text-muted">Use Edit this video to open the editor.</p></> : <div className={styles.emptyResult}><span className={styles.emptyIcon}><Film aria-hidden="true" /></span><h2 className="text-lg font-semibold">Your video will appear here</h2><p className="max-w-sm text-center text-sm leading-6 text-muted">{source.mode === "upload" ? "Upload your video in Create, then trim it or add text in Edit video." : "Choose an existing video from Creative Assets to start editing."}</p></div>}
              {source.busy ? <p role="status" className="text-sm text-muted">{localPreview ? "Reading your video…" : "Uploading your video…"}</p> : null}
            </div>
          </section> : null}
        </div>
        {step === "schedule" ? savedOutput ? <div className={styles.savedPreview}><h2 className="mb-4 text-base font-semibold">Post preview</h2>{savedOutput.kind === "media_asset" ? <video src={savedOutput.url} controls playsInline className="max-h-[65dvh] max-w-full rounded-xl" /> : <div className="grid w-full grid-cols-2 gap-4 xl:grid-cols-3">{(savedOutput.slides ?? [savedOutput.url]).map((url, index) => <figure key={`${index}:${url}`}><img src={url} alt={`Saved slide ${index + 1}`} width={1080} height={1350} className="aspect-[4/5] w-full rounded-xl object-contain" /><figcaption className="mt-2 text-center text-xs text-muted">{index + 1}</figcaption></figure>)}</div>}<p className="mt-3 text-sm text-muted">{savedOutput.title}</p></div> : <div className={styles.emptyResult}><span className={styles.emptyIcon}>{format === "slideshow" ? <Images aria-hidden="true" /> : <Film aria-hidden="true" />}</span><h2 className="text-xl font-semibold">Your final post</h2><p className="max-w-sm text-sm leading-6 text-muted">Save your {format === "slideshow" ? "slideshow" : "video"} in Edit {format === "slideshow" ? "slides" : "video"}. Your finished content will appear here before you schedule it.</p><Button type="button" variant="outline" onClick={() => setStep("edit")}>Go to Edit {format === "slideshow" ? "slides" : "video"}</Button></div> : null}
      </div>
    </div>
    {/* Mounted across steps so job polling and drafts survive navigation. */}
    </Tabs.Root>
    <Suspense fallback={null}><div className="contents">
    {controlsTarget && resultsTarget ? format === "slideshow" ? <ImagePanel active accessState={accessState} accessMessage={localPreview ? "Preview · generation disabled" : getAIStudioAccessMessage(accessState)} creditCost={subscription.data?.imageGenerationCreditCost ?? 1} creditsRemaining={subscription.data?.creditsRemaining ?? null} recreateView={recreateView} /> : <VideoPanel active accessState={accessState} accessMessage={localPreview ? "Preview · generation disabled" : getAIStudioAccessMessage(accessState)} creditsPerSecond={subscription.data?.videoGenerationCreditsPerSecond} creditsRemaining={subscription.data?.creditsRemaining ?? null} recreateView={recreateView} /> : null}
    </div></Suspense>
    {format !== "slideshow" && selectedVideo ? <FormatVideoEditor key={`${user?.uid}:${selectedVideo.id}`} format={format} video={selectedVideo} active={step === "edit"} controlsTarget={editControlsTarget} actionsTarget={editActionsTarget} resultsTarget={editResultsTarget} enabled={finishingEnabled && !localPreview} onDirty={markDirty} onSaved={acceptOutput} onContinue={() => setStep("schedule")} /> : null}
    {format === "slideshow" ? <FormatSlideshowEditor key={`${user?.uid}:${reference?.id ?? "empty"}`} reference={reference} controllerRef={slideshowEditor} slideIndex={activeSlideIndex} active={step === "edit"} generationBusy={generating} controlsTarget={editControlsTarget} actionsTarget={editActionsTarget} resultsTarget={editResultsTarget} localPreview={localPreview} savingEnabled={slideshowSavingEnabled} onDirty={markDirty} onSaved={acceptOutput} onContinue={() => setStep("schedule")} onRegenerate={index => { if (generating) return; chooseSlide(index); setStep("create"); setView("results"); }} /> : null}
    <ReferencePreviewDialog open={Boolean(previewReference)} onOpenChange={open => { if (!open) setPreviewReference(null); }} reference={previewReference} />
  </>;
}
