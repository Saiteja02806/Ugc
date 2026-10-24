"use client";

import { Play, Search, VolumeX } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import bundle from "@/lib/trending/ai-hook-bundle.json";
import { mixTrendingHookVideos } from "@/lib/trending/ai-hook-bundle-order";

const mixedVideos = mixTrendingHookVideos(bundle.videos);

function reactionLabel(value: string | null) {
  return value ? value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()) : "Other";
}

export function TrendingAiHookBundle() {
  const [query, setQuery] = useState("");
  const [reaction, setReaction] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const selected = bundle.videos.find((video) => video.id === selectedId);
  const reactions = useMemo(() => [...new Set(bundle.videos.map((video) => video.reaction).filter((value): value is string => Boolean(value)))].sort(), []);
  const visible = mixedVideos.filter((video) =>
    (!reaction || video.reaction === reaction) &&
    reactionLabel(video.reaction).toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-10">
        <header className="mb-12 flex items-center justify-between border-b border-border pb-5">
          <Link href="/" className="text-lg font-semibold tracking-tight">UGC Pilot</Link>
          <Link href="/dashboard" className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">Open app →</Link>
        </header>
        <section className="mb-10 flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p className="mb-3 text-sm font-medium text-primary">The Trending collection</p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">A hook for every reaction.</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">{bundle.videos.length} AI-generated hook videos from UGC Pilot’s Trending library. Browse reactions and preview a clip for your next video.</p>
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><VolumeX className="size-4" aria-hidden="true" />Silent opening clips · Add your own text, music and demo</p>
          </div>
        </section>
        <section aria-label="Hook video collection">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" aria-hidden="true" />
              <input aria-label="Search hook videos" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reactions" className="min-h-11 w-full rounded-xl border border-border bg-card py-2.5 pr-4 pl-10 text-sm focus-visible:outline-2 focus-visible:outline-ring" />
            </div>
            <select aria-label="Filter by reaction" value={reaction} onChange={(event) => setReaction(event.target.value)} className="min-h-11 rounded-xl border border-border bg-card px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring">
              <option value="">All reactions</option>
              {reactions.map((value) => <option key={value} value={value}>{reactionLabel(value)}</option>)}
            </select>
          </div>
          <p aria-live="polite" role="status" className="mb-4 text-sm text-muted-foreground">Showing {visible.length} of {bundle.videos.length} videos</p>
          {visible.length === 0 ? <div className="rounded-xl border border-border p-8 text-center"><p>No hook videos match your search.</p><button type="button" onClick={() => { setQuery(""); setReaction(""); }} className="mt-4 rounded-lg px-3 py-2 text-sm text-primary focus-visible:outline-2 focus-visible:outline-ring">Clear filters</button></div> : null}
          <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {visible.map((video) => (
              <button key={video.id} type="button" aria-label={`Preview ${reactionLabel(video.reaction)}`} onClick={() => { setPreviewFailed(false); setSelectedId(video.id); }} className="group min-w-0 self-start rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                <div className="relative aspect-[9/16] overflow-hidden rounded-xl border border-border bg-card">
                  {/* Catalogue posters keep the gallery light; only a selected video is loaded. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={video.posterUrl ?? undefined} alt="" loading="lazy" className="size-full object-cover" />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <span className="absolute top-2 right-2 rounded-md bg-black/60 px-2 py-1 font-mono text-xs text-white">{Number(video.durationSeconds).toFixed(1)}s</span>
                  <span className="absolute right-3 bottom-3 grid size-9 place-items-center rounded-full bg-white/90 text-black transition-transform group-hover:scale-110 motion-reduce:transition-none"><Play className="size-4 fill-current" aria-hidden="true" /></span>
                </div>
                <p className="mt-3 text-sm font-medium leading-5">{reactionLabel(video.reaction)}</p>
              </button>
            ))}
          </div>
        </section>
        <footer className="mt-14 border-t border-border pt-5 text-xs leading-6 text-muted-foreground">Trending hook collection · {bundle.videos.length} videos · Collected 16 October 2026</footer>
      </div>
      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        <DialogContent className="max-h-[95dvh] max-w-md overflow-y-auto">
          {selected ? <>
            <DialogHeader><DialogTitle>{reactionLabel(selected.reaction)}</DialogTitle><DialogDescription>{Number(selected.durationSeconds).toFixed(1)} seconds · Silent clip</DialogDescription></DialogHeader>
            <video key={selected.id} src={selected.videoUrl} poster={selected.posterUrl ?? undefined} controls autoPlay playsInline muted className="mx-auto max-h-[65dvh] w-full rounded-lg bg-black" onError={() => setPreviewFailed(true)} />
            {previewFailed ? <p role="alert" className="text-sm text-muted-foreground">Preview unavailable. Try reopening this video.</p> : null}
          </> : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}
