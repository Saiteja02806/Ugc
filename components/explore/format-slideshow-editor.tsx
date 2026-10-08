"use client";

/* eslint-disable @next/next/no-img-element */
import { cloneElement, isValidElement, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import type { AIStudioImageResult } from "@/lib/ai-studio/media-results";
import { uploadAIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import type { RecreateReference } from "@/lib/explore/recreate-types";
import { EMPTY_SLIDE_TEXT, parseSlideText, type SlideTextDesign } from "@/lib/explore/slideshow-text";
import { createSlideTextSvg, renderSlideText } from "@/lib/explore/slideshow-text-client";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { isExploreUuid } from "@/worker/src/lib/explore-finishing-contract";
import type { LibraryCarouselItemRecord } from "@/lib/library/db";
import styles from "./slideshow-editor.module.css";
import creation from "./workflow-creation.module.css";

type Output = { id: string; kind: "library_item"; url: string; title: string; slides?: string[] };
type SavedRequest = { version: 1; owner: string; requestKey: string; referenceId: string; slides: { referenceSlideId: string; mediaAssetId: string | null }[]; editFingerprint?: string; output?: Output };
type RenderedSlide = { signature: string; id: string };
type Draft = { order: string[]; replacements: Record<string, AIStudioImageResult>; text: Record<string, SlideTextDesign> };
const hasText = (value: SlideTextDesign) => Boolean(value.heading.trim() || value.body.trim());
const fingerprint = (draft: Draft) => JSON.stringify({ order: draft.order, images: draft.order.map(id => draft.replacements[id]?.id ?? null), text: draft.order.map(id => draft.text[id] ?? EMPTY_SLIDE_TEXT) });

function restoreDraft(key: string, legacyKey: string, reference: RecreateReference | null): Draft & { rendered: Record<string, RenderedSlide> } {
  const fallback = { order: [] as string[], replacements: {}, text: {}, rendered: {} };
  if (typeof window === "undefined" || !reference) return fallback;
  try {
    const raw = localStorage.getItem(key), legacy = localStorage.getItem(legacyKey);
    if (raw && raw.length > 131_072 || !raw && legacy && legacy.length > 65_536) return fallback;
    const parsed = raw ? JSON.parse(raw) : { replacements: legacy ? JSON.parse(legacy) : {} };
    const ids = new Set(reference.slides.map(slide => slide.id));
    const replacements = Object.fromEntries(Object.entries(parsed.replacements ?? {}).filter(([id, image]) => { const value = image as AIStudioImageResult; return ids.has(id) && value && isExploreUuid(value.id) && typeof value.url === "string" && value.url.startsWith("https://"); })) as Draft["replacements"];
    // Reference pixels are generation inputs. Only generated replacements belong
    // in this editor, including when migrating an older reference-based draft.
    const previousOrder = Array.isArray(parsed.order) && new Set(parsed.order).size === parsed.order.length ? parsed.order as string[] : reference.slides.map(slide => slide.id);
    const order = previousOrder.filter(id => ids.has(id) && Boolean(replacements[id]));
    const text: Draft["text"] = {};
    for (const [id, value] of Object.entries(parsed.text ?? {})) { if (ids.has(id)) { try { text[id] = parseSlideText(value); } catch { /* Preserve the image when a design is invalid. */ } } }
    const rendered = Object.fromEntries(Object.entries(parsed.rendered ?? {}).filter(([id, value]) => ids.has(id) && value && isExploreUuid((value as RenderedSlide).id) && typeof (value as RenderedSlide).signature === "string")) as Record<string, RenderedSlide>;
    return { order, replacements, text, rendered };
  } catch { return fallback; }
}

export type SlideshowEditorController = { useImage: (image: AIStudioImageResult, index: number) => void };
export function FormatSlideshowEditor({ reference, controllerRef, slideIndex, active, generationBusy, controlsTarget, resultsTarget, actionsTarget, localPreview, savingEnabled, onDirty, onSaved, onContinue, onRegenerate }: {
  reference: RecreateReference | null; controllerRef: Ref<SlideshowEditorController>; slideIndex: number; active: boolean; generationBusy: boolean; controlsTarget: HTMLElement | null; resultsTarget: HTMLElement | null; localPreview: boolean; savingEnabled: boolean;
  onDirty: () => void; onSaved: (output: Output) => void; onContinue: () => void; onRegenerate: (index: number) => void; actionsTarget?: HTMLElement | null;
}) {
  const { user } = useAuth();
  const fieldId = useId();
  const legacyKey = `ugc-explore:slideshow-draft:v1:${user?.uid}:${reference?.id}`;
  const draftKey = `ugc-explore:slideshow-draft:v2:${user?.uid}:${reference?.id}`;
  // Keep the previous save key so interrupted requests from the old editor resume safely.
  const saveKey = `${legacyKey}:save`;
  const [draft, setDraft] = useState(() => restoreDraft(draftKey, legacyKey, reference));
  const rendered = useRef(draft.rendered);
  const [selection, setSelection] = useState({ id: reference?.slides[slideIndex]?.id, externalIndex: slideIndex });
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<Output | null>(null), [pending, setPending] = useState(false);
  const [dimensions, setDimensions] = useState({ url: "", width: 1080, height: 1350 });
  const alive = useRef(true), revision = useRef(0), working = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const selectedId = selection.externalIndex === slideIndex ? selection.id : reference?.slides[slideIndex]?.id;
  const previewIndex = Math.max(0, draft.order.indexOf(selectedId ?? ""));
  const selected = reference?.slides.find(slide => slide.id === draft.order[previewIndex]);
  const selectedUrl = selected ? draft.replacements[selected.id]?.url ?? "" : "";
  const design = selected ? draft.text[selected.id] ?? EMPTY_SLIDE_TEXT : EMPTY_SLIDE_TEXT;
  const previewWidth = dimensions.url === selectedUrl ? dimensions.width : selected?.width ?? 1080;
  const previewHeight = dimensions.url === selectedUrl ? dimensions.height : selected?.height ?? 1350;
  const overlay = useMemo(() => typeof document === "undefined" ? "" : createSlideTextSvg(design, previewWidth, previewHeight), [design, previewWidth, previewHeight]);
  const choose = (id: string) => setSelection({ id, externalIndex: slideIndex });
  const blocked = busy || pending || generationBusy;
  const persist = useCallback((next: Draft) => {
    if (localPreview) return;
    try { localStorage.setItem(draftKey, JSON.stringify({ ...next, rendered: rendered.current })); } catch { /* Changes remain in this session. */ }
  }, [draftKey, localPreview]);
  const change = useCallback((next: Draft) => {
    revision.current += 1; setDraft({ ...next, rendered: rendered.current }); persist(next); setOutput(null); setError(null); onDirty();
  }, [persist, onDirty]);
  useImperativeHandle(controllerRef, () => ({ useImage(image, index) {
    const slide = reference?.slides[index];
    if (!slide || pending || busy) return;
    const order = draft.order.includes(slide.id) ? draft.order : [...draft.order, slide.id];
    change({ ...draft, order, replacements: { ...draft.replacements, [slide.id]: image } });
    setSelection({ id: slide.id, externalIndex: index });
  } }), [reference, pending, busy, draft, change]);
  function readSaved(): SavedRequest | null {
    const raw = localStorage.getItem(saveKey); if (!raw) return null;
    if (raw.length > 65_536) throw new Error("The saved slideshow request is invalid.");
    const value = JSON.parse(raw) as SavedRequest, ids = new Set(reference?.slides.map(slide => slide.id));
    if (value.version !== 1 || value.owner !== user?.uid || value.referenceId !== reference?.id || !isExploreUuid(value.requestKey) || !Array.isArray(value.slides) || value.slides.length < 2 || value.slides.length > 10 || new Set(value.slides.map(slide => slide.referenceSlideId)).size !== value.slides.length || value.slides.some(slide => !ids.has(slide.referenceSlideId) || slide.mediaAssetId !== null && !isExploreUuid(slide.mediaAssetId)) || value.editFingerprint !== undefined && typeof value.editFingerprint !== "string") throw new Error("Could not verify the saved slideshow request.");
    // An old draft may contain a save of original references. Start a fresh
    // generated-image save instead of resuming that obsolete input sequence.
    if (value.slides.some(slide => slide.mediaAssetId === null || !draft.replacements[slide.referenceSlideId])) return null;
    return value;
  }
  function matches(saved: SavedRequest) {
    if (saved.editFingerprint) return saved.editFingerprint === fingerprint(draft);
    return draft.order.every(id => !hasText(draft.text[id] ?? EMPTY_SLIDE_TEXT)) && JSON.stringify(saved.slides) === JSON.stringify(draft.order.map(id => ({ referenceSlideId: id, mediaAssetId: draft.replacements[id]?.id ?? null })));
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
    if (!user || !reference || localPreview) return;
    let stopped = false;
    const restoredRevision = revision.current;
    const timer = setTimeout(() => { void (async () => {
      try {
        const saved = readSaved();
        if (saved?.output && isExploreUuid(saved.output.id) && saved.output.kind === "library_item" && matches(saved)) {
          const verified = await verifyOutput(saved);
          if (!stopped && alive.current && restoredRevision === revision.current) { setOutput(verified); onSaved(verified); }
        } else if (saved && !saved.output && !stopped && alive.current) { setPending(true); setError("An interrupted save is ready to resume. Its slide choices are preserved."); }
      } catch (e) { if (!stopped && alive.current) setError(e instanceof Error ? e.message : "Could not restore the slideshow."); }
    })(); }, 0);
    return () => { stopped = true; clearTimeout(timer); };
    // Restore this owner/reference once. Changes are saved only by the button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveKey]);
  async function save() {
    if (!user || !reference || localPreview || !savingEnabled || working.current || generationBusy || draft.order.length < 2 || draft.order.length > 10) return;
    working.current = true; setBusy(true); setError(null);
    try {
      if (!navigator.locks) throw new Error("Use a browser with Web Locks to save safely across tabs.");
      await navigator.locks.request(saveKey, { ifAvailable: true }, async lock => {
        if (!lock) throw new Error("Another tab is saving this slideshow. Resume after it finishes.");
        const prior = readSaved();
        if (prior?.output && matches(prior)) { const verified = await verifyOutput(prior); if (alive.current) { setOutput(verified); onSaved(verified); } return; }
        let saved = prior && !prior.output ? prior : null;
        if (!saved) {
          const slides: SavedRequest["slides"] = [];
          for (const id of draft.order) {
            if (!alive.current) return;
            const generated = draft.replacements[id];
            if (!generated) throw new Error("Generate your own images before saving the slideshow.");
            const source = generated.url, text = draft.text[id] ?? EMPTY_SLIDE_TEXT;
            let mediaAssetId = generated.id;
            if (hasText(text)) {
              const signature = JSON.stringify({ source, text });
              if (rendered.current[id]?.signature === signature) mediaAssetId = rendered.current[id].id;
              else {
                const file = await renderSlideText(source, text, { referenceId: reference.id, slideId: id, mediaAssetId, ownerId: user.uid, preview: false }); if (!alive.current) return;
                const upload = await uploadAIStudioReferenceMedia(file, "image", undefined, user.uid); if (!alive.current) return;
                mediaAssetId = upload.asset.id; rendered.current[id] = { signature, id: mediaAssetId }; persist(draft);
              }
            }
            slides.push({ referenceSlideId: id, mediaAssetId });
          }
          saved = { version: 1, owner: user.uid, requestKey: crypto.randomUUID(), referenceId: reference.id, slides, editFingerprint: fingerprint(draft) };
        }
        if (!alive.current) return;
        // Freeze resolved asset IDs before submitting; retries use this immutable request.
        localStorage.setItem(saveKey, JSON.stringify(saved)); setPending(true);
        const token = await getCurrentUserIdToken(user.uid); if (!token || !alive.current) throw new Error("Sign in to save your slideshow.");
        const response = await fetch("/api/explore/slideshows", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Idempotency-Key": saved.requestKey }, body: JSON.stringify({ requestKey: saved.requestKey, referenceId: saved.referenceId, slides: saved.slides }) });
        const data = await response.json() as Output & { ok?: boolean; error?: string };
        if (!response.ok || !data.ok || !isExploreUuid(data.id) || data.kind !== "library_item" || !Array.isArray(data.slides) || data.slides.length !== saved.slides.length || data.slides.some(url => typeof url !== "string" || !url.startsWith("https://"))) throw new Error(data.error ?? "Could not confirm your save. Resume the same request.");
        if (!alive.current) return;
        const next: Output = { id: data.id, kind: "library_item", title: data.title, url: data.url, slides: data.slides };
        localStorage.setItem(saveKey, JSON.stringify({ ...saved, output: next })); setPending(false);
        if (matches(saved)) { setOutput(next); onSaved(next); } else { setOutput(null); onDirty(); setError("The interrupted save is complete. Save your current edits before scheduling them."); }
      });
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "Could not save the slideshow."); }
    finally { working.current = false; if (alive.current) setBusy(false); }
  }
  async function download() {
    if (!selected || working.current) return;
    working.current = true; setBusy(true); setError(null);
    try {
      const file = await renderSlideText(selectedUrl, design, { referenceId: reference!.id, slideId: selected.id, mediaAssetId: draft.replacements[selected.id]?.id ?? null, ownerId: user?.uid ?? null, preview: localPreview }); if (!alive.current) return;
      const url = URL.createObjectURL(file), link = document.createElement("a");
      link.href = url; link.download = `slide-${previewIndex + 1}.png`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "Could not download the slide."); }
    finally { working.current = false; if (alive.current) setBusy(false); }
  }
  function updateText(patch: Partial<SlideTextDesign>) { if (selected && !blocked) change({ ...draft, text: { ...draft.text, [selected.id]: parseSlideText({ ...design, ...patch }) } }); }
  function move(direction: -1 | 1) {
    const target = previewIndex + direction; if (blocked || target < 0 || target >= draft.order.length) return;
    const order = [...draft.order]; [order[previewIndex], order[target]] = [order[target], order[previewIndex]]; change({ ...draft, order });
  }
  if (!active || !controlsTarget || !resultsTarget) return null;
  const actions = <div className="space-y-2">
    {error ? <p role="alert" className="text-xs leading-5 text-destructive">{error}</p> : null}
    {output ? <Button type="button" size="lg" className={creation.primaryAction} onClick={onContinue}>Continue to Schedule</Button> : <Button type="button" size="lg" className={creation.primaryAction} disabled={!reference || localPreview || !savingEnabled || busy || generationBusy || draft.order.length < 2 || draft.order.length > 10} onClick={() => void save()}>{busy ? "Working…" : pending ? "Resume save" : "Save slideshow"}</Button>}
    <p role="status" className="text-xs leading-5 text-muted">{draft.order.length < 2 ? "Add at least two generated images to save a slideshow." : localPreview ? "Preview · saving disabled" : output ? "Your slideshow is saved in Library." : !savingEnabled ? "Slideshow saving is unavailable right now." : "Save your final sequence before scheduling. No AI credits are used to save edits."}</p>
  </div>;
  const field = (label: string, children: ReactNode) => {
    const id = `${fieldId}-${label.replace(/[^a-z]/gi, "-")}`;
    return <div className={styles.field}><label htmlFor={id}>{label}</label>{isValidElement<{ id?: string }>(children) ? cloneElement(children, { id }) : children}</div>;
  };
  return <>{actionsTarget ? createPortal(actions, actionsTarget) : null}{createPortal(<div className="space-y-4">
    <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Your slides</h2><span className="text-xs text-muted">{draft.order.length} slides</span></div>
    {draft.order.length > 10 ? <p role="alert" className="text-xs leading-5 text-destructive">Choose up to 10 slides to save. Remove any slides you do not need.</p> : null}
    {draft.order.length ? <div className={styles.filmstrip}>{draft.order.map((id, index) => { const slide = reference!.slides.find(value => value.id === id)!; return <button key={id} type="button" aria-label={`Preview slide ${index + 1}`} aria-pressed={previewIndex === index} onClick={() => choose(id)} className={styles.thumbnail}><img src={draft.replacements[id]?.url} alt="" width={slide.width} height={slide.height} /><span>{index + 1}{hasText(draft.text[id] ?? EMPTY_SLIDE_TEXT) ? " · Edited" : ""}</span></button>; })}</div> : null}
    {selected ? <>
      <div className="flex items-center gap-2"><Button type="button" variant="outline" size="icon" aria-label="Move slide earlier" disabled={blocked || previewIndex === 0} onClick={() => move(-1)}><ArrowLeft className="size-4" /></Button><Button type="button" variant="outline" size="icon" aria-label="Move slide later" disabled={blocked || previewIndex === draft.order.length - 1} onClick={() => move(1)}><ArrowRight className="size-4" /></Button><Button type="button" variant="ghost" size="sm" disabled={blocked || draft.order.length <= 2} onClick={() => change({ ...draft, order: draft.order.filter(id => id !== selected.id) })}><Trash2 className="size-4" />Remove slide</Button></div>
      <div className="space-y-3" aria-label="Slide text tools">
        {field("Heading", <textarea rows={2} value={design.heading} maxLength={180} disabled={blocked} placeholder="Add a heading…" onChange={event => updateText({ heading: event.target.value })} />)}
        {field("Body text", <textarea rows={3} value={design.body} maxLength={600} disabled={blocked} placeholder="Add your message…" onChange={event => updateText({ body: event.target.value })} />)}
        <div className={styles.settings}>
          {field("Font", <select value={design.font} disabled={blocked} onChange={event => updateText({ font: event.target.value as SlideTextDesign["font"] })}><option value="sans">Sans serif</option><option value="serif">Serif</option><option value="mono">Monospace</option></select>)}
          {field("Text size", <select value={design.size} disabled={blocked} onChange={event => updateText({ size: Number(event.target.value) })}>{[28, 36, 48, 64, 80].map((size, index) => <option key={size} value={size}>{["Small", "Medium", "Large", "Extra large", "Display"][index]}</option>)}</select>)}
          {field("Alignment", <select value={design.align} disabled={blocked} onChange={event => updateText({ align: event.target.value as SlideTextDesign["align"] })}>{["left", "center", "right"].map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select>)}
          {field("Position", <select value={design.position} disabled={blocked} onChange={event => updateText({ position: event.target.value as SlideTextDesign["position"] })}>{["top", "middle", "bottom"].map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select>)}
          {field("Text color", <input type="color" value={design.color} disabled={blocked} onChange={event => updateText({ color: event.target.value })} />)}
          {field("Background shape", <select value={design.background} disabled={blocked} onChange={event => updateText({ background: event.target.value as SlideTextDesign["background"] })}><option value="none">None</option><option value="solid">Rectangle</option><option value="rounded">Rounded box</option><option value="pill">Pill</option></select>)}
          {design.background !== "none" ? <>{field("Background color", <input type="color" value={design.backgroundColor} disabled={blocked} onChange={event => updateText({ backgroundColor: event.target.value })} />)}{field(`Opacity · ${Math.round(design.opacity * 100)}%`, <input type="range" min={0} max={100} value={Math.round(design.opacity * 100)} disabled={blocked} onChange={event => updateText({ opacity: Number(event.target.value) / 100 })} />)}</> : null}
        </div>
        <p className="text-xs leading-5 text-muted">Text is added above the image. Text already inside the original image stays in place.</p>
        <Button type="button" variant="ghost" size="sm" disabled={blocked || !hasText(design)} onClick={() => updateText(EMPTY_SLIDE_TEXT)}>Clear added text</Button>
      </div>
      <details className="border-t border-border pt-3"><summary className="cursor-pointer text-xs font-medium">Image &amp; sequence options</summary><div className="mt-3 space-y-2"><Button type="button" variant="outline" disabled={blocked} onClick={() => onRegenerate(reference!.slides.findIndex(slide => slide.id === selected.id))} className="w-full">Generate another version</Button>{reference && reference.slides.some(slide => draft.replacements[slide.id] && !draft.order.includes(slide.id)) ? <Button type="button" variant="ghost" size="sm" disabled={blocked} onClick={() => change({ ...draft, order: [...draft.order, ...reference.slides.filter(slide => draft.replacements[slide.id] && !draft.order.includes(slide.id)).map(slide => slide.id)] })}>Restore removed slides</Button> : null}</div></details>
    </> : <div className="space-y-3"><p className="text-sm leading-6 text-muted">Generate images in Create, then choose Edit image in Your Slides. Your reference is used to guide generation.</p><Button type="button" variant="outline" size="sm" onClick={() => onRegenerate(slideIndex)}>Go to Create</Button></div>}
    {!actionsTarget ? actions : null}
  </div>, controlsTarget)}{createPortal(<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4">
    {selected ? <><div className={styles.preview}><img key={selectedUrl} src={selectedUrl} alt={`Slide ${previewIndex + 1} of ${draft.order.length}`} width={selected.width} height={selected.height} onLoad={event => { const image = event.currentTarget; setDimensions({ url: selectedUrl, width: image.naturalWidth, height: image.naturalHeight }); }} />{overlay ? <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(overlay)}`} alt="Added slide text preview" className={styles.overlay} /> : null}</div><div className="flex flex-wrap items-center justify-center gap-3"><Button type="button" variant="outline" size="sm" disabled={previewIndex === 0} onClick={() => choose(draft.order[previewIndex - 1])}>Previous</Button><span className="text-sm text-muted">{previewIndex + 1} / {draft.order.length}</span><Button type="button" variant="outline" size="sm" disabled={previewIndex >= draft.order.length - 1} onClick={() => choose(draft.order[previewIndex + 1])}>Next</Button><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void download()}><Download className="size-4" />Download slide</Button></div></> : <div className="space-y-2 text-center"><h2 className="text-lg font-semibold">Your generated slides will appear here</h2><p className="text-sm text-muted">Create your own images, then add text and arrange them here.</p></div>}
  </div>, resultsTarget)}</>;
}
