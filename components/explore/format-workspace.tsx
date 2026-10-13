"use client";

/* eslint-disable @next/next/no-img-element */
import { useQuery } from "@tanstack/react-query";
import { Tabs } from "@base-ui/react/tabs";
import { ArrowLeft, Film, Images } from "lucide-react";
import { WorkflowNavigationButton } from "@/components/layout/workflow-navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useBillingSubscription } from "@/components/billing/use-billing-subscription";
import { useAIStudioAccess } from "@/components/generation/use-ai-studio-access";
import { EmptyReferences, fetchRecreateReferences, FilterMenu, LoadError, ProReferenceGate, ReferenceCard, ReferenceGridSkeleton, ReferencePreviewDialog } from "@/components/explore/recreate-workspace";
import styles from "@/components/explore/format-workspace.module.css";
import creation from "@/components/explore/workflow-creation.module.css";
import sections from "@/components/explore/workflow-section-layout.module.css";
import presentation from "@/components/explore/workflow-video-layout.module.css";
import slideshowLayout from "@/components/explore/workflow-slideshow-layout.module.css";
import { WorkflowSectionNavigation } from "@/components/explore/workflow-section-navigation";
import scrollbars from "@/components/ui/quiet-scrollbar.module.css";
import type { FormatOpeningPreview, FormatPreparationStatus, WorkflowClipEditState } from "@/components/explore/format-video-editor";
import { FormatDemoSection } from "@/components/explore/format-demo-section";
import type { SlideshowEditorController } from "@/components/explore/format-slideshow-editor";
import { SlideshowReferencePicker } from "@/components/explore/slideshow-reference-picker";
import { FormatSchedulePanel } from "@/components/explore/format-schedule-panel";
import { useBackgroundScheduleAvailability } from "@/components/explore/pending-schedule-panel";
import type { ExploreScheduleComposition } from "@/lib/explore/pending-schedule-client";
import { createWallScheduleComposition } from "@/lib/explore/wall-pending-composition";
import { WorkflowVideoSourceSection } from "@/components/explore/workflow-video-source-section";
import { useWorkflowSourceVideo } from "@/components/explore/use-workflow-source-video";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { getAIStudioAccessMessage } from "@/lib/ai-studio/access-policy";
import { type AIStudioImageResult, type AIStudioVideoResult } from "@/lib/ai-studio/media-results";
import { formatVideoFromAsset, type FormatVideoSource } from "@/lib/explore/format-video-source";
import { resolveRemixSource } from "@/lib/explore/remix-source";
import type { ReferenceText } from "@/lib/explore/reference-text";
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
const FormatVideoEditor = dynamic(() => import("@/components/explore/format-video-editor").then(module => module.FormatVideoEditor));
const FormatSlideshowEditor = dynamic(() => import("@/components/explore/format-slideshow-editor").then(module => module.FormatSlideshowEditor));
const WallSchedulePreview = dynamic(() => import("@/components/explore/wall-schedule-preview").then(module => module.WallSchedulePreview));
const EMPTY: RecreateReference[] = [];
const TITLES = { hook: "Hook video", wall_text: "Wall of text", slideshow: "Slideshows" };
type SavedOutput = { id: string; kind: "media_asset" | "library_item"; url: string; title: string; slides?: string[] };

type FormatWorkspaceProps = {
  format: RecreateFormat; previewReferences?: RecreateReference[]; finishingEnabled?: boolean; slideshowSavingEnabled?: boolean; previewVideo?: AIStudioVideoResult; previewAssets?: MediaAsset[];
  previewText?: ReferenceText | null;
  previewFinalVideo?: { id: string; url: string; title: string };
  previewFinalSlideshow?: { id: string; title: string; slides: string[] };
  previewSlideshow?: { referenceId: string; images: AIStudioImageResult[] };
  videoEditorLayout?: "controls" | "preview";
};
export function FormatWorkspace(props: FormatWorkspaceProps) {
  const { user } = useAuth();
  return <OwnedFormatWorkspace key={user?.uid ?? "signed-out"} {...props} />;
}
function OwnedFormatWorkspace({ format, previewReferences, finishingEnabled = false, slideshowSavingEnabled = false, previewVideo, previewAssets, previewSlideshow, previewText, previewFinalVideo, previewFinalSlideshow }: FormatWorkspaceProps) {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const localPreview = previewReferences !== undefined;
  const classic = true;
  const subscription = useBillingSubscription();
  const accountAccess = useAIStudioAccess();
  const accessState = localPreview ? "locked" : accountAccess;
  const editVideoId = searchParams.get("editVideoId");
  const initialMode = searchParams.get("videoSource");
  const generatedOpeningClaimed = useRef(false);
  const source = useWorkflowSourceVideo({ enabled: !localPreview, ownerId: user?.uid ?? null, minDuration: 1,
    initialMode: initialMode === "upload" || initialMode === "assets" ? initialMode : "generate",
    onSelected: (asset, preview, mode) => editVideo(asset ? formatVideoFromAsset(asset) : {
      id: `local:${preview.url}`, modelLabel: null, resolution: null, thumbnailUrl: null, mediaAssetId: null, createdAt: "", durationSeconds: preview.duration,
      ratio: "9:16", status: "Ready", title: preview.name, prompt: "", url: preview.url,
    }, mode) });
  const initialStepParam = searchParams.get("step") ?? searchParams.get("section");
  const initialStep: "create" | "edit" | "demo" | "schedule" =
    initialStepParam === "schedule" ? "schedule"
    : initialStepParam === "edit" ? (format === "hook" ? "demo" : "edit")
    : initialStepParam === "demo" ? (format === "hook" ? "demo" : "edit")
    : "create";
  const [step, setStep] = useState<"create" | "edit" | "demo" | "schedule">(initialStep);
  const [editTarget, setEditTarget] = useState<"opening" | "demo">("opening");
  const [editExpanded, setEditExpanded] = useState(false);
  const workflowControlsId = useId();
  const [workflowControlsExpanded, setWorkflowControlsExpanded] = useState(false);
  const [compactPane, setCompactPane] = useState<"controls" | "preview">("controls");
  const paneNavigation = useRef<HTMLElement | null>(null);
  const [view, setView] = useState<"references" | "results">(() => searchParams.get(`explore-${format}Job`) || format !== "slideshow" && (localPreview && previewVideo || isExploreUuid(editVideoId)) ? "results" : "references");
  const [showGenerationResults, setShowGenerationResults] = useState(false);
  const [controlsTarget, setControlsTarget] = useState<HTMLDivElement | null>(null);
  const [resultsTarget, setResultsTarget] = useState<HTMLDivElement | null>(null);
  const [editControlsTarget, setEditControlsTarget] = useState<HTMLDivElement | null>(null);
  const [editResultsTarget, setEditResultsTarget] = useState<HTMLDivElement | null>(null);
  const [demoEditResultsTarget, setDemoEditResultsTarget] = useState<HTMLDivElement | null>(null);
  const [createActionsTarget, setCreateActionsTarget] = useState<HTMLDivElement | null>(null);
  const [editActionsTarget, setEditActionsTarget] = useState<HTMLDivElement | null>(null);
  const [clipActionsTarget, setClipActionsTarget] = useState<HTMLDivElement | null>(null);
  const [demoControlsTarget, setDemoControlsTarget] = useState<HTMLDivElement | null>(null);
  const [remixOverviewTarget, setRemixOverviewTarget] = useState<HTMLDivElement | null>(null);
  const [demoActionsTarget, setDemoActionsTarget] = useState<HTMLDivElement | null>(null);
  const [demoResultsTarget, setDemoResultsTarget] = useState<HTMLDivElement | null>(null);
  const [scheduleResultsTarget, setScheduleResultsTarget] = useState<HTMLDivElement | null>(null);
  const [scheduleRequest, setScheduleRequest] = useState(0);
  const [openingPreparation, setOpeningPreparation] = useState<FormatPreparationStatus>({ busy: false, error: null, message: "Preparing your hook video…" });
  const reportOpeningPreparation = useCallback((status: FormatPreparationStatus) => setOpeningPreparation(status), []);
  const [openingPreview, setOpeningPreview] = useState<FormatOpeningPreview | null>(null);
  const reportOpeningPreview = useCallback((preview: FormatOpeningPreview) => setOpeningPreview(current => JSON.stringify(current) === JSON.stringify(preview) ? current : preview), []);
  const [categories, setCategories] = useState<string[]>([]);
  const [referencePage, setReferencePage] = useState({ key: "", limit: 12 });
  const [referenceColumns, setReferenceColumns] = useState(1);
  const uploadedReferenceKey = `ugc-explore:uploaded-slideshow:${user?.uid}`;
  const [selectedReference, setReference] = useState<RecreateReference | null>(() => {
    if (format === "slideshow" && localPreview && previewSlideshow) return previewReferences?.find(item => item.id === previewSlideshow.referenceId) ?? null;
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
  const [slideshowSaving, setSlideshowSaving] = useState(false);
  const reportSlideshowBusy = useCallback((busy: boolean) => setSlideshowSaving(busy), []);
  const [slideshowRegenerationImage, setSlideshowRegenerationImage] = useState<AIStudioImageResult | null>(null);
  const [referenceSelectionRevision, setReferenceSelectionRevision] = useState(0);
  const reportBusy = useCallback((busy: boolean) => setGenerating(busy), []);
  const [previewReference, setPreviewReference] = useState<RecreateReference | null>(null);
  const [previewSlide, setPreviewSlide] = useState(0);
  const mainArea = useRef<HTMLDivElement | null>(null);
  const controlsArea = useRef<HTMLElement | null>(null);
  const controlContent = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (controlContent.current) controlContent.current.scrollTop = 0;
    if (mainArea.current) mainArea.current.scrollTop = 0;
  }, [step]);
  const [slideIndex, setSlideIndex] = useState(() => { const value = Number(searchParams.get("slide")); return Number.isInteger(value) && value >= 1 && value <= 14 ? value - 1 : 0; });
  const [slideSelection, setSlideSelection] = useState<{ referenceId: string; ids: string[] } | null>(null);
  const [pickedVideo, setSelectedVideo] = useState<FormatVideoSource | null>(localPreview ? previewVideo ?? null : null);
  const restoredVideo = useQuery({ queryKey: ["explore-edit-restore", user?.uid, format, initialMode, editVideoId], enabled: !localPreview && !pickedVideo && Boolean(user) && format !== "slideshow" && isExploreUuid(editVideoId), queryFn: async () => {
    const token = await getCurrentUserIdToken(user?.uid); if (!token || !editVideoId) throw new Error("Sign in to restore your video edit.");
    const asset = await fetchAIStudioMediaAsset(editVideoId, token, { remixSource: true });
    if (initialMode !== "upload" && initialMode !== "assets" && asset.metadata.exploreFormat !== format) throw new Error("Choose a video from this workflow.");
    formatVideoFromAsset(asset); return asset;
  } });
  const pickedSource = useQuery({ queryKey: ["explore-edit-source", user?.uid ?? null, pickedVideo?.mediaAssetId, "remix-source"], staleTime: 30_000,
    enabled: !localPreview && Boolean(user && pickedVideo?.mediaAssetId && pickedVideo.remixTextSource === undefined), queryFn: async () => {
      const token = await getCurrentUserIdToken(user?.uid);
      if (!token || !pickedVideo?.mediaAssetId) throw new Error("Sign in to load this video's reference.");
      const asset = await fetchAIStudioMediaAsset(pickedVideo.mediaAssetId, token, { remixSource: true });
      formatVideoFromAsset(asset); return asset;
    } });
  const selectedVideo = pickedVideo ? pickedSource.data ? { ...pickedVideo, remixTextSource: formatVideoFromAsset(pickedSource.data).remixTextSource } : pickedVideo : restoredVideo.data ? formatVideoFromAsset(restoredVideo.data) : null;
  const restoredSource = !source.dirty && source.mode === initialMode ? restoredVideo.data : undefined;
  const importedSource = source.source ?? restoredSource;
  const importedPreview = source.preview ?? (restoredSource ? { name: restoredSource.title, url: restoredSource.url, duration: restoredSource.durationSeconds } : null);
  const importedReady = (source.ready || Boolean(restoredSource)) && !source.busy && !source.error;
  const slideshowEditor = useRef<SlideshowEditorController | null>(null);
  const [savedOutput, setSavedOutput] = useState<SavedOutput | null>(() => (localPreview && format === "slideshow" && previewFinalSlideshow?.slides.length ?
    { ...previewFinalSlideshow, url: previewFinalSlideshow.slides[0], kind: "library_item" } : localPreview && previewFinalVideo ? { ...previewFinalVideo, kind: "media_asset" } : null));
  const [openingOutput, setOpeningOutput] = useState<{ id: string; kind: "media_asset"; url: string; title: string } | null>(null);
  const [openingRevision, setOpeningRevision] = useState(0);
  const [openingClipState, setOpeningClipState] = useState<WorkflowClipEditState | null>(null);
  const [pendingComposition, setPendingComposition] = useState<ExploreScheduleComposition | null>(null);
  const wallCompositionIdentity = useRef<string | null>(null);
  const wallComposition = createWallScheduleComposition({ ownerId: user?.uid ?? null, sourceAssetId: selectedVideo?.mediaAssetId ?? null,
    title: selectedVideo?.title ?? "Wall of text video", clip: openingClipState, pendingSource: source.busy, selectionError: source.error });
  const resolveWallComposition = useCallback(async () => {
    if (wallCompositionIdentity.current !== wallComposition.signature) throw new Error("Your video or audio changed. Review the updated video before scheduling.");
    return wallComposition.resolve();
  }, [wallComposition]);
  useLayoutEffect(() => {
    wallCompositionIdentity.current = wallComposition.signature;
    return () => { wallCompositionIdentity.current = null; };
  }, [wallComposition.signature]);
  const backgroundCapability = useBackgroundScheduleAvailability(user?.uid ?? null, !localPreview && finishingEnabled && format !== "slideshow");
  const backgroundScheduling = format !== "slideshow" && !localPreview && backgroundCapability.data === true;
  const [scheduleCapabilityPending, setScheduleCapabilityPending] = useState(false);
  useEffect(() => {
    if (!scheduleCapabilityPending || backgroundCapability.isFetching) return;
    let subscribed = true;
    queueMicrotask(() => {
      if (!subscribed) return;
      setScheduleCapabilityPending(false);
      if (step === "schedule" && !backgroundScheduling) setScheduleRequest(value => value + 1);
    });
    return () => { subscribed = false; };
  }, [scheduleCapabilityPending, backgroundCapability.isFetching, backgroundScheduling, step]);
  const reportOpeningClip = useCallback((value: WorkflowClipEditState) => setOpeningClipState(previous => JSON.stringify(previous) === JSON.stringify(value) ? previous : value), []);
  const reportPendingComposition = useCallback((value: ExploreScheduleComposition) => setPendingComposition(previous => previous?.signature === value.signature ? previous : value), []);
  const [demoSelected, setDemoSelected] = useState(false);
  const [finalPassRequired, setFinalPassRequired] = useState(false);
  const reportDemoSelection = useCallback((present: boolean) => { setDemoSelected(present); if (!present) { setEditTarget("opening"); setEditExpanded(false); } }, [setDemoSelected, setEditTarget, setEditExpanded]);
  const markDirty = useCallback(() => { setSavedOutput(null); setOpeningOutput(null); setOpeningRevision(value => value + 1); }, [setSavedOutput, setOpeningOutput, setOpeningRevision]);
  const markDemoDirty = useCallback(() => setSavedOutput(null), [setSavedOutput]);
  const acceptOpening = useCallback((output: { id: string; kind: "media_asset"; url: string; title: string }) => { setOpeningOutput(output); setSavedOutput(output); }, [setOpeningOutput, setSavedOutput]);
  const acceptOutput = useCallback((output: SavedOutput) => setSavedOutput(output), [setSavedOutput]);
  // A selected demo or background-audio pass must finish before the opening
  // can become the scheduled result. Skip only bypasses the optional demo.
  const scheduleOutput = format !== "slideshow" && (demoSelected || finalPassRequired) && savedOutput?.id === openingOutput?.id ? null : savedOutput;
  const referencesQuery = useQuery({
    enabled: !localPreview && !authLoading && Boolean(user),
    queryKey: ["recreate-references", 2, user?.uid ?? "signed-out"],
    queryFn: ({ signal }) => fetchRecreateReferences(signal), staleTime: 30 * 60_000, retry: 1,
  });
  const references = previewReferences ?? referencesQuery.data ?? EMPTY;
  const reference = selectedReference ?? references.find(item => item.id === (searchParams.get("refId") ?? (localPreview ? previewText?.referenceId : null)) && item.format === format) ?? null;
  const clipReference = selectedVideo ? selectedVideo.remixTextSource !== undefined ? resolveRemixSource(selectedVideo.remixTextSource, references, format).reference : localPreview ? reference : null : reference;
  const options = useMemo(() => referenceCategories(references, format), [references, format]);
  const filtered = useMemo(() => {
    const result = filterReferences(references, format, categories);
    return format === "slideshow" ? interleaveReferenceCategories(result) : result;
  }, [references, format, categories]);
  const canBrowseAllReferences = format === "hook" || localPreview || subscription.data?.isActive === true;
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
  }, [filterKey, setReferencePage]);
  const visible = filtered.slice(0, canBrowseAllReferences ? alignReferenceLimit(referencePage.key === filterKey ? referencePage.limit : 12, referenceColumns) : 1);
  const loading = !localPreview && (authLoading || referencesQuery.isFetching && !referencesQuery.data);
  const activeSlideIndex = reference ? Math.min(slideIndex, Math.max(0, reference.slides.length - 1)) : 0;
  const selectedSlideIds = reference
    ? slideSelection?.referenceId === reference.id
      ? slideSelection.ids.filter(id => reference.slides.some(slide => slide.id === id))
      : [reference.slides[activeSlideIndex]?.id].filter((id): id is string => Boolean(id))
    : [];
  // The previewed selected slide is the primary edit target. Other checked
  // slides supply context; they do not change the requested output quantity.
  const contextSlides = reference?.slides.filter(slide => selectedSlideIds.includes(slide.id)) ?? [];
  const primarySlide = contextSlides.find(slide => slide.id === reference?.slides[activeSlideIndex]?.id) ?? contextSlides[0];
  const sourceImages = primarySlide ? [primarySlide, ...contextSlides.filter(slide => slide.id !== primarySlide.id)].map(slide => slide.url) : [];
  const sourceImage = format === "slideshow" ? sourceImages[0] : reference?.posterUrl;
  const resultLabel = format === "slideshow" ? "Your Slides" : "Your videos";
  const hasCombinedOutput = Boolean(savedOutput && savedOutput.id !== openingOutput?.id);
  const clipStageVisible = format === "hook" && (step === "demo"
    ? editExpanded || !hasCombinedOutput
    : step === "create" && view === "results" && (editExpanded || !showGenerationResults && Boolean(selectedVideo || isExploreUuid(editVideoId)) || source.mode !== "generate"));

  function revealOnMobile(target: "controls" | "preview") {
    setCompactPane(target);
    if (!window.matchMedia("(max-width: 1023.98px)").matches) return;
    requestAnimationFrame(() => paneNavigation.current?.scrollIntoView({ block: "start", behavior: "instant" }));
  }
  function showCompactPane(target: "controls" | "preview", focusPanel = false) {
    if (editExpanded) setWorkflowControlsExpanded(target === "controls");
    revealOnMobile(target);
    if (focusPanel) requestAnimationFrame(() => {
      const area = target === "controls" ? controlsArea.current : mainArea.current;
      area?.querySelector<HTMLButtonElement>(target === "controls" ? "[data-back-to-editor]" : "[data-workflow-controls-toggle]")?.focus({ preventScroll: true });
    });
  }
  function browseReferences() { setEditExpanded(false); setStep("create"); setView("references"); revealOnMobile("preview"); }
  function openClipEditor(target: "opening" | "demo") {
    setWorkflowControlsExpanded(false);
    setEditTarget(target); setEditExpanded(true); setStep("demo"); setView("results"); setShowGenerationResults(false); revealOnMobile("preview");
    requestAnimationFrame(() => editControlsTarget?.focus({ preventScroll: true }));
  }
  function showClipPreviews() {
    setEditExpanded(false); setView("results"); setShowGenerationResults(false); revealOnMobile("preview");
    requestAnimationFrame(() => mainArea.current?.querySelector<HTMLButtonElement>(`[data-edit-clip="${editTarget}"]`)?.focus({ preventScroll: true }));
  }
  function prepareFinalVideo() { setScheduleRequest(value => value + 1); }
  function requestSchedule() { if (!backgroundScheduling) { if (backgroundCapability.isFetching) setScheduleCapabilityPending(true); else prepareFinalVideo(); } setEditExpanded(false); setStep("schedule"); revealOnMobile("controls"); }
  function applyDemoEdits() { showClipPreviews(); }

  function clearVideoEdit() {
    setSelectedVideo(null); markDirty();
    const params = new URLSearchParams(window.location.search); params.delete("editVideoId");
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
  }
  function setVideoMode(mode: WorkflowVideoMode) {
    if (generating || source.busy) return;
    source.setMode(mode);
    setEditExpanded(false); setShowGenerationResults(false);
    const params = new URLSearchParams(window.location.search); params.set("videoSource", mode);
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
    setView(mode === "generate" ? "references" : "results");
  }
  function editVideo(video: FormatVideoSource, mode: WorkflowVideoMode, automatic = false) {
    generatedOpeningClaimed.current = true;
    if (selectedVideo?.id !== video.id) markDirty();
    source.setMode(mode);
    setSelectedVideo(video); setEditTarget("opening"); setEditExpanded(false); setView("results"); setShowGenerationResults(false);
    if (!automatic) {
      setStep(current => (format === "hook" ? (current === "demo" ? "demo" : "create") : (current === "edit" ? "edit" : "create")));
      revealOnMobile("preview");
    }
    const params = new URLSearchParams(window.location.search); params.set("videoSource", mode);
    if (video.mediaAssetId) params.set("editVideoId", video.mediaAssetId); else params.delete("editVideoId");
    if (!automatic) params.delete(`explore-${format}Job`);
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
  }
  function chooseDemoInDemo() {
    setEditExpanded(false); setStep("demo"); revealOnMobile("controls");
    requestAnimationFrame(() => demoControlsTarget?.querySelector<HTMLButtonElement>("[data-demo-source='upload']")?.focus({ preventScroll: true }));
  }
  const videoSelection = { ...source, source: importedSource ?? null, preview: importedPreview, ready: importedReady, setMode: setVideoMode,
    chooseUpload: async (file: File) => {
      if (generating) return false;
      const accepted = await source.chooseUpload(file);
      if (accepted) setView("results");
      return accepted;
    },
    selectAsset: (asset: MediaAsset) => {
      if (generating || !source.selectAsset(asset)) return false;
      setView("results"); return true;
    },
    removeUpload: () => { if (generating) return; clearVideoEdit(); source.removeUpload(); },
  };
  function chooseOpeningInCreate() {
    if (generating || source.busy) return;
    setEditExpanded(false); setShowGenerationResults(false); setStep("create");
    revealOnMobile("controls");
    requestAnimationFrame(() => controlsArea.current?.querySelector<HTMLButtonElement>("[role='group'] button[aria-pressed='true']")?.focus({ preventScroll: true }));
  }
  const changeOpeningAction = <Button type="button" variant="outline" disabled={generating || source.busy} aria-label={format === "wall_text" ? "Change wall-of-text video" : "Change hook video"} onClick={chooseOpeningInCreate}>Change</Button>;

  function selectReference(next: RecreateReference, fromUpload = false) {
    if (generating || source.busy || slideshowSaving || slideshowUploadBusy && !fromUpload) return;
    setSlideshowRegenerationImage(null); slideshowEditor.current?.startNewSlide();
    setReference(next); setSlideIndex(0); setSlideSelection(null);
    setReferenceSelectionRevision(value => value + 1);
    setStep("create"); setView("references"); setEditExpanded(false); setShowGenerationResults(false);
    if (format !== "slideshow") {
      if (selectedVideo) setSelectedVideo(selectedVideo);
      source.setMode("generate");
    }
    if (!localPreview && format === "slideshow" && next.id.startsWith("uploaded:")) {
      try { localStorage.setItem(uploadedReferenceKey, JSON.stringify(next)); } catch { /* This session remains usable. */ }
    }
    revealOnMobile("controls");
    const params = new URLSearchParams(window.location.search);
    for (const key of ["refType", "refId", "sourceUrl", "exploreRecreate", "slide"]) params.delete(key);
    params.set("refId", next.id);
    if (format !== "slideshow") {
      params.set("videoSource", "generate"); params.delete("editVideoId");
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

  function selectSlideContext(ids: string[], previewIndex?: number) {
    if (!reference || generating || slideshowUploadBusy) return;
    setSlideSelection({ referenceId: reference.id, ids });
    if (previewIndex !== undefined) chooseSlide(previewIndex);
    else if (!ids.includes(reference.slides[activeSlideIndex]?.id)) {
      const first = reference.slides.findIndex(slide => ids.includes(slide.id));
      if (first >= 0) chooseSlide(first);
    }
  }

  function clearStyleReference() {
    if (generating) return;
    setReference(null); setSlideSelection(null);
    const params = new URLSearchParams(window.location.search);
    for (const key of ["refType", "refId", "sourceUrl", "exploreRecreate", "slide"]) params.delete(key);
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
  }
  function regenerateSlide(_index: number, image?: AIStudioImageResult) {
    if (generating || slideshowSaving) return;
    setSlideshowRegenerationImage(image ?? null);
    setStep("create"); setView("results"); revealOnMobile("controls");
  }
  const contextBanner = format !== "slideshow" ? undefined : <SlideshowReferencePicker reference={reference} slideIndex={activeSlideIndex} selectedSlideIds={selectedSlideIds} disabled={generating} localPreview={localPreview} onPreview={() => { setPreviewSlide(activeSlideIndex); setPreviewReference(reference); }} onRemove={clearStyleReference} onSelectionChange={selectSlideContext} onBusy={setSlideshowUploadBusy} onUpload={next => { selectReference(next, true); setStep("create"); }} />;
  const recreateView = {
    contextBanner: format !== "slideshow" && reference?.pairedAudio ? <p className="text-xs leading-5 text-muted">Reference audio: {reference.pairedAudio.title}. It will play across your entire video, including the demo.</p> : contextBanner,
    referenceImageUrl: format === "slideshow" && !slideshowUploadBusy ? sourceImage : undefined,
    referenceImageUrls: format === "slideshow" && !slideshowUploadBusy ? sourceImages : undefined,
    referenceImageAssetId: format === "slideshow" ? slideshowRegenerationImage?.mediaAssetId ?? slideshowRegenerationImage?.id : undefined,
    styleVideo: format !== "slideshow" && reference?.videoUrl ? { id: reference.id, selectionRevision: referenceSelectionRevision, url: reference.videoUrl, name: reference.title, duration: reference.durationSeconds ?? null } : undefined,
    referenceTitle: reference?.title, onClearReference: clearStyleReference, preview: localPreview,
    emptyContent: <div className={styles.emptyResult}><span className={styles.emptyIcon}>{format === "slideshow" ? <Images aria-hidden="true" /> : <Film aria-hidden="true" />}</span><h2 className="text-lg font-semibold">{format === "slideshow" ? "Your images will appear here" : "Your video will appear here"}</h2><p className="max-w-sm text-sm leading-6 text-muted">{format === "slideshow" ? "Choose a reference and describe your changes in Create." : "Add your instructions in Create. You can use a style example or attach your own image or video."} Your generation will appear here, ready to edit.</p><Button type="button" variant="outline" onClick={browseReferences}>Browse references</Button></div>,
    workflow: { format, controlsTarget, controlsActive: step === "create" && (format === "slideshow" || source.mode === "generate"), resultsTarget, actionsTarget: createActionsTarget, onBusyChange: reportBusy,
      onGenerationStart: () => { generatedOpeningClaimed.current = false; setEditExpanded(false); setShowGenerationResults(true); setStep("create"); setView("results"); revealOnMobile("preview"); },
      onGeneratedVideo: (video: AIStudioVideoResult) => { if (!generatedOpeningClaimed.current) editVideo(video, "generate", true); },
      onSelectVideo: (video: AIStudioVideoResult) => {
        editVideo(video, "generate");
      },
      onSelectImage: (image: AIStudioImageResult) => { if (slideshowEditor.current?.useImage(image)) { setSlideshowRegenerationImage(null); setStep("edit"); revealOnMobile("preview"); } },
    },
  };

  return <><Tabs.Root data-format={format} data-stage={step} data-editing={editExpanded} data-controls-expanded={workflowControlsExpanded} data-pane={compactPane} className={cn(styles.workspace, scrollbars.surface, scrollbars.page, classic && creation.shell, classic && styles.classicWorkspace, sections.workspace, presentation.videoWorkspace, format === "slideshow" && slideshowLayout.workspace)} value={step} onValueChange={value => { if (value === step) return; if (value === "schedule" && format === "slideshow" && (slideshowSaving || slideshowUploadBusy)) return; if (value === "schedule" && format !== "slideshow") { requestSchedule(); return; } if (value === "create" || (value === "edit" && format !== "hook") || value === "schedule" || (value === "demo" && format === "hook")) { setEditExpanded(false); setStep(value); revealOnMobile("controls"); } }}>
      <header className={classic ? cn(creation.header, sections.header, "flex shrink-0 items-center gap-3 px-4 py-3 sm:px-6 lg:px-8") : styles.header}>
        <WorkflowNavigationButton />
        {classic ? <><Link prefetch={true} href={localPreview ? "/explore?preview=1" : "/explore"} aria-label="Back to Explore" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><ArrowLeft className="size-4" aria-hidden="true" /></Link><span className="hidden text-sm text-muted sm:block">Explore <span className="ml-2" aria-hidden="true">/</span></span><div className="min-w-0"><h1 className="text-base font-semibold tracking-tight text-foreground-strong sm:text-lg">{TITLES[format]}</h1></div></> : <><Link prefetch={true} href={localPreview ? "/explore?preview=1" : "/explore"} className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" />Explore</Link><span aria-hidden="true" className="text-sm text-muted">/</span><div className={styles.heading}><h1 className="text-lg font-semibold tracking-tight">{TITLES[format]}</h1></div></>}
        {!classic ? <span className={styles.mediaBadge}><Images className="size-3.5" aria-hidden="true" />Images only</span> : null}
      </header>
    <nav ref={paneNavigation} className={cn(styles.paneNavigation, presentation.paneNavigation)} aria-label="Workspace panels">
      <Button type="button" variant="ghost" aria-pressed={compactPane === "controls"} aria-controls={workflowControlsId} onClick={() => showCompactPane("controls")}>{step === "schedule" ? "Schedule" : "Controls"}</Button>
      <Button type="button" variant="ghost" aria-pressed={compactPane === "preview"} aria-controls={`${workflowControlsId}-preview`} onClick={() => showCompactPane("preview")}>Preview</Button>
    </nav>
    <div className={classic ? cn(creation.layout, styles.workflowLayout, presentation.videoLayout, format === "slideshow" && slideshowLayout.layout) : styles.body}>
      <aside ref={controlsArea} id={workflowControlsId} data-section={step} className={classic ? cn(creation.controls, styles.workflowControls, presentation.controls) : styles.controls} aria-label={`${TITLES[format]} controls`}>
        <WorkflowSectionNavigation presentation="panel" editValue={format === "hook" ? "demo" : "edit"} editLabel={format === "slideshow" ? "Edit slides" : format === "hook" ? "Demo" : "Edit"} />
        {editExpanded ? <div className={styles.controlsReturn}><span className="text-sm font-semibold">Workflow controls</span><Button type="button" variant="outline" data-back-to-editor onClick={() => showCompactPane("preview", true)}><ArrowLeft className="size-4" aria-hidden="true" />Back to editor</Button></div> : null}
        <div ref={controlContent} className={classic ? cn(creation.controlContent, styles.workflowContent) : styles.controlContent}>
        <Tabs.Panel value="create" keepMounted className={classic ? creation.sectionPanel : styles.sectionPanel}>
        {format !== "slideshow" ? <div className={presentation.createIntro}>
          <WorkflowVideoSourceSection kind="hook" label={TITLES[format]} selection={videoSelection} disabled={generating} uploadHint="MP4, MOV or WebM · 1–120 seconds · Up to 250 MB" description="Choose a video to trim, add text and save in this workflow." previewAssets={localPreview ? previewAssets : undefined} />
          {source.mode !== "generate" ? <p role="status" className="text-xs leading-5 text-muted">{source.busy ? "Preparing your video…" : importedReady ? "Your clip is ready. Choose Edit to trim it or add text." : format === "wall_text" ? "Choose a clip to trim and add your wall of text." : "Choose a clip to trim, add text and attach an optional demo."}{localPreview ? " Preview · uploads stay on your device." : ""}</p> : null}
        </div> : null}
        <div ref={setControlsTarget} className={classic ? creation.generationFields : styles.createControls} hidden={format !== "slideshow" && source.mode !== "generate"} />
        </Tabs.Panel>
        {format !== "hook" ? <Tabs.Panel value="edit" keepMounted className={classic ? creation.sectionPanel : styles.sectionPanel}><div ref={setEditControlsTarget} className={cn(styles.editControls, format === "wall_text" && "p-4 sm:p-6")} /></Tabs.Panel> : null}
        {format === "hook" ? <Tabs.Panel value="demo" keepMounted className={creation.sectionPanel}><div ref={setDemoControlsTarget} /><section className={presentation.remixOverview} aria-label="Hook text"><h2>Hook text</h2><p>Adapt an example for your business, or add your own text.</p><div ref={setRemixOverviewTarget} />{!selectedVideo ? <p>Add a hook in Create to remix its text.</p> : null}</section></Tabs.Panel> : null}
        <Tabs.Panel value="schedule" keepMounted className={classic ? cn(creation.sectionPanel, styles.classicSchedule) : styles.sectionPanel}>
        <FormatSchedulePanel key={`${format}:${selectedVideo?.id ?? "owned-slides"}`} format={format} draftScopeId={selectedVideo?.id ?? "owned-slides"} preparing={format !== "slideshow" && Boolean(selectedVideo || demoSelected || source.busy) && !scheduleOutput} pendingSource={source.busy || format === "slideshow" && (slideshowSaving || slideshowUploadBusy)} active={step === "schedule"} output={scheduleOutput} pendingComposition={backgroundScheduling && !scheduleOutput ? format === "wall_text" ? { ...wallComposition, resolve: resolveWallComposition } : pendingComposition : null} localPreview={localPreview} imageOnly={format === "slideshow"} onBackToEdit={() => { setEditExpanded(false); setStep(format === "hook" ? "demo" : "edit"); revealOnMobile("preview"); }} />
        </Tabs.Panel>
        </div>
        <footer hidden={editExpanded || step === "schedule" || step === "create" && format !== "slideshow" && source.mode !== "generate"} className={classic ? cn(creation.actionFooter, styles.workflowFooter) : styles.actionFooter} aria-label="Workflow action">
          <div ref={setCreateActionsTarget} hidden={step !== "create" || format !== "slideshow" && source.mode !== "generate"} />
          <div ref={setEditActionsTarget} hidden={step !== "edit"} />
          {format === "hook" ? <div ref={setDemoActionsTarget} hidden={step !== "demo"} /> : null}
        </footer>
      </aside>
      <div ref={mainArea} id={`${workflowControlsId}-preview`} role="region" aria-label="Workflow preview" className={classic ? cn(creation.main, styles.classicMain, presentation.preview) : styles.main}>
        <nav hidden={step !== "create" || editExpanded} className={styles.resultTabs} aria-label="Creation views">{(["references", "results"] as const).map(value => <button key={value} type="button" aria-pressed={view === value} onClick={() => { setEditExpanded(false); if (!generating) setShowGenerationResults(false); setView(value); }} className={cn(styles.resultTab, view === value && styles.active)}>{value === "references" ? "References" : resultLabel}</button>)}</nav>
        {format === "hook" ? <section hidden={!clipStageVisible} className={cn(styles.results, styles.clipStage)} data-editing={editExpanded} aria-label="Clip previews and editor">
          <header className={styles.clipStageHeader}><div><h2 className="text-base font-semibold">{editExpanded ? `Edit ${editTarget === "demo" ? "demo video" : "hook video"}` : "Your videos"}</h2><p className="mt-1 text-xs leading-5 text-muted">{editExpanded ? "Changes apply to this clip only." : "Preview and edit each clip before combining them."}</p></div>{editExpanded ? <div className={styles.clipStageActions}><Button type="button" variant="outline" className={styles.compactControlsToggle} data-workflow-controls-toggle aria-controls={workflowControlsId} aria-expanded={workflowControlsExpanded} onClick={() => showCompactPane("controls", true)}>Workflow controls</Button></div> : step === "create" && source.mode === "generate" && selectedVideo ? <Button type="button" variant="outline" onClick={() => setShowGenerationResults(true)}>Generated videos</Button> : null}</header>
          <div className={styles.clipScrollArea} tabIndex={0} role="region" aria-label="Clip preview and editing controls">
          <div className={styles.clipEditorBody} data-editing={editExpanded}>
            <div className={styles.clipPreviews} data-has-demo={demoSelected} data-has-clips={Boolean(selectedVideo || demoSelected)}>
              <div ref={setEditResultsTarget} className={styles.clipPreviewCard} data-clip-empty={!selectedVideo} hidden={editExpanded && editTarget !== "opening"}>
                {!selectedVideo ? <div className={styles.emptyClip}>
                  <span className={styles.emptyClipIcon}><Film aria-hidden="true" /></span>
                  <div className={styles.emptyClipCopy}>
                    <div className={styles.emptyClipTitle}><h3>Hook video</h3><span className={styles.clipOptional}>Optional</span></div>
                    <p aria-live="polite">{restoredVideo.isFetching ? "Restoring your video…" : source.busy ? "Preparing your opening video…" : restoredVideo.isError ? "This saved clip is unavailable. Choose another in Create." : demoSelected ? "You can schedule your demo on its own, or add an opening in Create." : "Add an opening in Create, a demo in Demo, or both."}</p>
                  </div>
                  <Button type="button" variant="outline" disabled={generating || source.busy || restoredVideo.isFetching} onClick={chooseOpeningInCreate}>Go to Create</Button>
                </div> : null}
              </div>
              <div ref={setDemoEditResultsTarget} className={styles.clipPreviewCard} data-clip-empty={!demoSelected} hidden={editExpanded && editTarget !== "demo"} />
            </div>
            <div ref={setEditControlsTarget} tabIndex={-1} className={cn(styles.editControls, styles.clipTools)} hidden={!editExpanded} aria-label="Selected clip editing tools" />
          </div>
          </div>
          <div ref={setClipActionsTarget} hidden={!editExpanded} className={styles.clipActions} aria-label="Clip edit action" />
        </section> : <div ref={setEditResultsTarget} hidden={step !== "edit"} className={cn(styles.results, styles.savedPreview)} />}
        {format === "wall_text" && step === "edit" && !selectedVideo ? (
          <div className={styles.emptyResult}>
            <span className={styles.emptyIcon}><Film aria-hidden="true" /></span>
            <h2 className="text-xl font-semibold">No video selected</h2>
            <p className="max-w-sm text-sm leading-6 text-muted">Choose or generate a video background in Create before adding your wall of text.</p>
            <Button type="button" variant="outline" onClick={chooseOpeningInCreate}>Go to Create</Button>
          </div>
        ) : null}
        {format === "hook" ? <div ref={setDemoResultsTarget} hidden={step !== "demo" || clipStageVisible} className={styles.results} /> : null}
        {format === "hook" ? <div ref={setScheduleResultsTarget} hidden={step !== "schedule"} className={styles.results} /> : null}
        <div hidden={step !== "create" || clipStageVisible} className="flex min-h-0 flex-1 flex-col">
          <section hidden={view !== "references"} aria-label="References" className={styles.referenceArea}>
            <div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm text-muted">Watch an example, then choose Recreate.</p><FilterMenu activeCategories={categories} categories={options} count={filtered.length} disabled={loading} onClear={() => setCategories([])} onToggle={(category, checked) => setCategories(current => checked ? [...current, category] : current.filter(value => value !== category))} /></div>
            {loading ? <ReferenceGridSkeleton /> : referencesQuery.isError && !localPreview ? <LoadError onRetry={() => void referencesQuery.refetch()} /> : visible.length ? <div ref={observeReferenceGrid} className={cn(styles.referenceGrid, presentation.exampleGrid)}>{visible.map(item => <ReferenceCard key={item.id} reference={item} compact showActionLabel hideCaption={format === "wall_text"} isSelected={reference?.id === item.id} onPreview={() => { setPreviewSlide(0); setPreviewReference(item); }} onRecreate={() => selectReference(item)} />)}</div> : <EmptyReferences format={format} hasFilters={categories.length > 0} onClear={() => setCategories([])} />}
            {!canBrowseAllReferences && filtered.length > 1 ? <ProReferenceGate /> : null}
            {canBrowseAllReferences && filtered.length > 0 ? <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4"><p className="text-xs text-muted">{visible.length} of {filtered.length} references</p>{visible.length < filtered.length ? <Button type="button" variant="outline" size="sm" onClick={() => setReferencePage({ key: filterKey, limit: visible.length + referenceBatchSize(referenceColumns) })}>Show more references</Button> : null}</div> : null}
          </section>
          <div ref={setResultsTarget} hidden={view !== "results" || (format !== "slideshow" && source.mode !== "generate")} className={styles.results} />
        </div>
        {step === "schedule" && format !== "hook" ? format === "wall_text" && backgroundScheduling && !scheduleOutput ? <WallSchedulePreview preview={openingPreview?.segment.id === selectedVideo?.mediaAssetId ? openingPreview : null} error={wallComposition.error} onBackToEdit={() => { setStep("edit"); revealOnMobile("preview"); }} /> : scheduleOutput ? <div role="region" aria-label={format === "slideshow" ? "Saved slideshow preview" : "Saved video preview"} tabIndex={0} className={styles.savedPreview}><h2 className="mb-4 text-base font-semibold">Post preview</h2>{scheduleOutput.kind === "media_asset" ? <video src={scheduleOutput.url} controls playsInline className="max-h-[65dvh] max-w-full rounded-xl" /> : <div className="grid w-full grid-cols-2 gap-4 xl:grid-cols-3">{(scheduleOutput.slides ?? [scheduleOutput.url]).map((url, index) => <figure key={`${index}:${url}`}><img src={url} alt={`Saved slide ${index + 1}`} width={1080} height={1350} className="aspect-[4/5] w-full rounded-xl object-contain" /><figcaption className="mt-2 text-center text-xs text-muted">{index + 1}</figcaption></figure>)}</div>}<p className="mt-3 text-sm text-muted">{scheduleOutput.title}</p></div> : <div className={styles.emptyResult}><span className={styles.emptyIcon}>{format === "slideshow" ? <Images aria-hidden="true" /> : <Film aria-hidden="true" />}</span><h2 className="text-xl font-semibold">Your final post</h2><p className="max-w-sm text-sm leading-6 text-muted">{format === "slideshow" ? "Save your slideshow in Edit slides." : "Save your edits in Edit."} Your finished content will appear here before you schedule it.</p><Button type="button" variant="outline" onClick={() => { setStep(format === "slideshow" ? "edit" : "create"); setView("results"); setEditExpanded(false); setShowGenerationResults(false); revealOnMobile("preview"); }}>{format === "slideshow" ? "Go to Edit slides" : "Go to videos"}</Button></div> : null}
      </div>
    </div>
    {/* Mounted across steps so job polling and drafts survive navigation. */}
    </Tabs.Root>
    <Suspense fallback={null}><div className="contents">
    {controlsTarget && resultsTarget ? format === "slideshow" ? <ImagePanel active accessState={accessState} accessMessage={localPreview ? "Preview · generation disabled" : getAIStudioAccessMessage(accessState)} creditCost={subscription.data?.imageGenerationCreditCost ?? 1} creditsRemaining={subscription.data?.creditsRemaining ?? null} recreateView={recreateView} /> : <VideoPanel active accessState={accessState} accessMessage={localPreview ? "Preview · generation disabled" : getAIStudioAccessMessage(accessState)} creditsPerSecond={subscription.data?.videoGenerationCreditsPerSecond} creditsRemaining={subscription.data?.creditsRemaining ?? null} recreateView={recreateView} /> : null}
    </div></Suspense>
    {format !== "slideshow" && selectedVideo ? <FormatVideoEditor key={`${user?.uid}:${selectedVideo.id}`} format={format} video={selectedVideo} remixReference={clipReference} remixReferences={references} previewText={previewText} remixOverviewTarget={format === "hook" ? remixOverviewTarget : null} localPreview={localPreview} active={format === "wall_text" ? step === "edit" : (clipStageVisible && (!editExpanded || editTarget === "opening"))} editingActive={format === "wall_text" ? step === "edit" : (editExpanded && editTarget === "opening")} onEdit={() => openClipEditor("opening")} previewActions={changeOpeningAction} controlsTarget={editControlsTarget} actionsTarget={format === "wall_text" ? editActionsTarget : clipActionsTarget} resultsTarget={editResultsTarget} enabled={finishingEnabled && !localPreview} pendingSource={source.busy} prepareRequest={backgroundScheduling ? 0 : scheduleRequest} onClipStateChange={reportOpeningClip} onPreparationChange={reportOpeningPreparation} onPreviewChange={reportOpeningPreview} onBackToPreview={format === "wall_text" ? undefined : showClipPreviews} onDirty={markDirty} onSaved={acceptOpening} onContinue={format === "wall_text" ? requestSchedule : () => { setEditExpanded(false); setStep("demo"); }} continueLabel={format === "wall_text" ? "Schedule video" : "Continue to Demo"} /> : null}
    {format === "hook" ? <FormatDemoSection key={`demo:${user?.uid}:${format}`} format={format} videoId={selectedVideo?.mediaAssetId ?? selectedVideo?.id ?? (isExploreUuid(editVideoId) ? editVideoId : null)} opening={openingOutput} openingRevision={openingRevision} finalVideo={localPreview && previewFinalVideo ? { ...previewFinalVideo, kind: "media_asset" } : scheduleOutput?.kind === "media_asset" ? { ...scheduleOutput, kind: "media_asset" } : null} active={step === "demo"} scheduleActive={step === "schedule"} scheduleResultsTarget={scheduleResultsTarget} prepareRequest={backgroundScheduling ? 0 : scheduleRequest} backgroundScheduling={backgroundScheduling} openingClipState={openingClipState} onPendingCompositionChange={reportPendingComposition} openingPreparation={openingPreparation} openingPreview={openingPreview?.segment.id === (selectedVideo?.mediaAssetId ?? selectedVideo?.id) ? openingPreview : null} sourcePreview={selectedVideo ? { name: selectedVideo.title, url: selectedVideo.url, duration: selectedVideo.durationSeconds } : importedPreview} editActive={clipStageVisible && editExpanded && editTarget === "demo"} editPreviewActive={clipStageVisible && (!editExpanded || editTarget === "demo")} editControlsTarget={editControlsTarget} editActionsTarget={clipActionsTarget} editResultsTarget={demoEditResultsTarget} onEdit={() => openClipEditor("demo")} onAdd={chooseDemoInDemo} onEditDone={applyDemoEdits} enabled={finishingEnabled && !localPreview} pendingSource={source.busy} controlsTarget={demoControlsTarget} actionsTarget={demoActionsTarget} resultsTarget={demoResultsTarget} onDirty={markDemoDirty} localPreview={localPreview} onSelectionChange={reportDemoSelection} onFinalRequiredChange={setFinalPassRequired} onSaved={acceptOutput} onSkip={() => { setDemoSelected(false); setSavedOutput(openingOutput); setEditExpanded(false); setStep("schedule"); }} onContinue={requestSchedule} previewAssets={localPreview ? previewAssets : undefined} /> : null}
    {format === "slideshow" ? <FormatSlideshowEditor key={`${user?.uid}:slideshow`} reference={reference} legacyReferences={references} previewText={previewText} previewImages={localPreview && reference?.id === previewSlideshow?.referenceId ? previewSlideshow?.images : undefined} controllerRef={slideshowEditor} slideIndex={activeSlideIndex} active={step === "edit"} generationBusy={generating} controlsTarget={editControlsTarget} actionsTarget={editActionsTarget} resultsTarget={editResultsTarget} localPreview={localPreview} savingEnabled={slideshowSavingEnabled} onDirty={markDirty} onSaved={acceptOutput} onContinue={() => setStep("schedule")} onRegenerate={regenerateSlide} onBusyChange={reportSlideshowBusy} onBackToPreview={() => { setStep("create"); setView("results"); revealOnMobile("preview"); }} onGoToCreate={() => { setSlideshowRegenerationImage(null); setStep("create"); revealOnMobile("controls"); }} /> : null}
    <ReferencePreviewDialog key={`${previewReference?.id}:${previewSlide}`} initialSlide={previewSlide} open={Boolean(previewReference)} onOpenChange={open => { if (!open) setPreviewReference(null); }} reference={previewReference} />
  </>;
}
