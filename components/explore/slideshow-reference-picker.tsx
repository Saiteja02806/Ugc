"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { Check, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { readAIStudioReferenceMetadata, uploadAIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import type { RecreateReference } from "@/lib/explore/recreate-types";
import creation from "./workflow-creation.module.css";
import styles from "./format-workspace.module.css";
import pickerStyles from "./slideshow-reference-picker.module.css";

export function SlideshowReferencePicker({ reference, slideIndex, selectedSlideIds, disabled, localPreview, onPreview, onRemove, onUpload, onSelectionChange, onBusy }: {
  reference: RecreateReference | null; slideIndex: number; disabled: boolean; localPreview: boolean;
  selectedSlideIds: string[];
  onPreview: () => void; onRemove: () => void; onUpload: (reference: RecreateReference) => void; onSelectionChange: (ids: string[], previewIndex?: number) => void; onBusy: (busy: boolean) => void;
}) {
  const { user } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const working = useRef(false);
  const urls = useRef<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { alive.current = true; const ownedUrls = urls.current; return () => { alive.current = false; ownedUrls.forEach(url => URL.revokeObjectURL(url)); }; }, []);
  async function upload(files: File[]) {
    if (disabled || working.current) return;
    setError(null);
    if (files.length < 2 || files.length > 10 || files.some(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size === 0 || file.size > 25 * 1024 ** 2)) {
      setError("Choose 2–10 JPG, PNG or WebP slide images, up to 25 MB each."); return;
    }
    if (!localPreview && !user) { setError("Sign in to upload your slides."); return; }
    working.current = true; setBusy(true); onBusy(true);
    try {
      // Validate the complete selection before uploading any file. Never call a generator.
      const metadata = await Promise.all(files.map(async file => {
        const result = await readAIStudioReferenceMetadata(file, "image");
        if (!result.width || !result.height || result.width > 16_384 || result.height > 16_384) throw new Error("Use slide images up to 16,384 pixels on each side.");
        return { width: result.width, height: result.height };
      }));
      const slides: RecreateReference["slides"] = [];
      for (const [index, file] of files.entries()) {
        if (!alive.current) return;
        if (localPreview) {
          const url = URL.createObjectURL(file); urls.current.push(url);
          slides.push({ id: crypto.randomUUID(), url, width: metadata[index].width, height: metadata[index].height });
        } else {
          const uploaded = await uploadAIStudioReferenceMedia(file, "image", undefined, user!.uid);
          if (!alive.current) return;
          slides.push({ id: uploaded.asset.id, url: uploaded.asset.url, width: uploaded.asset.width ?? metadata[index].width, height: uploaded.asset.height ?? metadata[index].height });
        }
      }
      if (alive.current) {
        onBusy(false);
        onUpload({ id: `uploaded:${crypto.randomUUID()}`, format: "slideshow", title: "Your uploaded slideshow", category: null, categoryLabel: null, posterUrl: slides[0].url, slides });
      }
    } catch (error) { if (alive.current) setError(error instanceof Error ? error.message : "Could not upload your slideshow. Try again."); }
    finally { working.current = false; if (alive.current) { setBusy(false); onBusy(false); } }
  }
  return <section aria-label="Slideshow references" className={pickerStyles.picker}>
    <div className={pickerStyles.heading}><h2>Slideshow reference</h2><span>Optional</span></div>
    <div className={pickerStyles.tiles}>
      {reference ? <div className={pickerStyles.referenceCard}>
        <div className={pickerStyles.referenceMedia}>
          <button type="button" className={pickerStyles.preview} disabled={disabled || busy} onClick={onPreview} aria-label="Preview selected slideshow"><img src={reference.slides[slideIndex]?.url ?? reference.posterUrl} alt="" width={64} height={64} /><span>Preview</span></button>
          <Button type="button" variant="ghost" size="icon-sm" className={pickerStyles.remove} disabled={disabled || busy} onClick={onRemove} aria-label="Remove slideshow reference" title="Remove slideshow reference"><X className="size-4" aria-hidden="true" /></Button>
        </div>
        <div className={pickerStyles.referenceCopy}><strong title={reference.title}>{reference.title}</strong><span>{reference.slides.length} slides</span></div>
      </div> : null}
      <Button type="button" variant="outline" data-workflow-tile={reference ? undefined : "reference"} className={`${creation.referenceButton} ${pickerStyles.upload}`} disabled={disabled || busy} onClick={() => input.current?.click()}><Upload className="size-4" aria-hidden="true" /><span className={creation.referenceLabel}>{busy ? "Uploading…" : "Upload reference slides"}</span></Button>
    </div>
    <p className="text-xs leading-5 text-muted">Reference slides guide new images.</p>
    <input ref={input} className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label="Upload reference slides" tabIndex={-1} onChange={event => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; if (files.length) void upload(files); }} />
    {error ? <p role="alert" className="text-xs leading-5 text-destructive">{error}</p> : null}
    {reference ? <details className={pickerStyles.selection} open><summary>Source slides<span aria-live="polite">{selectedSlideIds.length} selected</span></summary><div>
      <div className="mb-2 flex items-center gap-2"><Button type="button" variant="outline" size="sm" disabled={disabled || busy || reference.slides.every(slide => selectedSlideIds.includes(slide.id))} onClick={() => onSelectionChange(reference.slides.map(slide => slide.id))}>Select all</Button><span className="text-xs text-muted">Choose the slides to recreate. Generation starts separately.</span></div>
      <div className={styles.slideshowContextStrip} role="group" aria-label="Select reference slides">
        {reference.slides.map((slide, index) => {
          const checked = selectedSlideIds.includes(slide.id);
          return <button key={slide.id} type="button" className={styles.slideshowContextSlide} aria-label={`Source slide ${index + 1} as generation reference`} title={`Source slide ${index + 1}`} aria-pressed={checked} disabled={disabled || busy} onClick={() => onSelectionChange(checked ? selectedSlideIds.filter(id => id !== slide.id) : [...selectedSlideIds, slide.id], checked ? undefined : index)}>
            <img src={slide.url} alt="" width={48} height={64} loading="lazy" />
            <span className={styles.slideshowContextCheck} aria-hidden="true">{checked ? <Check className="size-3" /> : null}</span>
            <span className={styles.slideshowContextNumber} aria-hidden="true" title={`Source slide ${index + 1}`}>{index + 1}</span>
          </button>;
        })}
      </div>
    </div></details> : <p className="text-xs leading-5 text-muted">Choose an example or upload 2–10 reference images.</p>}
    {localPreview && busy ? <p role="status" className="text-xs text-muted">Reading your slide images on this device…</p> : null}
  </section>;
}
