"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, GripVertical, Plus, Trash2 } from "lucide-react";
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
import { readSlideshowEditableDraft } from "@/lib/explore/slideshow-editable-draft";
import type { MediaAsset } from "@/lib/media/types";
import { EMPTY_SLIDE_TEXT, parseSlideText, type SlideTextDesign } from "@/lib/explore/slideshow-text";
import { createSlideTextSvg, renderSlideText } from "@/lib/explore/slideshow-text-client";
import { prepareSlideshowSequence } from "@/lib/explore/slideshow-preparation";
import { fitSlideshowUpload } from "@/lib/explore/slideshow-image-client";
import { FormatSlideshowTextTools } from "./format-slideshow-text-tools";
import { SlideshowAddSlides, type SlideshowSlideSource } from "./slideshow-add-slides";
import { useSlideshowSlideDrag } from "./use-slideshow-slide-drag";
import { insertReferenceSlides } from "@/lib/explore/slideshow-assembly";
import { withReadDeadline } from "@/lib/http/read-deadline";
import { RemixTextSection } from "./remix-text-section";
import { ImageLibraryPicker, type ImageLibraryChoice } from "@/components/media/image-library-picker";
import { sameBackgroundTargets } from "@/lib/media/image-library";
import { imagePickerThumbnailUrl } from "@/lib/media/image-picker";
import textStyles from "./slideshow-editor.module.css";
import { MAX_SLIDESHOW_SLIDES, MIN_SLIDESHOW_SLIDES, moveSlideshowSlide, readSlideshowDraft, readSlideshowOutput, readSlideshowSaveRequest, sameSlideshowChoices,
  type SlideshowOutput, type SlideshowSaveRequest, type SlideshowSlideChoice } from "@/lib/explore/slideshow-draft";

type EditorSlide = SlideshowSlideChoice & { image: AIStudioImageResult | null; previous?: AIStudioImageResult; error?: string };
export type SlideshowEditorController = { useImage: (image: AIStudioImageResult, index?: number, originalAssetId?: string) => boolean; useSlideshow: (images: AIStudioImageResult[], onlyIfEmpty?: boolean) => boolean; startNewSlide: () => void };

function imageFromAsset(asset: MediaAsset): AIStudioImageResult {
  if (!isExploreUuid(asset.id) || asset.collection !== "image" || asset.status !== "ready" || !asset.url.startsWith("https://")) throw new Error("This slide is unavailable. Remove it or choose another image.");
  return { ...(Object.hasOwn(asset.metadata ?? {}, "remixTextSource") ? { remixTextSource: readRemixSource(asset.metadata.remixTextSource) } : {}), id: asset.id, url: asset.url, title: asset.title, createdAt: asset.createdAt,
    aspectRatio: asset.ratio === "1:1" || asset.ratio === "9:16" || asset.ratio === "16:9" ? asset.ratio : "4:5" };
}
function choices(slides: readonly EditorSlide[]) { return slides.map(({ referenceSlideId, mediaAssetId }) => ({ referenceSlideId, mediaAssetId })); }
function LibrarySlideshowPreview({ asset, design }: { asset: MediaAsset; design: SlideTextDesign }) {
  const [loaded, setLoaded] = useState<{ url: string; width: number; height: number } | null>(null);
  const imageWidth = loaded?.url === asset.url ? loaded.width : asset.width ?? 1080;
  const imageHeight = loaded?.url === asset.url ? loaded.height : asset.height ?? 1350;
  const scale = Math.min(1, 2048 / Math.max(imageWidth, imageHeight));
  const width = Math.round(imageWidth * scale), height = Math.round(imageHeight * scale);
  const overlay = useMemo(() => typeof document === "undefined" || !hasText(design) ? "" : createSlideTextSvg(design, width, height), [design, width, height]);
  return <div className="relative overflow-hidden" data-library-slide-composition style={{ aspectRatio: `${width} / ${height}` }}><img src={asset.url} alt="Proposed slide background" width={width} height={height} className="block h-auto w-full" onLoad={event => { const image = event.currentTarget; if (image.naturalWidth && image.naturalHeight) setLoaded({ url: asset.url, width: image.naturalWidth, height: image.naturalHeight }); }} />{overlay ? <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(overlay)}`} alt={[design.heading, design.body].filter(Boolean).join("\n")} width={width} height={height} className="absolute inset-0 h-full w-full" /> : null}</div>;
}
const hasText = (text: SlideTextDesign) => Boolean(text.heading.trim() || text.body.trim());
function readTextDraft(raw: string | null, activeIds: ReadonlySet<string>): Record<string, SlideTextDesign> {
  if (!raw || raw.length > 65536) return {};
  try { const parsed = JSON.parse(raw); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}; return Object.fromEntries(Object.entries(parsed).filter(([id]) => activeIds.has(id)).slice(0, MAX_SLIDESHOW_SLIDES).flatMap(([id, value]) => { try { return [[id, parseSlideText(value)]]; } catch { return []; } })); } catch { return {}; }
}

export function FormatSlideshowEditor({ reference, legacyReferences, previewImages, previewText, controllerRef, active, previewActive = active, previewActions, onEdit, generationBusy, controlsTarget, resultsTarget, actionsTarget, localPreview, savingEnabled, onDirty, onSaved, onContinue, onRegenerate, onBackToPreview, onGoToCreate, onBusyChange, libraryItemId }: {
  reference: RecreateReference | null; legacyReferences?: readonly RecreateReference[]; controllerRef: Ref<SlideshowEditorController>; slideIndex?: number; active: boolean; generationBusy: boolean;
  controlsTarget: HTMLElement | null; resultsTarget: HTMLElement | null; actionsTarget?: HTMLElement | null; localPreview: boolean; savingEnabled: boolean;
  previewActive?: boolean; previewActions?: ReactNode; onEdit?: () => void;
  onDirty: () => void; onSaved: (output: SlideshowOutput) => void; onContinue: () => void; onRegenerate: (index: number, image: AIStudioImageResult) => void;
  onBackToPreview?: () => void; onGoToCreate?: () => void; onBusyChange?: (busy: boolean) => void;
  previewImages?: AIStudioImageResult[]; previewText?: ReferenceText | null;
  libraryItemId?: string | null;
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
  const [saveProgress, setSaveProgress] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(!localPreview);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<SlideshowOutput | null>(null);
  const [pending, setPending] = useState<SlideshowSaveRequest | null>(null);
  const [draftHistory, setDraftHistory] = useState<Array<{ id: string; savedAt: string; slides: SlideshowSlideChoice[]; text: Record<string, SlideTextDesign> }>>([]);
  const [legacyPreview, setLegacyPreview] = useState<string[]>([]);
  const [addSlidesOpen, setAddSlidesOpen] = useState(false);
  const [libraryTarget, setLibraryTarget] = useState<{ mode: "add" | "background"; ids: string[]; images: string[]; selected?: string; draft: string } | null>(null);
  const alive = useRef(true);
  const working = useRef(false);
  const revision = useRef(0);
  const replacementTarget = useRef<string | null>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const legacyRestoreAttempted = useRef(false);
  const openedLibraryItem = useRef<string | null>(null);
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
  function openLibrary(mode: "add" | "background") {
    if (locked || generationBusy || working.current || localPreview || !owner) return;
    setAddSlidesOpen(false);
    setLibraryTarget({ mode, ids: slideRef.current.map(slide => slide.referenceSlideId), images: slideRef.current.map(slide => slide.mediaAssetId), selected: slideRef.current[previewIndex]?.referenceSlideId, draft: draftKey });
  }
  async function applyLibrary(choice: ImageLibraryChoice) {
    const current = slideRef.current;
    if (!libraryTarget || libraryTarget.draft !== draftKey || !sameBackgroundTargets(current.map(slide => slide.referenceSlideId), libraryTarget.ids) || !sameBackgroundTargets(current.map(slide => slide.mediaAssetId), libraryTarget.images)) {
      throw new Error("Your slideshow changed. Reopen the library before applying images.");
    }
    const images = new Map(choice.assets.map(asset => [asset.id, imageFromAsset(asset)]));
    let next: EditorSlide[];
    if (libraryTarget.mode === "add") {
      if (current.length + choice.assets.length > MAX_SLIDESHOW_SLIDES) throw new Error("Choose fewer images to stay within 10 slides.");
      next = [...current, ...choice.assets.map(asset => ({ referenceSlideId: crypto.randomUUID(), mediaAssetId: asset.id, image: images.get(asset.id)! }))];
    } else {
      const assignments = new Map(choice.assignments.map(item => [item.slideId, item.assetId]));
      next = current.map(slide => {
        const image = images.get(assignments.get(slide.referenceSlideId) ?? "");
        return image ? { ...slide, mediaAssetId: image.id, image, previous: slide.image ?? undefined, error: undefined } : slide;
      });
    }
    change(next, previewIndex); setError(null);
  }
  const moveSlide = useCallback((fromId: string, toId?: string) => {
    if (locked || generationBusy || working.current) return;
    const current = slideRef.current, from = current.findIndex(slide => slide.referenceSlideId === fromId), to = current.findIndex(slide => slide.referenceSlideId === toId);
    if (from < 0 || to < 0 || from === to) return;
    const selectedId = current[previewIndex]?.referenceSlideId;
    const next = moveSlideshowSlide(current, from, to);
    change(next, next.findIndex(slide => slide.referenceSlideId === selectedId));
  }, [locked, generationBusy, previewIndex, change]);
  function removeSlide(id: string) {
    if (locked || generationBusy || working.current) return;
    const current = slideRef.current, index = current.findIndex(slide => slide.referenceSlideId === id);
    if (index < 0) return;
    const selectedId = current[previewIndex]?.referenceSlideId;
    if (replacementTarget.current === id) startNewSlide();
    const next = current.filter(slide => slide.referenceSlideId !== id);
    change(next, selectedId === id ? index : next.findIndex(slide => slide.referenceSlideId === selectedId));
  }
  const slideIds = useMemo(() => slides.map(slide => slide.referenceSlideId), [slides]);
  const arrangementHelpId = useId();
  const slideDrag = useSlideshowSlideDrag({ ids: slideIds, disabled: locked || generationBusy || !previewActive, onMove: moveSlide });
  function editFingerprint(sequence: SlideshowSaveRequest["slides"]) { return JSON.stringify({ slides: sequence, text: sequence.map(slide => text[slide.referenceSlideId] ?? EMPTY_SLIDE_TEXT) }); }
  function matchesSaved(saved: SlideshowSaveRequest, sequence: SlideshowSaveRequest["slides"]) { return sameSlideshowChoices(saved.sourceSlides ?? saved.slides, sequence) && (saved.editFingerprint ? saved.editFingerprint === editFingerprint(sequence) : !sequence.some(slide => hasText(text[slide.referenceSlideId] ?? EMPTY_SLIDE_TEXT))); }
  const archiveDraft = useCallback(() => {
    if (!owner || localPreview || !slideRef.current.length) return;
    const entry = { id: crypto.randomUUID(), savedAt: new Date().toISOString(), slides: choices(slideRef.current), text };
    const next = [entry, ...draftHistory].slice(0, 20);
    localStorage.setItem(`${draftKey}:history`, JSON.stringify(next)); setDraftHistory(next);
  }, [owner, localPreview, draftHistory, draftKey, text]);
  useImperativeHandle(controllerRef, () => ({ startNewSlide, useSlideshow(images, onlyIfEmpty = false) {
    if (locked || working.current || onlyIfEmpty && slideRef.current.length) return false;
    if (!images.length || images.length > MAX_SLIDESHOW_SLIDES || new Set(images.map(image => image.id)).size !== images.length || images.some(image => !isExploreUuid(image.id) || !image.url.startsWith("https://"))) { setError("Choose a complete saved slideshow version from your account."); return false; }
    if (images.length === slideRef.current.length && images.every((image, index) => image.id === slideRef.current[index].mediaAssetId)) return true;
    try { archiveDraft(); } catch { setError("Could not preserve your current draft. Keep it open before switching versions."); return false; }
    const next = images.map(image => ({ referenceSlideId: crypto.randomUUID(), mediaAssetId: image.id, image }));
    replacementTarget.current = null; setError(null); change(next); setText({});
    if (owner && !localPreview) try { localStorage.removeItem(`${draftKey}:text`); } catch { /* The in-memory draft remains intact. */ }
    return true;
  }, useImage(image, index, originalAssetId) {
    if (locked || working.current) { setError("Finish or resume the current slideshow save before changing slides."); return false; }
    if (!isExploreUuid(image.id) || !image.url.startsWith("https://")) { setError("Choose a saved image from your account."); return false; }
    const current = slideRef.current;
    let target = index !== undefined && current[index] ? index : current.findIndex(slide => slide.referenceSlideId === replacementTarget.current);
    if (target < 0 && originalAssetId) {
      const matches = current.map((slide, position) => slide.mediaAssetId === originalAssetId ? position : -1).filter(position => position >= 0);
      if (matches.length !== 1) { setError("The original slide changed. Select the slide to replace in Edit slides and try again."); return false; }
      target = matches[0];
    }
    if (target < 0 && current.some(slide => slide.mediaAssetId === image.id)) { setPreviewIndex(current.findIndex(slide => slide.mediaAssetId === image.id)); setError(null); return true; }
    if (target < 0 && current.length >= MAX_SLIDESHOW_SLIDES) { setError("Your slideshow has 10 slides. Remove a slide or replace an existing slide to use this image."); return false; }
    const next = [...current];
    if (target >= 0) next[target] = { ...next[target], mediaAssetId: image.id, image, previous: next[target].image ?? undefined, error: undefined };
    else next.push({ referenceSlideId: crypto.randomUUID(), mediaAssetId: image.id, image });
    replacementTarget.current = null; setError(null); change(next, target >= 0 ? target : next.length - 1); return true;
  } }), [startNewSlide, locked, change, archiveDraft, owner, localPreview, draftKey]);

  async function addSelectedSlides(source: SlideshowSlideSource, ids: string[]) {
    if (!owner || localPreview || locked || generationBusy || working.current) throw new Error("Finish restoring, generating or saving before adding slides.");
    if (!ids.length || new Set(ids).size !== ids.length || ids.length + slideRef.current.length > MAX_SLIDESHOW_SLIDES) throw new Error("Choose images that fit the 10-slide limit.");
    const sourceReference = reference;
    if (source === "reference" && (!sourceReference || ids.some(id => !sourceReference.slides.some(slide => slide.id === id)))) throw new Error("Choose slides from the current reference.");
    const selectedRevision = revision.current;
    working.current = true; setUploading(true); setError(null);
    try {
      const token = await withReadDeadline(async () => {
        const value = await getCurrentUserIdToken(owner);
        if (!value) throw new Error("Sign in to add slides.");
        return value;
      });
      let assets: MediaAsset[];
      if (source === "reference" && !sourceReference!.id.startsWith("uploaded:")) {
        const response = await fetch("/api/explore/slideshows/reference-images", {
          method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ referenceId: sourceReference!.id, slideIds: ids }), signal: AbortSignal.timeout(45_000),
        });
        const data = await response.json() as { ok?: boolean; error?: string; assets?: MediaAsset[] };
        if (!response.ok || !data.ok || !Array.isArray(data.assets) || data.assets.length !== ids.length) throw new Error(data.error || "Could not add these originals. Try again; your existing slides are unchanged.");
        assets = data.assets;
      } else {
        assets = await withReadDeadline(signal => Promise.all(ids.map(id => fetchAIStudioMediaAsset(id, token, { signal, remixSource: true }))));
      }
      const images = [...new Map(assets.map(asset => { const image = imageFromAsset(asset); return [image.id, image] as const; })).values()];
      if (!alive.current || selectedRevision !== revision.current) throw new Error("Your slideshow changed. Open Add slides again to use these images.");
      const current = slideRef.current;
      const currentIds = new Set(current.map(slide => slide.mediaAssetId));
      const additions = images.filter(image => !currentIds.has(image.id)).map(image => ({ referenceSlideId: crypto.randomUUID(), mediaAssetId: image.id, image }));
      if (current.length + additions.length > MAX_SLIDESHOW_SLIDES) throw new Error("Your slideshow has changed. Choose fewer images to stay within 10 slides.");
      const position = (slide: EditorSlide) => {
        const index = sourceReference?.slides.findIndex(original => original.id === slide.mediaAssetId || original.url === slide.image?.url || original.url === slide.image?.remixTextSource?.sourceUrl) ?? -1;
        return index >= 0 ? index : null;
      };
      const next = source === "reference" ? insertReferenceSlides<EditorSlide>(current, additions, position) : [...current, ...additions];
      replacementTarget.current = null;
      if (additions.length) change(next, next.findIndex(slide => slide.referenceSlideId === additions[0].referenceSlideId));
    } finally { working.current = false; if (alive.current) setUploading(false); }
  }

  async function restoreEarlierDraft(id: string) {
    const entry = draftHistory.find(entry => entry.id === id);
    if (!entry || locked || generationBusy || !owner) return;
    setUploading(true); working.current = true;
    try {
      const token = await getCurrentUserIdToken(owner); if (!token) throw new Error("Sign in to reopen this draft.");
      const loaded = await loadChoices(entry.slides, token);
      if (!alive.current) return;
      archiveDraft(); change(loaded); setText(entry.text); setError(null);
      localStorage.setItem(`${draftKey}:text`, JSON.stringify(entry.text));
    } catch (error) { if (alive.current) setError(error instanceof Error ? error.message : "Could not reopen this draft."); }
    finally { working.current = false; if (alive.current) setUploading(false); }
  }

  async function loadChoices(sequence: SlideshowSaveRequest["slides"], token: string): Promise<EditorSlide[]> {
    const ids = [...new Set(sequence.flatMap(slide => slide.mediaAssetId ? [slide.mediaAssetId] : []))];
    const resolved = await Promise.allSettled(ids.map(async id => [id, imageFromAsset(await fetchAIStudioMediaAsset(id, token, { remixSource: true }))] as const));
    const images = new Map(resolved.flatMap(result => result.status === "fulfilled" ? [result.value] : []));
    return sequence.flatMap(slide => slide.mediaAssetId ? [{ referenceSlideId: slide.referenceSlideId, mediaAssetId: slide.mediaAssetId, image: images.get(slide.mediaAssetId) ?? null,
      ...(images.has(slide.mediaAssetId) ? {} : { error: "This slide is unavailable. Remove or replace it." }) }] : []);
  }
  async function verifyOutput(saved: SlideshowSaveRequest, token: string): Promise<SlideshowOutput> {
    if (!saved.output) throw new Error("No saved slideshow was found.");
    const response = await fetch(`/api/library/carousels/${saved.output.id}`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json() as { ok?: boolean; item?: LibraryCarouselItemRecord };
    const item = data.item?.id === saved.output.id && data.item.sourceId === `explore-slideshow:${saved.requestKey}` && data.item.projectId === "explore" ? data.item : null;
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
        const historyRaw = localStorage.getItem(`${draftKey}:history`);
        let previousHistory: typeof draftHistory = [];
        try { if (historyRaw && historyRaw.length <= 1_500_000) {
          const history: unknown = JSON.parse(historyRaw);
          if (Array.isArray(history)) previousHistory = history.slice(0, 20).flatMap(value => {
            const parsed = readSlideshowDraft(JSON.stringify({ version: 2, owner, slides: value?.slides }), owner);
            return parsed && typeof value.id === "string" && typeof value.savedAt === "string" ? [{ id: value.id, savedAt: value.savedAt, slides: parsed.slides, text: readTextDraft(JSON.stringify(value.text), new Set(parsed.slides.map(slide => slide.referenceSlideId))) }] : [];
          });
        } } catch { /* An unreadable archive must not hide the active draft. */ }
        setDraftHistory(previousHistory);
        if (libraryItemId && openedLibraryItem.current !== `${owner}:${libraryItemId}`) {
          if (!isExploreUuid(libraryItemId)) throw new Error("Choose a valid saved slideshow.");
          if (saved && !saved.output) throw new Error("Resume your interrupted save before opening another slideshow.");
          const token = await getCurrentUserIdToken(owner); if (!token) throw new Error("Sign in to reopen this slideshow.");
          const response = await fetch(`/api/library/carousels/${libraryItemId}`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
          const data = await response.json() as { ok?: boolean; item?: LibraryCarouselItemRecord };
          const item = data.item;
          if (!response.ok || !data.ok || !item || item.id !== libraryItemId || item.projectId !== "explore" || !item.sourceId.startsWith("explore-slideshow:") || item.slideCount < 2 || item.slideCount > 10 || item.slides.length !== item.slideCount) throw new Error("This saved slideshow is unavailable.");
          const editable = readSlideshowEditableDraft(item.editorDraft);
          const sequence = editable?.slides.map(slide => ({ referenceSlideId: slide.referenceSlideId, mediaAssetId: slide.mediaAssetId })) ?? item.slides.map((slide, index) => ({ referenceSlideId: `library:${item.id}:${index + 1}`, mediaAssetId: slide.mediaAssetId ?? "" }));
          if (sequence.some(slide => !isExploreUuid(slide.mediaAssetId))) throw new Error("This older slideshow has no reusable source images. Open its images in Creative Assets to recreate it.");
          const loaded = await loadChoices(sequence, token);
          if (stopped || !alive.current || restoredRevision !== revision.current) return;
          if (draft?.slides.length) {
            const entries = previousHistory.slice(0, 19);
            const priorText = readTextDraft(localStorage.getItem(`${draftKey}:text`), new Set(draft.slides.map(slide => slide.referenceSlideId)));
            const entry = { id: crypto.randomUUID(), savedAt: new Date().toISOString(), slides: draft.slides, text: priorText };
            const next = [entry, ...entries]; localStorage.setItem(`${draftKey}:history`, JSON.stringify(next)); setDraftHistory(next);
          }
          const nextText = Object.fromEntries(editable?.slides.map(slide => [slide.referenceSlideId, slide.design]) ?? []);
          persist(loaded); setText(nextText); setPreviewIndex(0); setOutput(null); onDirty();
          localStorage.setItem(`${draftKey}:text`, JSON.stringify(nextText));
          openedLibraryItem.current = `${owner}:${libraryItemId}`;
          // The exact item link opens once; subsequent reload restores newer edits.
          if (typeof window !== "undefined" && window.location?.href) {
            const url = new URL(window.location.href); url.searchParams.delete("slideshowId");
            window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
          }
          if (!editable) setError("Reopened the saved images. Text already inside these older images cannot be edited separately.");
          return;
        }
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
  }, [draftKey, saveKey, owner, localPreview, legacyReferences, libraryItemId]);
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
        else { const verified = await verifyOutput(saved, token); if (!stopped && alive.current && !revision.current) { setOutput(verified); onSaved(verified); setError("This earlier slideshow includes original references. Use Add slides to choose original images for a new editable sequence."); } }
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
      const settled = await prepareSlideshowSequence(files, async file => {
        try {
          const fitted = await fitSlideshowUpload(file);
          if (!alive.current || revision.current !== selectedRevision) throw new Error("The slideshow changed while preparing this image.");
          return { status: "fulfilled" as const, value: imageFromAsset((await uploadAIStudioReferenceMedia(fitted, "image", 3, owner, { purpose: "explore-slides" })).asset) };
        } catch (reason) { return { status: "rejected" as const, reason }; }
      });
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
    working.current = true; setBusy(true); setError(null); setSaveProgress("Checking saved slideshow…");
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
          const snapshot = [...slideRef.current];
          const fingerprint = editFingerprint(current);
          const resolved = await prepareSlideshowSequence(snapshot, async slide => {
            if (!alive.current) throw new Error("Slideshow preparation was interrupted. Your edits are preserved.");
            const design = text[slide.referenceSlideId] ?? EMPTY_SLIDE_TEXT;
            let mediaAssetId = slide.mediaAssetId;
            if (hasText(design)) {
              const signature = JSON.stringify({ source: mediaAssetId, text: design });
              if (renderedText.current[slide.referenceSlideId]?.signature === signature) mediaAssetId = renderedText.current[slide.referenceSlideId].id;
              else {
                const file = await renderSlideText(slide.image!.url, design, { referenceId: reference?.id ?? "owned", slideId: slide.referenceSlideId, mediaAssetId, ownerId: owner, preview: false });
                if (!alive.current) throw new Error("Slideshow preparation was interrupted. Your edits are preserved.");
                const uploaded = await uploadAIStudioReferenceMedia(file, "image", undefined, owner);
                if (!alive.current) throw new Error("Slideshow preparation was interrupted. Your edits are preserved.");
                mediaAssetId = uploaded.asset.id; renderedText.current[slide.referenceSlideId] = { signature, id: mediaAssetId };
              }
            }
            return { referenceSlideId: slide.referenceSlideId, mediaAssetId };
          }, (completed, total) => { if (alive.current) setSaveProgress(`Preparing slides · ${completed} of ${total}`); });
          if (!alive.current) return;
          saved = { version: 2, owner, requestKey: crypto.randomUUID(), referenceId: reference?.id ?? null, slides: resolved, sourceSlides: current, editFingerprint: fingerprint, editorDraft: { version: 1, slides: snapshot.map(slide => ({ referenceSlideId: slide.referenceSlideId, mediaAssetId: slide.mediaAssetId, design: text[slide.referenceSlideId] ?? EMPTY_SLIDE_TEXT })) } };
        }
        // Another tab's unfinished request wins until its exact outcome is known.
        if (saved.version === 1) {
          const guide = legacyGuide(saved), recovered = await loadChoices(saved.slides, token);
          if (!alive.current) return;
          setLegacyPreview(saved.slides.map(slide => recovered.find(value => value.referenceSlideId === slide.referenceSlideId)?.image?.url ?? (slide.mediaAssetId ? "" : guide?.slides.find(original => original.id === slide.referenceSlideId)?.url ?? "")));
          slideRef.current = []; setSlides([]); setPreviewIndex(0); setOutput(null); onDirty();
        }
        localStorage.setItem(saveKey, JSON.stringify(saved)); setPending(saved);
        setSaveProgress(resumedRequest ? "Recovering saved slideshow…" : "Saving slideshow to Library…");
        const response = await fetch("/api/explore/slideshows", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Idempotency-Key": saved.requestKey }, body: JSON.stringify({ version: saved.version, requestKey: saved.requestKey, referenceId: saved.referenceId, slides: saved.slides, ...(saved.editorDraft ? { editorDraft: saved.editorDraft } : {}) }) });
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
        localStorage.setItem(saveKey, JSON.stringify({ ...saved, output: result })); setPending(null);
        if (saved.version === 2 && !matchesSaved(saved, current)) {
          setOutput(null); onDirty();
          setError("The earlier slideshow is saved in Library. Your newer edits are still unsaved. Save again to keep these edits.");
        } else { setOutput(result); onSaved(result); }
      });
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "Could not save the slideshow."); }
    finally { working.current = false; if (alive.current) { setBusy(false); setSaveProgress(null); } }
  }
  function goToCreate() { setAddSlidesOpen(false); startNewSlide(); onGoToCreate?.(); }
  const scheduleRevision = revision.current;
  function continueToSchedule() {
    if (locked || working.current || generationBusy || !output || scheduleRevision !== revision.current) return;
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
  const actions = <div className={textStyles.saveActions}>
    {error ? <p role="alert" className="text-xs leading-5 text-destructive">{error}</p> : null}
    {output ? <Button type="button" size="lg" className="h-10 rounded-lg px-4 font-semibold" disabled={locked || generationBusy} onClick={continueToSchedule}>Schedule slideshow</Button> : <Button type="button" size="lg" className="h-10 rounded-lg px-4 font-semibold" disabled={!canSave || localPreview || !savingEnabled || busy || uploading || restoring || generationBusy} onClick={() => void save()}>{busy ? "Saving…" : pending ? "Resume save" : "Save slideshow"}</Button>}
    <p role="status" className="text-xs leading-5 text-muted">{busy ? saveProgress ?? "Saving your slideshow…" : restoring ? "Restoring your slides…" : uploading ? "Uploading your slide images…" : localPreview ? "Preview · uploads and saving disabled" : output ? "Your slideshow is saved in Library." : !savingEnabled ? "Slideshow saving is unavailable right now." : slides.length < 2 && !pending ? "Add at least two generated or uploaded images to save a slideshow." : "Save this sequence before scheduling."}</p>
  </div>;
  if ((!active && !previewActive) || !resultsTarget) return null;
  return <>
    <input ref={uploadInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" aria-label="Upload slideshow images" onChange={event => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; void upload(files, false); }} />
    <input ref={replaceInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Replace slideshow image" onChange={event => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; void upload(files, true); }} />
    {libraryTarget && owner ? <ImageLibraryPicker key={`${owner}:${libraryTarget.draft}`} owner={owner} mode={libraryTarget.mode} slideIds={libraryTarget.ids} selectedSlideId={libraryTarget.selected} remaining={MAX_SLIDESHOW_SLIDES - slides.length} renderSlidePreview={(id, asset) => <LibrarySlideshowPreview key={`${id}:${asset.id}`} asset={asset} design={text[id] ?? EMPTY_SLIDE_TEXT} />} onClose={() => setLibraryTarget(null)} onApply={applyLibrary} onBusyChange={setUploading} /> : null}
    {addSlidesOpen ? <SlideshowAddSlides key={`${owner}:${reference?.id ?? "none"}`} owner={owner} reference={reference} existing={slides.flatMap(slide => slide.image ? [slide.image] : [])} slideCount={slides.length} disabled={locked || generationBusy} localPreview={localPreview} onClose={() => setAddSlidesOpen(false)} onAdd={addSelectedSlides} onUpload={() => { setAddSlidesOpen(false); uploadInput.current?.click(); }} onCreate={onGoToCreate ? goToCreate : undefined} onLibrary={() => openLibrary("add")} /> : null}{active && actionsTarget ? createPortal(actions, actionsTarget) : null}{active && controlsTarget ? createPortal(<div className={textStyles.inspector}>
    <header className={textStyles.inspectorHeading}><div><h2>{selected ? `Edit slide ${previewIndex + 1}` : "Edit your slides"}</h2><p>Text and appearance</p></div>{selected ? <span>{previewIndex + 1} / {slides.length}</span> : null}</header>
    {draftHistory.length ? <label className="mb-3 block text-xs text-muted">Earlier drafts on this device<select aria-label="Reopen earlier slideshow draft" className="mt-1 block h-9 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground" value="" disabled={locked || generationBusy} onChange={event => void restoreEarlierDraft(event.target.value)}><option value="">Choose a draft…</option>{draftHistory.map(entry => <option key={entry.id} value={entry.id}>{entry.slides.length} slides · {new Date(entry.savedAt).toLocaleString()}</option>)}</select></label> : null}
    {selected ? <div className={textStyles.inspectorContent}>
      {selected.image ? <RemixTextSection expanded={Boolean(slideSource.reference)} editorNavigation referenceFirst={Boolean(slideSource.reference)} key={`${owner}:${selected.referenceSlideId}`} owner={owner} targetKey={`slide:${selected.referenceSlideId}`} format="slideshow" reference={slideSource.reference} previewSource={previewText} defaultSlideId={slideSource.slideId} disabled={locked || generationBusy} localPreview={localPreview} onUse={output => updateText({ heading: output.heading, body: output.body })}><FormatSlideshowTextTools design={design} disabled={locked || generationBusy} onChange={updateText} /></RemixTextSection> : null}
      {selected.error ? <p role="alert" className="text-xs text-destructive">{selected.error}</p> : null}
      <details className={textStyles.disclosure}><summary>Slide image<span>Replace or recreate</span></summary><div className={textStyles.imageActions}>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={locked || generationBusy || !selected.image} onClick={() => { replacementTarget.current = selected.referenceSlideId; onRegenerate(previewIndex, selected.image!); }}>Recreate slide {previewIndex + 1}</Button><Button type="button" variant="outline" disabled={locked || generationBusy || localPreview || !owner} onClick={() => replaceInput.current?.click()}>Replace image</Button><Button type="button" variant="outline" disabled={locked || generationBusy || localPreview || !owner} onClick={() => openLibrary("background")}>Choose from library</Button></div>
      {selected.previous ? <Button type="button" variant="ghost" disabled={locked || generationBusy} onClick={() => { const next = [...slideRef.current]; const previous = selected.previous!; next[previewIndex] = { ...selected, mediaAssetId: previous.id, image: previous, previous: undefined }; change(next, previewIndex); }}>Restore previous image</Button> : null}
      <p>Uploads fit a 4:5 canvas automatically. The full image stays visible, with a blurred background where needed.</p>
      <p>Text already inside an image is part of that image. Recreate or replace the image to change it.</p>
      </div></details>
    </div> : <div className={textStyles.emptyInspector}><p>Use Add slides in your slideshow to choose images, then select a slide to edit its text.</p></div>}
    {!actionsTarget ? actions : null}
  </div>, controlsTarget) : null}{previewActive ? createPortal(<section aria-label="Slideshow edit preview" className={textStyles.editorPreview}>
    <header className={textStyles.previewHeading}><div><h2>Your slideshow</h2><p>{previewUrls.length ? `${previewUrls.length} slides · ${active ? "Select a slide to edit" : "Preview your current sequence"}` : "Build your slide sequence"}</p></div><div className="flex flex-wrap gap-2">{previewActions}{!active && onEdit ? <Button type="button" variant="outline" onClick={onEdit}>Edit slides</Button> : onBackToPreview ? <Button type="button" variant="outline" onClick={onBackToPreview}><ArrowLeft aria-hidden="true" />Back to Create</Button> : null}</div></header>
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
      <div className={textStyles.sequenceHeading}><div><h3>Your slides</h3><span>{slides.length} / 10</span></div><div><Button type="button" variant="outline" disabled={locked || generationBusy || localPreview || !owner || !slides.length} onClick={() => openLibrary("background")}>Library backgrounds</Button><Button type="button" variant="outline" disabled={locked || generationBusy || slides.length >= 10} onClick={() => { startNewSlide(); setAddSlidesOpen(true); }}><Plus aria-hidden="true" />Add slides</Button></div></div>
      {slides.length ? <><p id={arrangementHelpId}>Drag the handle to reorder slides. Use the bin to remove a slide.<span className="sr-only"> Reorder handles also support Left and Right arrow keys, Home and End.</span></p><div ref={slideDrag.railRef} role="group" aria-label="Choose a slide" data-reordering={Boolean(slideDrag.drag) || undefined} className={textStyles.filmstrip}>{slides.map((slide, index) => <div key={slide.referenceSlideId} data-slideshow-slide={slide.referenceSlideId} data-selected={previewIndex === index || undefined} data-dragging={slideDrag.drag?.id === slide.referenceSlideId || undefined} data-drop={slideDrag.drag?.target === index && slideDrag.drag.id !== slide.referenceSlideId ? (index < slides.findIndex(item => item.referenceSlideId === slideDrag.drag?.id) ? "before" : "after") : undefined} className={textStyles.thumbnail}>
        <button type="button" aria-label={`Preview slide ${index + 1}`} aria-pressed={previewIndex === index} onClick={() => setPreviewIndex(index)} className={textStyles.thumbnailPreview}>{slide.image ? <img src={imagePickerThumbnailUrl(slide.image.url)} alt="" draggable={false} width={1080} height={1350} loading="lazy" decoding="async" /> : <span className={textStyles.unavailable}>Unavailable</span>}<span>{index + 1}</span></button>
        <button type="button" aria-label={`Reorder slide ${index + 1}`} aria-describedby={arrangementHelpId} title="Drag to reorder · or use arrow keys" disabled={locked || generationBusy || slides.length < 2} className={textStyles.dragHandle} {...slideDrag.handleProps(slide.referenceSlideId)}><GripVertical aria-hidden="true" /></button>
        <button type="button" aria-label={`Remove slide ${index + 1}`} title={`Remove slide ${index + 1} from this slideshow`} disabled={locked || generationBusy} className={textStyles.deleteSlide} onClick={() => removeSlide(slide.referenceSlideId)}><Trash2 aria-hidden="true" /></button>
      </div>)}</div><span role="status" className="sr-only">{slideDrag.announcement}</span></> : <p>Choose generated images, original reference slides or uploads to begin.</p>}
      {selected ? <div className={textStyles.arrangement}><p>Slide {previewIndex + 1} of {slides.length}</p><div><Button type="button" variant="ghost" aria-label={`Move slide ${previewIndex + 1} earlier`} disabled={locked || generationBusy || previewIndex === 0} onClick={() => moveSlide(selected.referenceSlideId, slideRef.current[previewIndex - 1]?.referenceSlideId)}><ArrowLeft aria-hidden="true" />Earlier</Button><Button type="button" variant="ghost" aria-label={`Move slide ${previewIndex + 1} later`} disabled={locked || generationBusy || previewIndex >= slides.length - 1} onClick={() => moveSlide(selected.referenceSlideId, slideRef.current[previewIndex + 1]?.referenceSlideId)}><ArrowRight aria-hidden="true" />Later</Button><Button type="button" variant="ghost" onClick={() => removeSlide(selected.referenceSlideId)} disabled={locked || generationBusy}>Remove slide</Button></div></div> : null}
    </section>
    {!active ? <footer aria-label="Slideshow actions" className={textStyles.overviewActions}>{actions}</footer> : null}
  </section>, resultsTarget) : null}</>;
}
