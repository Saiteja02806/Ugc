"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAIStudioMediaAsset } from "@/lib/ai-studio/media-client";
import { uploadAIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { FINISH_REQUEST_TIMEOUT_MS, finishStorageKey, finishRecoveryStorageKey, readFinishRecovery, canLeaveUncertainFinish, readSavedFinish, requestFinish, type FinishStatus, type SavedFinish } from "@/lib/explore/workflow-finishing-client";
import { loadWorkflowDefaultMusic } from "@/lib/explore/workflow-default-music-client";
import type { LocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";
import type { MediaAsset } from "@/lib/media/types";
import type { DemoFraming, ExploreClipComposition } from "@/worker/src/lib/explore-finishing-contract";
import type { ExploreFormatEdit } from "@/worker/src/lib/explore-format-edit";
import { getReferenceAudioPreview } from "@/lib/explore/reference-audio-preview";
import { withReadDeadline } from "@/lib/http/read-deadline";
import { pollInForeground } from "@/lib/http/foreground-polling";

export type FinishingOptions = import("@/lib/explore/workflow-session").WorkflowSessionOptions;
export const DEFAULT_FINISHING_OPTIONS: FinishingOptions = { subtitles: false, style: "clean", backgroundMusic: false, placement: "bottom" };
export type WorkflowAction = { busy: boolean; label?: string; processing?: boolean; disabled: boolean; message: string; error: string | null; onAction: () => void; refresh: () => void; cancel?: () => void; recoveryAvailable?: boolean };
export function useWorkflowFinishing({ ownerId, enabled, kind, source, demo, demoSource = null, demoAudio, demoAudioSource = null, playback, options, onRestoreOptions, demoFraming = null, sourceFraming = null, demoFramingError = null, editing, backgroundSource = null, backgroundPlayback: formatBackgroundPlayback = "once", scope, onRestoreDraft, reuseUnchangedSource = false, fastStatus = false, captionPreview = false, captionDraft = null, composition, demoAudioAssetId = null }: {
  ownerId: string | null; enabled: boolean; kind: "hook" | "phone"; source: MediaAsset | null;
  demo: LocalWorkflowMedia | null; demoAudio: LocalWorkflowMedia | null; playback: "once" | "repeat"; options: FinishingOptions;
  demoSource?: MediaAsset | null;
  /** Already-owned demo audio can be mixed in the final composition job. */
  demoAudioSource?: MediaAsset | null;
  onRestoreOptions?: (value: FinishingOptions) => void;
  demoFraming?: DemoFraming | null;
  sourceFraming?: DemoFraming | null;
  demoFramingError?: string | null;
  editing?: ExploreFormatEdit;
  backgroundSource?: MediaAsset | null;
  backgroundPlayback?: "once" | "repeat";
  scope?: string;
  onRestoreDraft?: (draft: SavedFinish["draft"]) => void;
  reuseUnchangedSource?: boolean;
  /** Foreground finishing can notice completion promptly; this only reads status. */
  fastStatus?: boolean;
  captionPreview?: boolean;
  /** Verified current caption selection, including the exact uploaded music. */
  captionDraft?: SavedFinish["draft"] | null;
  composition?: ExploreClipComposition;
  demoAudioAssetId?: string | null;
}) {
  const active = useRef(true), working = useRef(false);
  const saved = useRef<SavedFinish | null>(null);
  const uploaded = useRef(new WeakMap<File, string>());
  const [busy, setBusy] = useState(false), [restored, setRestored] = useState(false);
  const [status, setStatus] = useState<FinishStatus | null>(null), [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<MediaAsset | null>(null);
  const [savedEntry, setSavedEntry] = useState<SavedFinish | null>(null);
  const [recoveryEntries, setRecoveryEntries] = useState<SavedFinish[]>([]);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  // Inputs change without invalidating a completed request's server identity.
  const signature = JSON.stringify([source?.id, demo?.url, demoAudio?.url, playback, options, demoFraming, sourceFraming, demoFramingError, editing, backgroundSource?.id, formatBackgroundPlayback, demoSource?.id, demoAudioSource?.id, composition, demoAudioAssetId]);
  const storageKey = finishStorageKey(ownerId ?? "signed-out", kind) + (scope ? `:${encodeURIComponent(scope)}` : "");
  const [completedSignature, setCompletedSignature] = useState<string | null>(null);
  const musicSelection = options.backgroundAssetId === undefined ? undefined : options.backgroundMusic ? options.backgroundAssetId ?? "default" : "off";
  const savedMusicMatches = musicSelection === undefined || savedEntry?.musicSelection === musicSelection;
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const deps = useCallback(() => ({ token: () => getCurrentUserIdToken(ownerId ?? undefined), fetch: (...args: Parameters<typeof fetch>) => fetch(...args), assertActive() { if (!active.current) throw new Error("This account's workflow is no longer active."); } }), [ownerId]);
  const accept = useCallback(async (next: FinishStatus) => {
    if (!active.current) return;
    setStatus(next); setError(next.outcome === "uncertain" && next.terminal ? "This transcription is unconfirmed. Choose another video or turn off subtitles to continue. Refresh status to check this request; it will not be submitted again automatically." : null);
    if (next.outcome === "completed" && next.mediaAssetId && ownerId) {
      const token = await withReadDeadline(() => getCurrentUserIdToken(ownerId), undefined, FINISH_REQUEST_TIMEOUT_MS); if (!token) throw new Error("Sign in to view your finished video.");
      const asset = await fetchAIStudioMediaAsset(next.mediaAssetId, token, { signal: AbortSignal.timeout(FINISH_REQUEST_TIMEOUT_MS) });
      if (!active.current) return;
      if (asset.id !== next.mediaAssetId || asset.status !== "ready" || asset.collection !== "video") throw new Error("The finished output could not be verified.");
      setOutput(asset);
    }
  }, [ownerId]);
  const refresh = useCallback(async (quiet = false) => {
    if (!enabled || !ownerId || !saved.current || working.current || !active.current) return;
    working.current = true; if (!quiet) setBusy(true);
    try { await accept(await requestFinish(deps(), saved.current)); }
    catch (e) { if (active.current) setError(e instanceof Error ? e.message : "Could not recover your edit."); }
    finally { working.current = false; if (!quiet && active.current) setBusy(false); }
  }, [enabled, ownerId, accept, deps]);
  useEffect(() => {
    if (!enabled || !ownerId) return;
    let stopped = false;
    // Hydration is read-only. It must never dispatch a replacement paid request.
    void Promise.resolve().then(() => {
      if (stopped) return;
      try {
        saved.current = readSavedFinish(localStorage.getItem(storageKey), ownerId, kind);
        setRecoveryEntries(readFinishRecovery(localStorage.getItem(finishRecoveryStorageKey(storageKey)), ownerId, kind));
        if (saved.current) onRestoreOptions?.({ subtitles: !!saved.current.draft.subtitles, style: saved.current.draft.subtitles?.style ?? "clean", backgroundMusic: !!saved.current.draft.backgroundAssetId, placement: saved.current.draft.subtitles?.placement ?? "bottom", ...(saved.current.draft.subtitles?.corrections ? { corrections: saved.current.draft.subtitles.corrections } : {}) });
        if (saved.current) onRestoreDraft?.(saved.current.draft);
        setSavedEntry(saved.current); setRestored(true); void refresh(true);
      } catch (e) { setError(e instanceof Error ? e.message : "Could not verify the saved edit."); }
    });
    return () => { stopped = true; };
  }, [enabled, ownerId, kind, refresh, onRestoreOptions, onRestoreDraft, storageKey]);
  const loadingOutput = status?.outcome === "completed" && status.mediaAssetId !== output?.id;
  const needsRecovery = Boolean(savedEntry) && (!status || status.outcome === "pending" || status.outcome === "uncertain" && !status.terminal || status.outcome === "unconfirmed" || loadingOutput);
  useEffect(() => {
    if (!needsRecovery) return;
    // A completed receipt is not yet a usable preview if its owned-media GET
    // failed. Recover that same result without dispatching another render.
    return pollInForeground({ poll: () => refresh(true), intervalMs: fastStatus ? 1000 : 4000 });
  }, [needsRecovery, refresh, fastStatus]);
  useEffect(() => {
    if (!needsRecovery || typeof window === "undefined") return;
    const recover = () => { if (document.visibilityState !== "hidden" && navigator.onLine) void refresh(true); };
    window.addEventListener("focus", recover);
    return () => {
      window.removeEventListener("focus", recover);
    };
  }, [needsRecovery, refresh]);
  async function upload(asset: LocalWorkflowMedia | null, mediaKind: "video" | "audio") {
    if (!asset) return null;
    if (!asset.file || !ownerId) throw new Error(`Choose the ${mediaKind} file again before applying edits.`);
    const prior = uploaded.current.get(asset.file); if (prior) return prior;
    const result = await uploadAIStudioReferenceMedia(asset.file, mediaKind, 120, ownerId, { maxAudioDurationSeconds: 600, requireVideoReferenceRatio: false, purpose: "explore-demo" });
    deps().assertActive(); uploaded.current.set(asset.file, result.asset.id); return result.asset.id;
  }
  async function apply() {
    if (working.current || !enabled || !ownerId || !restored || !active.current || demoFramingError) return;
    working.current = true; setBusy(true); setError(null);
    try {
      if (!navigator.locks) throw new Error("Use a browser with Web Locks support to apply edits safely across tabs.");
      await navigator.locks.request(storageKey, { ifAvailable: true }, async (lock) => {
        if (!lock) throw new Error("Another tab is applying edits. Refresh status first.");
        const stored = readSavedFinish(localStorage.getItem(storageKey), ownerId, kind);
        if (stored && stored.requestKey !== saved.current?.requestKey) { saved.current = stored; setSavedEntry(stored); setCompletedSignature(null); setOutput(null); await accept(await requestFinish(deps(), stored)); return; }
        const leavingUncertainty = canLeaveUncertainFinish(status, saved.current, source?.id, options.subtitles);
        if (saved.current && status?.outcome === "uncertain" && status.terminal && !leavingUncertainty) {
          await accept(await requestFinish(deps(), saved.current)); return;
        }
        if (saved.current && !leavingUncertainty && !["completed", "captions_ready", "failed", "cancelled"].includes(status?.outcome ?? "")) {
          // Explicit resume only; reuses the exact durable draft and identity.
          await accept(await requestFinish(deps(), saved.current, true)); return;
        }
        if (captionPreview && currentTranscript) return;
        // Reopening the same saved result is not a request for another render.
        if (saved.current && status?.outcome === "completed" && (currentOutput || loadingOutput)) {
          await accept(await requestFinish(deps(), saved.current)); return;
        }
        if (!source) throw new Error("Upload or choose a video in Create before applying edits.");
        // Reuse only after checking durable recovery and the cross-tab lock.
        // Existing requests must finish recovering before this shortcut is used.
        if (demoAudioAssetId && (demoAudio || demoAudioSource)) throw new Error("Choose one demo audio track.");
        if (demoAudioSource && (demoAudio || demoAudioSource.status !== "ready" || demoAudioSource.collection !== "audio")) throw new Error("Choose one ready owned demo audio track.");
        if (leavingUncertainty && saved.current) {
          const recoveryKey = finishRecoveryStorageKey(storageKey);
          const history = readFinishRecovery(localStorage.getItem(recoveryKey), ownerId, kind);
          const next = history.some(entry => entry.requestKey === saved.current!.requestKey) ? history : [...history, saved.current];
          // Preserve the old exact identity before replacing any active draft.
          localStorage.setItem(recoveryKey, JSON.stringify(next)); setRecoveryEntries(next);
          setRecoveryMessage("An earlier transcription is preserved. Check saved requests to recover it.");
        }
        const settledRequest = leavingUncertainty || !saved.current || status && ["completed", "captions_ready", "failed", "cancelled"].includes(status.outcome);
        if (reuseUnchangedSource && settledRequest && source.status === "ready" && source.collection === "video" &&
            !demo && !demoSource && !demoAudio && !demoAudioSource && !demoAudioAssetId && !demoFraming && !sourceFraming && !backgroundSource && !options.backgroundMusic && !options.subtitles && !composition) {
          if (leavingUncertainty) { localStorage.removeItem(storageKey); saved.current = null; setSavedEntry(null); setStatus(null); }
          setOutput(source); setCompletedSignature(signature);
          return;
        }
        const total = (composition?.sourceEditing ? (composition.sourceEditing.trimEndMs - composition.sourceEditing.trimStartMs) / 1000 : source.durationSeconds ?? 0) + (composition?.demoEditing ? (composition.demoEditing.trimEndMs - composition.demoEditing.trimStartMs) / 1000 : demoSource?.durationSeconds ?? demo?.duration ?? 0);
        if (options.subtitles && (!(total > 0) || total > 60)) throw new Error("English auto subtitles support up to 60 seconds in total. Nothing is trimmed.");
        if (options.corrections?.length && !captionDraft) throw new Error("Generate captions for your current clips before applying word corrections.");
        let backgroundAssetId: string | null = null, backgroundPlayback: "once" | "repeat" = "once";
        if (options.backgroundMusic && !backgroundSource && !editing && !getReferenceAudioPreview(source)) {
          // Reuse the owned snapshot of a recovered edit instead of choosing
          // new music after reload or repeating an acknowledged upload.
          if (captionDraft?.backgroundAssetId) {
            backgroundAssetId = captionDraft.backgroundAssetId; backgroundPlayback = captionDraft.backgroundPlayback;
          } else if (savedMusicMatches && savedEntry?.draft.backgroundAssetId) {
            backgroundAssetId = savedEntry.draft.backgroundAssetId; backgroundPlayback = savedEntry.draft.backgroundPlayback;
          } else {
            const music = await loadWorkflowDefaultMusic(deps());
            const result = await uploadAIStudioReferenceMedia(music.file, "audio", 120, ownerId, { maxAudioDurationSeconds: 600, purpose: "explore-demo" });
            deps().assertActive(); backgroundAssetId = result.asset.id; backgroundPlayback = music.playback;
          }
        }
        const draft: SavedFinish["draft"] = { version: 1, kind, sourceAssetId: source.id, demoAssetId: demoSource?.id ?? captionDraft?.demoAssetId ?? await upload(demo, "video"), demoAudioAssetId: demoAudioAssetId ?? demoAudioSource?.id ?? captionDraft?.demoAudioAssetId ?? await upload(demoAudio, "audio"), demoAudioPlayback: demoAudio || demoAudioSource || demoAudioAssetId ? playback : "once", backgroundAssetId: backgroundSource?.id ?? (editing ? null : backgroundAssetId), backgroundPlayback: backgroundSource ? formatBackgroundPlayback : backgroundPlayback, subtitles: options.subtitles ? { language: "en", style: options.style, placement: options.placement ?? "bottom", version: 2, ...(options.corrections?.length ? { corrections: options.corrections } : {}) } : null,
          ...(captionPreview ? { captionPreview: true as const } : {}),
          ...(demoFraming ? { demoFraming } : {}), ...(sourceFraming ? { sourceFraming } : {}), ...(editing ? { editing } : {}), ...(composition ? { composition } : {}) };
        deps().assertActive();
        const entry: SavedFinish = { version: 1, ownerId, kind, requestKey: crypto.randomUUID(), draft, ...(musicSelection !== undefined ? { musicSelection } : {}) };
        // A storage failure must happen before dispatch, never after a paid request.
        localStorage.setItem(storageKey, JSON.stringify(entry)); saved.current = entry;
        setSavedEntry(entry); setStatus(null); setOutput(null); setCompletedSignature(signature);
        await accept(await requestFinish(deps(), entry, true));
      });
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : "Could not apply edits. Refresh the saved request."); }
    finally { working.current = false; if (active.current) setBusy(false); }
  }
  // A recovered output is a saved result, not a reconstruction from missing local
  // files. A different source or newly selected edit must be applied first.
  const recoveredDemoAudioMatches = demoAudioSource || demoAudioAssetId || scope?.startsWith("format-demo:")
    ? (demoAudioSource?.id ?? demoAudioAssetId ?? null) === savedEntry?.draft.demoAudioAssetId && (!(demoAudioSource || demoAudioAssetId) || playback === savedEntry?.draft.demoAudioPlayback)
    : true;
  const recoveredMatches = completedSignature === null && savedEntry && savedMusicMatches && JSON.stringify(composition) === JSON.stringify(savedEntry.draft.composition) && JSON.stringify(sourceFraming ?? undefined) === JSON.stringify(savedEntry.draft.sourceFraming) && (!source || source.id === savedEntry.draft.sourceAssetId) && !demo && !demoAudio && recoveredDemoAudioMatches && (demoSource ? demoSource.id === savedEntry.draft.demoAssetId : !savedEntry.draft.demoAssetId || !scope?.startsWith("format-demo:")) && (demoSource ? JSON.stringify(demoFraming ?? undefined) === JSON.stringify(savedEntry.draft.demoFraming) : !demoFraming) && (editing ? JSON.stringify(editing) === JSON.stringify(savedEntry.draft.editing) && (backgroundSource?.id ?? null) === savedEntry.draft.backgroundAssetId && (!backgroundSource || formatBackgroundPlayback === savedEntry.draft.backgroundPlayback) :
    (backgroundSource ? backgroundSource.id === savedEntry.draft.backgroundAssetId && formatBackgroundPlayback === savedEntry.draft.backgroundPlayback : !!options.backgroundMusic === !!savedEntry.draft.backgroundAssetId) &&
    options.subtitles === !!savedEntry.draft.subtitles && (!options.subtitles || (options.style === savedEntry.draft.subtitles?.style &&
      (options.placement ?? "bottom") === (savedEntry.draft.subtitles?.placement ?? "bottom") && JSON.stringify(options.corrections ?? []) === JSON.stringify(savedEntry.draft.subtitles?.corrections ?? []))));
  const currentOutput = output && !demoFramingError && (completedSignature === signature || recoveredMatches) ? output : null;
  // A recovered video can be offered while its local upload selection is still
  // restoring. Words must wait for the exact selected clips/audio: otherwise a
  // removed demo could silently return through the caption draft at export.
  const recoveredCaptionMatches = recoveredMatches && source?.id === savedEntry?.draft.sourceAssetId &&
    (demoSource?.id ?? null) === savedEntry?.draft.demoAssetId &&
    (demoAudioSource?.id ?? demoAudioAssetId ?? null) === savedEntry?.draft.demoAudioAssetId &&
    (!(demoAudioSource || demoAudioAssetId) || playback === savedEntry?.draft.demoAudioPlayback);
  const currentTranscript = status?.captionTranscript && !demoFramingError && (completedSignature === signature || recoveredCaptionMatches) ? status.captionTranscript : null;
  const independentEdit = canLeaveUncertainFinish(status, savedEntry, source?.id, options.subtitles);
  const pending = status?.outcome === "pending" || status?.outcome === "uncertain" && !independentEdit;
  const disabled = !enabled || !ownerId || !restored || busy || pending || loadingOutput || !!demoFramingError || (!source && !savedEntry);
  async function cancel() {
    if (working.current || !status?.jobId || !ownerId || !active.current) return;
    working.current = true; setBusy(true); setError(null);
    try {
      const token = await withReadDeadline(() => getCurrentUserIdToken(ownerId), undefined, FINISH_REQUEST_TIMEOUT_MS); deps().assertActive();
      if (!token) throw new Error("Sign in to cancel finishing.");
      const response = await fetch(`/api/jobs/${encodeURIComponent(status.jobId)}/cancel`, { method: "POST", signal: AbortSignal.timeout(FINISH_REQUEST_TIMEOUT_MS), headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Could not confirm cancellation. Refresh the saved request.");
      if (saved.current) await accept(await requestFinish(deps(), saved.current));
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : "Could not confirm cancellation."); }
    finally { working.current = false; if (active.current) setBusy(false); }
  }
  async function refreshAll() {
    await refresh();
    if (!ownerId || !active.current || working.current || !recoveryEntries.length) return;
    working.current = true; setBusy(true);
    try {
      const history = readFinishRecovery(localStorage.getItem(finishRecoveryStorageKey(storageKey)), ownerId, kind);
      const checked = await Promise.all(history.map(async entry => ({ entry, result: await requestFinish(deps(), entry) })));
      deps().assertActive();
      // Another tab may archive a new request while these status reads finish.
      // Merge under the same lock as apply rather than overwriting its history.
      if (!navigator.locks) throw new Error("Could not lock the saved recovery records.");
      await navigator.locks.request(storageKey, { ifAvailable: true }, async lock => {
        if (!lock) throw new Error("Another tab is updating the saved requests.");
        deps().assertActive();
        const resolved = new Set(checked.filter(({ result }) => ["completed", "cancelled"].includes(result.outcome)).map(({ entry }) => entry.requestKey));
        const unresolved = readFinishRecovery(localStorage.getItem(finishRecoveryStorageKey(storageKey)), ownerId, kind).filter(entry => !resolved.has(entry.requestKey));
        localStorage.setItem(finishRecoveryStorageKey(storageKey), JSON.stringify(unresolved)); setRecoveryEntries(unresolved);
      });
      setRecoveryMessage(checked.some(({ result }) => result.outcome === "completed") ? "An earlier finished video is saved in Creative Assets." : checked.some(({ result }) => result.outcome === "captions_ready") ? "Earlier captions are ready. Their original request is saved on the server." : "Earlier transcription status is still unconfirmed. No new transcription was submitted.");
    } catch { if (active.current) setRecoveryMessage("Could not check earlier requests. Their recovery records are preserved."); }
    finally { working.current = false; if (active.current) setBusy(false); }
  }
  const actionMessage = loadingOutput ? "Your video is saved. Loading your finished video…" : status?.message ?? (source ? "Apply edits to save your finished video." : "Choose a saved video before applying edits.");
  const action: WorkflowAction = { busy, processing: status?.outcome === "pending" || loadingOutput, disabled, message: recoveryMessage ? `${actionMessage} ${recoveryMessage}` : actionMessage, error: demoFramingError ?? error, onAction: () => { void apply(); }, refresh: () => { void refreshAll(); }, recoveryAvailable: recoveryEntries.length > 0,
    ...(pending && status?.jobId && !status.terminal ? { cancel: () => { void cancel(); } } : {}) };
  return { action, output: currentOutput, status, transcript: currentTranscript, captionDraft: currentTranscript && savedEntry?.draft.subtitles?.version === 2 ? savedEntry.draft : null };
}
