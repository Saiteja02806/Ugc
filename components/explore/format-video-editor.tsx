"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ClipPreviewControls } from "./clip-preview-controls";
import { ClipTrimTimeline } from "./clip-trim-timeline";
import { FormatVideoTextFields, trimFormatVideoEdit } from "@/components/explore/format-video-text-fields";
import { RemixTextSection } from "@/components/explore/remix-text-section";
import { FormatVideoTextOverlay } from "@/components/explore/format-video-text-overlay";
import { applyVideoTextRemix } from "@/lib/explore/remix-text-edit";
import { repairHookRemixEdit } from "@/lib/explore/hook-remix-source";
import { clipPreviewTextTimeMs } from "@/lib/explore/clip-preview-time";
import { readRemixSource, resolveRemixSource } from "@/lib/explore/remix-source";
import type { ReferenceText } from "@/lib/explore/reference-text";
import type { RecreateReference } from "@/lib/explore/recreate-types";
import { Button } from "@/components/ui/button";
import { WorkflowFilePicker } from "@/components/explore/hook-workflow-media-controls";
import { WorkflowBackgroundAudioPicker } from "@/components/explore/workflow-background-audio-picker";
import { useLocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";
import { DEFAULT_FINISHING_OPTIONS, useWorkflowFinishing } from "@/components/explore/use-workflow-finishing";
import { useAuth } from "@/contexts/auth-context";
import { fetchAIStudioMediaAsset } from "@/lib/ai-studio/media-client";
import { formatVideoFromAsset, type FormatVideoSource } from "@/lib/explore/format-video-source";
import { uploadAIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import type { ExploreFinishDraft } from "@/worker/src/lib/explore-finishing-contract";
import { formatTextEmojiError, formatTextLayout, formatTextOverlays, parseExploreFormatEdit, type ExploreFormatEdit } from "@/worker/src/lib/explore-format-edit";
import { prepareFormatEditForExport, readFormatEditDraft } from "@/lib/explore/format-edit-draft";
import { fullDurationWallText } from "@/lib/explore/wall-text-editor";
import { fullDurationSingleHookText } from "@/lib/explore/hook-text-timing";
import { canReuseUnchangedHookSource } from "@/lib/explore/unchanged-hook-source";
import { isExploreUuid } from "@/worker/src/lib/explore-finishing-contract";
import styles from "@/components/explore/format-workspace.module.css";
import editorStyles from "@/components/explore/format-video-editor.module.css";
import type { CSSProperties, ReactNode } from "react";
import type { MediaAsset } from "@/lib/media/types";
import { getReferenceAudioPreview } from "@/lib/explore/reference-audio-preview";
import { useClipDraftSave } from "@/components/explore/use-clip-draft-save";
import { withReadDeadline } from "@/lib/http/read-deadline";
import type { ExploreClipDraft, ExploreClipDraftContent } from "@/lib/explore/clip-draft-contract";
import { formatPreviewAudioPosition, type SequencePreviewAudio, type SequencePreviewSegment } from "@/lib/explore/sequence-preview";

const field = "w-full rounded-lg border border-border bg-card-muted px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-focus";
const defaultEdit = (format: "hook" | "wall_text", duration: number): ExploreFormatEdit => ({ version: 1, format, trimStartMs: 0, trimEndMs: Math.round(duration * 1000), originalVolume: 1, musicVolume: .2, text: null });
function normalizeTextTiming(edit: ExploreFormatEdit, fullDurationHookText: boolean) {
  const next = fullDurationWallText(edit);
  return fullDurationHookText ? fullDurationSingleHookText(next) : next;
}
export type FormatPreparationStatus = { busy: boolean; error: string | null; message: string };
export type WorkflowClipEditState = { sourceId: string; editing: ExploreFormatEdit; output: MediaAsset | null; busy: boolean; error: string | null; needsSaving: boolean;
  backgroundAssetId?: string | null; backgroundPlayback?: "once" | "repeat"; savedDraft?: ExploreClipDraft | null; needsDraftSaving?: boolean;
  draftBusy?: boolean; draftError?: string | null; retryLoad?: () => void };

export type FormatOpeningPreview = { segment: SequencePreviewSegment; referenceAudio: SequencePreviewAudio | null; disabledReason?: string | null; warning?: string | null };
export function FormatVideoEditor({ format, video, active, controlsTarget, resultsTarget, actionsTarget, originalSoundTarget, enabled, onDirty, onSaved, onContinue, pendingSource = false, editingActive = true, onEdit, previewActions, prepareRequest = 0, onPreparationChange, onBackToPreview, draftScope, videoLabel, continueLabel = "Continue to Demo", onClipStateChange, onPreviewChange, remixReference, remixReferences, previewText, localPreview = false, allowRemix = true, showSoundControls = true, prepareInSequence = false, backLabel = format === "wall_text" ? "Back to Create" : "Back to videos", remixScopeLabel, fullDurationHookText = false }: {
  format: "hook" | "wall_text"; video: FormatVideoSource; active: boolean; controlsTarget: HTMLElement | null; resultsTarget: HTMLElement | null; enabled: boolean;
  pendingSource?: boolean;
  onDirty: () => void; onSaved: (output: { id: string; kind: "media_asset"; url: string; title: string }) => void; onContinue: () => void;
  actionsTarget?: HTMLElement | null;
  /** Reuse this clip's exact draft for the Demo sidebar volume control. */
  originalSoundTarget?: HTMLElement | null;
  editingActive?: boolean; onEdit?: () => void;
  previewActions?: ReactNode;
  prepareRequest?: number; onPreparationChange?: (status: FormatPreparationStatus) => void; onBackToPreview?: () => void;
  onPreviewChange?: (preview: FormatOpeningPreview) => void;
  draftScope?: string; videoLabel?: string; continueLabel?: string; onClipStateChange?: (state: WorkflowClipEditState) => void;
  remixReference?: RecreateReference | null; remixReferences?: readonly RecreateReference[]; previewText?: ReferenceText | null; localPreview?: boolean;
  allowRemix?: boolean; showSoundControls?: boolean;
  prepareInSequence?: boolean; backLabel?: string; remixScopeLabel?: string;
  /** Only the Hook Video workflow opening opts in; never infer from format. */
  fullDurationHookText?: boolean;
}) {
  const { user } = useAuth();
  const saveStatusId = useId();
  const owner = user?.uid ?? null;
  const draftKey = `ugc-explore:format-draft:v1:${owner}:${draftScope ?? format}:${video.mediaAssetId ?? video.id}`;
  const [initialDraft] = useState(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(draftKey) : null;
      if (raw && raw.length < 65536) {
        const value = JSON.parse(raw);
        const editing = normalizeTextTiming(readFormatEditDraft(value.editing ?? value), fullDurationHookText);
        if (editing.format === format) return { editing, backgroundId: isExploreUuid(value.backgroundId) ? value.backgroundId as string : null, playback: value.playback === "repeat" ? "repeat" as const : "once" as const, restored: true };
      }
    } catch { /* An invalid local draft cannot replace the server receipt. */ }
    return { editing: defaultEdit(format, video.durationSeconds ?? 5), backgroundId: null, playback: "once" as "once" | "repeat", restored: false };
  });
  const [storedEditing, setEditing] = useState(initialDraft.editing);
  const [wallView, setWallView] = useState({ active, advanced: false });
  // Reset only view state on navigation; keep the clip draft and player mounted.
  if (wallView.active !== active) setWallView({ active, advanced: false });
  const wallAdvanced = wallView.active === active && wallView.advanced;
  const setWallAdvanced = (advanced: boolean) => setWallView({ active, advanced });
  const simpleWall = format === "wall_text" && !wallAdvanced;
  const wallToolsId = `wall-video-tools-${video.mediaAssetId ?? video.id}`;
  const wallModeButton = useRef<HTMLButtonElement | null>(null);
  const wallModeMounted = useRef(false);
  useEffect(() => {
    if (!wallModeMounted.current) { wallModeMounted.current = true; return; }
    wallModeButton.current?.focus();
  }, [wallAdvanced]);
  const localDraftExists = useRef(initialDraft.restored);
  const [duration, setDuration] = useState(video.durationSeconds ?? 5);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [time, setTime] = useState(0);
  const [textStyleTarget, setTextStyleTarget] = useState<HTMLDivElement | null>(null);
  const [backgroundId, setBackgroundId] = useState<string | null>(initialDraft.backgroundId);
  const [playback, setPlayback] = useState<"once" | "repeat">(initialDraft.playback);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [remixError, setRemixError] = useState<string | null>(null);
  const localAudio = useLocalWorkflowMedia("audio");
  const audioSelectionError = localAudio.loading ? "Wait for your selected audio to finish loading." : localAudio.error;
  const player = useRef<HTMLVideoElement | null>(null);
  const soundtrack = useRef<HTMLAudioElement | null>(null);
  const playingSoundtrack = useRef<HTMLAudioElement | null>(null);
  const soundtrackFrame = useRef<number | null>(null);
  const synchronizeSoundRef = useRef<() => void>(() => {});
  const alive = useRef(true);
  function stopSoundtrackPlayback() {
    if (soundtrackFrame.current !== null) cancelAnimationFrame(soundtrackFrame.current);
    soundtrackFrame.current = null;
    soundtrack.current?.pause();
    if (playingSoundtrack.current !== soundtrack.current) playingSoundtrack.current?.pause();
  }
  function startSoundtrackPlayback() {
    if (!soundtrack.current) return;
    if (soundtrackFrame.current !== null) cancelAnimationFrame(soundtrackFrame.current);
    const tick = () => {
      if (!alive.current || !soundtrack.current || !player.current || player.current.paused) { soundtrackFrame.current = null; return; }
      synchronizeSoundRef.current();
      soundtrackFrame.current = requestAnimationFrame(tick);
    };
    tick();
  }
  useEffect(() => { alive.current = true; return () => { alive.current = false; stopSoundtrackPlayback(); }; }, []);
  const sourceQuery = useQuery({ queryKey: ["explore-edit-source", owner, video.mediaAssetId, "remix-source"], staleTime: 30_000, enabled: Boolean(owner && video.mediaAssetId && !localPreview), queryFn: ({ signal }) => withReadDeadline(async bounded => {
    const token = await getCurrentUserIdToken(owner ?? undefined); bounded.throwIfAborted();
    if (!token || !video.mediaAssetId) throw new Error("Sign in to edit this saved video.");
    const asset = await fetchAIStudioMediaAsset(video.mediaAssetId, token, { remixSource: true, signal: bounded });
    formatVideoFromAsset(asset);
    return asset;
  }, signal) });
  const remixSource = sourceQuery.data && Object.hasOwn(sourceQuery.data.metadata ?? {}, "remixTextSource") ? readRemixSource(sourceQuery.data.metadata.remixTextSource) : video.remixTextSource;
  const boundReference = remixSource === undefined ? remixReference : resolveRemixSource(remixSource, remixReferences ?? (remixReference ? [remixReference] : []), format).reference;
  const editing = normalizeTextTiming(repairHookRemixEdit(storedEditing, boundReference?.id), fullDurationHookText);
  const backgroundQuery = useQuery({ queryKey: ["explore-edit-audio", owner, backgroundId], enabled: Boolean(owner && backgroundId), queryFn: ({ signal }) => withReadDeadline(async bounded => {
    const token = await getCurrentUserIdToken(owner ?? undefined); bounded.throwIfAborted();
    if (!token || !backgroundId) throw new Error("Sign in to load this audio.");
    const asset = await fetchAIStudioMediaAsset(backgroundId, token, { signal: bounded });
    if (asset.status !== "ready" || asset.collection !== "audio") throw new Error("Choose ready background audio.");
    return asset;
  }, signal) });
  const referenceAudio = getReferenceAudioPreview(sourceQuery.data);
  const [referenceAudioVolumeInitialized, setReferenceAudioVolumeInitialized] = useState(initialDraft.restored);
  useEffect(() => {
    if (!referenceAudio || localDraftExists.current || referenceAudioVolumeInitialized) return;
    setReferenceAudioVolumeInitialized(true);
    setEditing(current => ({ ...current, musicVolume: referenceAudio.volume }));
  }, [referenceAudio, referenceAudioVolumeInitialized]);
  const width = sourceQuery.data?.width ?? naturalSize?.width ?? video.width ?? 1080;
  const height = sourceQuery.data?.height ?? naturalSize?.height ?? video.height ?? (video.ratio === "16:9" ? 608 : video.ratio === "1:1" ? 1080 : video.ratio === "4:5" ? 1350 : 1920);
  const exportEditing = prepareFormatEditForExport(referenceAudio && !referenceAudioVolumeInitialized ? { ...editing, musicVolume: referenceAudio.volume } : editing);
  const overlays = formatTextOverlays(exportEditing);
  const textLayouts = overlays.map(text => formatTextLayout(text, width, height));
  let draftValidation: string | null = null;
  try { readFormatEditDraft(editing); } catch (error) { draftValidation = error instanceof Error ? error.message : "Review your edits."; }
  if (editing.trimEndMs > duration * 1000 + 50) draftValidation = "Keep the trim range inside this video.";
  const previewValidation = draftValidation;
  let validation: string | null = null;
  try { parseExploreFormatEdit(exportEditing); } catch (error) { validation = error instanceof Error ? error.message : "Review your edits."; }
  if (editing.trimEndMs > duration * 1000 + 50) validation = "Keep the trim range inside this video.";
  if (textLayouts.some(layout => !layout.fits)) validation = "Your text does not fit. Reduce its size or move it higher.";
  validation ??= overlays.map(text => formatTextEmojiError(text.value)).find(Boolean) ?? null;
  if (format === "wall_text" && !overlays.some(text => text.value.trim())) validation = "Add your wall of text before saving.";
  const restore = useCallback((draft: ExploreFinishDraft) => {
    if (localDraftExists.current || !draft.editing || draft.editing.format !== format || draft.sourceAssetId !== video.mediaAssetId) return;
    setReferenceAudioVolumeInitialized(true);
    setEditing(normalizeTextTiming(draft.editing, fullDurationHookText)); setBackgroundId(draft.backgroundAssetId); setPlayback(draft.backgroundPlayback);
  }, [format, video.mediaAssetId, fullDurationHookText]);
  const restoreSavedDraft = useCallback((draft: ExploreClipDraftContent, explicit: boolean) => {
    if (!explicit && localDraftExists.current || draft.editing.format !== format || draft.sourceAssetId !== video.mediaAssetId) return;
    localDraftExists.current = true; setReferenceAudioVolumeInitialized(true);
    const restoredEditing = normalizeTextTiming(draft.editing, fullDurationHookText);
    setEditing(restoredEditing); setBackgroundId(draft.backgroundAssetId); setPlayback(draft.backgroundPlayback);
    if (explicit) {
      onDirty();
      try { localStorage.setItem(draftKey, JSON.stringify({ version: 1, editing: restoredEditing, backgroundId: draft.backgroundAssetId, playback: draft.backgroundPlayback })); } catch { /* The server copy remains authoritative. */ }
    }
  }, [format, video.mediaAssetId, draftKey, onDirty, fullDurationHookText]);
  const clipDraftContent: ExploreClipDraftContent | null = video.mediaAssetId ? { version: 1, sourceAssetId: video.mediaAssetId, editing,
    backgroundAssetId: backgroundId, backgroundPlayback: backgroundId ? playback : "once" } : null;
  const latestClipContent = useRef(clipDraftContent);
  useEffect(() => { latestClipContent.current = clipDraftContent; });
  const draftSave = useClipDraftSave({ owner, sourceAssetId: video.mediaAssetId ?? null, scope: draftScope ?? format,
    content: clipDraftContent, enabled: enabled && !localPreview, onRestore: restoreSavedDraft });
  const [continueWithoutAutomaticText, setContinueWithoutAutomaticText] = useState(false);
  const automaticText = sourceQuery.data?.metadata?.automaticHookText as { status?: string } | undefined;
  const automaticTextNeedsReview = (format === "wall_text" || format === "hook" && (draftScope ?? format) === "hook") && automaticText?.status === "needs_review" &&
    !continueWithoutAutomaticText && !draftSave.saved && !overlays.some(text => text.value.trim());
  if (automaticTextNeedsReview) {
    if (format === "wall_text" && validation === "Add your wall of text before saving.") validation = "Your video is ready, but automatic text needs review. Add or remix your Wall text before saving.";
    else validation ??= "Your video is ready, but automatic text needs review. Add text or choose Continue without text.";
    draftValidation ??= validation;
  }
  const finishing = useWorkflowFinishing({ ownerId: owner, enabled, kind: "hook", source: sourceQuery.data ?? null, demo: null, demoAudio: null, playback: "once", options: DEFAULT_FINISHING_OPTIONS,
    editing: exportEditing, backgroundSource: backgroundQuery.data ?? null, backgroundPlayback: playback, scope: `${draftScope ?? `format:${format}`}:${video.mediaAssetId}`, onRestoreDraft: restore,
    reuseUnchangedSource: canReuseUnchangedHookSource(sourceQuery.data ?? null, exportEditing, backgroundId), fastStatus: prepareRequest > 0,
    demoFramingError: validation ?? remixError ?? audioSelectionError ?? uploadError ?? (uploading ? "Uploading background audio…" : backgroundId && !backgroundQuery.data ? "Loading your background audio…" : null),
  });
  const preparationBusy = pendingSource || localAudio.loading || finishing.action.busy || Boolean(finishing.action.cancel);
  const preparationError = validation ?? remixError ?? audioSelectionError ?? finishing.action.error ?? (sourceQuery.isError ? "Could not load this video. Return to the editor and retry." : null);
  const preparationMessage = finishing.action.message;
  const hasClipEdits = exportEditing.trimStartMs !== 0 || exportEditing.trimEndMs !== Math.round(duration * 1000) || exportEditing.originalVolume !== 1 || overlays.length > 0 || Boolean(backgroundId) || Boolean(referenceAudio && exportEditing.musicVolume !== referenceAudio.volume);
  const needsSaving = hasClipEdits && !finishing.output;
  // Raw final composition uses the saved edit JSON. A separate clip export's
  // pending receipt or failure must not lock that draft or the final sequence.
  const draftBusy = pendingSource || localAudio.loading || uploading || draftSave.busy;
  const draftError = validation ?? remixError ?? audioSelectionError ?? uploadError
    ?? (sourceQuery.isError ? "Could not load this video. Return to the editor and retry." : null)
    ?? (backgroundQuery.isError ? "Could not load your background audio. Choose it again." : backgroundId && !backgroundQuery.data ? "Loading your background audio…" : null)
    ?? (enabled && !localPreview ? draftSave.error ?? (!draftSave.loaded ? "Loading your saved clip edits…" : null) : null);
  useEffect(() => {
    onClipStateChange?.({ sourceId: video.mediaAssetId ?? video.id, editing: exportEditing, output: finishing.output, busy: preparationBusy || uploading || draftSave.busy,
      error: preparationError ?? uploadError ?? (enabled && !localPreview ? draftSave.error ?? (!draftSave.loaded ? "Loading your saved clip edits…" : null) : null), needsSaving,
      backgroundAssetId: backgroundId, backgroundPlayback: backgroundId ? playback : "once", savedDraft: draftSave.saved, needsDraftSaving: draftSave.dirty, draftBusy, draftError, retryLoad: !draftSave.loaded && draftSave.error ? draftSave.reload : undefined });
  }, [onClipStateChange, video.mediaAssetId, video.id, exportEditing, finishing.output, preparationBusy, uploading, preparationError, uploadError, needsSaving, backgroundId, playback, draftSave.busy, draftSave.saved, draftSave.dirty, enabled, localPreview, draftSave.error, draftSave.loaded, draftSave.reload, draftBusy, draftError]);
  useEffect(() => { onPreparationChange?.({ busy: preparationBusy, error: preparationError, message: preparationMessage }); }, [onPreparationChange, preparationBusy, preparationError, preparationMessage]);
  const handledPrepareRequest = useRef(0);
  useEffect(() => {
    if (!prepareRequest || handledPrepareRequest.current === prepareRequest || pendingSource || audioSelectionError || uploading || finishing.output || finishing.action.disabled || !sourceQuery.data) return;
    handledPrepareRequest.current = prepareRequest;
    finishing.action.onAction();
  }, [prepareRequest, pendingSource, audioSelectionError, uploading, finishing.output, finishing.action, sourceQuery.data]);
  useEffect(() => {
    if (finishing.output) onSaved({ id: finishing.output.id, kind: "media_asset", url: finishing.output.url, title: finishing.output.title });
  }, [finishing.output, onSaved]);
  useEffect(() => {
    if (!active) { player.current?.pause(); stopSoundtrackPlayback(); }
  }, [active]);

  function persistDraft(next: ExploreFormatEdit, audioId = backgroundId, mode = playback) {
    localDraftExists.current = true;
    try { localStorage.setItem(draftKey, JSON.stringify({ version: 1, editing: next, backgroundId: audioId, playback: mode })); } catch { /* No provider request is made by editing. */ }
  }
  function change(next: ExploreFormatEdit) {
    setRemixError(null);
    next = normalizeTextTiming(next, fullDurationHookText);
    setReferenceAudioVolumeInitialized(true);
    setEditing(next);
    if (JSON.stringify(prepareFormatEditForExport(next)) !== JSON.stringify(exportEditing)) onDirty();
    persistDraft(next);
  }
  function trim(startMs: number, endMs: number) {
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return;
    const end = Math.min(Math.round(duration * 1000), Math.max(1000, endMs));
    const start = Math.max(0, Math.min(startMs, end - 1000));
    const position = start !== editing.trimStartMs ? start : Math.max(start, end - 50);
    player.current?.pause(); stopSoundtrackPlayback();
    change(trimFormatVideoEdit(editing, start, end));
    setTime(position - start);
    if (player.current) player.current.currentTime = position / 1000;
  }
  function seekText(timeMs: number) {
    player.current?.pause(); stopSoundtrackPlayback();
    if (player.current) player.current.currentTime = (editing.trimStartMs + timeMs) / 1000;
    setTime(timeMs);
  }
  async function chooseAudio(file: File, mode: "once" | "repeat" = playback) {
    if (!owner || uploading || pendingSource || !enabled) return false;
    setUploading(true); setUploadError(null); onDirty();
    persistDraft(editing);
    try {
      if (!await localAudio.choose(file, { maxDuration: 600 })) return false;
      const result = await uploadAIStudioReferenceMedia(file, "audio", 120, owner, { maxAudioDurationSeconds: 600, purpose: "explore-demo" });
      if (!alive.current) return false;
      setBackgroundId(result.asset.id); setPlayback(mode); persistDraft(editing, result.asset.id, mode); return true;
    } catch (error) { if (alive.current) setUploadError(error instanceof Error ? error.message : "Could not upload audio."); return false; }
    finally { if (alive.current) setUploading(false); }
  }
  const attachment = { ...localAudio, choose: (file: File) => chooseAudio(file), chooseRemote: (...args: Parameters<typeof localAudio.chooseRemote>) => { onDirty(); return localAudio.chooseRemote(...args); }, loading: uploading || localAudio.loading, remove: () => { localAudio.remove(); setBackgroundId(null); setUploadError(null); persistDraft(editing, null); onDirty(); } };
  const background = backgroundQuery.data;
  const previewAudioUrl = referenceAudio?.audioUrl ?? background?.url ?? localAudio.asset?.url;
  const previewVideoUrl = referenceAudio?.cleanVideoUrl ?? sourceQuery.data?.url ?? video.url;
  const previewOriginalVolume = referenceAudio && !referenceAudio.cleanVideoUrl ? 0 : editing.originalVolume;
  const previewPlayback = referenceAudio ? "repeat" : playback;
  useEffect(() => {
    if (player.current) player.current.volume = previewOriginalVolume;
    if (soundtrack.current) soundtrack.current.volume = editing.musicVolume;
  }, [previewOriginalVolume, editing.musicVolume, previewPlayback, previewAudioUrl]);
  const sequencePreview = JSON.stringify({
    segment: { id: video.mediaAssetId ?? video.id, label: format === "wall_text" ? "Wall of text" : "Hook", url: previewVideoUrl,
      durationSeconds: duration, width, height, editing: { ...exportEditing, originalVolume: previewOriginalVolume },
      addedAudio: !referenceAudio && previewAudioUrl ? { url: previewAudioUrl, volume: editing.musicVolume, playback: previewPlayback,
        timelineOffsetMs: exportEditing.trimStartMs, mixDurationMs: duration * 1000 } : null },
    referenceAudio: referenceAudio ? { url: referenceAudio.audioUrl, volume: editing.musicVolume, playback: "repeat" } : null,
    warning: validation,
    disabledReason: previewValidation ?? (video.mediaAssetId && !localPreview && !sourceQuery.data ? sourceQuery.isError ? "The hook source could not load. Return to Edit to choose it again." : !owner ? "Sign in to preview this saved hook." : "Loading your hook settings…"
      : backgroundId && !previewAudioUrl ? backgroundQuery.isError ? "Hook audio could not load. Return to Edit and choose another track." : !owner ? "Sign in to preview your selected hook audio." : "Loading hook audio…" : null),
  } satisfies FormatOpeningPreview);
  useEffect(() => { onPreviewChange?.(JSON.parse(sequencePreview) as FormatOpeningPreview); }, [onPreviewChange, sequencePreview]);
  function synchronizeSound() {
    const audio = soundtrack.current, videoPlayer = player.current;
    if (!audio || !videoPlayer || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    if (playingSoundtrack.current !== audio) { playingSoundtrack.current?.pause(); playingSoundtrack.current = audio; }
    audio.muted = videoPlayer.muted;
    const length = audio.duration;
    const state = formatPreviewAudioPosition(length * 1000, duration * 1000, editing, videoPlayer.currentTime * 1000, previewPlayback, !!referenceAudio);
    audio.volume = editing.musicVolume * state.gain;
    if (!state.audible) { audio.pause(); return; }
    const expected = state.positionMs / 1000;
    if (Math.abs(audio.currentTime - expected) > .15) audio.currentTime = expected;
    if (!videoPlayer.paused && audio.paused) void audio.play().then(() => {
      if (!alive.current || player.current !== videoPlayer || videoPlayer.paused || soundtrack.current !== audio) audio.pause();
    }).catch(() => {});
  }
  useEffect(() => {
    synchronizeSoundRef.current = synchronizeSound;
    if (soundtrackFrame.current === null && soundtrack.current && player.current && !player.current.paused) startSoundtrackPlayback();
    else if (soundtrack.current && player.current) synchronizeSoundRef.current();
  });
  const previewTextTime = clipPreviewTextTimeMs(time, editing.trimEndMs - editing.trimStartMs);
  const referenceFirst = allowRemix && boundReference?.format === format && !boundReference.id.startsWith("uploaded:");
  const saveBlockedReason = localPreview ? "Saving is unavailable in this local preview." : !owner ? "Sign in to save your edits." : !enabled ? "Saving is unavailable for this editor."
    : pendingSource ? "Wait for your selected video to finish loading." : uploading ? "Wait for your audio upload to finish."
    : audioSelectionError ?? uploadError ?? remixError ?? draftValidation ?? (draftSave.busy ? "Saving your edits…" : null)
    ?? (!draftSave.loaded ? draftSave.error ?? "Loading your saved clip edits…" : null)
    ?? (!sourceQuery.data ? sourceQuery.isError ? "Could not load this saved video. Retry below." : "Loading your saved video…" : null)
    ?? (backgroundId && !backgroundQuery.data ? backgroundQuery.isError ? "Could not load your background audio. Choose it again." : "Loading your background audio…" : null);
  const saveDisabled = Boolean(saveBlockedReason);
  async function saveAndContinue() {
    if (saveDisabled) return;
    const snapshot = JSON.stringify(clipDraftContent);
    const saved = await draftSave.save();
    if (!alive.current || !saved || snapshot !== JSON.stringify(latestClipContent.current)) return;
    if (format === "wall_text") onContinue(); else (onBackToPreview ?? onContinue)();
  }
  const originalSound = <div className="space-y-2"><label className="block space-y-2 text-xs text-muted">Demo original sound · {Math.round(editing.originalVolume * 100)}%<input aria-label="Demo original volume" type="range" min={0} max={100} value={editing.originalVolume * 100} disabled={pendingSource || uploading || enabled && !draftSave.loaded} onChange={event => change({ ...editing, originalVolume: Number(event.target.value) / 100 })} className="w-full accent-primary" /></label>{enabled && draftSave.dirty ? <Button type="button" variant="outline" size="sm" disabled={Boolean(draftError) || !draftSave.loaded || !sourceQuery.data || draftSave.busy} onClick={() => void draftSave.save()}>Save demo edits</Button> : null}{draftError ? <p role="alert" className="text-xs text-destructive">{draftError}</p> : null}</div>;
  if (!active || !controlsTarget || !resultsTarget) return originalSoundTarget ? createPortal(originalSound, originalSoundTarget) : null;
  const actions = <div className={styles.clipActionContent}>
    {validation || remixError || finishing.action.error ? <p role="alert" className="text-xs leading-5 text-destructive">{validation ?? remixError ?? finishing.action.error}</p> : null}
    {automaticTextNeedsReview && format === "hook" ? <Button type="button" size="sm" variant="outline" disabled={!draftSave.loaded || draftSave.busy} onClick={() => { setContinueWithoutAutomaticText(true); void draftSave.save(); }}>Continue without text</Button> : null}
    <div className={editorStyles.actionBar}>
      {onBackToPreview ? <Button type="button" variant="ghost" onClick={onBackToPreview} disabled={draftSave.busy} className="h-11 rounded-xl px-4"><ArrowLeft className="size-4" aria-hidden="true" />{backLabel}</Button> : null}
      <Button type="button" variant="outline" disabled={saveDisabled} aria-describedby={saveBlockedReason || draftSave.error ? saveStatusId : undefined} onClick={() => void draftSave.save()} className={`${editorStyles.saveAction} h-11 min-w-28 rounded-xl px-5 font-semibold shadow-sm hover:shadow transition-shadow`}>{draftSave.busy ? "Saving…" : draftSave.saved && !draftSave.dirty ? "Edits saved" : "Save edits"}</Button>
      <Button type="button" disabled={saveDisabled} aria-describedby={saveBlockedReason || draftSave.error ? saveStatusId : undefined} onClick={() => void saveAndContinue()} className="h-11 rounded-xl px-5 font-semibold">{format === "wall_text" ? "Save & review post" : "Save & return"}</Button>
      {!prepareInSequence && ((draftSave.saved && !draftSave.dirty) || localPreview) ? <div className={editorStyles.nextAction}><Button type="button" variant="outline" disabled={pendingSource || draftSave.busy} onClick={onContinue} className="h-11 rounded-xl px-5 font-semibold">{continueLabel}</Button></div> : null}
    </div>
    {saveBlockedReason || draftSave.error ? <p id={saveStatusId} role="status" className="text-xs leading-5 text-muted">{saveBlockedReason ?? draftSave.error}</p> : null}
    {draftSave.error ? <Button type="button" variant="ghost" size="sm" onClick={draftSave.reload} disabled={draftSave.busy}>Reload saved draft</Button> : null}
    {!prepareInSequence && enabled && !finishing.output ? <Button type="button" size="sm" variant="outline" disabled={pendingSource || !!audioSelectionError || uploading || draftSave.busy || finishing.action.disabled || !sourceQuery.data} onClick={() => finishing.action.onAction()}>{finishing.action.busy || finishing.action.cancel ? "Preparing video…" : "Prepare final video"}</Button> : null}
    {finishing.action.busy || finishing.output ? <p role="status" className="text-xs leading-5 text-muted">{finishing.output ? "Publishing video ready in Library." : finishing.action.message}</p> : null}
    {sourceQuery.isError ? <p role="alert" className="text-xs text-destructive">Could not load this saved video. <button type="button" onClick={() => void sourceQuery.refetch()} className="rounded underline focus-visible:outline-2 focus-visible:outline-focus">Retry</button></p> : null}
    {finishing.action.cancel ? <Button type="button" variant="ghost" onClick={finishing.action.cancel}>Cancel preparation</Button> : null}
    {!prepareInSequence && enabled && !finishing.output ? <Button type="button" size="sm" variant="ghost" onClick={finishing.action.refresh} disabled={finishing.action.busy}>Refresh preparation status</Button> : null}
  </div>;
  const trimControls = <details key="trim" className={`${styles.demoOptions} ${editorStyles.trimSection}`} data-editor-section="trim" open><summary>Trim <span>{Math.max(0, editing.trimEndMs - editing.trimStartMs) / 1000}s selected</span></summary><section className={editorStyles.trimBody} aria-label="Trim">
      <div className={editorStyles.trimTimingFields}><label>Start <span>Seconds</span><input aria-label="Trim start" type="number" min={0} max={Math.max(0, editing.trimEndMs / 1000 - 1)} step={.1} value={editing.trimStartMs / 1000} onChange={event => trim(Math.round(Number(event.target.value) * 1000), editing.trimEndMs)} className={field} /></label><label>End <span>Seconds</span><input aria-label="Trim end" type="number" min={editing.trimStartMs / 1000 + 1} max={duration} step={.1} value={editing.trimEndMs / 1000} onChange={event => trim(editing.trimStartMs, Math.round(Number(event.target.value) * 1000))} className={field} /></label></div>
      <ClipTrimTimeline disabled={uploading || pendingSource} durationMs={Math.round(duration * 1000)} startMs={editing.trimStartMs} endMs={editing.trimEndMs} timeMs={editing.trimStartMs + time} onChange={trim} />
    </section></details>;
  const remixEditor = allowRemix ? <RemixTextSection expanded editorNavigation referenceFirst={referenceFirst} scopeLabel={remixScopeLabel ?? (format === "wall_text" ? "Applies to this video only." : undefined)} key={`${owner}:${video.id}`} owner={owner} targetKey={`video:${video.id}`} format={format} reference={boundReference} previewSource={previewText} disabled={uploading || pendingSource || sourceQuery.isFetching || finishing.action.busy} localPreview={localPreview} onUse={(output, source) => { try { const next = applyVideoTextRemix(editing, output, source, { width, height }); change(next); seekText(formatTextOverlays(next)[0]?.startMs ?? 0); return true; } catch (e) { setRemixError(e instanceof Error ? e.message : "Review the remixed text."); return false; } }} /> : null;
  const manualTextEditor = <FormatVideoTextFields fullDurationHookText={fullDurationHookText} styleTarget={textStyleTarget} showStyleControls={!simpleWall} editing={editing} onChange={change} timeMs={time} onSeek={seekText} />;
  const textControls = <div key="text" className={`${styles.clipTextControls} ${editorStyles.textControlSection}`}>{allowRemix ? <RemixTextSection expanded={referenceFirst} editorNavigation referenceFirst={referenceFirst} scopeLabel={remixScopeLabel ?? (format === "wall_text" ? "Applies to this video only." : undefined)} key={`${owner}:${video.id}`} owner={owner} targetKey={`video:${video.id}`} format={format} reference={boundReference} previewSource={previewText} disabled={uploading || pendingSource || sourceQuery.isFetching || finishing.action.busy} localPreview={localPreview} onUse={(output, source) => { try { const next = applyVideoTextRemix(editing, output, source, { width, height }); change(next); seekText(formatTextOverlays(next)[0]?.startMs ?? 0); return true; } catch (e) { setRemixError(e instanceof Error ? e.message : "Review the remixed text."); return false; } }}>{manualTextEditor}</RemixTextSection> : manualTextEditor}</div>;
  const manualTextControls = <div key="manual-text" className={`${styles.clipTextControls} ${editorStyles.textControlSection} ${editorStyles.manualTextSection}`}>{manualTextEditor}</div>;
  const remixControls = <div key="remix" className={`${styles.clipTextControls} ${editorStyles.remixControlSection}`}>{remixEditor}</div>;
  const controls = <div className={`${styles.clipControlContent} ${editorStyles.editorRoot}`} data-remix-priority={referenceFirst || undefined} data-wall-mode={format === "wall_text" ? simpleWall ? "text" : "advanced" : undefined}>
    {format === "wall_text" && previewActions ? <div className="flex flex-wrap items-center justify-end gap-2">{previewActions}</div> : null}
    <div data-clip-tools-heading={format === "wall_text" ? "wall" : "clip"} className={editorStyles.editorHeader}>{format === "wall_text" ? <h2 className="text-sm font-semibold">{simpleWall ? "Edit text" : "Edit video"}</h2> : videoLabel ? <h2 className="text-sm font-semibold">Edit {videoLabel.toLowerCase()}</h2> : <p className="truncate text-xs text-muted" title={video.title}>{video.title}</p>}{format === "wall_text" && wallAdvanced ? <Button ref={wallModeButton} type="button" size="sm" variant="ghost" aria-expanded={true} aria-controls={wallToolsId} onClick={() => setWallAdvanced(false)}><ArrowLeft className="size-4" aria-hidden="true" />Back to text</Button> : <span className="shrink-0 text-xs text-muted">{duration.toFixed(1)}s source</span>}</div>
    <fieldset id={format === "wall_text" ? wallToolsId : undefined} className={`${styles.clipControlsGrid} ${editorStyles.controlGrid}`} disabled={uploading || pendingSource}>
    {referenceFirst ? <>{remixControls}{!simpleWall ? trimControls : null}{manualTextControls}</> : !simpleWall ? trimControls : null}
    {referenceFirst ? null : textControls}
    {!simpleWall ? <div className={`${styles.clipUtilityControls} ${editorStyles.utilityControlSection}`}><div ref={setTextStyleTarget} className={editorStyles.styleDock} />{showSoundControls ? <details className={styles.demoOptions} open><summary>Sound <span>{previewAudioUrl ? "Audio added" : `${Math.round(editing.originalVolume * 100)}% original`}</span></summary><section className="mt-3 space-y-3" aria-label="Audio">
      {referenceAudio ? <><p className="text-xs leading-5 text-muted">Reference audio: {referenceAudio.title}. It plays across the complete video, including your demo, and repeats to fit.</p><label className="block space-y-2 text-xs text-muted">Music volume · {Math.round(editing.musicVolume * 100)}%<input aria-label="Reference music volume" type="range" min={0} max={100} value={editing.musicVolume * 100} onChange={event => change({ ...editing, musicVolume: Number(event.target.value) / 100 })} className="w-full accent-primary" /></label></> : null}
      {!referenceAudio || referenceAudio.cleanVideoUrl ? <label className="block space-y-2 text-xs text-muted">Original volume · {Math.round(editing.originalVolume * 100)}%<input aria-label="Original volume" type="range" min={0} max={100} value={editing.originalVolume * 100} onChange={event => change({ ...editing, originalVolume: Number(event.target.value) / 100 })} className="w-full accent-primary" /></label> : null}
      {!referenceAudio ? <>
      <div className="flex flex-wrap gap-2"><WorkflowFilePicker attachment={attachment} kind="audio" label="Upload background audio" buttonLabel="Upload audio" disabled={!enabled} /><WorkflowBackgroundAudioPicker ownerId={owner} attachment={attachment} onChoose={chooseAudio} disabled={!enabled || uploading || pendingSource} localPreview={localPreview} /></div>
      {previewAudioUrl ? <><p className="break-words text-xs text-muted">{background?.title ?? localAudio.asset?.name}</p><Button type="button" size="sm" variant="ghost" onClick={attachment.remove}>Remove audio</Button><label className="block space-y-2 text-xs text-muted">Music volume · {Math.round(editing.musicVolume * 100)}%<input aria-label="Music volume" type="range" min={0} max={100} value={editing.musicVolume * 100} onChange={event => change({ ...editing, musicVolume: Number(event.target.value) / 100 })} className="w-full accent-primary" /></label><label className="block space-y-2 text-xs text-muted">Playback<select aria-label="Music playback" value={playback} onChange={event => { const mode = event.target.value as "once" | "repeat"; setPlayback(mode); persistDraft(editing, backgroundId, mode); onDirty(); }} className={field}><option value="once">Play once</option><option value="repeat">Repeat to fit</option></select></label></> : null}
      </> : null}
    </section></details> : null}</div> : null}
    </fieldset>
    {simpleWall ? <div className={editorStyles.advancedEntry}><Button ref={wallModeButton} type="button" size="sm" variant="outline" aria-label="Edit video with advanced controls" aria-expanded={false} aria-controls={wallToolsId} onClick={() => setWallAdvanced(true)}>Edit</Button><span className="text-xs text-muted">Trim, text style and background audio</span></div> : null}
    {!actionsTarget ? actions : null}
  </div>;
  const clipLabel = videoLabel ?? (format === "wall_text" ? "Wall-of-text video" : "Hook video");
  const preview = <section className="flex flex-col items-center gap-4" aria-label="Video edit preview" style={{ "--clip-aspect": width / height } as CSSProperties}><div className={styles.clipPreviewHeading}><h3>{editingActive ? `${clipLabel} · Live preview` : videoLabel ? `${videoLabel} preview` : onEdit ? clipLabel : "Live preview"}</h3><span>{width * 16 === height * 9 ? "9:16" : width * 9 === height * 16 ? "16:9" : width === height ? "1:1" : width < height ? "Portrait" : "Landscape"}</span></div>
    <div data-clip-media data-clip-orientation={width < height ? "portrait" : width > height ? "landscape" : "square"} className="relative max-h-[65dvh] w-full max-w-[min(420px,55dvh)] overflow-hidden rounded-xl bg-black" style={{ aspectRatio: `${width}/${height}`, "--clip-aspect": width / height } as CSSProperties}>
      <video ref={player} src={previewVideoUrl} playsInline preload="metadata" className="size-full object-contain" onLoadedMetadata={event => {
        const d = event.currentTarget.duration;
        const { videoWidth, videoHeight } = event.currentTarget;
        if (videoWidth > 0 && videoHeight > 0) setNaturalSize({ width: videoWidth, height: videoHeight });
        if (Number.isFinite(d) && d >= 1) { setDuration(d); if (!localDraftExists.current && !video.durationSeconds && editing.trimEndMs === 5000) setEditing(current => normalizeTextTiming({ ...current, trimEndMs: Math.round(d * 1000) }, fullDurationHookText)); }
        event.currentTarget.volume = previewOriginalVolume;
        if (Number.isFinite(d) && d >= 1) event.currentTarget.currentTime = Math.min(editing.trimStartMs / 1000, d - .001);
        setTime(0);
      }} onPlay={event => { event.currentTarget.volume = previewOriginalVolume; if (event.currentTarget.currentTime < editing.trimStartMs / 1000 || event.currentTarget.currentTime >= (editing.trimEndMs - 50) / 1000) event.currentTarget.currentTime = editing.trimStartMs / 1000; startSoundtrackPlayback(); }} onPause={stopSoundtrackPlayback} onSeeked={synchronizeSound} onTimeUpdate={event => {
        event.currentTarget.volume = previewOriginalVolume;
        setTime(Math.max(0, Math.min(editing.trimEndMs - editing.trimStartMs, event.currentTarget.currentTime * 1000 - editing.trimStartMs)));
        if (!event.currentTarget.paused && event.currentTarget.currentTime * 1000 >= editing.trimEndMs) { event.currentTarget.pause(); event.currentTarget.currentTime = Math.max(editing.trimStartMs, editing.trimEndMs - 50) / 1000; }
        synchronizeSound();
      }} />
      {overlays.map((text, overlayIndex) => previewTextTime >= text.startMs && previewTextTime < text.endMs ? <FormatVideoTextOverlay key={overlayIndex} label={`Text overlay ${overlayIndex + 1} preview`} text={text} width={width} height={height}
        onMoveStart={() => { player.current?.pause(); stopSoundtrackPlayback(); }}
        onChange={editingActive && !pendingSource && !uploading && (!enabled || draftSave.loaded) ? next => change({ ...editing,
          ...(editing.textOverlays ? { textOverlays: editing.textOverlays.map(overlay => overlay === text ? next : overlay) } : { text: next }) }) : undefined} /> : null)}
    </div>
    <ClipPreviewControls player={player} onMute={muted => { if (player.current) player.current.muted = muted; if (soundtrack.current) soundtrack.current.muted = muted; }} timeMs={time} startMs={editing.trimStartMs} endMs={editing.trimEndMs} onSeek={seekText} />
    {editingActive ? <p className="text-xs text-muted" aria-label="Selected clip duration">{((editing.trimEndMs - editing.trimStartMs) / 1000).toFixed(1)}s selected · {overlays.length ? "Drag text to position it." : "Changes appear here as you edit."}</p> : null}
    {previewAudioUrl ? <audio ref={soundtrack} src={previewAudioUrl} loop={previewPlayback === "repeat"} preload="metadata" onLoadedMetadata={synchronizeSound} aria-label="Background audio preview" /> : null}
    {!editingActive && onEdit ? <><p className="max-w-full truncate text-xs text-muted" title={video.title}>{video.title}</p><div className={styles.clipCardActions}><Button type="button" variant="outline" data-edit-clip="opening" disabled={pendingSource || uploading} onClick={onEdit}>Edit {clipLabel.toLowerCase()}</Button>{previewActions}</div></> : null}
    {editingActive && finishing.output ? <div className="w-full max-w-sm space-y-2"><h3 className="text-sm font-medium">Saved video</h3><video src={finishing.output.url} controls playsInline className="max-h-80 w-full rounded-xl" /></div> : null}
  </section>;
  return <>{editingActive ? createPortal(controls, controlsTarget) : null}{createPortal(preview, resultsTarget)}{actionsTarget ? createPortal(actions, actionsTarget) : null}{originalSoundTarget ? createPortal(originalSound, originalSoundTarget) : null}</>;
}
