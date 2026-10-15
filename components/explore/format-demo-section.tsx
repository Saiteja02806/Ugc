"use client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FolderOpen, Upload, Video } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { WorkflowFilePicker } from "@/components/explore/hook-workflow-media-controls";
import { WorkflowVideoAssetPicker } from "@/components/explore/workflow-video-asset-picker";
import { WorkflowClipSourceActions } from "@/components/explore/workflow-clip-source-actions";
import { WorkflowDemoControls } from "@/components/explore/workflow-demo-controls";
import { WorkflowSavedAudioPicker } from "@/components/explore/workflow-saved-audio-picker";
import { WorkflowBackgroundAudioPicker } from "@/components/explore/workflow-background-audio-picker";
import { ClipPreviewControls } from "./clip-preview-controls";
import { ClipTrimTimeline } from "./clip-trim-timeline";
import editorStyles from "./format-video-editor.module.css";
import { FormatVideoTextFields, trimFormatVideoEdit } from "@/components/explore/format-video-text-fields";
import { RemixTextSection } from "@/components/explore/remix-text-section";
import { applyVideoTextRemix } from "@/lib/explore/remix-text-edit";
import { FormatVideoTextOverlay } from "@/components/explore/format-video-text-overlay";
import { WorkflowSequencePreview } from "@/components/explore/workflow-sequence-preview";
import { useLocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";
import { useWorkflowSourceVideo } from "@/components/explore/use-workflow-source-video";
import { useClipDraftSave } from "@/components/explore/use-clip-draft-save";
import type { ExploreClipDraftContent } from "@/lib/explore/clip-draft-contract";
import { DEFAULT_FINISHING_OPTIONS, useWorkflowFinishing } from "@/components/explore/use-workflow-finishing";
import creation from "@/components/explore/workflow-creation.module.css";
import styles from "@/components/explore/format-workspace.module.css";
import scheduleStyles from "@/components/explore/workflow-final-video.module.css";
import { useAuth } from "@/contexts/auth-context";
import { fetchAIStudioMediaAsset } from "@/lib/ai-studio/media-client";
import { uploadAIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { defaultDemoEdit, readFormatDemoDraft, trimmedDemoFraming, type FormatDemoDraft } from "@/lib/explore/format-demo";
import { formatVideoFromAsset } from "@/lib/explore/format-video-source";
import { prepareFormatEditForExport } from "@/lib/explore/format-edit-draft";
import { canReuseUnchangedHookSource } from "@/lib/explore/unchanged-hook-source";
import type { FormatOpeningPreview, FormatPreparationStatus, WorkflowClipEditState } from "@/components/explore/format-video-editor";
import { isExploreUuid, parseExploreFinishDraft, type ExploreFinishDraft } from "@/worker/src/lib/explore-finishing-contract";
import type { ExploreScheduleComposition } from "@/lib/explore/pending-schedule-client";
import { mapSequencePreviewDemoReference, type SequencePreviewAudio, type SequencePreviewSegment } from "@/lib/explore/sequence-preview";
import { loadWorkflowDefaultMusic } from "@/lib/explore/workflow-default-music-client";
import type { MediaAsset } from "@/lib/media/types";
import { formatTextLayout, formatTextOverlays, parseExploreFormatEdit } from "@/worker/src/lib/explore-format-edit";
import type { CSSProperties } from "react";
import { getReferenceAudioPreview } from "@/lib/explore/reference-audio-preview";
type VideoOutput = {
    id: string;
    kind: "media_asset";
    url: string;
    title: string;
};
type DemoSave = {
    opening: MediaAsset | null;
    openingRevision: number;
    demo: MediaAsset | null;
    audio: MediaAsset | null;
    background: MediaAsset | null;
    draft: FormatDemoDraft;
};
const field = "w-full rounded-lg border border-border bg-card-muted px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-focus";
/** The demo uses existing owned-media edit and concatenation contracts. The
 * opening is already saved, so its text/audio cannot bleed into the demo. */
export function FormatDemoSection({ format, videoId, contentDemoId = null, opening, openingRevision, enabled, active, controlsTarget, actionsTarget, resultsTarget, onDirty, onSelectionChange, onFinalRequiredChange, onSaved, onSkip, onContinue, localPreview = false, previewAssets, pendingSource = false, editActive = false, editPreviewActive = false, editControlsTarget = null, editActionsTarget = null, editResultsTarget = null, onEdit, onEditDone, onAdd, prepareRequest = 0, scheduleActive = false, scheduleResultsTarget = null, openingPreparation, openingPreview = null, sourcePreview = null, finalVideo = null, openingClipState = null, onPendingCompositionChange, backgroundScheduling = false }: {
    format: "hook" | "wall_text";
    videoId: string | null;
    contentDemoId?: string | null;
    opening: VideoOutput | null;
    openingRevision: number;
    enabled: boolean;
    active: boolean;
    controlsTarget: HTMLElement | null;
    actionsTarget: HTMLElement | null;
    resultsTarget: HTMLElement | null;
    onDirty: () => void;
    onSelectionChange: (present: boolean) => void;
    onFinalRequiredChange?: (required: boolean) => void;
    onSaved: (output: VideoOutput) => void;
    onSkip: () => void;
    onContinue: () => void;
    localPreview?: boolean;
    previewAssets?: MediaAsset[];
    pendingSource?: boolean;
    editActive?: boolean;
    editPreviewActive?: boolean;
    editControlsTarget?: HTMLElement | null;
    editActionsTarget?: HTMLElement | null;
    editResultsTarget?: HTMLElement | null;
    onEdit?: () => void;
    onEditDone?: () => void;
    onAdd?: () => void;
    prepareRequest?: number; scheduleActive?: boolean; scheduleResultsTarget?: HTMLElement | null;
    finalVideo?: VideoOutput | null;
    openingPreview?: FormatOpeningPreview | null;
    openingPreparation?: FormatPreparationStatus; sourcePreview?: { name: string; url: string; duration: number | null } | null;
    openingClipState?: WorkflowClipEditState | null;
    onPendingCompositionChange?: (composition: ExploreScheduleComposition) => void;
    backgroundScheduling?: boolean;
}) {
    const { user } = useAuth();
    const owner = user?.uid ?? null;
    // The demo belongs to the workflow, even when the opening is not chosen
    // yet. Opening changes invalidate the final save, not the user's demo.
    const key = `ugc-explore:demo:${localPreview ? "preview:" : ""}v2:${owner}:${format}`;
    const [initial] = useState(() => { try {
        return isExploreUuid(contentDemoId) ? { version: 1 as const, demoId: contentDemoId, audioId: null, editing: defaultDemoEdit(5), framing: null, playback: "once" as const }
          : typeof window === "undefined" ? null : readFormatDemoDraft(localStorage.getItem(key));
    }
    catch {
        return null;
    } });
    const [draft, setDraft] = useState<FormatDemoDraft>(initial ?? { version: 1, demoId: null, audioId: null, editing: defaultDemoEdit(5), framing: null, playback: "once" });
    const demoDraftTouched = useRef(Boolean(initial) && !contentDemoId);
    const [assetsOpen, setAssetsOpen] = useState(false);
    const [uploadingAudio, setUploadingAudio] = useState(false), [audioError, setAudioError] = useState<string | null>(null);
    const [uploadingBackground, setUploadingBackground] = useState(false), [backgroundError, setBackgroundError] = useState<string | null>(null);
    const [selectionChanged, setSelectionChanged] = useState(false);
    const [videoError, setVideoError] = useState<string | null>(null);
    const [legacyChecked, setLegacyChecked] = useState<string | null>(null);
    const [save, setSave] = useState<DemoSave | null>(null), [saveBusy, setSaveBusy] = useState(false);
    const [final, setFinal] = useState<VideoOutput | null>(null);
    const [naturalDuration, setNaturalDuration] = useState(0);
    const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
    const [finalMediaInfo, setFinalMediaInfo] = useState<{ id: string; duration: number; width: number; height: number; error?: boolean } | null>(null);
    const [previewTime, setPreviewTime] = useState(0);
    const [remixError, setRemixError] = useState<string | null>(null);
    const [textStyleTarget, setTextStyleTarget] = useState<HTMLDivElement | null>(null);
    const [scheduleProgressTarget, setScheduleProgressTarget] = useState<HTMLDivElement | null>(null);
    const [watchedSequence, setWatchedSequence] = useState<string | null>(null);
    const [finishedSequence, setFinishedSequence] = useState<string | null>(null);
    const [defaultMusicPreview, setDefaultMusicPreview] = useState<{ owner: string | null; url: string; playback: "once" | "repeat" } | null>(null);
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
    const alive = useRef(true), fileInput = useRef<HTMLInputElement>(null), previewPlayer = useRef<HTMLVideoElement>(null), editPlayer = useRef<HTMLVideoElement>(null), editAudio = useRef<HTMLAudioElement>(null);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    useEffect(() => { if (!active)
        previewPlayer.current?.pause(); }, [active]);
    useEffect(() => { if (!editActive && !editPreviewActive) { editPlayer.current?.pause(); editAudio.current?.pause(); } }, [editActive, editPreviewActive]);
    const selection = useWorkflowSourceVideo({ enabled: !localPreview, ownerId: owner, initialMode: "upload", minDuration: 1, library: "content", assetLibrary: "creative_assets", onSelected: (asset, preview) => {
            demoDraftTouched.current = false;
            const next: FormatDemoDraft = { version: 1, demoId: asset?.id ?? null, audioId: null, editing: defaultDemoEdit(preview.duration ?? 5), framing: null, playback: "once", ...(draft.backgroundMusic !== undefined ? { backgroundMusic: draft.backgroundMusic } : {}), ...(draft.backgroundAudioId !== undefined ? { backgroundAudioId: draft.backgroundAudioId } : {}), ...(draft.backgroundPlayback !== undefined ? { backgroundPlayback: draft.backgroundPlayback } : {}) };
            setDraft(next);
            setNaturalDuration(0);
            setNaturalSize(null); setPreviewTime(0);
            audio.remove();
            setAudioError(null);
            try {
                localStorage.setItem(key, JSON.stringify(next));
            }
            catch { /* Selecting media does not dispatch a render. */ }
        } });
    const audio = useLocalWorkflowMedia("audio");
    const backgroundAudio = useLocalWorkflowMedia("audio");
    const loadAsset = async (id: string, kind: "video" | "audio") => {
        const token = await getCurrentUserIdToken(owner ?? undefined);
        if (!token)
            throw new Error("Sign in to restore your demo.");
        const asset: MediaAsset = kind === "video" && contentDemoId === id
          ? await fetch("/api/demo/sources", { cache: "no-store", headers: { Authorization: `Bearer ${token}` } }).then(async response => {
            const data = await response.json();
            const source = response.ok && data.ok === true && Array.isArray(data.assets) ? data.assets.find((candidate: MediaAsset) => candidate.id === id) : null;
            if (!source) throw new Error("This footage is not available on the Demo screen. Choose another demo.");
            return source;
          }) : await fetchAIStudioMediaAsset(id, token);
        if (kind === "video") {
            formatVideoFromAsset(asset);
            if (contentDemoId && asset.id === contentDemoId && asset.sourceType !== "demo_upload") throw new Error("This footage is not available on the Demo screen.");
        }
        else if (asset.status !== "ready" || asset.collection !== "audio")
            throw new Error("Choose ready demo audio.");
        return asset;
    };
    const openingQuery = useQuery({ queryKey: ["format-demo-opening", owner, opening?.id], enabled: enabled && !!owner && !!opening, queryFn: () => loadAsset(opening!.id, "video") });
    const demoQuery = useQuery({ queryKey: ["format-demo-restore", owner, contentDemoId ? "content" : "media", draft.demoId], enabled: !localPreview && !!owner && !!draft.demoId && !selectionChanged, queryFn: () => loadAsset(draft.demoId!, "video") });
    const audioQuery = useQuery({ queryKey: ["format-demo-audio", owner, draft.audioId], enabled: !localPreview && !!owner && !!draft.audioId, queryFn: () => loadAsset(draft.audioId!, "audio") });
    const backgroundQuery = useQuery({ queryKey: ["format-background-audio", owner, draft.backgroundAudioId], enabled: !localPreview && !!owner && !!draft.backgroundAudioId, queryFn: () => loadAsset(draft.backgroundAudioId!, "audio") });
    // Development fixtures restore from their local catalogue only. Live
    // restoration continues to require the owner-scoped asset query.
    const previewDemo = localPreview ? previewAssets?.find(asset => asset.id === draft.demoId && asset.status === "ready" && asset.mimeType.startsWith("video/")) : undefined;
    const demo = selection.source ?? (!selectionChanged ? localPreview ? previewDemo : demoQuery.data : null);
    const preview = selection.preview ?? (demo ? { name: demo.title, url: demo.url, duration: demo.durationSeconds } : null);
    const demoDraftSourceId = demo?.id ?? draft.demoId;
    const initializedContentDemo = useRef<string | null>(null);
    useEffect(() => {
      if (!contentDemoId || demo?.id !== contentDemoId || !demo.durationSeconds || initializedContentDemo.current === contentDemoId) return;
      initializedContentDemo.current = contentDemoId;
      if (!demoDraftTouched.current) setDraft(current => ({ ...current, editing: defaultDemoEdit(demo.durationSeconds!) }));
    }, [contentDemoId, demo?.id, demo?.durationSeconds]);
    const restoreDemoDraft = useCallback((content: ExploreClipDraftContent, explicit: boolean) => {
      if (!explicit && demoDraftTouched.current || content.sourceAssetId !== demoDraftSourceId || content.editing.format !== "hook") return;
      demoDraftTouched.current = true;
      if (explicit) { setSave(null); setSaveBusy(false); setFinal(null); onDirty(); }
      setDraft(current => {
        const next: FormatDemoDraft = { ...current, demoId: content.sourceAssetId, editing: content.editing, audioId: content.backgroundAssetId,
          playback: content.backgroundPlayback, framing: content.framing ?? null,
          ...(content.workflowMusic ? { backgroundMusic: content.workflowMusic.enabled, backgroundAudioId: content.workflowMusic.assetId, backgroundPlayback: content.workflowMusic.playback } : {}) };
        try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* The saved server copy remains available. */ }
        return next;
      });
    }, [demoDraftSourceId, key, onDirty]);
    const demoDraftSave = useClipDraftSave({ owner, sourceAssetId: demoDraftSourceId, scope: `${format}:demo`, enabled: !localPreview,
      content: demoDraftSourceId ? { version: 1, sourceAssetId: demoDraftSourceId, editing: draft.editing,
        backgroundAssetId: draft.audioId, backgroundPlayback: draft.audioId ? draft.playback : "once", framing: draft.framing,
        workflowMusic: { enabled: draft.backgroundMusic === true, assetId: draft.backgroundAudioId ?? null, playback: draft.backgroundPlayback ?? "repeat" } } : null,
      onRestore: restoreDemoDraft });
    const activeSave = save && (opening?.id ?? null) === (save.opening?.id ?? null) && openingRevision === save.openingRevision ? save : null;
    const currentFinal = activeSave ? final : null;
    const saveContext = useRef<DemoSave | null>(activeSave);
    useLayoutEffect(() => { saveContext.current = activeSave; }, [activeSave]);
    const hasDemo = Boolean(preview || draft.demoId || selection.busy);
    useEffect(() => { onSelectionChange(hasDemo); }, [hasDemo, onSelectionChange]);
    useEffect(() => { onFinalRequiredChange?.(hasDemo || draft.backgroundMusic === true); }, [hasDemo, draft.backgroundMusic, onFinalRequiredChange]);
    const busy = pendingSource || Boolean(activeSave && saveBusy) || selection.busy || audio.loading || backgroundAudio.loading || uploadingAudio || uploadingBackground || demoDraftSave.busy;
    const duration = preview?.duration ?? naturalDuration;
    const width = naturalSize?.width ?? demo?.width ?? 1080, height = naturalSize?.height ?? demo?.height ?? 1920;
    const exportEditing = prepareFormatEditForExport(draft.editing);
    const overlays = formatTextOverlays(exportEditing);
    const textLayouts = overlays.map(text => formatTextLayout(text, width, height));
    const textMayBeCropped = draft.framing && overlays.some((text, index) => draft.framing!.points.some(([, x, y]) =>
        (1 - text.width) / 2 < x || (1 + text.width) / 2 > x + draft.framing!.width ||
        textLayouts[index].y / height < y || (textLayouts[index].y + textLayouts[index].lines.length * textLayouts[index].lineHeight) / height > y + draft.framing!.height));
    let validation: string | null = null;
    try {
        parseExploreFormatEdit(exportEditing);
        if (hasDemo && draft.editing.trimEndMs > duration * 1000 + 50)
            validation = "Keep the trim range inside your demo.";
    }
    catch (error) {
        validation = error instanceof Error ? error.message : "Review your demo trim.";
    }
    if (!validation && textLayouts.some(layout => !layout.fits)) validation = "Your text does not fit. Reduce its size or move it higher.";
    const openingAsset = openingQuery.data;
    const referenceAudio = getReferenceAudioPreview(openingAsset);
    const needsDefaultMusic = draft.backgroundMusic === true && !draft.backgroundAudioId && !backgroundAudio.asset && !referenceAudio && !openingPreview?.referenceAudio;
    const defaultMusicQuery = useQuery({ queryKey: ["format-default-music-preview", owner], enabled: !localPreview && !!owner && needsDefaultMusic, staleTime: 5 * 60_000,
      queryFn: () => loadWorkflowDefaultMusic({ token: () => getCurrentUserIdToken(owner ?? undefined), fetch: (...args: Parameters<typeof fetch>) => fetch(...args), assertActive() { if (!alive.current) throw new Error("This workflow is no longer active."); } }) });
    useEffect(() => {
      if (!defaultMusicQuery.data) return;
      const url = URL.createObjectURL(defaultMusicQuery.data.file);
      const playback = defaultMusicQuery.data.playback;
      let subscribed = true;
      queueMicrotask(() => { if (subscribed) setDefaultMusicPreview({ owner, url, playback }); });
      return () => { subscribed = false; URL.revokeObjectURL(url); };
    }, [defaultMusicQuery.data, owner]);
    const openingWidth = openingAsset?.width ?? openingPreview?.segment.width;
    const openingHeight = openingAsset?.height ?? openingPreview?.segment.height;
    if (!validation && draft.framing && demo?.width && demo.height && openingWidth && openingHeight &&
        Math.abs((demo.width * draft.framing.width) / (demo.height * draft.framing.height) / (openingWidth / openingHeight) - 1) > .015) {
        validation = "Reframe your demo to match the opening, or reset framing to fit the full clip.";
    }
    const hasOpening = Boolean(videoId || opening || sourcePreview);
    let compositionDraft: ExploreFinishDraft | null = null;
    let compositionError = pendingSource || selection.busy || audio.loading || backgroundAudio.loading || uploadingAudio || uploadingBackground ? "Wait for the selected media to finish uploading." :
      demoQuery.isError || audioQuery.isError || backgroundQuery.isError ? "Could not restore the selected clip or audio. Retry in Edit before scheduling." :
      !localPreview && hasDemo && demoDraftSourceId && !demoDraftSave.loaded ? demoDraftSave.error ?? "Loading your saved demo edits…" :
      hasOpening && (!openingClipState || openingClipState.sourceId !== videoId) ? "Loading the opening edit settings…" :
      hasOpening && openingClipState?.error ? openingClipState.error :
      hasDemo && !demo ? "Loading your selected demo…" :
      validation && hasDemo ? validation :
      draft.audioId && !audioQuery.data ? "Loading your demo audio…" :
      draft.backgroundMusic && draft.backgroundAudioId && !backgroundQuery.data ? "Loading your background music…" :
      selection.error || audio.error || backgroundAudio.error || audioError || backgroundError || null;
    if (!compositionError) try {
      if (!hasOpening && !demo) throw new Error("Add a hook or demo before scheduling.");
      const sourceId = hasOpening ? openingClipState!.sourceId : demo!.id;
      const sourceAudioId = hasOpening ? openingClipState!.backgroundAssetId : draft.audioId;
      const globalBackground = draft.backgroundMusic ? backgroundQuery.data?.id ?? null : null;
      compositionDraft = parseExploreFinishDraft({ version: 1, kind: "hook", sourceAssetId: sourceId,
        demoAssetId: hasOpening ? demo?.id ?? null : null,
        demoAudioAssetId: hasOpening && demo ? draft.audioId : null,
        demoAudioPlayback: hasOpening && demo && draft.audioId ? draft.playback : "once",
        backgroundAssetId: globalBackground, backgroundPlayback: globalBackground ? draft.backgroundPlayback ?? "repeat" : "once", subtitles: null,
        ...(draft.framing && demo ? hasOpening ? { demoFraming: trimmedDemoFraming(draft.framing, draft.editing) } : { sourceFraming: trimmedDemoFraming(draft.framing, draft.editing) } : {}),
        composition: { version: 1, sourceEditing: hasOpening ? openingClipState!.editing : exportEditing,
          demoEditing: hasOpening && demo ? exportEditing : null,
          sourceAudioAssetId: sourceAudioId ?? null, sourceAudioPlayback: sourceAudioId ? hasOpening ? openingClipState!.backgroundPlayback : draft.playback : "once" },
      });
    } catch (error) { compositionError = error instanceof Error ? error.message : "Review the selected clips before scheduling."; }
    const compositionSignature = JSON.stringify([videoId, compositionDraft, compositionError, needsDefaultMusic, draft.backgroundMusic]);
    const latestCompositionSignature = useRef(compositionSignature);
    const defaultMusicUploads = useRef(new Map<string, { id: string; playback: "once" | "repeat" }>());
    useLayoutEffect(() => { latestCompositionSignature.current = compositionSignature; }, [compositionSignature]);
    useEffect(() => {
      if (!onPendingCompositionChange) return;
      const captured = compositionDraft;
      onPendingCompositionChange({ signature: compositionSignature, sourceId: captured?.sourceAssetId ?? videoId ?? demo?.id ?? "",
        title: hasOpening ? format === "wall_text" ? "Wall of text video" : "Hook + demo video" : preview?.name ?? "Demo video", draft: captured, error: compositionError,
        resolve: async () => {
          if (compositionError) throw new Error(compositionError);
          if (!captured || compositionError || latestCompositionSignature.current !== compositionSignature || !alive.current) throw new Error("Your clips changed. Review the updated video before scheduling.");
          let result = captured;
          if (needsDefaultMusic) {
            if (!owner) throw new Error("Sign in before adding background music.");
            let uploaded = defaultMusicUploads.current.get(owner);
            if (!uploaded) {
              const music = defaultMusicQuery.data ?? await loadWorkflowDefaultMusic({ token: () => getCurrentUserIdToken(owner), fetch, assertActive() { if (!alive.current || latestCompositionSignature.current !== compositionSignature) throw new Error("Your music selection changed."); } });
              const savedMusic = await uploadAIStudioReferenceMedia(music.file, "audio", 120, owner, { maxAudioDurationSeconds: 600, purpose: "explore-demo" });
              uploaded = { id: savedMusic.asset.id, playback: music.playback }; defaultMusicUploads.current.set(owner, uploaded);
            }
            result = parseExploreFinishDraft({ ...captured, backgroundAssetId: uploaded.id, backgroundPlayback: uploaded.playback });
          }
          if (!alive.current || latestCompositionSignature.current !== compositionSignature) throw new Error("Your clips changed. Review the updated video before scheduling.");
          return result;
        } });
    }, [onPendingCompositionChange, compositionSignature, compositionDraft, compositionError, videoId, demo?.id, hasOpening, format, preview?.name, needsDefaultMusic, owner, defaultMusicQuery.data]);
    const ready = !pendingSource && (hasOpening ? !!openingQuery.data : !!demo) && (hasDemo ? !!demo : draft.backgroundMusic === true) && !selection.busy && !selection.error && !validation && !audio.loading && !backgroundAudio.loading && !audio.error && !backgroundAudio.error && !audioError && !backgroundError && !uploadingAudio && !uploadingBackground && (!draft.audioId || !!audioQuery.data) && (!draft.backgroundMusic || !draft.backgroundAudioId || !!backgroundQuery.data);
    const handledPrepareRequest = useRef(0);
    useEffect(() => {
        if (!prepareRequest || handledPrepareRequest.current === prepareRequest || !enabled || !ready || currentFinal || activeSave) return;
        handledPrepareRequest.current = prepareRequest;
        setSaveBusy(true); setFinal(null);
        setSave({ opening: openingQuery.data ?? null, openingRevision, demo: demo ?? null, audio: audioQuery.data ?? null, background: draft.backgroundMusic ? backgroundQuery.data ?? null : null, draft: { ...draft, editing: exportEditing, demoId: demo?.id ?? null } });
    }, [prepareRequest, enabled, ready, currentFinal, activeSave, openingQuery.data, openingRevision, demo, audioQuery.data, backgroundQuery.data, draft, exportEditing]);
    function change(next: FormatDemoDraft) { demoDraftTouched.current = true; setDraft(next); if (JSON.stringify({ ...next, editing: prepareFormatEditForExport(next.editing) }) !== JSON.stringify({ ...draft, editing: exportEditing })) { setSave(null); setSaveBusy(false); setFinal(null); onDirty(); } try {
        localStorage.setItem(key, JSON.stringify(next));
    }
    catch { /* Saving verifies its durable receipt independently. */ } }
    function seekDemoText(timeMs: number) {
        editPlayer.current?.pause(); editAudio.current?.pause();
        if (editPlayer.current) editPlayer.current.currentTime = (draft.editing.trimStartMs + timeMs) / 1000;
        setPreviewTime(timeMs);
    }
    function trimDemo(startMs: number, endMs: number) {
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return;
        const end = Math.min(Math.round(duration * 1000), Math.max(1000, endMs));
        const start = Math.max(0, Math.min(startMs, end - 1000));
        const position = start !== draft.editing.trimStartMs ? start : Math.max(start, end - 50);
        editPlayer.current?.pause(); editAudio.current?.pause();
        change({ ...draft, editing: trimFormatVideoEdit(draft.editing, start, end) });
        setPreviewTime(position - start);
        if (editPlayer.current) editPlayer.current.currentTime = position / 1000;
    }
    const prepareSelection = () => { setSelectionChanged(true); setSave(null); setSaveBusy(false); setFinal(null); onDirty(); };
    async function chooseVideo(file: File) {
        if (busy)
            return;
        const previousMode = selection.mode;
        setVideoError(null);
        selection.setMode("upload");
        const accepted = await selection.chooseUpload(file);
        if (!alive.current) return;
        if (accepted) prepareSelection();
        else {
            selection.setMode(previousMode);
            if (preview) selection.clearUploadError();
            setVideoError(preview ? "The replacement could not be added. Your previous demo is kept. Try another video." : "This video could not be added. Try another MP4, MOV or WebM clip.");
        }
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
            if (localPreview || !owner)
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
    const audioAttachment = { ...audio, choose: chooseAudio, chooseRemote: (...args: Parameters<typeof audio.chooseRemote>) => { setSave(null); setFinal(null); onDirty(); return audio.chooseRemote(...args); }, loading: uploadingAudio || audio.loading, remove: () => { audio.remove(); setAudioError(null); change({ ...draft, audioId: null, playback: "once" }); } };
    async function chooseBackgroundAudio(file: File, playback: "once" | "repeat" = "repeat") {
        if (busy) return false;
        setUploadingBackground(true); setBackgroundError(null); setFinal(null); onDirty();
        try {
            if (!await backgroundAudio.choose(file, { maxDuration: 600 })) return false;
            if (localPreview || !owner) { change({ ...draft, backgroundMusic: true, backgroundAudioId: null, backgroundPlayback: playback }); return true; }
            const uploaded = await uploadAIStudioReferenceMedia(file, "audio", 120, owner, { maxAudioDurationSeconds: 600, purpose: "explore-demo" });
            if (!alive.current) return false;
            change({ ...draft, backgroundMusic: true, backgroundAudioId: uploaded.asset.id, backgroundPlayback: playback });
            return true;
        } catch (error) { if (alive.current) setBackgroundError(error instanceof Error ? error.message : "Could not upload background audio."); return false; }
        finally { if (alive.current) setUploadingBackground(false); }
    }
    const backgroundAttachment = { ...backgroundAudio, choose: (file: File) => chooseBackgroundAudio(file), chooseRemote: (...args: Parameters<typeof backgroundAudio.chooseRemote>) => { setSave(null); setFinal(null); onDirty(); return backgroundAudio.chooseRemote(...args); }, loading: uploadingBackground || backgroundAudio.loading, remove: () => { backgroundAudio.remove(); setBackgroundError(null); change({ ...draft, backgroundAudioId: null }); } };
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
        setNaturalSize(null); setPreviewTime(0);
        change({ version: 1, demoId: null, audioId: null, editing: defaultDemoEdit(5), framing: null, playback: "once", ...(draft.backgroundMusic !== undefined ? { backgroundMusic: draft.backgroundMusic } : {}), ...(draft.backgroundAudioId !== undefined ? { backgroundAudioId: draft.backgroundAudioId } : {}), ...(draft.backgroundPlayback !== undefined ? { backgroundPlayback: draft.backgroundPlayback } : {}) });
    } };
    const skip = () => { if (!busy) {
        removeDemo();
        onSkip();
    } };
    const problems = <>{selection.error || videoError || audioError || audio.error || preview && validation ? <p role="alert" className="text-xs text-destructive">{selection.error ?? videoError ?? audioError ?? audio.error ?? validation}</p> : null}
    {demoQuery.isError || audioQuery.isError || openingQuery.isError ? <p role="alert" className="text-xs text-destructive">Could not restore a saved clip or audio. <button type="button" className="underline" onClick={() => { void openingQuery.refetch(); void demoQuery.refetch(); void audioQuery.refetch(); }}>Retry</button></p> : null}</>;
    const controls = <div className={`${styles.demoControls} space-y-4`}>
      <h2 className="text-sm font-semibold">{editPreviewActive ? "Video settings" : <>Demo <span className="ml-1 text-xs font-normal text-muted">Optional</span></>}</h2>
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <div hidden={editPreviewActive}>
        <div className={styles.demoSourceActions}>
          <Button type="button" variant="outline" data-demo-source="upload" onClick={() => fileInput.current?.click()}><span className={styles.demoSourceIcon} aria-hidden="true"><Upload className="size-5" /></span><span>{preview ? "Replace demo" : "Upload demo"}</span></Button>
          <Button type="button" variant="outline" onClick={() => setAssetsOpen(true)}><span className={styles.demoSourceIcon} aria-hidden="true"><FolderOpen className="size-5" /></span><span>Creative Assets</span></Button>
          <input ref={fileInput} type="file" accept="video/mp4,video/quicktime,video/webm" className="sr-only" aria-label="Upload or replace demo video" onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void chooseVideo(file); }}/>
        </div>
        {preview ? <div className="flex items-center gap-2"><p className="min-w-0 flex-1 truncate text-xs text-muted" title={preview.name}>{preview.name}</p><Button type="button" size="sm" variant="ghost" onClick={removeDemo}>Remove</Button></div>
          : <p className="text-xs leading-5 text-muted">MP4, MOV or WebM · 1–60 seconds · Up to 100 MB. Uploads appear on the Demo screen.</p>}
        </div>
        <section className={creation.editGroup} aria-label="Background audio settings">
          {referenceAudio ? <p className="text-xs leading-5 text-muted">Reference audio: {referenceAudio.title}. This track continues across your video. Demo speech stays audible.</p> : <div className={creation.finishRow}><span className="text-sm font-medium">Background audio</span><button type="button" role="switch" aria-label="Background audio" aria-checked={draft.backgroundMusic === true} disabled={busy} className={styles.backgroundAudioSwitch} onClick={() => { if (!busy) change({ ...draft, backgroundMusic: !draft.backgroundMusic }); }}><span className={styles.backgroundAudioTrack} aria-hidden="true"><span className={styles.backgroundAudioThumb}/></span></button></div>}
          {!referenceAudio ? <div className={styles.backgroundChoices}>
            <div className="flex flex-wrap gap-2"><WorkflowFilePicker attachment={backgroundAttachment} kind="audio" label="Upload background audio" buttonLabel="Upload audio" disabled={busy} /><WorkflowBackgroundAudioPicker ownerId={owner} attachment={backgroundAttachment} onChoose={chooseBackgroundAudio} disabled={busy} localPreview={localPreview} /></div>
            {draft.backgroundAudioId || backgroundAudio.asset ? <><p className="break-words text-xs text-muted">{backgroundQuery.data?.title ?? backgroundAudio.asset?.name ?? "Loading your audio…"}</p><audio controls src={backgroundQuery.data?.url ?? backgroundAudio.asset?.url} className="h-8 w-full" aria-label="Selected background audio" /><div className="flex items-center justify-between gap-2"><label className="text-xs text-muted">Playback<select aria-label="Background audio playback" value={draft.backgroundPlayback ?? "repeat"} onChange={event => change({ ...draft, backgroundPlayback: event.target.value as "once" | "repeat" })} className={field}><option value="once">Play once</option><option value="repeat">Repeat to fit</option></select></label><Button type="button" size="sm" variant="ghost" onClick={backgroundAttachment.remove}>Remove audio</Button></div></> : null}
            <p className="text-xs leading-5 text-muted">Plays across your video. Turn on to use the default track, or choose your own.</p>
            {backgroundError || backgroundAudio.error ? <p role="alert" className="text-xs text-destructive">{backgroundError ?? backgroundAudio.error}</p> : null}
            {backgroundQuery.isError ? <p role="alert" className="text-xs text-destructive">Could not restore background audio. <button type="button" className="underline" onClick={() => void backgroundQuery.refetch()}>Retry</button></p> : null}
          </div> : null}
        </section>
      </fieldset>
      {problems}
    </div>;
    const editingControls = <div className={editorStyles.editorRoot}>
      <div className={editorStyles.editorHeader}><h2 className="text-sm font-semibold">Edit demo video</h2><span className="shrink-0 text-xs text-muted">{duration.toFixed(1)}s source</span></div>
      {preview ? <fieldset disabled={busy} className={`${styles.clipControlsGrid} ${editorStyles.controlGrid}`}>
        <details className={`${styles.demoOptions} ${editorStyles.trimSection}`} aria-label="Demo trim" data-editor-section="trim" open><summary>Trim <span>{Math.max(0, draft.editing.trimEndMs - draft.editing.trimStartMs) / 1000}s selected</span></summary><section className={editorStyles.trimBody} aria-label="Trim">
          <div className={editorStyles.trimTimingFields}>{(["trimStartMs", "trimEndMs"] as const).map((name, index) => <label key={name}>{index === 0 ? "Start" : "End"}<span>Seconds</span><input type="number" aria-label={index === 0 ? "Demo trim start" : "Demo trim end"} min={index === 0 ? 0 : draft.editing.trimStartMs / 1000 + 1} max={index === 0 ? Math.max(0, draft.editing.trimEndMs / 1000 - 1) : duration} step={.1} value={draft.editing[name] / 1000} className={field} onChange={event => trimDemo(name === "trimStartMs" ? Math.round(Number(event.target.value) * 1000) : draft.editing.trimStartMs, name === "trimEndMs" ? Math.round(Number(event.target.value) * 1000) : draft.editing.trimEndMs)}/></label>)}</div>
          <ClipTrimTimeline disabled={busy} durationMs={Math.round(duration * 1000)} startMs={draft.editing.trimStartMs} endMs={draft.editing.trimEndMs} timeMs={draft.editing.trimStartMs + previewTime} onChange={trimDemo} />
        </section></details>
        <div className={`${styles.clipTextControls} ${editorStyles.textControlSection}`}>
          <RemixTextSection editorNavigation owner={owner} targetKey={`demo:${demo?.id ?? preview.url}`} format="hook" disabled={busy} localPreview={localPreview} scopeLabel="Only this demo clip. The hook stays unchanged." onUse={(output, source) => {
            try { const editing = applyVideoTextRemix(draft.editing, output, source); setRemixError(null); change({ ...draft, editing }); seekDemoText(formatTextOverlays(editing)[0]?.startMs ?? 0); return true; }
            catch (error) { setRemixError(error instanceof Error ? error.message : "Review the remixed text."); return false; }
          }}>
            <FormatVideoTextFields styleTarget={textStyleTarget} editing={draft.editing} onChange={editing => change({ ...draft, editing })} timeMs={previewTime} onSeek={seekDemoText} />
          </RemixTextSection>
          {remixError ? <p role="alert" className="text-xs leading-5 text-destructive">{remixError}</p> : null}
          {textMayBeCropped ? <p role="status" className="text-xs leading-5 text-muted">Your crop may cut off this heading. Move the text inside the visible area or adjust Crop & zoom before saving.</p> : null}
        </div>
        <div className={`${styles.clipUtilityControls} ${editorStyles.utilityControlSection}`}><div ref={setTextStyleTarget} className={editorStyles.styleDock} />
        <details className={styles.demoOptions}><summary>Crop & zoom <span>{draft.framing ? "Custom framing" : "Full clip"}</span></summary><div className="mt-3 space-y-3">
          <p className="text-xs leading-5 text-muted">The full demo fits by default. Choose Adjust crop &amp; pan to change the frame.</p><WorkflowDemoControls asset={preview} value={draft.framing} onChange={framing => change({ ...draft, framing })} outputAspect={openingQuery.data?.width && openingQuery.data.height ? openingQuery.data.width / openingQuery.data.height : hasOpening ? 9 / 16 : width / height} disabled={busy}/>
        </div></details>
        <details className={styles.demoOptions} open><summary>Sound <span>{draft.audioId || audio.asset ? "Audio added" : `${Math.round(draft.editing.originalVolume * 100)}% original`}</span></summary><div className="mt-3 space-y-3">
          <label className="block space-y-2 text-xs text-muted">Original sound · {Math.round(draft.editing.originalVolume * 100)}%<input type="range" aria-label="Demo original volume" min={0} max={100} value={draft.editing.originalVolume * 100} onChange={event => change({ ...draft, editing: { ...draft.editing, originalVolume: Number(event.target.value) / 100 } })} className="w-full accent-primary"/></label>
          <div className="flex flex-wrap gap-2"><WorkflowFilePicker attachment={audioAttachment} kind="audio" label="Upload demo audio" buttonLabel="Upload audio" disabled={busy}/><WorkflowSavedAudioPicker ownerId={owner} attachment={audioAttachment} disabled={busy} localPreview={localPreview}/></div>
          {draft.audioId || audio.asset ? <><p className="break-words text-xs text-muted">{audioQuery.data?.title ?? audio.asset?.name}</p><Button type="button" size="sm" variant="ghost" onClick={audioAttachment.remove}>Remove audio</Button><label className="block space-y-2 text-xs text-muted">Added audio · {Math.round(draft.editing.musicVolume * 100)}%<input type="range" aria-label="Demo added audio volume" min={0} max={100} value={draft.editing.musicVolume * 100} className="w-full accent-primary" onChange={event => change({ ...draft, editing: { ...draft.editing, musicVolume: Number(event.target.value) / 100 } })}/></label><label className="block space-y-2 text-xs text-muted">Playback<select aria-label="Demo audio playback" value={draft.playback} className={field} onChange={event => change({ ...draft, playback: event.target.value as "once" | "repeat" })}><option value="once">Play once</option><option value="repeat">Repeat to fit demo</option></select></label></> : null}
          <p className="text-xs leading-5 text-muted">Added audio plays during the demo only. The sound mix is applied when you save the final video.</p>
        </div></details>

        {draft.framing ? <Button type="button" variant="ghost" size="sm" onClick={() => change({ ...draft, framing: null })}>Reset demo framing</Button> : null}</div>
      </fieldset> : <p className="text-sm leading-6 text-muted">Add a demo in the Demo section to edit it here.</p>}
      {problems}
    </div>;
    const editingActions = <div className={styles.clipActionContent}><div className={editorStyles.actionBar}>{onEditDone ? <Button type="button" variant="ghost" className="h-11 rounded-xl px-4" disabled={busy} onClick={onEditDone}><ArrowLeft className="size-4" aria-hidden="true" />Back to videos</Button> : null}<Button type="button" className={`${editorStyles.saveAction} h-11 rounded-xl px-5 font-semibold shadow-sm hover:shadow transition-shadow`} disabled={busy || localPreview || !preview || !!validation || !!audio.error || !!backgroundAudio.error || !!audioError || !!backgroundError || !localPreview && (!demo || !demoDraftSave.loaded || Boolean(draft.audioId && !audioQuery.data) || Boolean(draft.backgroundAudioId && !backgroundQuery.data))} onClick={async () => {
      if (busy || !preview || validation || audio.error || backgroundAudio.error || audioError || backgroundError) return;
      if (localPreview) return;
      await demoDraftSave.save();
    }}>{demoDraftSave.busy ? "Saving…" : demoDraftSave.saved && !demoDraftSave.dirty ? "Edits saved" : "Save edits"}</Button></div>
      <p role="status" className="text-xs leading-5 text-muted">{localPreview ? "Demo edits stay in this browser preview." : demoDraftSave.busy ? "Saving your edits…" : demoDraftSave.saved && !demoDraftSave.dirty ? "Edits saved. Your preview is up to date." : "Changes appear in the preview immediately. Save edits to keep them."}</p>
      {demoDraftSave.error ? <><p role="alert" className="text-xs leading-5 text-destructive">{demoDraftSave.error}</p><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={demoDraftSave.reload}>Reload saved demo draft</Button></> : null}
    </div>;
    const previewAudioUrl = audioQuery.data?.url ?? audio.asset?.url;
    function synchronizeEditSound() {
        const sound = editAudio.current, video = editPlayer.current;
        if (!sound || !video) return;
        sound.volume = draft.editing.musicVolume;
        sound.muted = video.muted;
        const elapsed = Math.max(0, video.currentTime - draft.editing.trimStartMs / 1000);
        const position = draft.playback === "repeat" && Number.isFinite(sound.duration) && sound.duration > 0 ? elapsed % sound.duration : elapsed;
        if (draft.playback === "once" && Number.isFinite(sound.duration) && elapsed >= sound.duration) { sound.pause(); return; }
        if (Math.abs(sound.currentTime - position) > .15) sound.currentTime = position;
        if (!video.paused) void sound.play().catch(() => {});
    }
    useEffect(() => {
        if (editPlayer.current) editPlayer.current.volume = draft.editing.originalVolume;
        if (editAudio.current) editAudio.current.volume = draft.editing.musicVolume;
    }, [draft.editing.originalVolume, draft.editing.musicVolume]);
    const editingPreview = <section className="flex flex-col items-center gap-4" aria-label="Demo edit preview" style={{ "--clip-aspect": width / height } as CSSProperties}>{preview ? <div className={styles.clipPreviewHeading}><h3>{editActive ? draft.framing ? "Full clip preview" : "Live preview" : "Demo video"}</h3><span>{width * 16 === height * 9 ? "9:16" : width * 9 === height * 16 ? "16:9" : width === height ? "1:1" : width < height ? "Portrait" : "Landscape"}</span></div> : null}
      {preview ? <div data-clip-media data-clip-orientation={width < height ? "portrait" : width > height ? "landscape" : "square"} className="relative max-h-[65dvh] w-full max-w-[min(420px,55dvh)] overflow-hidden rounded-xl bg-black" style={{ aspectRatio: `${width}/${height}`, "--clip-aspect": width / height } as CSSProperties}>
        <video ref={editPlayer} src={preview.url} aria-label="Demo video being edited" playsInline preload="metadata" className="size-full object-contain" onLoadedMetadata={event => {
          const video = event.currentTarget;
          if (video.videoWidth > 0 && video.videoHeight > 0) setNaturalSize({ width: video.videoWidth, height: video.videoHeight });
          if (Number.isFinite(video.duration)) setNaturalDuration(video.duration);
          video.volume = draft.editing.originalVolume; video.currentTime = draft.editing.trimStartMs / 1000; setPreviewTime(0);
        }} onPlay={event => { const video = event.currentTarget; video.volume = draft.editing.originalVolume; if (video.currentTime < draft.editing.trimStartMs / 1000 || video.currentTime >= draft.editing.trimEndMs / 1000) video.currentTime = draft.editing.trimStartMs / 1000; synchronizeEditSound(); }} onPause={() => editAudio.current?.pause()} onSeeked={synchronizeEditSound} onTimeUpdate={event => {
          const video = event.currentTarget; video.volume = draft.editing.originalVolume;
          setPreviewTime(video.currentTime * 1000 - draft.editing.trimStartMs);
          if (!video.paused && video.currentTime * 1000 >= draft.editing.trimEndMs) { video.pause(); video.currentTime = Math.max(draft.editing.trimStartMs, draft.editing.trimEndMs - 50) / 1000; }
          synchronizeEditSound();
        }} />
        {overlays.map((text, overlayIndex) => previewTime >= text.startMs && previewTime < text.endMs ? <FormatVideoTextOverlay key={overlayIndex} label={`Demo text overlay ${overlayIndex + 1} preview`} text={text} width={width} height={height} /> : null)}
      </div> : <div className={styles.emptyClip}>
        <span className={styles.emptyClipIcon}><Video aria-hidden="true" /></span>
        <div className={styles.emptyClipCopy}>
          <div className={styles.emptyClipTitle}><h3>Demo video</h3><span className={styles.clipOptional}>Optional</span></div>
          <p aria-live="polite">{selection.busy ? "Preparing your demo…" : draft.demoId ? localPreview ? "This preview clip is unavailable. Upload or choose another demo." : "Restoring your demo…" : active ? "Upload or choose a demo to preview it here." : "Your demo plays after the opening."}</p>
        </div>
        <div className={styles.emptyClipActions}><WorkflowClipSourceActions label="demo video" disabled={busy} onUpload={chooseVideo} onChooseAssets={() => setAssetsOpen(true)} /></div>
        {selection.error || videoError ? <p role="alert" className="col-span-full text-xs text-destructive">{videoError ?? selection.error}</p> : null}
      </div>}
      {preview ? <ClipPreviewControls player={editPlayer} onMute={muted => { if (editPlayer.current) editPlayer.current.muted = muted; if (editAudio.current) editAudio.current.muted = muted; }} timeMs={previewTime} startMs={draft.editing.trimStartMs} endMs={draft.editing.trimEndMs} onSeek={timeMs => { editPlayer.current?.pause(); editAudio.current?.pause(); if (editPlayer.current) editPlayer.current.currentTime = (draft.editing.trimStartMs + timeMs) / 1000; setPreviewTime(timeMs); }} /> : null}
      {previewAudioUrl ? <audio ref={editAudio} src={previewAudioUrl} loop={draft.playback === "repeat"} preload="metadata" aria-label="Demo added audio preview" /> : null}
      {!editActive && preview ? <><p className="max-w-full truncate text-xs text-muted" title={preview.name}>{preview.name}</p><div className={styles.clipCardActions}><Button type="button" variant="outline" data-edit-clip="demo" disabled={busy || !onEdit} onClick={onEdit}>Edit demo video</Button><Button type="button" variant="outline" aria-label="Change demo video" disabled={busy || !onAdd} onClick={onAdd}>Change</Button></div>{draft.framing ? <p className="text-xs leading-5 text-muted">Full clip preview. Your crop applies when you save.</p> : null}</> : editActive && draft.framing ? <p className="max-w-md text-center text-xs leading-5 text-muted">Full clip preview. Review your crop in Crop & zoom; it applies when you save.</p> : null}
    </section>;
    const actions = <div className="space-y-2"><Button type="button" className="h-11 w-full rounded-xl font-semibold shadow-sm hover:shadow transition-shadow" disabled={pendingSource || selection.busy || !sourcePreview && !opening && !demo || Boolean(validation && preview)} onClick={onContinue}>Schedule video</Button>
    {opening && !draft.backgroundMusic ? <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={skip}>Continue without demo</Button> : null}
  </div>;
    const results = <section className="mx-auto w-full max-w-3xl space-y-5 p-4 sm:p-6" aria-label="Opening and demo preview"><h2 className="text-base font-semibold">{currentFinal ? "Your final video" : "Your video sequence"}</h2>{currentFinal ? <video src={currentFinal.url} controls playsInline aria-label="Merged final video" className="mx-auto max-h-[65dvh] max-w-full rounded-xl"/> : <div className="grid grid-cols-1 gap-5 sm:grid-cols-2"><figure><figcaption className="mb-3 text-sm font-medium">1 · {format === "wall_text" ? "Wall of text" : "Hook"}</figcaption>{opening ? <video src={opening.url} controls playsInline preload="metadata" aria-label="Saved opening video" className="max-h-80 w-full rounded-xl bg-black object-contain"/> : <div className="flex min-h-48 items-center justify-center rounded-xl border border-border p-5 text-center text-sm text-muted">Save your opening from its preview.</div>}</figure><figure><figcaption className="mb-3 text-sm font-medium">2 · Demo</figcaption>{preview ? <video ref={previewPlayer} src={preview.url} controls playsInline preload="metadata" aria-label="Selected demo video" className="max-h-80 w-full rounded-xl bg-black object-contain" onLoadedMetadata={event => { const length = event.currentTarget.duration; if (Number.isFinite(length) && length >= 1 && length <= 120) {
        setNaturalDuration(length);
        if (preview.duration === null && draft.editing.trimStartMs === 0 && draft.editing.trimEndMs === 5000 && initial?.demoId !== demo?.id)
            change({ ...draft, editing: defaultDemoEdit(length) });
    } event.currentTarget.currentTime = draft.editing.trimStartMs / 1000; event.currentTarget.volume = draft.editing.originalVolume; }} onPlay={event => { event.currentTarget.volume = draft.editing.originalVolume; if (event.currentTarget.currentTime < draft.editing.trimStartMs / 1000 || event.currentTarget.currentTime >= draft.editing.trimEndMs / 1000)
        event.currentTarget.currentTime = draft.editing.trimStartMs / 1000; }} onTimeUpdate={event => { if (event.currentTarget.currentTime * 1000 >= draft.editing.trimEndMs) {
        event.currentTarget.pause();
        event.currentTarget.currentTime = draft.editing.trimStartMs / 1000;
    } }}/> : <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-5 text-sm text-muted"><Video aria-hidden="true"/>Add an optional demo</div>}</figure></div>}<p className="text-center text-sm text-muted">{preview && opening ? `Opening → Demo · ${Math.round(((openingQuery.data?.durationSeconds ?? 0) + (draft.editing.trimEndMs - draft.editing.trimStartMs) / 1000) * 10) / 10}s total` : preview && !hasOpening ? "This demo will be scheduled on its own." : "The demo plays after your saved opening."}</p>{format === "wall_text" ? <p className="text-center text-xs leading-5 text-muted">Your wall of text stays on the opening. The demo uses its own sound and framing.</p> : null}</section>;
    // Publication still requires the verified saved output. Local sequence
    // playback is independent of that gate and never becomes onSaved output.
    const scheduleFinal = pendingSource ? null : currentFinal ?? (finalVideo && (!hasDemo && !draft.backgroundMusic || finalVideo.id !== opening?.id) ? finalVideo : !hasDemo && !draft.backgroundMusic ? opening : null);
    const referenceMusic = openingPreview?.referenceAudio ?? (referenceAudio ? { url: referenceAudio.audioUrl, volume: referenceAudio.volume, playback: "repeat" as const } : null);
    const sequenceSegments: SequencePreviewSegment[] = [];
    const rawOpening = openingPreview?.segment ?? (sourcePreview?.duration && sourcePreview.duration > 0 ? {
      id: videoId ?? "opening-preview", label: format === "wall_text" ? "Wall of text" : "Hook", url: sourcePreview.url,
      durationSeconds: sourcePreview.duration, width: openingAsset?.width ?? 1080, height: openingAsset?.height ?? 1920,
    } : openingAsset ? { id: openingAsset.id, label: format === "wall_text" ? "Wall of text" : "Hook", url: openingAsset.url,
      durationSeconds: openingAsset.durationSeconds ?? 0, width: openingAsset.width ?? 1080, height: openingAsset.height ?? 1920 } : null);
    if (!pendingSource && rawOpening) sequenceSegments.push({ ...rawOpening, id: `opening:${rawOpening.id}` });
    if (!pendingSource && preview && duration > 0) {
      const demoReference = getReferenceAudioPreview(demo);
      const requiresPreparation = !canReuseUnchangedHookSource(demo ?? null, exportEditing, null);
      const rawDemo: SequencePreviewSegment = { id: `demo:${demo?.id ?? draft.demoId ?? preview.url}`, label: "Demo", url: preview.url,
        durationSeconds: duration, width, height, editing: exportEditing, framing: draft.framing,
        addedAudio: audioQuery.data?.url || audio.asset?.url ? { url: audioQuery.data?.url ?? audio.asset!.url, volume: exportEditing.musicVolume, playback: draft.playback } : null };
      sequenceSegments.push(mapSequencePreviewDemoReference(rawDemo, demoReference, { openingHasReference: Boolean(referenceMusic), requiresPreparation,
        referenceVolume: rawDemo.addedAudio ? exportEditing.musicVolume : requiresPreparation ? .2 : demoReference?.volume }));
    }
    const customMusicUrl = backgroundQuery.data?.url ?? backgroundAudio.asset?.url;
    const sequenceMusic: SequencePreviewAudio | null = referenceMusic ?? (draft.backgroundMusic ? customMusicUrl ? { url: customMusicUrl, volume: .2, playback: draft.backgroundPlayback ?? "repeat" }
      : defaultMusicPreview?.owner === owner && defaultMusicQuery.data ? { url: defaultMusicPreview.url, volume: .2, playback: defaultMusicPreview.playback } : null : null);
    const sequenceKey = JSON.stringify([sequenceSegments, sequenceMusic, openingRevision]);
    const sequenceInUse = watchedSequence === sequenceKey && finishedSequence !== sequenceKey;
    const showSequence = sequenceSegments.length > 0 && (!scheduleFinal || sequenceInUse);
    const sequenceDuration = sequenceSegments.reduce((total, segment) => total + (segment.editing ? segment.editing.trimEndMs - segment.editing.trimStartMs : segment.durationSeconds * 1000), 0) / 1000;
    const musicPending = needsDefaultMusic && !sequenceMusic;
    const demoAudioPending = hasDemo && draft.audioId && !audioQuery.data?.url && !audio.asset?.url;
    const customMusicPending = draft.backgroundMusic && draft.backgroundAudioId && !customMusicUrl && !referenceMusic;
    const sequenceDisabledReason = openingPreview?.disabledReason ?? validation ?? (videoId && !openingPreview ? "Loading hook settings…" : hasDemo && !preview ? "Loading your demo…"
      : demoAudioPending ? audioQuery.isError ? "Demo audio could not load. Return to Edit and choose another track." : !enabled || !owner ? "Sign in to preview your selected demo audio." : "Loading demo audio…"
      : customMusicPending ? backgroundQuery.isError ? "Background music could not load. Return to Edit and choose another track." : !enabled || !owner ? "Sign in to preview your selected background music." : "Loading background music…"
      : musicPending ? !enabled || !owner ? "Background music needs a signed-in session. Return to Edit and turn it off to preview original sound." : defaultMusicQuery.isError ? "Background music could not load. Return to Edit and choose another track." : "Loading background music…" : null);
    const preparationError = hasOpening ? openingPreparation?.error : null;
    const finalInfo = scheduleFinal && finalMediaInfo?.id === scheduleFinal.id ? finalMediaInfo : null;
    const displayedDuration = showSequence ? sequenceDuration : finalInfo?.duration;
    const finalDuration = displayedDuration && displayedDuration > 0 ? `${Math.floor(displayedDuration / 60)}:${String(Math.floor(displayedDuration % 60)).padStart(2, "0")}` : null;
    const finalStatus = finalInfo?.error && !showSequence ? "Preview unavailable" : scheduleFinal ? localPreview ? "Sample" : "Ready" : preparationError || selection.error || videoError || audioError || backgroundError || validation ? "Needs attention" : showSequence || localPreview ? "Preview" : !hasOpening && !hasDemo && !pendingSource ? "No video" : busy || openingPreparation?.busy ? "Preparing" : "Not ready";
    const schedulePreview = <section className={scheduleStyles.panel} aria-label="Schedule video preview">
      <header className={scheduleStyles.heading}><h2>Final video</h2><div className={scheduleStyles.status}><span data-ready={Boolean(scheduleFinal) && !finalInfo?.error}>{finalStatus}</span>{finalDuration ? <span className={scheduleStyles.duration}>{finalDuration}</span> : null}</div></header>
      <div data-schedule-final className={scheduleStyles.media}>
        {showSequence ? <WorkflowSequencePreview showDescription={false} segments={sequenceSegments} backgroundAudio={sequenceMusic} active={scheduleActive} className={scheduleStyles.sequence} playbackDisabledReason={sequenceDisabledReason} onPlaybackStart={() => setWatchedSequence(sequenceKey)} /> : scheduleFinal ? <video key={scheduleFinal.id} src={scheduleFinal.url} controls playsInline preload="auto" aria-label="Final video" className={scheduleStyles.video} onLoadedMetadata={event => { const media = event.currentTarget; setFinalMediaInfo({ id: scheduleFinal.id, duration: Number.isFinite(media.duration) ? media.duration : 0, width: media.videoWidth, height: media.videoHeight }); }} onError={() => setFinalMediaInfo({ id: scheduleFinal.id, duration: 0, width: 0, height: 0, error: true })} /> : <div className="flex max-w-sm flex-col items-center gap-3 px-4 py-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl border border-border bg-card-muted text-muted"><Video className="size-5" aria-hidden="true" /></span>
          <h3 className="text-sm font-medium">{preparationError ? "Your video couldn't be prepared" : localPreview ? "Final video preview" : !hasOpening && !hasDemo ? "No video to prepare yet" : "Preparing your final video"}</h3>
          <p className="text-xs leading-6 text-muted">{localPreview ? "Add clips to preview them here. Rendering is disabled in this local preview." : !hasOpening && !hasDemo ? "Add a hook or demo to get started." : "Loading your clips. The publishing file prepares separately."}</p>
        </div>}
      </div>
      <div className={scheduleStyles.caption}><p>{finalInfo?.error && !showSequence ? "The video preview could not load. Go back to Edit to check your clip." : showSequence ? `${sequenceSegments.map(segment => segment.label).join(" → ")} · preview. Your publishing file prepares separately.` : hasDemo && hasOpening ? `${format === "wall_text" ? "Wall of text" : "Hook"} + demo · one finished video` : "Review the finished video before scheduling."}{finalInfo && !showSequence && finalInfo.width > 0 && finalInfo.height > 0 ? ` · ${Math.min(finalInfo.width, finalInfo.height)}p` : ""}</p>{showSequence && scheduleFinal ? <Button type="button" variant="ghost" size="sm" onClick={() => setFinishedSequence(sequenceKey)}>View finished video</Button> : null}</div>
      <div ref={setScheduleProgressTarget} className={scheduleStyles.progress} />
      {localPreview && scheduleFinal ? <p className={scheduleStyles.notice}>Prepared sample · rendering and scheduling disabled.</p> : null}
      {!scheduleFinal && !activeSave && !backgroundScheduling ? <>
        <p role="status" className="text-sm leading-6 text-muted">{localPreview ? "Preview · rendering and scheduling disabled" : preparationError ?? (hasOpening && !opening ? openingPreparation?.message ?? "Preparing your hook video…" : selection.busy ? "Uploading your demo…" : validation ?? "Preparing your final video…")}</p>
        {problems}
        {enabled && (hasOpening || hasDemo) && (!hasOpening || !openingPreparation?.busy) ? <Button type="button" variant="outline" disabled={busy} onClick={onContinue}>{preparationError ? "Retry preparation" : "Prepare final video"}</Button> : null}
      </> : null}
    </section>;
    return <>{active && controlsTarget ? createPortal(controls, controlsTarget) : null}{active && resultsTarget ? createPortal(results, resultsTarget) : null}{actionsTarget ? createPortal(actions, actionsTarget) : null}{scheduleActive && scheduleResultsTarget ? createPortal(schedulePreview, scheduleResultsTarget) : null}{activeSave ? <DemoSaveRun key={JSON.stringify([activeSave.opening?.id ?? null, activeSave.openingRevision, activeSave.demo?.id ?? "opening-only", activeSave.draft])} save={activeSave} ownerId={owner} format={format} enabled={enabled} pendingSource={pendingSource} onBusy={reportSaveBusy} onSaved={saved} onContinue={onContinue} compact actionsTarget={scheduleProgressTarget} /> : null}{editActive && editControlsTarget ? createPortal(editingControls, editControlsTarget) : null}{(editActive || editPreviewActive) && editResultsTarget ? createPortal(editingPreview, editResultsTarget) : null}{editActive && editActionsTarget ? createPortal(editingActions, editActionsTarget) : null}<WorkflowVideoAssetPicker open={assetsOpen && (active || editActive || editPreviewActive)} onOpenChange={setAssetsOpen} ownerId={owner} selectedId={demo?.id} description="Choose a video from Creative Assets to use as your demo." previewAssets={previewAssets} onSelect={asset => { if (busy || !selection.selectAsset(asset))
        return false; setVideoError(null); prepareSelection(); selection.setMode("assets"); return true; }}/></>;
}
/** An explicit Save freezes the inputs. Each stage has its own durable receipt;
 * reloading/retrying reuses it, and a failed preparation cannot start the join. */
export function DemoSaveRun({ save, ownerId, format, enabled, onBusy, onSaved, onContinue, pendingSource = false, actionsTarget, compact = false }: {
    save: DemoSave;
    ownerId: string | null;
    format: "hook" | "wall_text";
    enabled: boolean;
    pendingSource?: boolean;
    onBusy: (busy: boolean) => void;
    onSaved: (output: VideoOutput) => void;
    onContinue: () => void;
    actionsTarget?: HTMLElement | null;
    compact?: boolean;
}) {
    const requiresDemo = save.demo !== null;
    const demoScope = save.demo?.id ?? "opening-only";
    const openingScope = save.opening?.id ?? "demo-only";
    const needsPreparation = requiresDemo && !canReuseUnchangedHookSource(save.demo, save.draft.editing, null);
    const prep = useWorkflowFinishing({ ownerId, enabled: enabled && needsPreparation, fastStatus: true, kind: "hook", source: save.demo, demo: null, demoAudio: null, playback: "once", options: DEFAULT_FINISHING_OPTIONS, editing: { ...save.draft.editing, musicVolume: .2 }, scope: `format-demo-prep:${format}:${openingScope}:${demoScope}` });
    const editedDemo = needsPreparation ? prep.output : save.demo;
    // At the standard volume the existing join contract can mix the owned
    // track directly. Custom-volume and demo-only requests keep their saved
    // sound stage so the selected gain and audio timing remain exact.
    const joinDemoAudio = requiresDemo && !!save.opening && !!save.audio && save.draft.editing.musicVolume === .2;
    // Start added audio at the trimmed demo's beginning, not at its raw
    // source timestamp. This optional pass never touches the opening audio.
    const sound = useWorkflowFinishing({ ownerId, enabled: enabled && requiresDemo && !!save.audio && !joinDemoAudio, fastStatus: true, kind: "hook", source: editedDemo, demo: null, demoAudio: null, playback: "once", options: DEFAULT_FINISHING_OPTIONS, editing: { ...save.draft.editing, text: null, textOverlays: undefined, trimStartMs: 0, trimEndMs: save.draft.editing.trimEndMs - save.draft.editing.trimStartMs, originalVolume: 1 }, backgroundSource: save.audio, backgroundPlayback: save.draft.playback, scope: `format-demo-sound:${format}:${openingScope}:${demoScope}`, demoFramingError: !editedDemo ? "Preparing your demo…" : null });
    const prepared = save.audio && !joinDemoAudio ? sound.output : editedDemo;
    const framing = trimmedDemoFraming(save.draft.framing, save.draft.editing);
    // Apply default music once, after clip edits, across the saved sequence.
    const reusableSource = save.opening && !requiresDemo ? save.opening : !save.opening ? prepared : null;
    const join = useWorkflowFinishing({ ownerId, enabled, fastStatus: true, kind: "hook", source: save.opening ?? prepared, demo: null, demoSource: save.opening && requiresDemo ? prepared : null, demoAudio: null, demoAudioSource: joinDemoAudio ? save.audio : null, playback: joinDemoAudio ? save.draft.playback : "once", options: { ...DEFAULT_FINISHING_OPTIONS, backgroundMusic: save.draft.backgroundMusic === true }, backgroundSource: save.background, backgroundPlayback: save.draft.backgroundPlayback ?? "repeat", demoFraming: save.opening && requiresDemo ? framing : null, sourceFraming: !save.opening ? framing : null, reuseUnchangedSource: !!reusableSource && !framing && canReuseUnchangedHookSource(reusableSource, defaultDemoEdit(reusableSource.durationSeconds ?? 0), null), scope: `format-demo:${format}:${openingScope}`, demoFramingError: requiresDemo && !prepared ? "Preparing the demo before joining…" : null });
    const attempted = useRef({ prep: false, sound: false, join: false });
    const current = !requiresDemo || prepared ? join : editedDemo && save.audio && !joinDemoAudio ? sound : prep;
    const action = current.action;
    const error = action.error;
    useEffect(() => { if (needsPreparation && !pendingSource && !prep.output && !prep.action.disabled && !attempted.current.prep) {
        attempted.current.prep = true;
        prep.action.onAction();
    } }, [needsPreparation, pendingSource, prep.output, prep.action]);
    useEffect(() => { if (requiresDemo && !joinDemoAudio && !pendingSource && save.audio && editedDemo && !sound.output && !sound.action.disabled && !attempted.current.sound) {
        attempted.current.sound = true;
        sound.action.onAction();
    } }, [requiresDemo, joinDemoAudio, pendingSource, save.audio, editedDemo, sound.output, sound.action]);
    useEffect(() => { if (!pendingSource && (!requiresDemo || prepared) && !join.output && !join.action.disabled && !attempted.current.join) {
        attempted.current.join = true;
        join.action.onAction();
    } }, [requiresDemo, pendingSource, prepared, join.output, join.action]);
    useEffect(() => { onBusy(!join.output && !error && !["failed", "cancelled"].includes(current.status?.outcome ?? "")); }, [join.output, error, current.status, onBusy]);
    useEffect(() => { if (join.output)
        onSaved({ id: join.output.id, kind: "media_asset", url: join.output.url, title: join.output.title }); }, [join.output, onSaved]);
    const actions = join.output ? <><Button type="button" disabled={pendingSource} className="h-11 rounded-xl px-5 font-semibold shadow-sm hover:shadow transition-shadow" onClick={onContinue}>Schedule video</Button><p role="status" className="text-xs text-muted">{save.opening && requiresDemo ? "Your opening and demo are saved as one video." : "Your final video is ready."}</p></> : <><Button type="button" className="h-11 rounded-xl px-5 font-medium" disabled={pendingSource || !error && action.disabled} onClick={() => { if (!pendingSource) action.onAction(); }}>{error || ["failed", "cancelled"].includes(current.status?.outcome ?? "") ? "Retry final video" : !requiresDemo || prepared ? "Saving your video…" : "Preparing your demo…"}</Button><p role="status" className="text-xs leading-5 text-muted">{action.message}</p>{error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}<Button type="button" variant="ghost" size="sm" onClick={action.refresh} disabled={action.busy}>Refresh save status</Button>{action.cancel ? <Button type="button" variant="ghost" size="sm" onClick={action.cancel}>Cancel save</Button> : null}</>;
    const scheduleActions = join.output ? <p role="status" className="text-xs text-muted">Publishing file ready.</p> : <div className="space-y-1">
      <p role="status" className="text-xs leading-5 text-muted">{error ? "Your publishing file couldn't be prepared." : action.message}</p>
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
      <div className="flex flex-wrap justify-center gap-1">
        {error || ["failed", "cancelled"].includes(current.status?.outcome ?? "") ? <Button type="button" variant="outline" size="sm" disabled={pendingSource} onClick={() => { if (!pendingSource) action.onAction(); }}>Retry final video</Button> : null}
        <Button type="button" variant="ghost" size="sm" onClick={action.refresh} disabled={action.busy}>Refresh status</Button>
        {action.cancel ? <Button type="button" variant="ghost" size="sm" onClick={action.cancel}>Cancel save</Button> : null}
      </div>
    </div>;
    const content = compact ? scheduleActions : actions;
    return actionsTarget ? createPortal(content, actionsTarget) : actionsTarget === undefined ? content : null;
}
