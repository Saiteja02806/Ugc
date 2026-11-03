"use client";

/* eslint-disable @next/next/no-img-element */
import { Check, ScanFace } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  const eligible = value.slides?.filter(slide => slide.eligible) ?? [];
  const validIds = slideIds.filter(id => eligible.some(slide => slide.id === id));
  const incomplete = Boolean(face) !== Boolean(validIds.length);
  function open() {
    setFace(value.influencer);
    setSlideIds([...value.slideIds]);
    value.onOpenChange(true);
  }
  return <Dialog open={value.open} onOpenChange={next => { if (uploading) return; if (next) open(); else value.onOpenChange(false); }}>
    <DialogTrigger render={<Button type="button" variant="outline" size="icon-sm" data-face-swap-control="" aria-label="Face swap" title="Choose face photos and slides" disabled={disabled}
      className="relative shrink-0 rounded-lg" />}>
      <ScanFace className="size-4" aria-hidden="true" />
      {value.influencer && value.slideIds.length ? <span aria-label={`${value.slideIds.length} slides selected for face swap`} className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">{value.slideIds.length}</span> : null}
    </DialogTrigger>
      <DialogContent data-face-swap-control="" showCloseButton={!uploading} className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-2xl">
        <div className="pr-7"><DialogTitle>Face swap</DialogTitle><DialogDescription>Choose photos of one person, then the slides where you want that face. Nothing generates until you click Generate.</DialogDescription></div>
        <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain p-1">
          <section aria-label="Face reference photos" className="space-y-2"><h3 className="text-sm font-semibold">1. Choose your face photos</h3>
            <SlideshowFaceChoice ownerId={ownerId} selected={face} disabled={disabled} onSelect={setFace} onBusyChange={setUploading} />
          </section>
          <section aria-label="Face swap slides" className="space-y-2">
            <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">2. Select slide numbers</h3><Button type="button" variant="outline" size="sm" disabled={disabled || uploading || !eligible.length} onClick={() => setSlideIds(validIds.length === eligible.length ? [] : eligible.map(slide => slide.id))}>{eligible.length && validIds.length === eligible.length ? "Clear slides" : "Select all"}</Button></div>
            {eligible.length ? <p className="text-xs text-muted">Only slides selected for generation can receive face swap.</p> : <p className="text-xs text-muted">Choose an example or upload reference slides, then select the source slides to generate.</p>}
            <div role="group" aria-label="Select slides for face swap" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {value.slides?.map(slide => <button key={slide.id} type="button" aria-label={`Face swap for source slide ${slide.number}`} aria-pressed={validIds.includes(slide.id)} disabled={disabled || uploading || !slide.eligible} onClick={() => setSlideIds(current => current.includes(slide.id) ? current.filter(id => id !== slide.id) : [...current, slide.id])}
                className="relative overflow-hidden rounded-lg border border-border p-1 text-xs aria-pressed:border-primary aria-pressed:ring-2 aria-pressed:ring-primary disabled:opacity-40">
                <img src={slide.url} alt="" width={80} height={100} className="aspect-[4/5] w-full rounded object-cover" />
                <span className="flex min-h-7 items-center justify-center gap-1">Slide {slide.number}{validIds.includes(slide.id) ? <Check className="size-3" aria-hidden="true" /> : null}</span>
              </button>)}
            </div>
          </section>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <p role="status" className="text-xs text-muted">{incomplete ? "Choose both face photos and slides, or clear both." : `${face ? 1 + (face.referencePhotos?.length ?? 0) : 0} photos · ${validIds.length} slides selected`}</p>
          <div className="flex gap-2"><Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => value.onOpenChange(false)}>Cancel</Button><Button type="button" size="sm" disabled={disabled || uploading || incomplete} onClick={() => { value.onInfluencerChange(face); value.onSlideIdsChange(validIds); value.onOpenChange(false); }}>Done</Button></div>
        </div>
      </DialogContent>
  </Dialog>;
}
