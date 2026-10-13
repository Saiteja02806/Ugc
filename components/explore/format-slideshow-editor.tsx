"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import type { AIStudioImageResult } from "@/lib/ai-studio/media-results";
import { fetchAIStudioMediaAsset } from "@/lib/ai-studio/media-client";
import { uploadAIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import { readRemixSource, resolveRemixSource } from "@/lib/explore/remix-source";
import type { ReferenceText } from "@/lib/explore/reference-text";
import type { RecreateReference } from "@/lib/explore/recreate-types";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { isExploreUuid } from "@/worker/src/lib/explore-finishing-contract";
import type { LibraryCarouselItemRecord } from "@/lib/library/db";
import type { MediaAsset } from "@/lib/media/types";
import { EMPTY_SLIDE_TEXT, parseSlideText, type SlideTextDesign } from "@/lib/explore/slideshow-text";
import { createSlideTextSvg, renderSlideText } from "@/lib/explore/slideshow-text-client";
import { FormatSlideshowTextTools } from "./format-slideshow-text-tools";
import { RemixTextSection } from "./remix-text-section";
import textStyles from "./slideshow-editor.module.css";
import { MAX_SLIDESHOW_SLIDES, MIN_SLIDESHOW_SLIDES, moveSlideshowSlide, readSlideshowDraft, readSlideshowOutput, readSlideshowSaveRequest, sameSlideshowChoices,
  type SlideshowOutput, type SlideshowSaveRequest, type SlideshowSlideChoice } from "@/lib/explore/slideshow-draft";

type EditorSlide = SlideshowSlideChoice & { image: AIStudioImageResult | null; previous?: AIStudioImageResult; error?: string };
export type SlideshowEditorController = { useImage: (image: AIStudioImageResult, index?: number) => boolean; startNewSlide: () => void };

function imageFromAsset(asset: MediaAsset): AIStudioImageResult {
  if (!isExploreUuid(asset.id) || asset.collection !== "image" || asset.status !== "ready" || !asset.url.startsWith("https://")) throw new Error("This slide is unavailable. Remove it or choose another image.");
  return { ...(Object.hasOwn(asset.metadata ?? {}, "remixTextSource") ? { remixTextSource: readRemixSource(asset.metadata.remixTextSource) } : {}), id: asset.id, url: asset.url, title: asset.title, createdAt: asset.createdAt,
    aspectRatio: asset.ratio === "1:1" || asset.ratio === "9:16" || asset.ratio === "16:9" ? asset.ratio : "4:5" };
}
function choices(slides: readonly EditorSlide[]) { return slides.map(({ referenceSlideId, mediaAssetId }) => ({ referenceSlideId, mediaAssetId })); }
const hasText = (text: SlideTextDesign) => Boolean(text.heading.trim() || text.body.trim());
function readTextDraft(raw: string | null, activeIds: ReadonlySet<string>): Record<string, SlideTextDesign> {
  if (!raw || raw.length > 65536) return {};
  try { const parsed = JSON.parse(raw); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}; return Object.fromEntries(Object.entries(parsed).filter(([id]) => activeIds.has(id)).slice(0, MAX_SLIDESHOW_SLIDES).flatMap(([id, value]) => { try { return [[id, parseSlideText(value)]]; } catch { return []; } })); } catch { return {}; }
}

export function FormatSlideshowEditor({ reference, legacyReferences, previewImages, previewText, controllerRef, active, generationBusy, controlsTarget, resultsTarget, actionsTarget, localPreview, savingEnabled, onDirty, onSaved, onContinue, onRegenerate, onBackToPreview, onGoToCreate, onBusyChange }: {
  reference: RecreateReference | null; legacyReferences?: readonly RecreateReference[]; controllerRef: Ref<SlideshowEditorController>; slideIndex?: number; active: boolean; generationBusy: boolean;
  controlsTarget: HTMLElement | null; resultsTarget: HTMLElement | null; actionsTarget?: HTMLElement | null; localPreview: boolean; savingEnabled: boolean;
  onDirty: () => void; onSaved: (output: SlideshowOutput) => void; onContinue: () => void; onRegenerate: (index: number, image: AIStudioImageResult) => void;
  onBackToPreview?: () => void; onGoToCreate?: () => void; onBusyChange?: (busy: boolean) => void;
  previewImages?: AIStudioImageResult[]; previewText?: ReferenceText | null;
}) {
  const { user } = useAuth();
  const owner = user?.uid ?? null;
  const draftKey = `ugc-explore:slideshow-draft:v2:${owner}`;
  const saveKey = `${draftKey}:save`;
  const [slides, setSlides] = useState<EditorSlide[]>(() => localPreview ? (previewImages ?? []).slice(0, 10).map((image, index) => ({ referenceSlideId: reference?.slides[index]?.id ?? `preview-${index}`, mediaAssetId: image.id, image })) : []);
  const slideRef = useRef<EditorSlide[]>(slides);
  const [text, setText] = useState<Record<string, SlideTextDesign>>(() => {
    if (typeof window === "undefined" || localPreview || !owner) return {};
    try {
      const saved = readSlideshowSaveRequest(localStorage.getItem(saveKey), owner);
      const draft = readSlideshowDraft(localStorage.getItem(draftKey), owner);
      const sequence = saved && !saved.output ? saved.sourceSlides ?? saved.slides : draft?.slides ?? saved?.sourceSlides ?? saved?.slides ?? [];
      return readTextDraft(localStorage.getItem(`${draftKey}:text`), new Set(sequence.map(slide => slide.referenceSlideId)));
    } catch { return {}; }
  });
  const renderedText = useRef<Record<string, { signature: string; id: string }>>({});
  const [dimensions, setDimensions] = useState({ url: "", width: 1080, height: 1350 });
  const [previewIndex, setPreviewIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(!localPreview);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<SlideshowOutput | null>(null);
  const [pending, setPending] = useState<SlideshowSaveRequest | null>(null);
  const [legacyPreview, setLegacyPreview] = useState<string[]>([]);
  const alive = useRef(true);
  const working = useRef(false);
  const revision = useRef(0);
  const replacementTarget = useRef<string | null>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const legacyRestoreAttempted = useRef(false);
  const locked = busy || Boolean(pending) || uploading || restoring;
  const legacyGuide = useCallback((saved: SlideshowSaveRequest) => {
    const guide = reference?.id === saved.referenceId ? reference : legacyReferences?.find(item => item.id === saved.referenceId);
    const uploaded = saved.referenceId?.startsWith("uploaded:") && isExploreUuid(saved.referenceId.slice(9));
    if (!uploaded && (!guide || guide.format !== "slideshow" || saved.slides.some(slide => !guide.slides.some(original => original.id === slide.referenceSlideId)))) throw new Error("The previous slideshow reference is unavailable. Review its saved item in Library before scheduling.");
    return guide;
  }, [reference, legacyReferences]);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { onBusyChange?.(locked); }, [locked, onBusyChange]);
  const persist = useCallback((next: EditorSlide[]) => {
    slideRef.current = next; setSlides(next);
    if (owner && !localPreview) {
      try { localStorage.setItem(draftKey, JSON.stringify({ version: 2, owner, slides: choices(next) })); }
      catch { setError("Your slide choices are kept in this tab. Browser storage could not save the draft."); }
    }
  }, [draftKey, owner, localPreview]);
  const change = useCallback((next: EditorSlide[], index = 0) => {
    revision.current += 1; persist(next); setLegacyPreview([]); setPreviewIndex(Math.max(0, Math.min(index, next.length - 1))); setOutput(null); onDirty();
    const activeIds = new Set(next.map(slide => slide.referenceSlideId));
    const activeText = Object.fromEntries(Object.entries(text).filter(([id]) => activeIds.has(id)));
    if (Object.keys(activeText).length !== Object.keys(text).length) {
      setText(activeText);
      if (owner && !localPreview) try { localStorage.setItem(`${draftKey}:text`, JSON.stringify(activeText)); } catch { /* The active edits remain in this tab. */ }
    }
  }, [persist, onDirty, text, owner, localPreview, draftKey]);
  const startNewSlide = useCallback(() => { replacementTarget.current = null; }, []);
  function editFingerprint(sequence: SlideshowSaveRequest["slides"]) { return JSON.stringify({ slides: sequence, text: sequence.map(slide => text[slide.referenceSlideId] ?? EMPTY_SLIDE_TEXT) }); }
  function matchesSaved(saved: SlideshowSaveRequest, sequence: SlideshowSaveRequest["slides"]) { return sameSlideshowChoices(saved.sourceSlides ?? saved.slides, sequence) && (!saved.editFingerprint || saved.editFingerprint === editFingerprint(sequence)); }
  useImperativeHandle(controllerRef, () => ({ startNewSlide, useImage(image, index) {
    if (locked || working.current) { setError("Finish or resume the current slideshow save before changing slides."); return false; }
    if (!isExploreUuid(image.id) || !image.url.startsWith("https://")) { setError("Choose a saved image from your account."); return false; }
    const current = slideRef.current;
    const target = index !== undefined && current[index] ? index : current.findIndex(slide => slide.referenceSlideId === replacementTarget.current);
    if (target < 0 && current.some(slide => slide.mediaAssetId === image.id)) { setPreviewIndex(current.findIndex(slide => slide.mediaAssetId === image.id)); setError(null); return true; }
    if (target < 0 && current.length >= MAX_SLIDESHOW_SLIDES) { setError("Your slideshow has 10 slides. Remove a slide or replace an existing slide to use this image."); return false; }
    const next = [...current];
    if (target >= 0) next[target] = { ...next[target], mediaAssetId: image.id, image, previous: next[target].image ?? undefined, error: undefined };
    else next.push({ referenceSlideId: crypto.randomUUID(), mediaAssetId: image.id, image });
    replacementTarget.current = null; setError(null); change(next, target >= 0 ? target : next.length - 1); return true;
  } }), [startNewSlide, locked, change]);

  async function loadChoices(sequence: SlideshowSaveRequest["slides"], token: string): Promise<EditorSlide[]> {
    const ids = [...new Set(sequence.flatMap(slide => slide.mediaAssetId ? [slide.mediaAssetId] : []))];
    const resolved = await Promise.allSettled(ids.map(async id => [id, imageFromAsset(await fetchAIStudioMediaAsset(id, token, { remixSource: true }))] as const));
    const images = new Map(resolved.flatMap(result => result.status === "fulfilled" ? [result.value] : []));
    return sequence.flatMap(slide => slide.mediaAssetId ? [{ referenceSlideId: slide.referenceSlideId, mediaAssetId: slide.mediaAssetId, image: images.get(slide.mediaAssetId) ?? null,
      ...(images.has(slide.mediaAssetId) ? {} : { error: "This slide is unavailable. Remove or replace it." }) }] : []);
  }
  async function verifyOutput(saved: SlideshowSaveRequest, token: string): Promise<SlideshowOutput> {
    if (!saved.output) throw new Error("No saved slideshow was found.");
    const response = await fetch("/api/library?type=carousel&projectId=explore", { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json() as { ok?: boolean; items?: LibraryCarouselItemRecord[] };
    const item = data.items?.find(value => value.id === saved.output?.id && value.sourceId === `explore-slideshow:${saved.requestKey}` && value.projectId === "explore");
    const verified = item && item.slideCount === saved.slides.length && item.slides.every((slide, index) => slide.slideNumber === index + 1)
      ? readSlideshowOutput({ id: item.id, kind: "library_item", title: item.title, url: item.slides[0]?.renderedUrl, slides: item.slides.map(slide => slide.renderedUrl) }, saved.slides.length) : null;
    if (!response.ok || !data.ok || !verified) throw new Error("This saved slideshow is unavailable. Review your Library before scheduling.");
    return verified;
  }
  useEffect(() => {
    if (localPreview || !owner) return;
    let stopped = false;
    const restoredRevision = revision.current;
    const timer = setTimeout(() => { void (async () => {
      try {
        const rawSave = localStorage.getItem(saveKey);
        const saved = readSlideshowSaveRequest(rawSave, owner);
        if (rawSave && !saved) throw new Error("Could not verify the saved slideshow request. Review your Library before saving again.");
        const draft = readSlideshowDraft(localStorage.getItem(draftKey), owner);
        const sequence = saved && !saved.output ? saved.sourceSlides ?? saved.slides : draft?.slides ?? saved?.sourceSlides ?? saved?.slides ?? [];
        const restoreLegacy = saved?.version === 1 && saved.slides.some(slide => slide.mediaAssetId === null) && (!saved.output || !draft);
        if (!sequence.length) {
          if (draft && !stopped && alive.current && restoredRevision === revision.current) {
            setLegacyPreview([]); slideRef.current = []; setSlides([]); setOutput(null); onDirty();
          }
          return;
        }
        const token = await getCurrentUserIdToken(owner); if (!token) throw new Error("Sign in to restore your slides.");
        const loaded = await loadChoices(sequence, token);
        if (stopped || !alive.current || restoredRevision !== revision.current) return;
        if (saved && restoreLegacy) {
          const guide = legacyGuide(saved);
          setLegacyPreview(saved.slides.map(slide => loaded.find(value => value.referenceSlideId === slide.referenceSlideId)?.image?.url ?? (slide.mediaAssetId ? "" : guide?.slides.find(original => original.id === slide.referenceSlideId)?.url ?? "")));
          slideRef.current = []; setSlides([]);
        } else {
          setLegacyPreview([]);
          if (saved && !saved.output) persist(loaded);
          else { slideRef.current = loaded; setSlides(loaded); }
          if (!saved?.output || !matchesSaved(saved, sequence)) { setOutput(null); onDirty(); }
        }
        if (saved && !saved.output) { setPending(saved); setError("An interrupted save is ready to resume. Its exact slide choices are preserved."); }
        if (saved?.output && matchesSaved(saved, sequence)) {
          const verified = await verifyOutput(saved, token);
          if (!stopped && alive.current && restoredRevision === revision.current) { setOutput(verified); onSaved(verified); }
        }
      } catch (e) { if (!stopped && alive.current) setError(e instanceof Error ? e.message : "Could not restore your slides."); }
      finally { if (!stopped && alive.current) setRestoring(false); }
    })(); }, 0);
    return () => { stopped = true; clearTimeout(timer); };
    // Read the owner's complete sequence once. Choosing another guide never resets it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, saveKey, owner, localPreview, legacyReferences]);
  useEffect(() => {
    if (localPreview || !owner || !reference || legacyRestoreAttempted.current) return;
    let stopped = false;
    const timer = setTimeout(() => { void (async () => {
      if (revision.current || slideRef.current.length || localStorage.getItem(draftKey) || localStorage.getItem(saveKey)) return;
      const raw = localStorage.getItem(`ugc-explore:slideshow-draft:v1:${owner}:${reference.id}:save`);
      const oldDraftRaw = localStorage.getItem(`ugc-explore:slideshow-draft:v2:${owner}:${reference.id}`);
      if (!raw && !oldDraftRaw) return;
      legacyRestoreAttempted.current = true;
      setRestoring(true);
      try {
        let saved = readSlideshowSaveRequest(raw, owner);
        if (raw && (!saved || saved.version !== 1 || saved.referenceId !== reference.id)) throw new Error("Could not verify the previous slideshow request. Review Library before saving again.");
        const token = await getCurrentUserIdToken(owner); if (!token) throw new Error("Sign in to verify your previous slideshow.");
        // Main's older editor stored owned replacements and manual text under
        // the design guide. Move them into the owner sequence, preserving edits.
        let older: { order: string[]; replacements: Record<string, AIStudioImageResult>; text: Record<string, SlideTextDesign> } | null = null;
        if (oldDraftRaw && oldDraftRaw.length <= 131072) {
          const parsed = JSON.parse(oldDraftRaw);
          if (parsed && Array.isArray(parsed.order) && parsed.order.length <= 10 && new Set(parsed.order).size === parsed.order.length && parsed.replacements && typeof parsed.replacements === "object") {
            const order = parsed.order.filter((id: unknown) => typeof id === "string" && id.length <= 160 && isExploreUuid(parsed.replacements[id]?.id)) as string[];
            older = { order, replacements: parsed.replacements, text: readTextDraft(JSON.stringify(parsed.text ?? {}), new Set(order)) };
          }
        }
        if (older?.order.length && (!saved || saved.slides.every(slide => slide.mediaAssetId !== null))) {
          const original = older.order.map(id => ({ referenceSlideId: id, mediaAssetId: older!.replacements[id].id }));
          const loaded = await loadChoices(original, token);
          if (stopped || !alive.current || revision.current) return;
          setText(older.text); localStorage.setItem(`${draftKey}:text`, JSON.stringify(older.text)); persist(loaded); setLegacyPreview([]);
          if (saved) {
            const oldFingerprint = JSON.stringify({ order: older.order, images: older.order.map(id => older!.replacements[id]?.id ?? null), text: older.order.map(id => older!.text[id] ?? EMPTY_SLIDE_TEXT) });
            const sameOldDraft = !saved.editFingerprint || saved.editFingerprint === oldFingerprint;
            saved = { ...saved, ...(sameOldDraft ? { sourceSlides: original, editFingerprint: JSON.stringify({ slides: original, text: original.map(slide => older!.text[slide.referenceSlideId] ?? EMPTY_SLIDE_TEXT) }) } : {}) };
            if (!saved.output) { localStorage.setItem(saveKey, JSON.stringify(saved)); setPending(saved); setError("Resume your previous save to confirm its exact result."); }
            else if (sameOldDraft) { const verified = await verifyOutput(saved, token); if (!stopped && alive.current && !revision.current) { localStorage.setItem(saveKey, JSON.stringify(saved)); setOutput(verified); onSaved(verified); } }
          }
          return;
        }
        if (!saved) return;
        const guide = legacyGuide(saved);
        const loaded = await loadChoices(saved.slides, token);
        if (stopped || !alive.current || revision.current) return;
        if (saved.slides.every(slide => slide.mediaAssetId !== null)) { persist(loaded); setLegacyPreview([]); }
        else setLegacyPreview(saved.slides.map(slide => loaded.find(value => value.referenceSlideId === slide.referenceSlideId)?.image?.url ?? (slide.mediaAssetId ? "" : guide?.slides.find(original => original.id === slide.referenceSlideId)?.url ?? "")));
        if (!saved.output) { localStorage.setItem(saveKey, JSON.stringify(saved)); setPending(saved); setError("Resume your previous save to verify it. That earlier sequence includes reference slides."); }
        else { const verified = await verifyOutput(saved, token); if (!stopped && alive.current && !revision.current) { setOutput(verified); onSaved(verified); setError("This previously saved slideshow includes reference slides. New slideshows use only your generated or uploaded images."); } }
      } catch (e) { if (!stopped && alive.current) setError(e instanceof Error ? e.message : "Could not restore the previous save."); }
      finally { if (!stopped && alive.current) setRestoring(false); }
    })(); }, 0);
    return () => { stopped = true; clearTimeout(timer); };
    // Legacy receipts remain explicit recovery, never automatic new reference slides.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference?.id, owner, localPreview, draftKey, saveKey]);

  async function upload(files: File[], replace: boolean) {
    if (!owner || localPreview || locked || generationBusy || working.current || !files.length) return;
    const current = slideRef.current;
    const targetKey = replace ? current[previewIndex]?.referenceSlideId : null;
    if (replace && (!targetKey || files.length !== 1) || !replace && current.length + files.length > MAX_SLIDESHOW_SLIDES) { setError("A slideshow can contain up to 10 images. Replace one image or choose fewer files."); return; }
    if (files.some(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size <= 0 || file.size > 25 * 1024 * 1024)) { setError("Choose JPG, PNG or WebP images, up to 25 MB each."); return; }
    working.current = true; setUploading(true); setError(null); setOutput(null); onDirty();
    const selectedRevision = revision.current;
    try {
      const settled = await Promise.allSettled(files.map(async file => imageFromAsset((await uploadAIStudioReferenceMedia(file, "image", 3, owner, { purpose: "explore-slides" })).asset)));
      if (!alive.current || revision.current !== selectedRevision) return;
      const images = settled.flatMap(value => value.status === "fulfilled" ? [value.value] : []);
      const next = [...slideRef.current];
      if (replace && images[0]) { const index = next.findIndex(slide => slide.referenceSlideId === targetKey); if (index >= 0) next[index] = { ...next[index], mediaAssetId: images[0].id, image: images[0], previous: next[index].image ?? undefined, error: undefined }; }
      else for (const image of images) next.push({ referenceSlideId: crypto.randomUUID(), mediaAssetId: image.id, image });
      if (images.length) change(next, replace ? previewIndex : current.length);
      const failed = settled.find(value => value.status === "rejected");
      if (failed?.status === "rejected") setError(`${images.length ? `${images.length} image${images.length === 1 ? "" : "s"} added. ` : ""}${failed.reason instanceof Error ? failed.reason.message : "Some images could not be uploaded. Try them again."}`);
    } finally { working.current = false; if (alive.current) setUploading(false); }
  }
  async function save() {
    if (!owner || localPreview || !savingEnabled || working.current || restoring || uploading || generationBusy) return;
    if (!pending && (slides.length < MIN_SLIDESHOW_SLIDES || slides.length > MAX_SLIDESHOW_SLIDES || slides.some(slide => !slide.image))) return;
    working.current = true; setBusy(true); setError(null);
    try {
      if (!navigator.locks) throw new Error("Use a browser with Web Locks to save safely across tabs.");
      await navigator.locks.request(saveKey, { ifAvailable: true }, async lock => {
        if (!lock) throw new Error("Another tab is saving this slideshow. Resume after it finishes.");
        const raw = localStorage.getItem(saveKey), prior = readSlideshowSaveRequest(raw, owner);
        if (raw && !prior) throw new Error("Could not verify the saved request. Review Library before saving again.");
        const current = choices(slideRef.current);
        const token = await getCurrentUserIdToken(owner); if (!token || !alive.current) throw new Error("Sign in to save your slideshow.");
        if (prior?.output && (prior.version === 1 && pending?.requestKey === prior.requestKey || matchesSaved(prior, current))) { const verified = await verifyOutput(prior, token); if (alive.current) { setPending(null); setOutput(verified); onSaved(verified); } return; }
        const resumedRequest = Boolean(prior && !prior.output);
        let saved: SlideshowSaveRequest;
        if (prior && !prior.output) saved = prior;
        else {
          const resolved = [];
          for (const slide of slideRef.current) {
            const design = text[slide.referenceSlideId] ?? EMPTY_SLIDE_TEXT;
            let mediaAssetId = slide.mediaAssetId;
            if (hasText(design)) {
              const signature = JSON.stringify({ source: mediaAssetId, text: design });
              if (renderedText.current[slide.referenceSlideId]?.signature === signature) mediaAssetId = renderedText.current[slide.referenceSlideId].id;
              else {
                const file = await renderSlideText(slide.image!.url, design, { referenceId: reference?.id ?? "owned", slideId: slide.referenceSlideId, mediaAssetId, ownerId: owner, preview: false });
                if (!alive.current) return;
                const uploaded = await uploadAIStudioReferenceMedia(file, "image", undefined, owner);
                if (!alive.current) return;
                mediaAssetId = uploaded.asset.id; renderedText.current[slide.referenceSlideId] = { signature, id: mediaAssetId };
              }
            }
            resolved.push({ referenceSlideId: slide.referenceSlideId, mediaAssetId });
          }
          saved = { version: 2, owner, requestKey: crypto.randomUUID(), referenceId: reference?.id ?? null, slides: resolved, sourceSlides: current, editFingerprint: editFingerprint(current) };
        }
        // Another tab's unfinished request wins until its exact outcome is known.
        if (saved.version === 1) {
          const guide = legacyGuide(saved), recovered = await loadChoices(saved.slides, token);
          if (!alive.current) return;
          setLegacyPreview(saved.slides.map(slide => recovered.find(value => value.referenceSlideId === slide.referenceSlideId)?.image?.url ?? (slide.mediaAssetId ? "" : guide?.slides.find(original => original.id === slide.referenceSlideId)?.url ?? "")));
          slideRef.current = []; setSlides([]); setPreviewIndex(0); setOutput(null); onDirty();
        } else if (!sameSlideshowChoices(saved.sourceSlides ?? saved.slides, current)) {
          const recovered = await loadChoices(saved.sourceSlides ?? saved.slides, token);
          if (!alive.current) return;
          persist(recovered); setPreviewIndex(0); setOutput(null); onDirty();
        }
        localStorage.setItem(saveKey, JSON.stringify(saved)); setPending(saved);
        const response = await fetch("/api/explore/slideshows", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Idempotency-Key": saved.requestKey }, body: JSON.stringify({ version: saved.version, requestKey: saved.requestKey, referenceId: saved.referenceId, slides: saved.slides }) });
        const data: unknown = await response.json();
        const result = readSlideshowOutput(data, saved.slides.length);
        if (!response.ok || !data || typeof data !== "object" || !("ok" in data) || data.ok !== true || !result) {
          // A rejection proves only this attempt did not write. An older lost
          // acknowledgement may have committed, so retain the same identity.
          if (alive.current && !resumedRequest && data && typeof data === "object" && "outcome" in data && data.outcome === "rejected") {
            if (prior) localStorage.setItem(saveKey, JSON.stringify(prior)); else localStorage.removeItem(saveKey);
            setPending(null);
          }
          throw new Error(data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "Could not confirm your save. Resume the same request.");
        }
        if (!alive.current) return;
        localStorage.setItem(saveKey, JSON.stringify({ ...saved, output: result })); setPending(null); setOutput(result); onSaved(result);
      });
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "Could not save the slideshow."); }
    finally { working.current = false; if (alive.current) setBusy(false); }
  }
  function goToCreate() { startNewSlide(); onGoToCreate?.(); }
  function continueToSchedule() {
    if (locked || working.current || generationBusy || !output) return;
    onContinue();
  }
  const selected = slides[Math.min(previewIndex, Math.max(0, slides.length - 1))];
  const slideSource = selected?.image?.remixTextSource !== undefined ? resolveRemixSource(selected.image.remixTextSource, legacyReferences ?? (reference ? [reference] : []), "slideshow") : { reference, slideId: reference?.slides.find(s => s.id === selected?.referenceSlideId)?.id ?? null };
  const design = selected ? text[selected.referenceSlideId] ?? EMPTY_SLIDE_TEXT : EMPTY_SLIDE_TEXT;
  const selectedUrl = selected?.image?.url ?? "";
  const overlay = useMemo(() => typeof document === "undefined" || !hasText(design) ? "" : createSlideTextSvg(design, dimensions.url === selectedUrl ? dimensions.width : 1080, dimensions.url === selectedUrl ? dimensions.height : 1350), [design, dimensions, selectedUrl]);
  function updateText(patch: Partial<SlideTextDesign>) {
    if (!selected || locked || generationBusy) return;
    const next = { ...text, [selected.referenceSlideId]: parseSlideText({ ...design, ...patch }) };
    revision.current += 1; setText(next); setOutput(null); setError(null); onDirty();
    if (owner && !localPreview) try { localStorage.setItem(`${draftKey}:text`, JSON.stringify(next)); } catch { /* Edits remain in this tab. */ }
  }
  const previewUrls = legacyPreview.length && !slides.length ? output?.slides ?? legacyPreview : slides.map(slide => slide.image?.url ?? null);
  const canSave = Boolean(pending) || slides.length >= MIN_SLIDESHOW_SLIDES && slides.every(slide => slide.image);
  const actions = <div className="space-y-2">
    {error ? <p role="alert" className="text-xs leading-5 text-destructive">{error}</p> : null}
    {output ? <Button type="button" size="lg" className="h-11 w-full rounded-xl font-semibold shadow-sm hover:shadow transition-all" disabled={locked || generationBusy} onClick={continueToSchedule}>Schedule slideshow</Button> : <Button type="button" size="lg" className="h-11 w-full rounded-xl font-semibold shadow-sm hover:shadow transition-all" disabled={!canSave || localPreview || !savingEnabled || busy || uploading || restoring || generationBusy} onClick={() => void save()}>{busy ? "Saving…" : pending ? "Resume save" : "Save slideshow"}</Button>}
    <p role="status" className="text-xs leading-5 text-muted">{restoring ? "Restoring your slides…" : uploading ? "Uploading your slide images…" : localPreview ? "Preview · uploads and saving disabled" : output ? "Your slideshow is saved in Library." : !savingEnabled ? "Slideshow saving is unavailable right now." : slides.length < 2 && !pending ? "Add at least two generated or uploaded images to save a slideshow." : "Save this sequence before scheduling."}</p>
  </div>;
  if (!active || !controlsTarget || !resultsTarget) return null;
  return <>{actionsTarget ? createPortal(actions, actionsTarget) : null}{createPortal(<div className={textStyles.inspector}>
    <header className={textStyles.inspectorHeading}><div><h2>{selected ? `Edit slide ${previewIndex + 1}` : "Edit your slides"}</h2><p>Text and appearance</p></div>{selected ? <span>{previewIndex + 1} / {slides.length}</span> : null}</header>
    <input ref={uploadInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" aria-label="Upload slideshow images" onChange={event => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; void upload(files, false); }} />
    <input ref={replaceInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Replace slideshow image" onChange={event => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; void upload(files, true); }} />
    {selected ? <div className={textStyles.inspectorContent}>
      {selected.image ? <RemixTextSection key={`${owner}:${selected.referenceSlideId}`} owner={owner} targetKey={`slide:${selected.referenceSlideId}`} format="slideshow" reference={slideSource.reference} previewSource={previewText} defaultSlideId={slideSource.slideId} disabled={locked || generationBusy} localPreview={localPreview} onUse={output => updateText({ heading: output.heading, body: output.body })}><FormatSlideshowTextTools design={design} disabled={locked || generationBusy} onChange={updateText} /></RemixTextSection> : null}
      {selected.error ? <p role="alert" className="text-xs text-destructive">{selected.error}</p> : null}
      <details className={textStyles.disclosure}><summary>Slide image<span>Replace or recreate</span></summary><div className={textStyles.imageActions}>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={locked || generationBusy || !selected.image} onClick={() => { replacementTarget.current = selected.referenceSlideId; onRegenerate(previewIndex, selected.image!); }}>Recreate slide {previewIndex + 1}</Button><Button type="button" variant="outline" disabled={locked || generationBusy || localPreview || !owner} onClick={() => replaceInput.current?.click()}>Replace image</Button></div>
      {selected.previous ? <Button type="button" variant="ghost" disabled={locked || generationBusy} onClick={() => { const next = [...slideRef.current]; const previous = selected.previous!; next[previewIndex] = { ...selected, mediaAssetId: previous.id, image: previous, previous: undefined }; change(next, previewIndex); }}>Restore previous image</Button> : null}
      <p>Text already inside an image is part of that image. Recreate or replace the image to change it.</p>
      </div></details>
    </div> : <div className={textStyles.emptyInspector}><p>Add images, then select a slide to edit its text.</p>{onGoToCreate ? <Button type="button" variant="outline" onClick={goToCreate}>Go to Create</Button> : null}</div>}
    {!actionsTarget ? actions : null}
  </div>, controlsTarget)}{createPortal(<section aria-label="Slideshow edit preview" className={textStyles.editorPreview}>
    <header className={textStyles.previewHeading}><div><h2>Your slideshow</h2><p>{previewUrls.length ? `${previewUrls.length} slides · Select a slide to edit` : "Build your slide sequence"}</p></div>{onBackToPreview ? <Button type="button" variant="outline" onClick={onBackToPreview}><ArrowLeft aria-hidden="true" />Back to preview</Button> : null}</header>
    <div className={textStyles.previewCanvas}>
    {previewUrls.length ? <>{previewUrls[Math.min(previewIndex, previewUrls.length - 1)] ? <div className={textStyles.preview}>
      <img key={previewUrls[Math.min(previewIndex, previewUrls.length - 1)]} src={previewUrls[Math.min(previewIndex, previewUrls.length - 1)]!} alt={`Slide ${previewIndex + 1} of ${previewUrls.length}`} width={dimensions.url === selectedUrl ? dimensions.width : 1080} height={dimensions.url === selectedUrl ? dimensions.height : 1350} onLoad={event => {
        const image = event.currentTarget;
        if (!image.naturalWidth || !image.naturalHeight) return;
        const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
        setDimensions({ url: selectedUrl, width: Math.round(image.naturalWidth * scale), height: Math.round(image.naturalHeight * scale) });
      }} />
      {selected?.image && overlay ? <img data-slide-text-overlay src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(overlay)}`} alt={[design.heading, design.body].filter(value => value.trim()).join("\n")} width={dimensions.url === selectedUrl ? dimensions.width : 1080} height={dimensions.url === selectedUrl ? dimensions.height : 1350} className={textStyles.overlay} /> : null}
    </div> : <p className="text-sm text-destructive">This image is unavailable. Replace it or remove this slide.</p>}<div className={textStyles.previewNavigation}><Button type="button" variant="ghost" disabled={previewIndex === 0} onClick={() => setPreviewIndex(index => index - 1)}><ArrowLeft aria-hidden="true" />Previous</Button><span>{previewIndex + 1} / {previewUrls.length}</span><Button type="button" variant="ghost" disabled={previewIndex >= previewUrls.length - 1} onClick={() => setPreviewIndex(index => index + 1)}>Next<ArrowRight aria-hidden="true" /></Button></div></> : <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center"><h3 className="text-lg font-semibold">{restoring ? "Restoring your slides…" : "Your slides will appear here"}</h3><p className="max-w-md text-sm leading-6 text-muted">Generate your own images in Create or upload finished slide images. Then arrange them here before scheduling.</p></div>}
    </div>
    <section className={textStyles.sequence} aria-label="Slide sequence">
      <div className={textStyles.sequenceHeading}><div><h3>Your slides</h3><span>{slides.length} / 10</span></div><div><Button type="button" variant="outline" disabled={locked || generationBusy || slides.length >= 10} onClick={goToCreate}><Plus aria-hidden="true" />Add slide</Button><Button type="button" variant="outline" disabled={locked || generationBusy || localPreview || !owner || slides.length >= 10} onClick={() => uploadInput.current?.click()}><Upload aria-hidden="true" />Upload slides</Button></div></div>
      {slides.length ? <div role="group" aria-label="Choose a slide" className={textStyles.filmstrip}>{slides.map((slide, index) => <button key={slide.referenceSlideId} type="button" aria-label={`Preview slide ${index + 1}`} aria-pressed={previewIndex === index} onClick={() => setPreviewIndex(index)} className={textStyles.thumbnail}>{slide.image ? <img src={slide.image.url} alt="" width={1080} height={1350} /> : <span className={textStyles.unavailable}>Unavailable</span>}<span>{index + 1}</span></button>)}</div> : <p>Generate or upload your own slide images to begin.</p>}
      {selected ? <div className={textStyles.arrangement}><p>Slide {previewIndex + 1} of {slides.length}</p><div><Button type="button" variant="ghost" aria-label={`Move slide ${previewIndex + 1} earlier`} disabled={locked || generationBusy || previewIndex === 0} onClick={() => change(moveSlideshowSlide(slideRef.current, previewIndex, previewIndex - 1), previewIndex - 1)}><ArrowLeft aria-hidden="true" />Earlier</Button><Button type="button" variant="ghost" aria-label={`Move slide ${previewIndex + 1} later`} disabled={locked || generationBusy || previewIndex >= slides.length - 1} onClick={() => change(moveSlideshowSlide(slideRef.current, previewIndex, previewIndex + 1), previewIndex + 1)}><ArrowRight aria-hidden="true" />Later</Button><Button type="button" variant="ghost" onClick={() => { if (replacementTarget.current === selected.referenceSlideId) startNewSlide(); change(slideRef.current.filter(slide => slide.referenceSlideId !== selected.referenceSlideId), previewIndex); }} disabled={locked || generationBusy}>Remove slide</Button></div></div> : null}
    </section>
  </section>, resultsTarget)}</>;
}
