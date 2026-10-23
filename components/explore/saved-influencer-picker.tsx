"use client";

/* eslint-disable @next/next/no-img-element */
import { Check, ChevronDown, Loader2, RefreshCw, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { CharacterHistoryImage } from "@/lib/characters/types";
import styles from "./saved-influencer-picker.module.css";

/** A photo chooser for reuse, separate from the builder's generation history. */
export function SavedInfluencerPicker({ images, selectedAssetId, open, onOpenChange, onSelect,
  loading, error, selectionError, onRetry, hasMore, loadingMore, onLoadMore, disabled, selecting }: {
  images: CharacterHistoryImage[]; selectedAssetId: string | null;
  open: boolean; onOpenChange: (open: boolean) => void; onSelect: (image: CharacterHistoryImage) => void;
  loading: boolean; error: Error | null; selectionError: string | null; onRetry: () => void;
  hasMore: boolean; loadingMore: boolean; onLoadMore: () => void; disabled: boolean; selecting: boolean;
}) {
  function photos(items: CharacterHistoryImage[]) {
    return items.map((image, index) => <button key={image.jobId} type="button" className={styles.photo}
      aria-label={`Use saved influencer ${index + 1} as main photo`} aria-pressed={selectedAssetId === image.mediaAssetId}
      title="Use as main face photo" disabled={disabled} onClick={() => onSelect(image)}>
      <img src={image.url} alt={`Saved influencer ${index + 1}`} width={120} height={160} loading="lazy" decoding="async" />
      {selectedAssetId === image.mediaAssetId ? <span className={styles.selected}><Check aria-hidden="true" /><span className="sr-only">Main photo</span></span> : null}
    </button>);
  }
  function status() {
    return <>
      {loading && !images.length ? <p className={styles.status} role="status"><Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading your influencers…</p> : null}
      {error ? <div className={styles.status} role="alert"><span>{error.message}</span><Button type="button" variant="ghost" size="sm" disabled={loading} onClick={onRetry}><RefreshCw aria-hidden="true" />Retry</Button></div> : null}
      {!loading && !error && !images.length ? <p className={styles.status}>No saved influencers yet. Choose photos below or create one.</p> : null}
      {selecting ? <p className={styles.status} role="status"><Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Selecting your face photo…</p> : null}
    </>;
  }
  return <>
    <section className={styles.launcher} aria-label="Saved influencers">
      <Button type="button" variant="outline" className={styles.choose} disabled={disabled}
        aria-haspopup="dialog" aria-expanded={open} onClick={() => onOpenChange(true)}>
        <UserRound aria-hidden="true" /><span>Choose influencer</span><ChevronDown aria-hidden="true" />
      </Button>
    </section>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.dialog}>
        <header className={styles.header}><DialogTitle>Choose an influencer</DialogTitle>
          <DialogDescription>Select a photo to use as your main face reference.</DialogDescription></header>
        <div className={styles.library}>
          {images.length ? <div className={styles.libraryGrid}>{photos(images)}</div> : null}
          {status()}
          {selectionError ? <p role="alert" className="mt-3 text-sm text-destructive">{selectionError}</p> : null}
          {hasMore ? <Button type="button" variant="outline" size="sm" className={styles.more} disabled={disabled || loadingMore}
            onClick={onLoadMore}>{loadingMore ? "Loading…" : "Load more influencers"}</Button> : null}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
