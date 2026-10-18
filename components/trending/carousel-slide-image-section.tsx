"use client";

import { ImagePlus, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { uploadAIStudioReferenceMedia } from "@/lib/ai-studio/reference-media-upload";
import type { MediaAsset } from "@/lib/media/types";
import type { TrendingCarouselEditSlide } from "@/lib/trending/creative-edit-contract";
import { CAROUSEL_SLIDE_IMAGE_PROJECT, validateCarouselSlideImage } from "@/lib/trending/carousel-slide-image-selection";
import { useAuth } from "@/contexts/auth-context";
import { ImageLibraryPicker, type ImageLibraryChoice, type LibrarySlidePreview } from "@/components/media/image-library-picker";
import { sameBackgroundTargets } from "@/lib/media/image-library";
import { MediaLibraryButton } from "@/components/media/media-library-dialog";

export async function uploadCarouselSlideImage(file: File) {
  validateCarouselSlideImage(file);
  return (await uploadAIStudioReferenceMedia(file, "image", 3, undefined, { purpose: CAROUSEL_SLIDE_IMAGE_PROJECT })).asset;
}

export type CarouselSlideImagePreview = { slideId: string; url: string };

export function CarouselSlideImageSection({
  slide, slides, disabled = false, onUploaded, onRestore, onBusyChange, onPreviewChange, onLibraryApply, renderLibrarySlidePreview,
  uploadImage = uploadCarouselSlideImage,
}: {
  slide: TrendingCarouselEditSlide;
  slides?: TrendingCarouselEditSlide[];
  onLibraryApply?: (choice: ImageLibraryChoice) => void;
  renderLibrarySlidePreview?: LibrarySlidePreview;
  disabled?: boolean;
  onUploaded: (slideId: string, asset: MediaAsset) => void;
  onRestore: (slideId: string) => void;
  onBusyChange: (busy: boolean) => void;
  onPreviewChange?: (preview: CarouselSlideImagePreview | null) => void;
  uploadImage?: (file: File) => Promise<MediaAsset>;
}) {
  const { user } = useAuth();
  const [libraryTarget, setLibraryTarget] = useState<{ ids: string[]; selected: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileTargetRef = useRef<{ id: string; number: number } | null>(null);
  const working = useRef(false);
  const alive = useRef(false);
  const previewUrl = useRef<string | null>(null);
  const [uploadingSlide, setUploadingSlide] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = null;
    };
  }, []);

  async function upload(file: File, target: { id: string; number: number }) {
    if (disabled || working.current) return;
    working.current = true;
    setUploadingSlide(target.number); setMessage(null); setError(null);
    onBusyChange(true);
    try {
      validateCarouselSlideImage(file);
      previewUrl.current = URL.createObjectURL(file);
      onPreviewChange?.({ slideId: target.id, url: previewUrl.current });
      const asset = await uploadImage(file);
      if (!alive.current) return;
      onUploaded(target.id, asset);
      setMessage(`Slide ${target.number} image updated. Save to apply your changes.`);
    } catch (failure) {
      if (alive.current) setError(`Slide ${target.number}: ${failure instanceof Error ? failure.message : "Could not upload this image. Try again."}`);
    } finally {
      working.current = false;
      if (alive.current) {
        onPreviewChange?.(null);
        setUploadingSlide(null); onBusyChange(false);
        if (inputRef.current) inputRef.current.value = "";
      }
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = null;
    }
  }

  return <section className="mt-5 rounded-xl border border-border bg-muted/20 p-4" aria-label="Slide image">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold">Slide {slide.slideNumber} image</h3>
      {slide.backgroundAssetId !== slide.originalBackgroundAssetId ? <Button size="sm" variant="ghost" disabled={disabled || uploadingSlide !== null}
        onClick={() => { onRestore(slide.slideId); setMessage(null); setError(null); }}>
        <RefreshCw className="size-3.5" aria-hidden="true" />Restore original
      </Button> : null}
    </div>
    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Upload a replacement for this slide. JPG, PNG or WebP, up to 25 MB. The image fills the frame; edges may be cropped.</p>
    <Button type="button" className="mt-3" size="sm" variant="outline" disabled={disabled || uploadingSlide !== null} onClick={() => {
      fileTargetRef.current = { id: slide.slideId, number: slide.slideNumber };
      inputRef.current?.click();
    }}>
      {uploadingSlide !== null ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ImagePlus className="size-4" aria-hidden="true" />}
      {uploadingSlide !== null ? `Uploading slide ${uploadingSlide}…` : `Upload image for slide ${slide.slideNumber}`}
    </Button>
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1}
      aria-label={`Choose image for slide ${slide.slideNumber}`} disabled={disabled || uploadingSlide !== null}
      onChange={event => {
        const file = event.target.files?.[0];
        const target = fileTargetRef.current ?? { id: slide.slideId, number: slide.slideNumber };
        fileTargetRef.current = null;
        if (file) void upload(file, target);
      }} />
    <Button type="button" size="sm" variant="outline" className="ml-2 mt-3" disabled={disabled || uploadingSlide !== null || !user} onClick={() => setLibraryTarget({ ids: (slides ?? [slide]).map(item => item.slideId), selected: slide.slideId })}>Choose from library</Button>
    {libraryTarget && user ? <ImageLibraryPicker key={user.uid} owner={user.uid} slideIds={libraryTarget.ids} selectedSlideId={libraryTarget.selected} renderSlidePreview={renderLibrarySlidePreview} onBusyChange={onBusyChange} onClose={() => setLibraryTarget(null)} onApply={async choice => {
      if (!sameBackgroundTargets((slides ?? [slide]).map(item => item.slideId), libraryTarget.ids)) throw new Error("Your slideshow changed. Reopen the library before applying backgrounds.");
      if (onLibraryApply) onLibraryApply(choice);
      else { const target = choice.assignments[0]; const asset = choice.assets.find(item => item.id === target?.assetId); if (target && asset) onUploaded(target.slideId, asset); }
    }} /> : null}
    <MediaLibraryButton label="Add to library" className="ml-2 mt-3" disabled={disabled || uploadingSlide !== null} />
    <div role="status" className="mt-2 text-xs text-muted-foreground">{message}</div>
    {error ? <p role="alert" className="mt-2 text-xs text-destructive">{error}</p> : null}
  </section>;
}
