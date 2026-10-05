"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAIStudioMediaAsset } from "@/lib/ai-studio/media-client";
import { uploadAIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { finishStorageKey, readSavedFinish, requestFinish, type FinishStatus, type SavedFinish } from "@/lib/explore/workflow-finishing-client";
import { loadWorkflowDefaultMusic } from "@/lib/explore/workflow-default-music-client";
import type { LocalWorkflowMedia } from "@/components/explore/use-local-workflow-media";
import type { MediaAsset } from "@/lib/media/types";
import type { ExploreFinishStyle } from "@/worker/src/lib/explore-finishing-contract";

export type FinishingOptions = { subtitles: boolean; style: ExploreFinishStyle; backgroundMusic: boolean };
export const DEFAULT_FINISHING_OPTIONS: FinishingOptions = { subtitles: false, style: "clean", backgroundMusic: false };
export type WorkflowAction = { busy: boolean; disabled: boolean; message: string; error: string | null; onAction: () => void; refresh: () => void };
export function useWorkflowFinishing({ ownerId, enabled, kind, source, demo, demoAudio, playback, options, onRestoreOptions }: {
  ownerId: string | null; enabled: boolean; kind: "hook" | "phone"; source: MediaAsset | null;
  demo: LocalWorkflowMedia | null; demoAudio: LocalWorkflowMedia | null; playback: "once" | "repeat"; options: FinishingOptions;
  onRestoreOptions?: (value: FinishingOptions) => void;
}) {
  const active = useRef(true), working = useRef(false);
  const saved = useRef<SavedFinish | null>(null);
  const uploaded = useRef(new Map<File, string>());
  const [busy, setBusy] = useState(false), [restored, setRestored] = useState(false);
  const [status, setStatus] = useState<FinishStatus | null>(null), [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<MediaAsset | null>(null);
  const [savedEntry, setSavedEntry] = useState<SavedFinish | null>(null);
  // Inputs change without invalidating a completed request's server identity.
  const signature = JSON.stringify([source?.id, demo?.url, demoAudio?.url, playback, options]);
  const [completedSignature, setCompletedSignature] = useState<string | null>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const deps = useCallback(() => ({ token: () => getCurrentUserIdToken(ownerId ?? undefined), fetch: (...args: Parameters<typeof fetch>) => fetch(...args), assertActive() { if (!active.current) throw new Error("This account's workflow is no longer active."); } }), [ownerId]);
  const accept = useCallback(async (next: FinishStatus) => {
    if (!active.current) return;
    setStatus(next); setError(null);
    if (next.outcome === "completed" && next.mediaAssetId && ownerId) {
      const token = await getCurrentUserIdToken(ownerId); if (!token) throw new Error("Sign in to view your finished video.");
      const asset = await fetchAIStudioMediaAsset(next.mediaAssetId, token);
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
        saved.current = readSavedFinish(localStorage.getItem(finishStorageKey(ownerId, kind)), ownerId, kind);
        if (saved.current) onRestoreOptions?.({ subtitles: !!saved.current.draft.subtitles, style: saved.current.draft.subtitles?.style ?? "clean", backgroundMusic: !!saved.current.draft.backgroundAssetId });
        setSavedEntry(saved.current); setRestored(true); void refresh();
      } catch (e) { setError(e instanceof Error ? e.message : "Could not verify the saved edit."); }
    });
    return () => { stopped = true; };
  }, [enabled, ownerId, kind, refresh, onRestoreOptions]);
  useEffect(() => {
    if (!saved.current || status?.outcome !== "pending") return;
    const timer = setInterval(() => { void refresh(); }, 4000);
    return () => clearInterval(timer);
  }, [status?.outcome, refresh]);
  async function upload(asset: LocalWorkflowMedia | null, mediaKind: "video" | "audio") {
    if (!asset) return null;
    if (!asset.file || !ownerId) throw new Error(`Choose the ${mediaKind} file again before applying edits.`);
    const prior = uploaded.current.get(asset.file); if (prior) return prior;
    const result = await uploadAIStudioReferenceMedia(asset.file, mediaKind, 120, ownerId, { maxAudioDurationSeconds: 600, requireVideoReferenceRatio: false, purpose: "explore-demo" });
    deps().assertActive(); uploaded.current.set(asset.file, result.asset.id); return result.asset.id;
  }
  async function apply() {
    if (working.current || !enabled || !ownerId || !restored || !active.current) return;
    working.current = true; setBusy(true); setError(null);
    try {
      if (!navigator.locks) throw new Error("Use a browser with Web Locks support to apply edits safely across tabs.");
      await navigator.locks.request(finishStorageKey(ownerId, kind), { ifAvailable: true }, async (lock) => {
        if (!lock) throw new Error("Another tab is applying edits. Refresh status first.");
        const stored = readSavedFinish(localStorage.getItem(finishStorageKey(ownerId, kind)), ownerId, kind);
        if (stored && stored.requestKey !== saved.current?.requestKey) { saved.current = stored; setSavedEntry(stored); setCompletedSignature(null); setOutput(null); await accept(await requestFinish(deps(), stored)); return; }
        if (saved.current && !["completed", "failed", "cancelled"].includes(status?.outcome ?? "")) {
          // Explicit resume only; reuses the exact durable draft and identity.
          await accept(await requestFinish(deps(), saved.current, true)); return;
        }
        // Reopening the same saved result is not a request for another render.
        if (currentOutput && saved.current && status?.outcome === "completed") {
          await accept(await requestFinish(deps(), saved.current)); return;
        }
        if (!source) throw new Error("Generate and select a video before applying edits.");
        const total = (source.durationSeconds ?? 0) + (demo?.duration ?? 0);
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
        const draft: SavedFinish["draft"] = { version: 1, kind, sourceAssetId: source.id, demoAssetId: await upload(demo, "video"), demoAudioAssetId: await upload(demoAudio, "audio"), demoAudioPlayback: demoAudio ? playback : "once", backgroundAssetId, backgroundPlayback, subtitles: options.subtitles ? { language: "en", style: options.style, placement: "bottom" } : null };
        deps().assertActive();
        const entry: SavedFinish = { version: 1, ownerId, kind, requestKey: crypto.randomUUID(), draft };
        // A storage failure must happen before dispatch, never after a paid request.
        localStorage.setItem(finishStorageKey(ownerId, kind), JSON.stringify(entry)); saved.current = entry;
        setSavedEntry(entry); setOutput(null); setCompletedSignature(signature);
        await accept(await requestFinish(deps(), entry, true));
      });
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : "Could not apply edits. Refresh the saved request."); }
    finally { working.current = false; if (active.current) setBusy(false); }
  }
  // A recovered output is a saved result, not a reconstruction from missing local
  // files. A different source or newly selected edit must be applied first.
  const recoveredMatches = completedSignature === null && savedEntry && (!source || source.id === savedEntry.draft.sourceAssetId) && !demo && !demoAudio &&
    !!options.backgroundMusic === !!savedEntry.draft.backgroundAssetId &&
    options.subtitles === !!savedEntry.draft.subtitles && (!options.subtitles || options.style === savedEntry.draft.subtitles?.style);
  const currentOutput = output && (completedSignature === signature || recoveredMatches) ? output : null;
  const pending = status?.outcome === "pending" || status?.outcome === "uncertain";
  const disabled = !enabled || !ownerId || !restored || busy || pending || (!source && !savedEntry);
  const action: WorkflowAction = { busy, disabled, message: status?.message ?? (source ? "Apply edits to save your finished video." : "Generate a video before applying edits."), error, onAction: () => { void apply(); }, refresh: () => { void refresh(); } };
  return { action, output: currentOutput };
}
