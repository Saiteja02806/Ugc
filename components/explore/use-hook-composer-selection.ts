"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HookStartingFrameSelection } from "@/lib/explore/hook-keyframe-client";
import { fetchRecentStartingFrame } from "@/lib/explore/hook-starting-frame-history-client";
import { hookComposerSelectionKey, readHookComposerSelection, restoreHookComposerSelection, serializeHookComposerSelection } from "@/lib/explore/hook-composer-selection";

export function useHookComposerSelection(ownerId: string | null, enabled: boolean, namespace = "hook", options: { tabScoped?: boolean; resumeDraftId?: string | null } = {}) {
  const tabScoped = options.tabScoped === true, resumeDraftId = options.resumeDraftId ?? null;
  const store = useCallback(() => tabScoped ? sessionStorage : localStorage, [tabScoped]);
  const scopeKey = `${ownerId ?? "signed-out"}:${namespace}:${tabScoped ? "tab" : "shared"}`;
  const [state, setState] = useState<{ ownerId: string | null; scopeKey: string; frame: HookStartingFrameSelection | null; ready: boolean; error: string | null }>({ ownerId, scopeKey, frame: null, ready: !enabled, error: null });
  const [attempt, retry] = useState(0);
  const revision = useRef(0);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController(); pending.current = controller;
    const current = ++revision.current;
    if (!enabled || !ownerId) return () => controller.abort();
    void (async () => {
      await Promise.resolve();
      if (controller.signal.aborted || current !== revision.current) return;
      setState({ ownerId, scopeKey, frame: null, ready: false, error: null });
      try {
        const key = hookComposerSelectionKey(ownerId, namespace);
        let raw = store().getItem(key);
        // Legacy records stay intact. Adopt one only for an explicit matching
        // frame draft, never because another tab most recently selected it.
        if (tabScoped && raw === null && resumeDraftId) {
          const legacyRaw = localStorage.getItem(key);
          const legacy = readHookComposerSelection(legacyRaw, ownerId);
          if (legacy?.draftId === resumeDraftId) { raw = legacyRaw; if (raw !== null) store().setItem(key, raw); }
        }
        const saved = raw === "" ? null : readHookComposerSelection(raw, ownerId);
        const frame = saved ? restoreHookComposerSelection(saved, await fetchRecentStartingFrame(saved, ownerId, controller.signal)) : null;
        if (!controller.signal.aborted && current === revision.current) setState({ ownerId, scopeKey, frame, ready: true, error: null });
      } catch (cause) {
        if (!controller.signal.aborted && current === revision.current) setState({ ownerId, scopeKey, frame: null, ready: false,
          error: cause instanceof Error ? cause.message : "Could not restore your starting frame. Retry or choose another image." });
      }
    })();
    return () => controller.abort();
  }, [ownerId, enabled, attempt, namespace, scopeKey, tabScoped, resumeDraftId, store]);
  function setFrame(frame: HookStartingFrameSelection | null) {
    if (frame && frame.ownerId !== ownerId) return false;
    try {
      if (enabled && ownerId) {
        if (frame) store().setItem(hookComposerSelectionKey(ownerId, namespace), serializeHookComposerSelection(frame));
        else if (tabScoped) store().setItem(hookComposerSelectionKey(ownerId, namespace), "");
        else store().removeItem(hookComposerSelectionKey(ownerId, namespace));
      }
      ++revision.current; pending.current?.abort();
      setState({ ownerId, scopeKey, frame, ready: true, error: null });
      return true;
    } catch {
      setState(previous => ({ ...previous, error: "Your browser could not save the starting frame. Allow site storage and try again." }));
      return false;
    }
  }
  const visible = state.ownerId === ownerId && state.scopeKey === scopeKey ? state : null;
  return { frame: visible?.frame ?? null, ready: !enabled || !ownerId || Boolean(visible?.ready), error: visible?.error ?? null, setFrame, retry: () => retry(value => value + 1) };
}
