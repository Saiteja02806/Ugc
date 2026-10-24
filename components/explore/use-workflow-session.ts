"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAIStudioMediaAsset } from "@/lib/ai-studio/media-client";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { createWorkflowSession, parseWorkflowSession, readWorkflowSession, restoreWorkflowSessionAssets, serializeWorkflowSession, workflowSessionAssetError, workflowSessionStorageKey,
  type WorkflowSession, type WorkflowSessionAssets, type WorkflowSessionMediaRole, type WorkflowSessionProblems } from "@/lib/explore/workflow-session";
import type { WorkflowGenerationSettings } from "@/lib/explore/workflow-generation-settings";
import type { MediaAsset } from "@/lib/media/types";
import { withReadDeadline } from "@/lib/http/read-deadline";
import { workflowVisitStorage } from "@/lib/explore/workflow-visit-storage";
import { workflowDraftStorage, markWorkflowDraftScheduled, type WorkflowDraftEntry } from "@/lib/explore/workflow-draft-lifecycle";

const emptyAssets = (): WorkflowSessionAssets => ({ source: null, demo: null, demoAudio: null });
/** Only owned IDs and serializable drafts are stored. Recovery cannot upload or submit work. */
export function useWorkflowSession({ ownerId, enabled, defaults, draftEntry }: { ownerId: string | null; enabled: boolean; defaults: WorkflowGenerationSettings; draftEntry?: WorkflowDraftEntry }) {
  const [session, setSession] = useState(() => createWorkflowSession(ownerId ?? "preview", defaults));
  const current = useRef(session);
  const [assets, setAssets] = useState<WorkflowSessionAssets>(emptyAssets);
  const [problems, setProblems] = useState<WorkflowSessionProblems>({});
  const [loaded, setLoaded] = useState(!enabled), [error, setError] = useState<string | null>(null), [attempt, setAttempt] = useState(0);
  const [sessionRevision, setSessionRevision] = useState(0);
  const active = useRef(true), revision = useRef(0), loadedRef = useRef(!enabled);
  const key = ownerId ? workflowSessionStorageKey(ownerId) : null;
  const defaultsRef = useRef(defaults);
  const draftId = draftEntry?.id, createNew = draftEntry?.createNew;
  const storage = useCallback(() => draftId ? workflowDraftStorage(localStorage, draftId) : workflowVisitStorage(sessionStorage), [draftId]);
  useEffect(() => { active.current = true; const requests = revision; return () => { active.current = false; requests.current++; }; }, []);
  useEffect(() => {
    if (!enabled || !ownerId || !key) return;
    const request = ++revision.current, controller = new AbortController();
    loadedRef.current = false;
    const isCurrent = () => active.current && request === revision.current && !controller.signal.aborted;
    const restore = async () => {
      try {
        if (!isCurrent()) return;
        setLoaded(false); setError(null);
        const stored = storage().getItem(key);
        if (draftId && !createNew && stored === null) throw new Error("This draft is not available on this browser. Open Saved drafts or start a new video; your generated media is kept in Creative Assets.");
        const draft = readWorkflowSession(stored, ownerId) ?? createWorkflowSession(ownerId, defaultsRef.current);
        if (draftId && stored === null) storage().setItem(key, serializeWorkflowSession(draft));
        const assertActive = () => { if (!isCurrent()) throw new Error("This account's saved workflow changed during recovery."); };
        let tokenRequest: ReturnType<typeof getCurrentUserIdToken> | null = null;
        const restored = await withReadDeadline(async bounded => restoreWorkflowSessionAssets(draft, async id => {
          tokenRequest ??= getCurrentUserIdToken(ownerId);
          const token = await tokenRequest; bounded.throwIfAborted(); assertActive();
          if (!token) throw new Error("Sign in to restore your saved workflow.");
          return fetchAIStudioMediaAsset(id, token, { signal: bounded });
        }, assertActive), controller.signal);
        if (!isCurrent()) return;
        current.current = draft; setSession(draft); setAssets(restored.assets); setProblems(restored.problems); setSessionRevision(value => value + 1);
      } catch (cause) { if (isCurrent()) { setAssets(emptyAssets()); setError(cause instanceof Error ? cause.message : "Could not recover the saved workflow."); } }
      finally { if (isCurrent()) { loadedRef.current = true; setLoaded(true); } }
    };
    // A draft has one editing owner per browser. A second tab cannot overwrite
    // its snapshot or clip settings while the first is still editing it.
    if (draftId) {
      if (!navigator.locks) void Promise.resolve().then(() => { if (isCurrent()) { setError("This browser cannot safely coordinate saved drafts across tabs. Use a browser with Web Locks support."); setLoaded(true); } });
      else void navigator.locks.request(`${key}:${draftId}`, { ifAvailable: true }, async lock => {
        if (!isCurrent()) return;
        if (!lock) { setError("This draft is already open in another tab. Close that copy, then retry recovery, or start a new video."); setLoaded(true); return; }
        await restore();
        if (!controller.signal.aborted) await new Promise<void>(resolve => controller.signal.addEventListener("abort", () => resolve(), { once: true }));
      }).catch(cause => { if (isCurrent()) { setError(cause instanceof Error ? cause.message : "Could not lock this draft safely."); setLoaded(true); } });
    } else void Promise.resolve().then(restore);
    return () => controller.abort();
  }, [enabled, ownerId, key, attempt, draftId, createNew, storage]);
  const update = useCallback((change: (previous: WorkflowSession) => WorkflowSession) => {
    if (!active.current || !loadedRef.current) return false;
    try {
      const next = parseWorkflowSession(change(current.current), ownerId ?? "preview");
      if (JSON.stringify(next) === JSON.stringify(current.current)) return true;
      if (enabled && key) storage().setItem(key, serializeWorkflowSession(next));
      current.current = next; setSession(next); setError(null);
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Your workflow could not be saved in this browser."); return false; }
  }, [enabled, key, ownerId, storage]);
  const acceptAsset = useCallback((role: WorkflowSessionMediaRole, asset: MediaAsset, sourceMode?: WorkflowSession["sourceMode"]) => {
    const problem = workflowSessionAssetError(asset, asset.id, role);
    if (problem) { setProblems(previous => ({ ...previous, [role]: problem })); return false; }
    const accepted = update(previous => ({ ...previous,
      ...(role === "source" ? sourceMode === "generate" ? { sourceMode, generatedAssetId: asset.id, generatedSelectionCleared: false, pendingSource: false } : { sourceMode: sourceMode ?? previous.sourceMode, sourceAssetId: asset.id, pendingSource: false } : {}),
      ...(role === "demo" ? { demoAssetId: asset.id, pendingDemo: false, demoAudioAssetId: null, pendingDemoAudio: false, demoAudioPlayback: "once" as const, demoFraming: null } : {}),
      ...(role === "demoAudio" ? { demoAudioAssetId: asset.id, pendingDemoAudio: false } : {}),
    }));
    if (!accepted) return false;
    setAssets(previous => ({ ...previous, [role]: asset, ...(role === "demo" ? { demoAudio: null } : {}) }));
    setProblems(previous => { const next = { ...previous }; delete next[role]; if (role === "demo") delete next.demoAudio; return next; });
    return true;
  }, [update]);
  const clearProblem = useCallback((role: WorkflowSessionMediaRole) => {
    setProblems(previous => { const next = { ...previous }; delete next[role]; return next; });
  }, []);
  const clearMedia = useCallback((role: WorkflowSessionMediaRole) => {
    update(previous => ({ ...previous,
      ...(role === "source" ? { sourceAssetId: null, generatedAssetId: null, generatedSelectionCleared: true, pendingSource: false } : {}),
      ...(role === "demo" ? { demoAssetId: null, pendingDemo: false, demoAudioAssetId: null, pendingDemoAudio: false, demoAudioPlayback: "once" as const, demoFraming: null } : {}),
      ...(role === "demoAudio" ? { demoAudioAssetId: null, pendingDemoAudio: false, demoAudioPlayback: "once" as const } : {}),
    }));
    setAssets(previous => ({ ...previous, [role]: null, ...(role === "demo" ? { demoAudio: null } : {}) }));
    setProblems(previous => { const next = { ...previous }; delete next[role]; if (role === "demo") delete next.demoAudio; return next; });
  }, [update]);
  const markPending = useCallback((role: WorkflowSessionMediaRole) => {
    update(previous => ({ ...previous, [role === "source" ? "pendingSource" : role === "demo" ? "pendingDemo" : "pendingDemoAudio"]: true }));
  }, [update]);
  const reset = useCallback(() => {
    // A hard transition releases this draft's lock and all of its pending UI callbacks.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (draftId) { window.location.href = "/explore/create-hook"; return; }
    revision.current++;
    try {
      const next = createWorkflowSession(ownerId ?? "preview", defaultsRef.current);
      if (enabled && key) storage().setItem(key, serializeWorkflowSession(next));
      current.current = next; setSession(next); setAssets(emptyAssets()); setProblems({}); setError(null); loadedRef.current = true; setLoaded(true); setSessionRevision(value => value + 1);
    } catch { setError("Browser storage could not reset the saved workflow. Its accepted generation and schedule requests are kept."); }
  }, [enabled, key, ownerId, draftId, storage]);
  const complete = useCallback(() => {
    if (!enabled || !ownerId || !draftId || !active.current || !loadedRef.current) return;
    try { markWorkflowDraftScheduled(localStorage, ownerId, draftId); }
    catch { setError("Your schedule is saved, but this browser could not update the draft's status. Review Scheduling."); }
  }, [enabled, ownerId, draftId]);
  return { session, assets, problems, loaded, error, update, acceptAsset, clearMedia, clearProblem, markPending, reset, complete,
    recoveryRevision: sessionRevision, retry: () => { loadedRef.current = false; setLoaded(false); setAttempt(value => value + 1); } };
}
