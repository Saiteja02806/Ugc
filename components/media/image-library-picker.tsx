"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageLibraryBrowser } from "./image-library-browser";
import { resolveLibraryImages } from "@/lib/media/image-library-client";
import { planSlideshowBackgrounds, type BackgroundAssignment } from "@/lib/media/image-library";
import type { MediaAsset } from "@/lib/media/types";
import styles from "./image-library.module.css";
import { MediaLibraryButton } from "./media-library-dialog";

export type ImageLibraryChoice = { assets: MediaAsset[]; assignments: BackgroundAssignment[] };
type Review = { title: string; assets: MediaAsset[]; assignments: BackgroundAssignment[] };

/** Target IDs are captured when opened, never read from the currently selected slide. */
export function ImageLibraryPicker({ owner, slideIds, selectedSlideId, mode = "background", remaining = 10, onApply, onClose, onBusyChange }: {
  owner: string; slideIds: string[]; selectedSlideId?: string; mode?: "background" | "add" | "reference"; remaining?: number;
  onApply: (choice: ImageLibraryChoice) => Promise<void>; onClose: () => void; onBusyChange?: (busy: boolean) => void;
}) {
  const [review, setReview] = useState<Review | null>(null);
  const [single, setSingle] = useState<MediaAsset | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const working = useRef(false), alive = useRef(true);
  const busyCallback = useRef(onBusyChange);
  useEffect(() => { busyCallback.current = onBusyChange; }, [onBusyChange]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; busyCallback.current?.(false); }; }, []);
  function preview(assets: MediaAsset[], all: boolean, name: string) {
    const targets = all ? slideIds : selectedSlideId ? [selectedSlideId] : [];
    setReview({ assets, title: name, assignments: mode === "background" ? planSlideshowBackgrounds(targets, assets.map(asset => asset.id)) : [] });
    setSingle(null); setError(null);
  }
  async function apply() {
    if (!review || working.current) return;
    working.current = true; setBusy(true); setError(null); onBusyChange?.(true);
    try {
      const ids = mode === "background" ? review.assignments.map(item => item.assetId) : review.assets.map(asset => asset.id);
      const fresh = await resolveLibraryImages(owner, ids);
      if (!alive.current) return;
      await onApply({ assets: [...fresh.values()], assignments: review.assignments });
      if (alive.current) { onBusyChange?.(false); onClose(); }
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : "Could not apply these images. Your draft is unchanged."); }
    finally { working.current = false; if (alive.current) { setBusy(false); onBusyChange?.(false); } }
  }
  const images = new Map(review?.assets.map(asset => [asset.id, asset]));
  return <Dialog open onOpenChange={open => { if (!open && !working.current) onClose(); }}><DialogContent className={styles.dialog} showCloseButton={!busy}>
    <DialogHeader><DialogTitle>{review ? "Review image changes" : "Image library"}</DialogTitle><DialogDescription>{mode === "background" ? "Choose an image for one slide, one image for every slide, or a collection in order. Changes stay in this draft until you save." : mode === "add" ? "Choose library images in the order you want to add them." : "Choose a saved image to guide generation."}</DialogDescription></DialogHeader>
    <div className={styles.dialogBody}>
      {!review && !single ? <div className="mb-3"><MediaLibraryButton label="Add images or music to library" disabled={busy} /></div> : null}
      {review ? <div className="space-y-4"><p className="text-sm font-medium">{review.title}</p>
        <div className={styles.review}>{mode === "background" ? review.assignments.map((assignment, index) => <figure key={assignment.slideId}><img src={images.get(assignment.assetId)?.url} alt={`Proposed background for slide ${slideIds.indexOf(assignment.slideId) + 1}`} width={160} height={200} /><figcaption>Slide {slideIds.indexOf(assignment.slideId) + 1 || index + 1}</figcaption></figure>) : review.assets.map((asset, index) => <figure key={asset.id}><img src={asset.url} alt={asset.title} width={160} height={200} /><figcaption>{index + 1}. {asset.title}</figcaption></figure>)}</div>
        {mode === "background" ? <p className="text-xs text-muted">Only backgrounds change. Slide order and editable text stay in place. The preview shows the image selection; check text contrast in the editor before saving.</p> : null}
        <div className={styles.actions}><Button type="button" variant="outline" disabled={busy} onClick={() => setReview(null)}>Back to images</Button><Button type="button" disabled={busy} onClick={() => void apply()}>{busy ? "Checking images…" : mode === "background" ? `Apply to ${review.assignments.length} slide${review.assignments.length === 1 ? "" : "s"}` : mode === "reference" ? "Use reference image" : `Add ${review.assets.length} images`}</Button></div>
      </div> : single ? <div className="space-y-4"><img src={single.url} alt={single.title} width={500} height={400} className="max-h-72 w-full object-contain" /><div className={styles.actions}>
        <Button type="button" variant="outline" onClick={() => setSingle(null)}>Back to images</Button>
        {selectedSlideId ? <Button type="button" onClick={() => preview([single], false, single.title)}>Preview selected slide</Button> : null}
        {slideIds.length > 1 ? <Button type="button" variant="outline" onClick={() => preview([single], true, `${single.title} on every slide`)}>Preview all slides</Button> : null}
      </div></div> : <ImageLibraryBrowser owner={owner} mode="pick" multiple={mode === "add"} limit={mode === "add" ? remaining : 1} disabled={busy}
        onChoose={assets => { if (mode === "background") { setSingle(assets[0]); setError(null); } else preview(assets, false, mode === "reference" ? "Reference image" : "Add selected images"); }}
        onCollection={mode === "background" && slideIds.length ? (assets, name) => preview(assets, true, `${name} · collection order, repeating if needed`) : undefined} />}
    </div>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
  </DialogContent></Dialog>;
}
