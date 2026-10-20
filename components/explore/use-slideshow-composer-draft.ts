"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type SetStateAction } from "react";
import type { AIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { fetchFormatReferenceImage } from "@/lib/explore/format-reference-images";
import { readSlideshowComposerDraft, slideshowComposerDraftKey } from "@/lib/explore/slideshow-composer-draft";

type State = { key: string; prompt: string; images: AIStudioReferenceMedia[]; ready: boolean; error: string | null };
export function useSlideshowComposerDraft(owner: string | null, scope: string, enabled: boolean) {
  const key = enabled && owner ? slideshowComposerDraftKey(owner, scope) : "";
  const [state, setState] = useState<State>({ key: "", prompt: "", images: [], ready: false, error: null });
  const [attempt, setAttempt] = useState(0);
  const current = useRef(state);
  const activeKey = useRef(key);
  useLayoutEffect(() => { activeKey.current = key; }, [key]);
  useEffect(() => {
    if (!key || !owner) return;
    let cancelled = false;
    void (async () => {
      let prompt = "";
      try {
        const saved = readSlideshowComposerDraft(localStorage.getItem(key)); prompt = saved.prompt;
        const images = await Promise.all(saved.imageIds.map(async id => ({ kind: "image" as const, asset: await fetchFormatReferenceImage(id, owner) })));
        if (cancelled || activeKey.current !== key) return;
        const next = { key, prompt, images, ready: true, error: null }; current.current = next; setState(next);
      } catch (cause) {
        if (cancelled || activeKey.current !== key) return;
        const next = { key, prompt, images: [], ready: false, error: cause instanceof Error ? cause.message : "Could not restore your attached images." };
        current.current = next; setState(next);
      }
    })();
    return () => { cancelled = true; };
  }, [key, owner, attempt]);

  const update = useCallback((patch: { prompt?: string; images?: SetStateAction<AIStudioReferenceMedia[]> }) => {
    if (!key || activeKey.current !== key || current.current.key !== key || !current.current.ready) return;
    const previous = current.current;
    const next = { ...previous, ...(patch.prompt === undefined ? {} : { prompt: patch.prompt }), ...(patch.images === undefined ? {} : { images: typeof patch.images === "function" ? patch.images(previous.images) : patch.images }), error: null };
    try {
      // Persist before acknowledging the change; never silently lose selected IDs.
      localStorage.setItem(key, JSON.stringify({ version: 1, prompt: next.prompt, imageIds: next.images.map(image => image.asset.id) }));
      current.current = next; setState(next);
    } catch { setState({ ...previous, error: "Your browser could not save these instructions. Allow site storage and retry before generating." }); }
  }, [key]);
  const setPrompt = useCallback((value: SetStateAction<string>) => update({ prompt: typeof value === "function" ? value(current.current.prompt) : value }), [update]);
  const setImages = useCallback((images: SetStateAction<AIStudioReferenceMedia[]>) => update({ images }), [update]);
  const visible = state.key === key ? state : null;
  return {
    prompt: visible?.prompt ?? "", images: visible?.images ?? [], busy: Boolean(key && (!visible || !visible.ready && !visible.error)),
    error: visible?.error ?? null,
    setPrompt, setImages,
    retry: () => setAttempt(value => value + 1),
    reset: () => { try { localStorage.setItem(key, JSON.stringify({ version: 1, prompt: visible?.prompt ?? "", imageIds: [] })); setAttempt(value => value + 1); } catch { /* Preserve the visible recovery error. */ } },
  };
}
