"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAIStudioMediaAsset } from "@/lib/ai-studio/media-client";
import { uploadAIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { FINISH_REQUEST_TIMEOUT_MS, finishStorageKey, readSavedFinish, requestFinish, type FinishStatus, type SavedFinish } from "@/lib/explore/workflow-finishing-client";
import { loadWorkflowDefaultMusic } from "@/lib/explore/workflow-default-music-client";
import type { LocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";
import type { MediaAsset } from "@/lib/media/types";
import type { DemoFraming, ExploreFinishStyle } from "@/worker/src/lib/explore-finishing-contract";
import type { ExploreFormatEdit } from "@/worker/src/lib/explore-format-edit";

export type FinishingOptions = { subtitles: boolean; style: ExploreFinishStyle; backgroundMusic: boolean; placement?: "bottom" | "middle" | "top" };
export const DEFAULT_FINISHING_OPTIONS: FinishingOptions = { subtitles: false, style: "clean", backgroundMusic: false, placement: "bottom" };
export type WorkflowAction = { busy: boolean; disabled: boolean; message: string; error: string | null; onAction: () => void; refresh: () => void; cancel?: () => void };
export function useWorkflowFinishing({ ownerId, enabled, kind, source, demo, demoSource = null, demoAudio, playback, options, onRestoreOptions, demoFraming = null, sourceFraming = null, demoFramingError = null, editing, backgroundSource = null, backgroundPlayback: formatBackgroundPlayback = "once", scope, onRestoreDraft, reuseUnchangedSource = false }: {
  ownerId: string | null; enabled: boolean; kind: "hook" | "phone"; source: MediaAsset | null;
  demo: LocalWorkflowMedia | null; demoAudio: LocalWorkflowMedia | null; playback: "once" | "repeat"; options: FinishingOptions;
  demoSource?: MediaAsset | null;
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
}) {
  const active = useRef(true), working = useRef(false);
  const saved = useRef<SavedFinish | null>(null);
  const uploaded = useRef(new Map<File, string>());
  const [busy, setBusy] = useState(false), [restored, setRestored] = useState(false);
  const [status, setStatus] = useState<FinishStatus | null>(null), [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<MediaAsset | null>(null);
  const [savedEntry, setSavedEntry] = useState<SavedFinish | null>(null);
  // Inputs change without invalidating a completed request's server identity.
  const signature = JSON.stringify([source?.id, demo?.url, demoAudio?.url, playback, options, demoFraming, sourceFraming, demoFramingError, editing, backgroundSource?.id, formatBackgroundPlayback, demoSource?.id]);
  const storageKey = finishStorageKey(ownerId ?? "signed-out", kind) + (scope ? `:${encodeURIComponent(scope)}` : "");
  const [completedSignature, setCompletedSignature] = useState<string | null>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const deps = useCallback(() => ({ token: () => getCurrentUserIdToken(ownerId ?? undefined), fetch: (...args: Parameters<typeof fetch>) => fetch(...args), assertActive() { if (!active.current) throw new Error("This account's workflow is no longer active."); } }), [ownerId]);
  const accept = useCallback(async (next: FinishStatus) => {
    if (!active.current) return;
    setStatus(next); setError(null);
    if (next.outcome === "completed" && next.mediaAssetId && ownerId) {
      const token = await getCurrentUserIdToken(ownerId); if (!token) throw new Error("Sign in to view your finished video.");
      const asset = await fetchAIStudioMediaAsset(next.mediaAssetId, token, { signal: AbortSignal.timeout(FINISH_REQUEST_TIMEOUT_MS) });
      if (!active.current) return;
      if (asset.id !== next.mediaAssetId || asset.status !== "ready" || asset.collection !== "video") throw new Error("The finished output could not be verified.");
      setOutput(asset);
    }
  }, [ownerId]);
  const refresh = useCallback(async () => {
    if (!enabled || !ownerId || !saved.current || working.current || !active.current) return;
    working.current = true; setBusy(true);
    try { await accept(await requestFinish(deps(), saved.current)); }
    catch (e) { if (active.current) setError(e instanceof Error ? e.message : "Could not recover your edit."); }
    finally { working.current = false; if (active.current) setBusy(false); }
  }, [enabled, ownerId, accept, deps]);
  useEffect(() => {
    if (!enabled || !ownerId) return;
    let stopped = false;
    // Hydration is read-only. It must never dispatch a replacement paid request.
    void Promise.resolve().then(() => {
      if (stopped) return;
      try {
        saved.current = readSavedFinish(localStorage.getItem(storageKey), ownerId, kind);
        if (saved.current) onRestoreOptions?.({ subtitles: !!saved.current.draft.subtitles, style: saved.current.draft.subtitles?.style ?? "clean", backgroundMusic: !!saved.current.draft.backgroundAssetId, placement: saved.current.draft.subtitles?.placement ?? "bottom" });
        if (saved.current) onRestoreDraft?.(saved.current.draft);
        setSavedEntry(saved.current); setRestored(true); void refresh();
      } catch (e) { setError(e instanceof Error ? e.message : "Could not verify the saved edit."); }
    });
    return () => { stopped = true; };
  }, [enabled, ownerId, kind, refresh, onRestoreOptions, onRestoreDraft, storageKey]);
  const loadingOutput = status?.outcome === "completed" && status.mediaAssetId !== output?.id;
  const needsRecovery = Boolean(savedEntry) && (!status || status.outcome === "pending" || status.outcome === "unconfirmed" || loadingOutput);
  useEffect(() => {
    if (!needsRecovery) return;
    // A completed receipt is not yet a usable preview if its owned-media GET
    // failed. Recover that same result without dispatching another render.
    const timer = setInterval(() => { void refresh(); }, 4000);
    return () => clearInterval(timer);
  }, [needsRecovery, refresh]);
  useEffect(() => {
    if (!needsRecovery || typeof window === "undefined") return;
    const recover = () => { void refresh(); };
    const visible = () => { if (document.visibilityState === "visible") recover(); };
    window.addEventListener("focus", recover);
    window.addEventListener("online", recover);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("focus", recover);
      window.removeEventListener("online", recover);
      document.removeEventListener("visibilitychange", visible);
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
        if (saved.current && !["completed", "failed", "cancelled"].includes(status?.outcome ?? "")) {
          // Explicit resume only; reuses the exact durable draft and identity.
          await accept(await requestFinish(deps(), saved.current, true)); return;
        }
        // Reopening the same saved result is not a request for another render.
        if (saved.current && status?.outcome === "completed" && (currentOutput || loadingOutput)) {
          await accept(await requestFinish(deps(), saved.current)); return;
        }
        if (!source) throw new Error("Upload or choose a video in Create before applying edits.");
        // Reuse only after checking durable recovery and the cross-tab lock.
        // Existing requests must finish recovering before this shortcut is used.
        if (reuseUnchangedSource && !saved.current && !demo && !demoSource && !demoAudio && !demoFraming && !sourceFraming && !backgroundSource && !options.backgroundMusic && !options.subtitles) {
          setOutput(source); setCompletedSignature(signature); return;
        }
        const total = (source.durationSeconds ?? 0) + (demoSource?.durationSeconds ?? demo?.duration ?? 0);
        if (options.subtitles && (!(total > 0) || total > 60)) throw new Error("English auto subtitles support up to 60 seconds in total. Nothing is trimmed.");
        let backgroundAssetId: string | null = null, backgroundPlayback: "once" | "repeat" = "once";
        if (options.backgroundMusic) {
          // Reuse the owned snapshot of a recovered edit instead of choosing
          // new music after reload or repeating an acknowledged upload.
          if (savedEntry?.draft.backgroundAssetId) {
            backgroundAssetId = savedEntry.draft.backgroundAssetId; backgroundPlayback = savedEntry.draft.backgroundPlayback;
          } else {
            const music = await loadWorkflowDefaultMusic(deps());
            const result = await uploadAIStudioReferenceMedia(music.file, "audio", 120, ownerId, { maxAudioDurationSeconds: 600, purpose: "explore-demo" });
            deps().assertActive(); backgroundAssetId = result.asset.id; backgroundPlayback = music.playback;
          }
        }
        const draft: SavedFinish["draft"] = { version: 1, kind, sourceAssetId: source.id, demoAssetId: demoSource?.id ?? await upload(demo, "video"), demoAudioAssetId: await upload(demoAudio, "audio"), demoAudioPlayback: demoAudio ? playback : "once", backgroundAssetId: editing ? backgroundSource?.id ?? null : backgroundAssetId, backgroundPlayback: editing && backgroundSource ? formatBackgroundPlayback : backgroundPlayback, subtitles: options.subtitles ? { language: "en", style: options.style, placement: options.placement ?? "bottom" } : null,
          ...(demoFraming ? { demoFraming } : {}), ...(sourceFraming ? { sourceFraming } : {}), ...(editing ? { editing } : {}) };
        deps().assertActive();
        const entry: SavedFinish = { version: 1, ownerId, kind, requestKey: crypto.randomUUID(), draft };
        // A storage failure must happen before dispatch, never after a paid request.
        localStorage.setItem(storageKey, JSON.stringify(entry)); saved.current = entry;
        setSavedEntry(entry); setOutput(null); setCompletedSignature(signature);
        await accept(await requestFinish(deps(), entry, true));
      });
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : "Could not apply edits. Refresh the saved request."); }
    finally { working.current = false; if (active.current) setBusy(false); }
  }
  // A recovered output is a saved result, not a reconstruction from missing local
  // files. A different source or newly selected edit must be applied first.
  const recoveredMatches = completedSignature === null && savedEntry && JSON.stringify(sourceFraming ?? undefined) === JSON.stringify(savedEntry.draft.sourceFraming) && (!source || source.id === savedEntry.draft.sourceAssetId) && !demo && !demoAudio && (demoSource ? demoSource.id === savedEntry.draft.demoAssetId : !savedEntry.draft.demoAssetId || !scope?.startsWith("format-demo:")) && (demoSource ? JSON.stringify(demoFraming ?? undefined) === JSON.stringify(savedEntry.draft.demoFraming) : !demoFraming) && (editing ? JSON.stringify(editing) === JSON.stringify(savedEntry.draft.editing) && (backgroundSource?.id ?? null) === savedEntry.draft.backgroundAssetId && (!backgroundSource || formatBackgroundPlayback === savedEntry.draft.backgroundPlayback) :
    !!options.backgroundMusic === !!savedEntry.draft.backgroundAssetId &&
    options.subtitles === !!savedEntry.draft.subtitles && (!options.subtitles || (options.style === savedEntry.draft.subtitles?.style &&
      (options.placement ?? "bottom") === (savedEntry.draft.subtitles?.placement ?? "bottom"))));
  const currentOutput = output && !demoFramingError && (completedSignature === signature || recoveredMatches) ? output : null;
  const pending = status?.outcome === "pending" || status?.outcome === "uncertain";
  const disabled = !enabled || !ownerId || !restored || busy || pending || loadingOutput || !!demoFramingError || (!source && !savedEntry);
  async function cancel() {
    if (working.current || !status?.jobId || !ownerId || !active.current) return;
    working.current = true; setBusy(true); setError(null);
    try {
      const token = await getCurrentUserIdToken(ownerId); deps().assertActive();
      if (!token) throw new Error("Sign in to cancel finishing.");
      const response = await fetch(`/api/jobs/${encodeURIComponent(status.jobId)}/cancel`, { method: "POST", signal: AbortSignal.timeout(FINISH_REQUEST_TIMEOUT_MS), headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Could not confirm cancellation. Refresh the saved request.");
      if (saved.current) await accept(await requestFinish(deps(), saved.current));
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : "Could not confirm cancellation."); }
    finally { working.current = false; if (active.current) setBusy(false); }
  }
  const action: WorkflowAction = { busy, disabled, message: loadingOutput ? "Your video is saved. Loading your finished video…" : status?.message ?? (source ? "Apply edits to save your finished video." : "Choose a saved video before applying edits."), error: demoFramingError ?? error, onAction: () => { void apply(); }, refresh: () => { void refresh(); },
    ...(pending && status?.jobId ? { cancel: () => { void cancel(); } } : {}) };
  return { action, output: currentOutput, status };
}
