"use client";

import { ArrowUpRight, Check, History, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { getImageHistoryDateLabel } from "@/lib/ai-studio/image-history";
import type { CharacterHistoryImage } from "@/lib/characters/types";

export function CharacterHistory({ open, onOpenChange, images, selectedJobId, onSelect, loading, error, onRetry,
  hasMore, loadingMore, onLoadMore, signedIn, busy }: {
  open: boolean; onOpenChange: (open: boolean) => void; images: CharacterHistoryImage[];
  selectedJobId: string | null; onSelect: (image: CharacterHistoryImage) => void;
  loading: boolean; error: Error | null; onRetry: () => void;
  hasMore: boolean; loadingMore: boolean; onLoadMore: () => void; signedIn: boolean; busy: boolean;
}) {
  const groups = new Map<string, CharacterHistoryImage[]>();
  for (const image of images) {
    const label = getImageHistoryDateLabel(image.createdAt);
    const group = groups.get(label) ?? [];
    group.push(image); groups.set(label, group);
  }
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="inset-y-0 left-auto right-0 top-0 flex h-dvh w-full max-w-[460px] translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 border-l bg-background p-0 sm:max-w-[460px]">
      <header className="shrink-0 border-b border-border px-5 py-5 pr-12">
        <DialogTitle>Character history</DialogTitle>
        <DialogDescription className="mt-1 text-xs">Your completed character images. Open an image to view it or save it to My influencers.</DialogDescription>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
        {busy ? <p className="mb-4 text-xs text-muted" role="status">You can open an earlier image when your current request finishes.</p> : null}
        {error ? <div className="mb-4 text-sm text-muted" role="alert">{error.message}<Button variant="ghost" size="sm" onClick={onRetry}>Try again</Button></div> : null}
        {loading && !images.length ? <p className="flex items-center gap-2 text-sm text-muted" role="status"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading your images…</p>
          : !images.length && !error ? <div className="flex min-h-48 flex-col items-center justify-center px-5 text-center">
            <History className="size-5 text-muted" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium">{signedIn ? "Your character images will be saved here" : "Sign in to see your character history"}</p>
            <p className="mt-1 text-xs leading-5 text-muted">{signedIn ? "Completed images stay here when you start a new session." : "Your history is saved to your account."}</p>
          </div> : null}
        <div className="space-y-6">{[...groups].map(([label, group]) => <section key={label} aria-label={label}>
          <h2 className="mb-2 text-xs font-semibold text-muted">{label}</h2>
          <div className="space-y-2">{group.map((image) => <button key={image.jobId} type="button" disabled={busy}
            onClick={() => onSelect(image)} aria-pressed={selectedJobId === image.jobId}
            className="flex w-full items-center gap-3 rounded-2xl border border-transparent p-2 text-left transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60 motion-reduce:transition-none">
            <span className="flex h-20 w-[76px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-card-muted">
              {/* Owned history images are validated against their completed source jobs. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt="" loading="lazy" decoding="async" className="size-full object-contain" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 block text-sm font-semibold leading-5">{image.prompt || "AI character"}</span>
              <span className="mt-1.5 flex items-center gap-1 text-[11px] text-muted">9:16 portrait{image.saved ? <><span> · </span><Check className="size-3" aria-hidden="true" />Saved</> : null}</span>
            </span>
            <ArrowUpRight className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
          </button>)}</div>
        </section>)}</div>
        {hasMore ? <Button variant="outline" size="sm" className="mt-5 w-full" onClick={onLoadMore} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load older images"}</Button> : null}
      </div>
    </DialogContent>
  </Dialog>;
}
