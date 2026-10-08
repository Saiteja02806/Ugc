"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { Images, Upload, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { readAIStudioReferenceMetadata, uploadAIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import type { RecreateReference } from "@/lib/explore/recreate-types";
import creation from "./workflow-creation.module.css";

export function SlideshowReferencePicker({ reference, slideIndex, disabled, localPreview, onBrowse, onUpload, onSlide, onBusy, onEdit }: {
  reference: RecreateReference | null; slideIndex: number; disabled: boolean; localPreview: boolean;
  onBrowse: () => void; onUpload: (reference: RecreateReference) => void; onSlide: (index: number) => void; onBusy: (busy: boolean) => void;
  onEdit: () => void;
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
  return <section aria-label="Slideshow references" className="space-y-3">
    <h2 className="text-sm font-medium">Slideshow reference</h2>
    <div className={creation.referenceGrid}>
      <Button type="button" variant="outline" className={creation.referenceButton} disabled={disabled || busy} onClick={onBrowse}><Images className="size-5" aria-hidden="true" /><span className={creation.referenceLabel}>Browse slideshows</span></Button>
      <Button type="button" variant="outline" className={creation.referenceButton} disabled={disabled || busy} onClick={() => input.current?.click()}><Upload className="size-5" aria-hidden="true" /><span className={creation.referenceLabel}>{busy ? "Uploading…" : "Upload slides"}</span></Button>
    </div>
    <input ref={input} className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label="Upload slideshow images" tabIndex={-1} onChange={event => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; if (files.length) void upload(files); }} />
    {error ? <p role="alert" className="text-xs leading-5 text-destructive">{error}</p> : null}
    {reference ? <div className="space-y-2">
      <div className="flex items-center justify-between gap-2"><p className="min-w-0 truncate text-xs font-medium">{reference.title} · {reference.slides.length} slides</p><button type="button" disabled={disabled || busy} onClick={onBrowse} className="rounded p-1 text-primary focus-visible:outline-2 focus-visible:outline-focus" aria-label="Change slideshow reference"><RotateCcw className="size-4" /></button></div>
      <div className="flex gap-2 overflow-x-auto p-1">{reference.slides.map((slide, index) => <button key={slide.id} type="button" disabled={disabled || busy} aria-label={`Recreate slide ${index + 1}`} aria-pressed={slideIndex === index} onClick={() => onSlide(index)} className={`w-10 shrink-0 overflow-hidden rounded bg-card-muted ${slideIndex === index ? "ring-2 ring-primary" : ""}`}><img src={slide.url} alt="" width={40} height={50} className="aspect-[4/5] object-contain" /><span className="block text-[10px] text-muted">{index + 1}</span></button>)}</div>
      <Button type="button" variant="outline" size="sm" disabled={disabled || busy} onClick={onEdit}>Edit these slides</Button>
    </div> : <p className="text-xs leading-5 text-muted">Choose a slideshow or upload 2–10 slide images in their original order.</p>}
    {localPreview && busy ? <p role="status" className="text-xs text-muted">Reading your slide images on this device…</p> : null}
  </section>;
}
