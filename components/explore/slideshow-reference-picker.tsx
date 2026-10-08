"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { readAIStudioReferenceMetadata, uploadAIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import type { RecreateReference } from "@/lib/explore/recreate-types";
import creation from "./workflow-creation.module.css";
import styles from "./format-workspace.module.css";

export function SlideshowReferencePicker({ reference, slideIndex, disabled, localPreview, onPreview, onRemove, onUpload, onSlide, onBusy }: {
  reference: RecreateReference | null; slideIndex: number; disabled: boolean; localPreview: boolean;
  onPreview: () => void; onRemove: () => void; onUpload: (reference: RecreateReference) => void; onSlide: (index: number) => void; onBusy: (busy: boolean) => void;
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
    <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-medium">Slideshow reference</h2>{reference ? <Button type="button" variant="ghost" size="icon-sm" disabled={disabled || busy} onClick={onRemove} aria-label="Remove slideshow reference"><X className="size-4" /></Button> : null}</div>
    <div className={styles.slideshowReferenceTiles}>
      {reference ? <button type="button" className={styles.slideshowReferenceTile} disabled={disabled || busy} onClick={onPreview} aria-label="Preview selected slideshow"><img src={reference.slides[slideIndex]?.url ?? reference.posterUrl} alt="" width={128} height={128} /><span>Preview slideshow</span></button> : null}
      <Button type="button" variant="outline" className={creation.referenceButton} disabled={disabled || busy} onClick={() => input.current?.click()}><Upload className="size-5" aria-hidden="true" /><span className={creation.referenceLabel}>{busy ? "Uploading…" : "Upload slides"}</span></Button>
    </div>
    <input ref={input} className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label="Upload slideshow images" tabIndex={-1} onChange={event => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; if (files.length) void upload(files); }} />
    {error ? <p role="alert" className="text-xs leading-5 text-destructive">{error}</p> : null}
    {reference ? <div className="space-y-2">
      <p className="truncate text-xs font-medium">{reference.title}</p>
      <div className="flex items-center gap-2"><Button type="button" variant="outline" size="icon-sm" aria-label="Previous reference slide" disabled={disabled || busy || slideIndex === 0} onClick={() => onSlide(slideIndex - 1)}><ArrowLeft className="size-4" /></Button><span aria-live="polite" className="text-xs text-muted">Slide {slideIndex + 1} of {reference.slides.length}</span><Button type="button" variant="outline" size="icon-sm" aria-label="Next reference slide" disabled={disabled || busy || slideIndex >= reference.slides.length - 1} onClick={() => onSlide(slideIndex + 1)}><ArrowRight className="size-4" /></Button></div>
      <p className="text-xs leading-5 text-muted">Describe your changes for this slide, then generate your own image.</p>
    </div> : <p className="text-xs leading-5 text-muted">Select a slideshow on the right, or upload 2–10 images as a reference.</p>}
    {localPreview && busy ? <p role="status" className="text-xs text-muted">Reading your slide images on this device…</p> : null}
  </section>;
}
