"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { ClipDraftSaveSession, clipDraftPendingKey, loadClipDraftWithInitial, saveClipDraft } from "@/lib/explore/clip-draft-client";
import { parseClipDraftContent, type ExploreClipDraft, type ExploreClipDraftContent } from "@/lib/explore/clip-draft-contract";

function draftStorage<T>(operation: () => T): T {
  try { return operation(); }
  catch { throw new Error("Browser storage is unavailable. Allow site storage, then retry. Your edits are kept on this screen; keep it open until they are saved."); }
}

/** Saves edits, not pixels. Export and publishing continue to use their own receipts. */
export function useClipDraftSave({ owner, sourceAssetId, scope, content, enabled, onRestore }: {
  owner: string | null; sourceAssetId: string | null; scope: string; content: ExploreClipDraftContent | null;
  enabled: boolean; onRestore: (draft: ExploreClipDraftContent, explicit: boolean) => void;
}) {
  const [savedEntry, setSavedEntry] = useState<{ key: string; draft: ExploreClipDraft | null } | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const replaceOnReload = useRef<string | null>(null);
  const active = useRef(true), working = useRef(false), session = useRef<ClipDraftSaveSession | null>(null);
  const currentContent = useRef(content);
  useEffect(() => { currentContent.current = content; }, [content]);
  const storageKey = owner && sourceAssetId ? clipDraftPendingKey(owner, scope, sourceAssetId) : null;
  const currentScope = useRef(storageKey);
  useEffect(() => { currentScope.current = storageKey; }, [storageKey]);
  const deps = useCallback(() => ({ token: () => getCurrentUserIdToken(owner ?? undefined), fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init) }), [owner]);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    if (!enabled || !owner || !sourceAssetId || !storageKey) return;
    let stopped = false;
    const replaceLocal = replaceOnReload.current === storageKey;
    // Recovery only reads the saved draft. Mounting cannot submit a save/render.
    void loadClipDraftWithInitial(deps(), sourceAssetId, scope).then(({ draft, initialContent }) => {
      if (stopped) return;
      let pending: unknown = null;
      const raw = draftStorage(() => localStorage.getItem(storageKey));
      if (raw) { if (raw.length > 131072) throw new Error("The interrupted save could not be recovered. Your local edits are kept."); pending = JSON.parse(raw); }
      const baseKey = `${storageKey}:revision`, previous = draftStorage(() => localStorage.getItem(baseKey));
      const parsed = previous === null ? null : Number(previous), currentRevision = draft?.revision ?? 0;
      if (parsed !== null && (!Number.isSafeInteger(parsed) || parsed < 0)) throw new Error("The draft revision could not be recovered. Reload the saved draft.");
      // Keep the original base of a local draft, so another device's newer
      // version cannot be silently overwritten after a browser reload.
      const expectedRevision = replaceLocal || parsed === null || draft && JSON.stringify(currentContent.current) === JSON.stringify(draft.content) ? currentRevision : parsed;
      if (parsed === null || replaceLocal) draftStorage(() => localStorage.setItem(baseKey, String(currentRevision)));
      session.current = new ClipDraftSaveSession(expectedRevision, scope, sourceAssetId, request => {
        // Persist the identity before sending so a lost response/reload can replay.
        draftStorage(() => { if (request) localStorage.setItem(storageKey, JSON.stringify(request)); else localStorage.removeItem(storageKey); });
      }, pending);
      setSavedEntry({ key: storageKey, draft });
      if (draft) onRestore(draft.content, replaceLocal);
      else if (!pending && initialContent) onRestore(initialContent, false);
      setLoadedKey(storageKey); setError(null);
    }).catch(error => { if (!stopped) { setLoadedKey(null); setError(error instanceof Error ? error.message : "Could not load your saved edits."); } });
    return () => { stopped = true; };
  }, [enabled, owner, sourceAssetId, scope, storageKey, deps, loadAttempt, onRestore]);
  const currentSaved = savedEntry?.key === storageKey ? savedEntry.draft : null;
  const loaded = enabled && storageKey !== null && loadedKey === storageKey;
  let canonicalContent = content;
  try { if (content) canonicalContent = parseClipDraftContent(content); } catch { /* Invalid local edits remain dirty and cannot be saved by the contract. */ }
  const dirty = Boolean(canonicalContent && (!currentSaved || JSON.stringify(canonicalContent) !== JSON.stringify(currentSaved.content)));
  async function save() {
    if (!enabled || !owner || !content || !loaded || working.current || !session.current) return;
    working.current = true; setBusy(true); setError(null);
    try {
      const accepted = await session.current.save(content, request => saveClipDraft(deps(), request));
      if (storageKey) draftStorage(() => localStorage.setItem(`${storageKey}:revision`, String(accepted.revision)));
      if (active.current && storageKey && currentScope.current === storageKey) {
        setSavedEntry({ key: storageKey, draft: accepted });
        return accepted;
      }
    } catch (error) { if (active.current && currentScope.current === storageKey) setError(error instanceof Error ? error.message : "Could not save your edits. Your local changes are kept."); }
    finally { working.current = false; if (active.current) setBusy(false); }
  }
  return { saved: currentSaved, loaded, busy, dirty, error, save, reload: () => { if (!working.current) { replaceOnReload.current = loaded ? storageKey : null; setLoadedKey(null); setLoadAttempt(attempt => attempt + 1); } } };
}
