"use client";

/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ImagePlus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { withReadDeadline } from "@/lib/http/read-deadline";
import { getAIStudioImageResults, type AIStudioImageResult } from "@/lib/ai-studio/media-results";
import { slideshowGenerationGroups } from "@/lib/explore/slideshow-generation-groups";
import type { RecreateReference } from "@/lib/explore/recreate-types";
import type { MediaAsset } from "@/lib/media/types";
import styles from "./slideshow-add-slides.module.css";

export type SlideshowSlideSource = "generated" | "reference";
export function SlideshowAddSlides({ owner, reference, existing, slideCount, disabled, localPreview, onClose, onAdd, onUpload, onCreate, onLibrary }: {
  owner: string | null; reference: RecreateReference | null; existing: readonly AIStudioImageResult[]; slideCount: number; disabled: boolean; localPreview: boolean;
  onClose: () => void; onAdd: (source: SlideshowSlideSource, ids: string[]) => Promise<void>; onUpload: () => void; onCreate?: () => void; onLibrary?: () => void;
}) {
  const [source, setSource] = useState<SlideshowSlideSource | "upload">(reference ? "reference" : "generated");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const remaining = Math.max(0, 10 - slideCount);
  const library = useQuery<AIStudioImageResult[]>({
    queryKey: ["slideshow-add-generated", owner], enabled: source === "generated" && !!owner && !localPreview,
    retry: false, staleTime: 0, refetchOnWindowFocus: false,
    queryFn: ({ signal }) => withReadDeadline(async bounded => {
      const token = await getCurrentUserIdToken(owner ?? undefined);
      if (!token) throw new Error("Sign in to choose your generated images.");
      bounded.throwIfAborted();
      const response = await fetch("/api/media?collection=image&sourceTypes=generated_image", { cache: "no-store", headers: { Authorization: `Bearer ${token}` }, signal: bounded });
      const data = await response.json() as { ok?: boolean; assets?: MediaAsset[] };
      if (!response.ok || !data.ok || !Array.isArray(data.assets)) throw new Error("Could not load your generated images.");
      return getAIStudioImageResults(data.assets, data.assets.length);
    }, signal),
  });
  const generated = library.data ?? [];
  const groups = slideshowGenerationGroups(generated);
  const groupedIds = new Set(groups.flatMap(group => group.images.map(image => image.id)));
  const generatedOrder = [...groups.flatMap(group => group.images), ...generated.filter(image => !groupedIds.has(image.id))];
  const usedIds = new Set(existing.map(image => image.mediaAssetId ?? image.id));
  const usedUrls = new Set(existing.map(image => image.url));
  const representedUrls = new Set(existing.flatMap(image => image.remixTextSource?.format === "slideshow" && image.remixTextSource.sourceUrl ? [image.remixTextSource.sourceUrl] : []));
  const candidates = source === "reference" ? (reference?.slides ?? []).map((slide, index) => ({ id: slide.id, url: slide.url, label: `Reference slide ${index + 1}`, used: usedIds.has(slide.id) || usedUrls.has(slide.url) || representedUrls.has(slide.url) }))
    : generatedOrder.map((image, index) => ({ id: image.id, url: image.url, label: `Generated image ${index + 1}`, used: usedIds.has(image.id) }));
  function changeSource(next: typeof source) { if (working.current) return; setSource(next); setSelected([]); setError(null); }
  function toggle(id: string) { setError(null); setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]); }
  async function add() {
    if (working.current || disabled || localPreview || source === "upload" || !selected.length || selected.length > remaining) return;
    working.current = true; setBusy(true); setError(null);
    try { await onAdd(source, candidates.filter(item => selected.includes(item.id) && !item.used).map(item => item.id)); onClose(); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not add these slides. Try again."); }
    finally { working.current = false; setBusy(false); }
  }
  function tiles(items: typeof candidates) { return <div className={styles.grid}>{items.map(item => <button key={item.id} type="button" className={styles.tile} aria-label={item.used ? `${item.label}, already added` : `Select ${item.label.toLowerCase()}`} aria-pressed={selected.includes(item.id)} disabled={busy || disabled || item.used} onClick={() => toggle(item.id)}>
    <img src={item.url} alt="" width={160} height={200} loading="lazy" />
    <span className={styles.check} aria-hidden="true">{selected.includes(item.id) || item.used ? <Check className="size-3.5" /> : null}</span>
    <span className={styles.caption}>{item.label}<small>{item.used ? "Already added" : selected.includes(item.id) ? "Selected" : ""}</small></span>
  </button>)}</div>; }
  return <Dialog open onOpenChange={open => { if (!open && !working.current) onClose(); }}><DialogContent className={styles.dialog} showCloseButton={!busy}>
    <DialogHeader><DialogTitle>Add slides</DialogTitle><DialogDescription>Choose images to add to your slideshow. Your existing slides and edits stay in place.</DialogDescription></DialogHeader>
    {onLibrary ? <Button type="button" variant="outline" disabled={busy || disabled || localPreview || !owner || !remaining} onClick={onLibrary}>Choose from image library</Button> : null}
    <div className={styles.sources} role="group" aria-label="Slide sources">{([["generated", "Generated images"], ["reference", "Original reference"], ["upload", "Use my finished slides"]] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={source === value} disabled={busy || disabled || value === "upload" && (localPreview || !owner || !remaining)} onClick={() => { if (busy || disabled) return; if (value === "upload") { if (!localPreview && owner && remaining) onUpload(); } else changeSource(value); }}>{label}</button>)}</div>
    <div className={styles.body}>
      {source === "upload" ? <div className={styles.empty}><Upload aria-hidden="true" /><p>Add JPG, PNG or WebP images. Uploads automatically fit 4:5, keeping the full image visible with a blurred background where needed.</p><Button type="button" variant="outline" disabled={disabled || localPreview || !owner || !remaining} onClick={onUpload}>Choose images</Button></div>
        : source === "reference" ? !reference ? <p className={styles.empty}>Choose a slideshow reference in Create to add its original slides.</p> : <>
          <div className={styles.sourceHeading}><div><strong>{reference.title}</strong><p>Add only the originals you want. Slides already added or recreated are marked below.</p></div><Button type="button" variant="ghost" size="sm" disabled={busy || disabled || candidates.every(item => item.used)} onClick={() => { setSelected(candidates.filter(item => !item.used).map(item => item.id)); setError(null); }}>Select all remaining</Button></div>{tiles(candidates)}
        </> : localPreview || !owner ? <p className={styles.empty}>Your saved generated images will appear here when signed in.</p>
          : !library.data && library.isPending ? <p role="status" className={styles.empty}>Loading generated images…</p>
          : library.isError && !library.data ? <div className={styles.empty}><p role="alert">{library.error.message}</p><Button type="button" variant="outline" onClick={() => void library.refetch()}>Retry</Button></div>
          : !generated.length ? <div className={styles.empty}><ImagePlus aria-hidden="true" /><p>No ready generated images yet.</p></div> : <>
            {groups.map((group, index) => <section key={group.key} className={styles.generatedGroup} aria-label={`Generated set ${index + 1}, version ${group.slot.versionIndex}`}><h3>Generated set {index + 1} · Version {group.slot.versionIndex}<span>{group.images.length} of {group.slot.slideCount} images ready</span></h3>{tiles(candidates.filter(item => group.images.some(image => image.id === item.id)))}</section>)}
            {candidates.some(item => !groupedIds.has(item.id)) ? <section className={styles.generatedGroup}><h3>Other generated images</h3>{tiles(candidates.filter(item => !groupedIds.has(item.id)))}</section> : null}
          </>}
    </div>
    <footer className={styles.footer}><div><p aria-live="polite">{slideCount} of 10 slides · {remaining} space{remaining === 1 ? "" : "s"} left</p>{selected.length > remaining ? <p role="alert" className={styles.error}>Choose {remaining} or fewer images, or remove slides from your slideshow first.</p> : null}{error ? <p role="alert" className={styles.error}>{error}</p> : null}{localPreview ? <p>Preview · adding images is disabled</p> : null}</div>
      <div className={styles.actions}>{onCreate ? <Button type="button" variant="ghost" disabled={busy || disabled || !remaining} onClick={onCreate}>Create new slides</Button> : null}{source !== "upload" ? <Button type="button" disabled={busy || disabled || localPreview || !owner || !selected.length || selected.length > remaining} onClick={() => void add()}>{busy ? "Adding…" : `Add ${selected.length || "selected"} slide${selected.length === 1 ? "" : "s"}`}</Button> : null}</div>
    </footer>
  </DialogContent></Dialog>;
}
