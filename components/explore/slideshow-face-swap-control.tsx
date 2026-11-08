"use client";

/* eslint-disable @next/next/no-img-element */
import { Check, ScanFace } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { imagePickerThumbnailUrl } from "@/lib/media/image-picker";
import type { RecreateGenerationView } from "./recreate-generation-view";
import { SlideshowFaceChoice, type SlideshowFaceChoiceValue } from "./slideshow-face-choice";

export function SlideshowFaceSwapControl({ value, ownerId, disabled }: {
  value: NonNullable<RecreateGenerationView["slideshowFaceSwap"]>;
  ownerId?: string;
  disabled?: boolean;
}) {
  const [face, setFace] = useState<SlideshowFaceChoiceValue | null>(null);
  const [slideIds, setSlideIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState<"photos" | "slides">("photos");
  const statusId = useId();
  const eligible = value.slides?.filter(slide => slide.eligible) ?? [];
  const validIds = slideIds.filter(id => eligible.some(slide => slide.id === id));
  const photoCount = face ? 1 + (face.referencePhotos?.length ?? 0) : 0;
  const status = uploading ? "Uploading your face photos…" : !eligible.length
    ? "Select source slides in Create before setting up face swap."
    : step === "photos" ? face ? `${photoCount} photo${photoCount === 1 ? "" : "s"} selected. Next, choose which slides get this face.` : "Choose or upload a face photo to continue."
    : !validIds.length ? "Select at least one slide below. To swap only the first image, select Slide 1."
    : `Face swap on ${validIds.length === 1 ? "Slide" : "Slides"} ${eligible.filter(slide => validIds.includes(slide.id)).map(slide => slide.number).join(", ")}. Other slides will not receive face swap.`;
  function open() {
    setFace(value.influencer);
    setSlideIds([...value.slideIds]);
    setStep("photos");
    value.onOpenChange(true);
  }
  return <Dialog open={value.open} onOpenChange={next => { if (uploading) return; if (next) open(); else value.onOpenChange(false); }}>
    <DialogTrigger render={<Button type="button" variant="outline" size="icon-sm" data-face-swap-control="" aria-label="Face swap" title="Choose face photos and slides" disabled={disabled}
      className="relative shrink-0 rounded-lg" />}>
      <ScanFace className="size-4" aria-hidden="true" />
      {value.influencer && value.slideIds.length ? <span aria-label={`${value.slideIds.length} slides selected for face swap`} className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">{value.slideIds.length}</span> : null}
    </DialogTrigger>
      <DialogContent data-face-swap-control="" showCloseButton={!uploading} className="h-[min(720px,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-2xl">
        <div className="pr-7"><DialogTitle>Face swap</DialogTitle><DialogDescription>Choose face photos, then select exactly which slides get that face. Nothing generates until you click Generate.</DialogDescription><p className="mt-2 text-xs font-medium text-muted">Step {step === "photos" ? "1 of 2 · Face photos" : "2 of 2 · Slide selection"}</p></div>
        <div key={step} className="min-h-0 space-y-5 overflow-y-auto overscroll-contain p-1">
          {step === "photos" ? <section aria-label="Face reference photos" className="space-y-2"><h3 className="text-sm font-semibold">1. Choose your face photos</h3>
            <SlideshowFaceChoice key={ownerId} ownerId={ownerId} selected={face} disabled={disabled} onSelect={setFace} onBusyChange={setUploading} />
          </section> : <section aria-label="Face swap slides" className="space-y-2">
            <div className="flex items-center gap-3 rounded-lg border border-border p-2">{face ? <img src={imagePickerThumbnailUrl(face.url)} alt="Selected primary face" width={40} height={40} className="size-10 rounded object-cover" /> : null}<p className="text-xs text-muted">{photoCount} face photo{photoCount === 1 ? "" : "s"} selected. Use Back to change them.</p></div>
            <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">2. Select slide numbers</h3><Button type="button" variant="outline" size="sm" disabled={disabled || uploading || !eligible.length} onClick={() => setSlideIds(validIds.length === eligible.length ? [] : eligible.map(slide => slide.id))}>{eligible.length && validIds.length === eligible.length ? "Clear slides" : "Select all"}</Button></div>
            <p className="text-xs text-muted">Select Slide 1 for a first-image-only swap. Unmarked slides keep normal generation. Dimmed slides are not selected for generation in Create.</p>
            <div role="group" aria-label="Select slides for face swap" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {value.slides?.map(slide => <button key={slide.id} type="button" aria-label={`Face swap for source slide ${slide.number}`} aria-pressed={validIds.includes(slide.id)} disabled={disabled || uploading || !slide.eligible} onClick={() => setSlideIds(current => current.includes(slide.id) ? current.filter(id => id !== slide.id) : [...current, slide.id])}
                className="relative overflow-hidden rounded-lg border border-border p-1 text-xs aria-pressed:border-primary aria-pressed:ring-2 aria-pressed:ring-primary disabled:opacity-40">
                <img src={imagePickerThumbnailUrl(slide.url)} alt="" width={80} height={100} loading="lazy" decoding="async" className="aspect-[4/5] w-full rounded object-cover" />
                <span className="flex min-h-7 items-center justify-center gap-1">Slide {slide.number}{validIds.includes(slide.id) ? <Check className="size-3" aria-hidden="true" /> : null}</span><span className="block text-[10px] text-muted">{!slide.eligible ? "Not generating" : validIds.includes(slide.id) ? "Face swap" : "No face swap"}</span>
              </button>)}
            </div>
          </section>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <p id={statusId} role="status" className="w-full text-xs text-muted">{status}</p>
          {value.influencer || value.slideIds.length ? <Button type="button" variant="ghost" size="sm" disabled={disabled || uploading} onClick={() => { value.onInfluencerChange(null); value.onSlideIdsChange([]); value.onOpenChange(false); }}>Remove face swap</Button> : null}
          <div className="ml-auto flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => value.onOpenChange(false)}>Cancel</Button>{step === "slides" ? <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => setStep("photos")}>Back</Button> : null}<Button type="button" size="sm" aria-describedby={statusId} disabled={disabled || uploading || !face || !eligible.length || step === "slides" && !validIds.length} onClick={() => { if (disabled || uploading || !face || !eligible.length) return; if (step === "photos") { setStep("slides"); return; } if (!validIds.length) return; value.onInfluencerChange(face); value.onSlideIdsChange(validIds); value.onOpenChange(false); }}>{step === "photos" ? "Next: choose slides" : "Done"}</Button></div>
        </div>
      </DialogContent>
  </Dialog>;
}
