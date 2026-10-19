"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageLibraryBrowser } from "./image-library-browser";
import { MediaLibraryPanel } from "./media-library-dialog";
import { resolveLibraryImages } from "@/lib/media/image-library-client";
import { planSlideshowBackgrounds, type BackgroundAssignment } from "@/lib/media/image-library";
import type { MediaAsset } from "@/lib/media/types";
import styles from "./image-library.module.css";

export type ImageLibraryChoice = { assets: MediaAsset[]; assignments: BackgroundAssignment[] };
type Candidate = { assets: MediaAsset[]; collection?: string };
export type LibrarySlidePreview = (slideId: string, asset: MediaAsset) => ReactNode;

/** Selection and scope only propose changes; one explicit Apply verifies every used source. */
export function ImageLibraryPicker({ owner, slideIds, selectedSlideId, mode = "background", remaining = 10, onApply, onClose, onBusyChange, renderSlidePreview }: {
  owner: string; slideIds: string[]; selectedSlideId?: string; mode?: "background" | "add" | "reference"; remaining?: number;
  onApply: (choice: ImageLibraryChoice) => Promise<void>; onClose: () => void; onBusyChange?: (busy: boolean) => void; renderSlidePreview?: LibrarySlidePreview;
}) {
  const [candidate, setCandidate] = useState<Candidate>({ assets: [] });
  const [scope, setScope] = useState<"slide" | "all">(selectedSlideId ? "slide" : "all");
  const [manage, setManage] = useState(false);
  const [review, setReview] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [busy, setBusy] = useState(false), [libraryBusy, setLibraryBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const working = useRef(false), alive = useRef(true);
  const busyCallback = useRef(onBusyChange);
  useEffect(() => { busyCallback.current = onBusyChange; }, [onBusyChange]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; busyCallback.current?.(false); }; }, []);
  const locked = busy || libraryBusy;
  const targets = scope === "all" ? slideIds : selectedSlideId ? [selectedSlideId] : [];
  const assignments = mode === "background" && candidate.assets.length && targets.length ? planSlideshowBackgrounds(targets, candidate.assets.map(asset => asset.id)) : [];
  const images = new Map(candidate.assets.map(asset => [asset.id, asset]));
  const shownIndex = Math.min(previewIndex, Math.max(0, assignments.length - 1));
  const shownAssignment = assignments[shownIndex];
  const shownImage = mode === "background" ? images.get(shownAssignment?.assetId ?? "") : candidate.assets[0];
  const valid = candidate.assets.length > 0 && (mode === "background" ? assignments.length > 0 : mode !== "add" || candidate.assets.length <= remaining);
  const usedImages = new Set(assignments.map(item => item.assetId)).size;
  const repeated = assignments.length - usedImages;
  function propose(assets: MediaAsset[], collection?: string) {
    setCandidate({ assets, collection }); setError(null); setPreviewIndex(0);
    if (collection) setScope("all");
  }
  function changeLibraryBusy(next: boolean) { setLibraryBusy(next); busyCallback.current?.(next); }
  async function apply() {
    if (!valid || locked || working.current) return;
    if (mode === "background" && !review) { setReview(true); return; }
    const proposed = { assets: candidate.assets, assignments };
    working.current = true; setBusy(true); setError(null); onBusyChange?.(true);
    try {
      const ids = mode === "background" ? proposed.assignments.map(item => item.assetId) : proposed.assets.map(asset => asset.id);
      const fresh = await resolveLibraryImages(owner, ids);
      if (!alive.current) return;
      await onApply({ assets: [...fresh.values()], assignments: proposed.assignments });
      if (alive.current) { onBusyChange?.(false); onClose(); }
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : "Could not apply these images. Your draft is unchanged."); }
    finally { working.current = false; if (alive.current) { setBusy(false); onBusyChange?.(false); } }
  }
  const targetLabel = scope === "all" ? `All ${slideIds.length} slides` : `Slide ${slideIds.indexOf(selectedSlideId ?? "") + 1} of ${slideIds.length}`;
  return <Dialog open onOpenChange={open => { if (!open && !working.current && !libraryBusy) onClose(); }}><DialogContent className={`${styles.dialog} ${styles.pickerDialog}`} showCloseButton={!locked}>
    <DialogHeader><div className={styles.heading}><DialogTitle>{manage ? "Manage library" : mode === "background" ? "Choose slide backgrounds" : mode === "add" ? "Add images to slideshow" : "Choose reference image"}</DialogTitle><Button type="button" variant="ghost" size="sm" className="mr-7" disabled={locked} onClick={() => { setManage(value => !value); setError(null); }}>{manage ? "Back to selection" : "Manage library"}</Button></div><DialogDescription>{manage ? "Library changes save automatically. Your slideshow stays unchanged." : mode === "background" ? "Select images, then use them as slideshow backgrounds. Your text stays in place." : mode === "add" ? `Choose up to ${remaining} images in the order you want them.` : "Use a saved image to guide generation."}</DialogDescription></DialogHeader>
    {!manage && mode === "background" ? <fieldset className={styles.scope} disabled={locked}><legend>Replace backgrounds on</legend>{selectedSlideId ? <label><input type="radio" name="background-scope" value="slide" checked={scope === "slide"} onChange={() => { setScope("slide"); propose(candidate.assets.slice(0, 1)); }} />This slide <span>{slideIds.indexOf(selectedSlideId) + 1}</span></label> : null}<label><input type="radio" name="background-scope" value="all" checked={scope === "all"} onChange={() => { setScope("all"); setPreviewIndex(0); }} />All slides <span>{slideIds.length}</span></label></fieldset> : null}
    {!manage ? <div className={styles.selectionTabs}><Button type="button" size="sm" variant={!review ? "secondary" : "outline"} aria-pressed={!review} disabled={locked} onClick={() => setReview(false)}>Choose images</Button><Button type="button" size="sm" variant={review ? "secondary" : "outline"} aria-pressed={review} disabled={locked || !candidate.assets.length} onClick={() => setReview(true)}>{mode === "background" ? "Preview" : "Review selection"}</Button><span role="status">{candidate.assets.length} selected</span></div> : null}
    <div className={styles.dialogBody}>
      <div hidden={!manage}>{manage ? <MediaLibraryPanel key={owner} onBusyChange={changeLibraryBusy} /> : null}</div>
      <div hidden={manage || review}>
        <ImageLibraryBrowser owner={owner} mode="pick" multiple={mode === "add" || mode === "background" && scope === "all"} limit={mode === "add" ? remaining : mode === "reference" || scope === "slide" ? 1 : 100} disabled={locked || manage || review} selectedIds={candidate.assets.map(asset => asset.id)} onBusyChange={changeLibraryBusy}
          onSelectionChange={assets => propose(assets)} onCollection={mode === "background" ? (assets, name) => propose(assets, name) : undefined} />
      </div>
        <section hidden={manage || !review} className={styles.proposal} aria-label="Proposed slide preview">
          <div className={styles.heading}><h3>{mode === "background" ? "Slide preview" : "Your selection"}</h3><span className="text-xs text-muted">{candidate.collection ?? (shownImage?.title || "No image selected")}</span></div>
          {shownImage ? <>
            <div className={styles.composition} inert>{mode === "background" && renderSlidePreview && shownAssignment ? renderSlidePreview(shownAssignment.slideId, shownImage) : <img src={shownImage.url} alt={shownImage.title} width={shownImage.width ?? 1080} height={shownImage.height ?? 1350} />}</div>
            {mode === "background" && assignments.length > 1 ? <div className={styles.previewNavigation}><Button type="button" size="sm" variant="outline" disabled={locked || shownIndex === 0} onClick={() => setPreviewIndex(value => value - 1)}>Previous</Button><span>Slide {slideIds.indexOf(shownAssignment.slideId) + 1} of {slideIds.length}</span><Button type="button" size="sm" variant="outline" disabled={locked || shownIndex === assignments.length - 1} onClick={() => setPreviewIndex(value => value + 1)}>Next</Button></div> : null}
            <p role="status" className="text-xs text-muted">{mode === "background" ? `${assignments.length} slide${assignments.length === 1 ? "" : "s"} · ${usedImages} image${usedImages === 1 ? "" : "s"}${repeated ? ` · ${repeated} repeated placement${repeated === 1 ? "" : "s"}` : ""}` : `${candidate.assets.length} selected`}</p>
            <p className="text-xs text-muted">{shownImage.title}{shownAssignment ? ` · Background for slide ${slideIds.indexOf(shownAssignment.slideId) + 1}` : ""}</p>
            {candidate.assets.length > 1 ? <ol className={styles.orderList} aria-label="Image order for this slideshow">{candidate.assets.map((asset, index) => <li key={asset.id}><span>{index + 1}. {asset.title}</span></li>)}</ol> : null}
            {mode === "background" ? <p className="text-xs text-muted">{candidate.collection ? "Images follow collection order." : "Images follow your selection order."} {repeated ? "Images repeat from the beginning to fill the slides." : ""} {candidate.assets.length > assignments.length ? `${candidate.assets.length - assignments.length} extra images are unused.` : ""}</p> : null}
          </> : <div className={styles.empty}><p>Select an image{mode === "background" && scope === "all" ? " or use a collection" : ""} to preview it here.</p></div>}
        </section>
    </div>
    <footer className={styles.pickerFooter} aria-label="Library selection actions"><div><strong>{manage ? "Library changes save automatically" : mode === "background" ? `${candidate.assets.length} selected · ${targetLabel}` : `${candidate.assets.length} images selected`}</strong><p>{locked ? "Wait for the current operation to finish…" : manage ? "Return to selection when you’re done organizing." : mode === "background" ? `${repeated ? "Images repeat to fill all slides. " : ""}Save the slideshow after using these backgrounds.` : "Your current draft stays unchanged until you confirm."}</p>{error ? <p role="alert" className={styles.error}>{error}</p> : null}</div><div className={styles.actions}><Button type="button" variant="outline" disabled={locked} onClick={manage ? () => setManage(false) : onClose}>{manage ? "Done" : "Cancel"}</Button>{!manage ? <Button type="button" disabled={locked || !valid} onClick={() => void apply()}>{busy ? "Checking images…" : mode === "background" ? review ? "Use these backgrounds" : "Preview backgrounds" : mode === "reference" ? "Use reference image" : `Add ${candidate.assets.length || "selected"} images`}</Button> : null}</div></footer>
  </DialogContent></Dialog>;
}
