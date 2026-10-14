"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAIStudioMediaAsset } from "@/lib/ai-studio/media-client";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { createWorkflowSession, parseWorkflowSession, readWorkflowSession, restoreWorkflowSessionAssets, serializeWorkflowSession, workflowSessionAssetError, workflowSessionStorageKey,
  type WorkflowSession, type WorkflowSessionAssets, type WorkflowSessionMediaRole, type WorkflowSessionProblems } from "@/lib/explore/workflow-session";
import type { WorkflowGenerationSettings } from "@/lib/explore/workflow-generation-settings";
import type { MediaAsset } from "@/lib/media/types";
import { withReadDeadline } from "@/lib/http/read-deadline";

const emptyAssets = (): WorkflowSessionAssets => ({ source: null, demo: null, demoAudio: null });
/** Only owned IDs and serializable drafts are stored. Recovery cannot upload or submit work. */
export function useWorkflowSession({ ownerId, enabled, defaults }: { ownerId: string | null; enabled: boolean; defaults: WorkflowGenerationSettings }) {
  const [session, setSession] = useState(() => createWorkflowSession(ownerId ?? "preview", defaults));
  const current = useRef(session);
  const [assets, setAssets] = useState<WorkflowSessionAssets>(emptyAssets);
  const [problems, setProblems] = useState<WorkflowSessionProblems>({});
  const [loaded, setLoaded] = useState(!enabled), [error, setError] = useState<string | null>(null), [attempt, setAttempt] = useState(0);
  const [sessionRevision, setSessionRevision] = useState(0);
  const active = useRef(true), revision = useRef(0), loadedRef = useRef(!enabled);
  const key = ownerId ? workflowSessionStorageKey(ownerId) : null;
  const defaultsRef = useRef(defaults);
  useEffect(() => { active.current = true; const requests = revision; return () => { active.current = false; requests.current++; }; }, []);
  useEffect(() => {
    if (!enabled || !ownerId || !key) return;
    const request = ++revision.current, controller = new AbortController();
    loadedRef.current = false;
    const isCurrent = () => active.current && request === revision.current && !controller.signal.aborted;
    void Promise.resolve().then(async () => {
      try {
        if (!isCurrent()) return;
        setLoaded(false); setError(null);
        const draft = readWorkflowSession(localStorage.getItem(key), ownerId) ?? createWorkflowSession(ownerId, defaultsRef.current);
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
    });
    return () => controller.abort();
  }, [enabled, ownerId, key, attempt]);
  const update = useCallback((change: (previous: WorkflowSession) => WorkflowSession) => {
    if (!active.current || !loadedRef.current) return false;
    try {
      const next = parseWorkflowSession(change(current.current), ownerId ?? "preview");
      if (JSON.stringify(next) === JSON.stringify(current.current)) return true;
      if (enabled && key) localStorage.setItem(key, serializeWorkflowSession(next));
      current.current = next; setSession(next); setError(null);
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Your workflow could not be saved in this browser."); return false; }
  }, [enabled, key, ownerId]);
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
    revision.current++;
    try {
      if (enabled && key) localStorage.removeItem(key);
      const next = createWorkflowSession(ownerId ?? "preview", defaultsRef.current);
      current.current = next; setSession(next); setAssets(emptyAssets()); setProblems({}); setError(null); loadedRef.current = true; setLoaded(true); setSessionRevision(value => value + 1);
    } catch { setError("Browser storage could not reset the saved workflow. Its accepted generation and schedule requests are kept."); }
  }, [enabled, key, ownerId]);
  return { session, assets, problems, loaded, error, update, acceptAsset, clearMedia, clearProblem, markPending, reset,
    recoveryRevision: sessionRevision, retry: () => { loadedRef.current = false; setLoaded(false); setAttempt(value => value + 1); } };
}
