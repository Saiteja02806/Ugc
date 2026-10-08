"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import type { AIStudioImageResult } from "@/lib/ai-studio/media-results";
import type { RecreateReference } from "@/lib/explore/recreate-types";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { isExploreUuid } from "@/worker/src/lib/explore-finishing-contract";
import type { LibraryCarouselItemRecord } from "@/lib/library/db";

type Output = { id: string; kind: "library_item"; url: string; title: string; slides?: string[] };
type SavedRequest = { version: 1; owner: string; requestKey: string; referenceId: string; slides: { referenceSlideId: string; mediaAssetId: string | null }[]; output?: Output };
export type SlideshowEditorController = { useImage: (image: AIStudioImageResult, index: number) => void };
export function FormatSlideshowEditor({ reference, controllerRef, slideIndex, active, generationBusy, controlsTarget, resultsTarget, actionsTarget, localPreview, savingEnabled, onDirty, onSaved, onContinue, onRegenerate }: {
  reference: RecreateReference | null; controllerRef: Ref<SlideshowEditorController>; slideIndex: number; active: boolean; generationBusy: boolean; controlsTarget: HTMLElement | null; resultsTarget: HTMLElement | null; localPreview: boolean; savingEnabled: boolean;
  onDirty: () => void; onSaved: (output: Output) => void; onContinue: () => void; onRegenerate: (index: number) => void;
  actionsTarget?: HTMLElement | null;
}) {
  const { user } = useAuth();
  const draftKey = `ugc-explore:slideshow-draft:v1:${user?.uid}:${reference?.id}`;
  const saveKey = `${draftKey}:save`;
  const [replacements, setReplacements] = useState<Record<string, AIStudioImageResult>>(() => {
    try { const raw = typeof window === "undefined" ? null : localStorage.getItem(draftKey); if (raw && raw.length < 65536) { const values = JSON.parse(raw) as Record<string, AIStudioImageResult>; return Object.fromEntries(Object.entries(values).filter(([id, image]) => reference?.slides.some(slide => slide.id === id) && isExploreUuid(image.id) && typeof image.url === "string" && image.url.startsWith("https://"))); } } catch { /* Original slides remain available. */ }
    return {};
  });
  const [selection, setSelection] = useState({ index: slideIndex, externalIndex: slideIndex });
  const previewIndex = selection.externalIndex === slideIndex ? selection.index : slideIndex;
  const setPreviewIndex = useCallback((value: number | ((index: number) => number)) => {
    setSelection(current => ({ index: typeof value === "function" ? value(current.externalIndex === slideIndex ? current.index : slideIndex) : value, externalIndex: slideIndex }));
  }, [slideIndex]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<Output | null>(null);
  const [pending, setPending] = useState(false);
  const alive = useRef(true);
  const revision = useRef(0);
  const working = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useImperativeHandle(controllerRef, () => ({ useImage(image, index) {
    if (!reference?.slides[index] || pending || busy) return;
    revision.current += 1;
    const next = { ...replacements, [reference.slides[index].id]: image };
    setReplacements(next); setPreviewIndex(index); setOutput(null); onDirty();
    try { localStorage.setItem(draftKey, JSON.stringify(next)); } catch { /* Original slides remain available. */ }
  } }), [reference, pending, busy, replacements, onDirty, draftKey, setPreviewIndex]);
  function payload() { return reference?.slides.map(slide => ({ referenceSlideId: slide.id, mediaAssetId: replacements[slide.id]?.id ?? null })) ?? []; }
  function readSaved(): SavedRequest | null {
    const raw = localStorage.getItem(saveKey); if (!raw) return null;
    if (raw.length > 16384) throw new Error("The saved slideshow request is invalid.");
    const value = JSON.parse(raw) as SavedRequest;
    if (value.version !== 1 || value.owner !== user?.uid || value.referenceId !== reference?.id || !isExploreUuid(value.requestKey) || !Array.isArray(value.slides) || value.slides.length !== reference.slides.length || value.slides.some((slide, index) => slide.referenceSlideId !== reference.slides[index].id || slide.mediaAssetId !== null && !isExploreUuid(slide.mediaAssetId))) throw new Error("Could not verify the saved slideshow request.");
    return value;
  }
  async function verifyOutput(saved: SavedRequest): Promise<Output> {
    const token = await getCurrentUserIdToken(user?.uid);
    if (!token || !saved.output) throw new Error("Sign in to verify your saved slideshow.");
    const response = await fetch("/api/library?type=carousel&projectId=explore", { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json() as { ok?: boolean; items?: LibraryCarouselItemRecord[] };
    const item = data.items?.find(value => value.id === saved.output?.id && value.sourceId === `explore-slideshow:${saved.requestKey}` && value.projectId === "explore");
    if (!response.ok || !data.ok || !item || item.slideCount !== saved.slides.length || item.slides.length !== saved.slides.length || item.slides.some((slide, index) => slide.slideNumber !== index + 1 || !slide.renderedUrl.startsWith("https://"))) throw new Error("This saved slideshow is unavailable. Review your Library before scheduling.");
    return { id: item.id, kind: "library_item", url: item.slides[0].renderedUrl, title: item.title, slides: item.slides.map(slide => slide.renderedUrl) };
  }
  useEffect(() => {
    if (!user || !reference) return;
    let stopped = false;
    const restoredRevision = revision.current;
    const timer = setTimeout(() => { void (async () => {
      try {
        const saved = readSaved();
        if (saved?.output && isExploreUuid(saved.output.id) && saved.output.kind === "library_item" && JSON.stringify(saved.slides) === JSON.stringify(payload())) { const verified = await verifyOutput(saved); if (!stopped && alive.current && restoredRevision === revision.current) { setOutput(verified); onSaved(verified); } }
        else if (saved && !saved.output) { setPending(true); setError("An interrupted save is ready to resume. Your slide choices are preserved."); }
      } catch (e) { if (!stopped && alive.current) setError(e instanceof Error ? e.message : "Could not restore the slideshow."); }
    })(); }, 0);
    return () => { stopped = true; clearTimeout(timer); };
    // Restore this owner/reference once. Changes are saved only by the button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveKey]);
  async function save() {
    if (!user || !reference || localPreview || !savingEnabled || working.current) return;
    working.current = true; setBusy(true); setError(null);
    try {
      if (!navigator.locks) throw new Error("Use a browser with Web Locks to save safely across tabs.");
      await navigator.locks.request(saveKey, { ifAvailable: true }, async lock => {
        if (!lock) throw new Error("Another tab is saving this slideshow. Resume after it finishes.");
        const prior = readSaved();
        const slides = payload();
        if (prior?.output && JSON.stringify(prior.slides) === JSON.stringify(slides)) { const verified = await verifyOutput(prior); if (alive.current) { setOutput(verified); onSaved(verified); } return; }
        const saved: SavedRequest = prior && !prior.output ? prior : { version: 1, owner: user.uid, requestKey: crypto.randomUUID(), referenceId: reference.id, slides };
        localStorage.setItem(saveKey, JSON.stringify(saved)); setPending(true);
        const token = await getCurrentUserIdToken(user.uid); if (!token || !alive.current) throw new Error("Sign in to save your slideshow.");
        const response = await fetch("/api/explore/slideshows", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Idempotency-Key": saved.requestKey }, body: JSON.stringify({ requestKey: saved.requestKey, referenceId: saved.referenceId, slides: saved.slides }) });
        const data = await response.json() as Output & { ok?: boolean; error?: string };
        if (!response.ok || !data.ok || !isExploreUuid(data.id) || data.kind !== "library_item") throw new Error(data.error ?? "Could not confirm your save. Resume the same request.");
        if (!alive.current) return;
        const next: Output = { id: data.id, kind: "library_item", title: data.title, url: data.url, slides: data.slides };
        localStorage.setItem(saveKey, JSON.stringify({ ...saved, output: next })); setPending(false); setOutput(next); onSaved(next);
      });
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "Could not save the slideshow."); }
    finally { working.current = false; if (alive.current) setBusy(false); }
  }
  if (!active || !controlsTarget || !resultsTarget) return null;
  const slides = reference?.slides ?? [];
  const selected = slides[previewIndex];
  const actions = <div className="space-y-2">
    {error ? <p role="alert" className="text-xs leading-5 text-destructive">{error}</p> : null}
    {output ? <Button type="button" size="lg" className="h-11 w-full rounded-lg" onClick={onContinue}>Continue to Schedule</Button> : <Button type="button" size="lg" className="h-11 w-full rounded-lg" disabled={!reference || localPreview || !savingEnabled || busy} onClick={() => void save()}>{busy ? "Saving…" : pending ? "Resume save" : "Save slideshow"}</Button>}
    <p role="status" className="text-xs leading-5 text-muted">{localPreview ? "Preview · saving disabled" : output ? "Your slideshow is saved in Library." : !savingEnabled ? "Slideshow saving is unavailable right now." : "Save your final sequence before scheduling."}</p>
  </div>;
  return <>{actionsTarget ? createPortal(actions, actionsTarget) : null}{createPortal(<div className="space-y-5 p-4"><h2 className="text-sm font-semibold">Your slides</h2><p className="text-xs leading-5 text-muted">Review the full sequence. Replace a slide with a generated image or recreate it again.</p>
    <div className="grid grid-cols-3 gap-3">{slides.map((slide, index) => <button key={slide.id} type="button" aria-label={`Preview slide ${index + 1}`} aria-pressed={previewIndex === index} onClick={() => setPreviewIndex(index)} className={`overflow-hidden rounded-lg border ${previewIndex === index ? "border-primary ring-1 ring-primary" : "border-border"}`}><img src={replacements[slide.id]?.url ?? slide.url} alt="" width={slide.width} height={slide.height} className="aspect-[4/5] w-full object-contain" /><span className="block py-1 text-xs">{index + 1}{replacements[slide.id] ? " · Edited" : ""}</span></button>)}</div>
    {selected ? <><Button type="button" variant="outline" disabled={generationBusy || pending || busy} onClick={() => onRegenerate(previewIndex)} className="w-full">Recreate slide {previewIndex + 1}</Button>{replacements[selected.id] ? <Button type="button" variant="ghost" disabled={pending || busy} onClick={() => { revision.current += 1; const next = { ...replacements }; delete next[selected.id]; setReplacements(next); try { localStorage.setItem(draftKey, JSON.stringify(next)); } catch { /* Changes remain in this session. */ } setOutput(null); onDirty(); }}>Restore original slide</Button> : null}</> : <p className="text-xs text-muted">Choose a slideshow reference in Create.</p>}
    <p className="text-xs leading-5 text-muted">The original slide order stays intact. Text inside an image is changed by recreating that image.</p>
    {!actionsTarget ? actions : null}
  </div>, controlsTarget)}{createPortal(<div className="flex flex-col items-center gap-4"><h2 className="self-start text-base font-semibold">Your slideshow</h2>{selected ? <><img src={replacements[selected.id]?.url ?? selected.url} alt={`Slide ${previewIndex + 1} of ${slides.length}`} width={selected.width} height={selected.height} className="max-h-[65dvh] max-w-full rounded-xl object-contain" /><div className="flex items-center gap-4"><Button type="button" variant="outline" disabled={previewIndex === 0} onClick={() => setPreviewIndex(index => index - 1)}>Previous</Button><span className="text-sm text-muted">{previewIndex + 1} / {slides.length}</span><Button type="button" variant="outline" disabled={previewIndex >= slides.length - 1} onClick={() => setPreviewIndex(index => index + 1)}>Next</Button></div></> : <p className="text-sm text-muted">Select a slideshow in References to begin.</p>}</div>, resultsTarget)}</>;
}
