"use client";

/* Gallery covers fill their cards; opened previews preserve the full source dimensions. */
/* eslint-disable @next/next/no-img-element */

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Filter, Layers3, Play, RefreshCw, RotateCcw, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import { RecreateGenerationPanel } from "@/components/explore/recreate-generation-panel";
import { RecreateSplitPane } from "@/components/explore/recreate-split-pane";
import studio from "@/components/explore/workflow-studio.module.css";
import layout from "@/components/explore/recreate-layout.module.css";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { filterReferences, interleaveReferenceCategories, RECREATE_FORMAT_LABELS, RECREATE_FORMATS, referenceCategories, type RecreateFormat, type RecreateReference } from "@/lib/explore/recreate-types";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { cn } from "@/lib/utils";

type RecreateReferencesResponse =
  | { items: RecreateReference[]; ok: true }
  | { message?: string; ok?: false };

const GALLERY_GRID = layout.galleryGrid;
const EMPTY_REFERENCES: RecreateReference[] = [];

export function RecreateWorkspace({ previewReferences }: { previewReferences?: RecreateReference[] }) {
  const { loading: authLoading, user } = useAuth();
  const localPreview = previewReferences !== undefined;
  const referencesQuery = useQuery({
    enabled: !localPreview && !authLoading && Boolean(user),
    gcTime: 60 * 60 * 1_000,
    queryFn: ({ signal }) => fetchRecreateReferences(signal),
    queryKey: ["recreate-references", 3, user?.uid ?? "signed-out"],
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 30 * 60 * 1_000,
  });
  const [format, setFormat] = useState<RecreateFormat>("slideshow");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedReference, setSelectedReference] = useState<RecreateReference | null>(null);
  const [previewReference, setPreviewReference] = useState<RecreateReference | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [generationMode, setGenerationMode] = useState<"images" | "videos">("images");
  const references = previewReferences ?? referencesQuery.data ?? EMPTY_REFERENCES;
  const categories = useMemo(() => referenceCategories(references, format), [format, references]);
  const filtered = useMemo(() => {
    const matching = filterReferences(references, format, selectedCategories);
    return format === "slideshow" ? interleaveReferenceCategories(matching) : matching;
  }, [format, references, selectedCategories]);
  const loading = !localPreview && (authLoading || referencesQuery.isFetching && !referencesQuery.data);
  const ready = localPreview || referencesQuery.isSuccess;

  function changeFormat(nextFormat: RecreateFormat) {
    setFormat(nextFormat);
    setSelectedCategories([]);
  }

  function openPreview(reference: RecreateReference) {
    setPreviewReference(reference);
    setPreviewOpen(true);
  }

  function toggleCategory(category: string, checked: boolean) {
    setSelectedCategories((current) => checked
      ? current.includes(category) ? current : [...current, category]
      : current.filter((value) => value !== category));
  }

  function selectReference(reference: RecreateReference | null) {
    setSelectedReference(reference);
    if (reference) setGenerationMode(reference.format === "slideshow" ? "images" : "videos");
    const params = new URLSearchParams(window.location.search);
    for (const key of ["refType", "refId", "sourceUrl", "exploreRecreate"]) params.delete(key);
    if (reference && reference.format !== "slideshow") {
      params.set("refType", reference.format);
      params.set("refId", reference.id);
      params.set("sourceUrl", reference.videoUrl ?? "");
      params.set("exploreRecreate", "1");
    }
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }

  return (
    <section className={cn(studio.studio, "flex min-h-[calc(100dvh-4rem)] flex-col bg-background text-foreground lg:h-dvh lg:min-h-0 lg:overflow-hidden")}>
      <header className={cn(studio.header, "flex shrink-0 items-center gap-3 px-4 py-4 sm:px-6 lg:px-8")}>
        <Link href={localPreview ? "/explore?preview=1" : "/explore"} aria-label="Back to Explore" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Link>
        <div className="min-w-0"><h1 className="text-base font-semibold tracking-tight text-foreground-strong sm:text-lg">Recreate</h1><p className="hidden text-[11px] text-muted sm:block">Find a format. Make it your own.</p></div>
      </header>

      <RecreateSplitPane>
        <RecreateGenerationPanel
          localPreview={localPreview}
          mode={generationMode}
          onModeChange={setGenerationMode}
          onPreview={() => selectedReference && openPreview(selectedReference)}
          onRemove={() => selectReference(null)}
          reference={selectedReference}
        />

        <section aria-label="Reference gallery" className={cn(studio.gallery, "order-first flex min-h-0 min-w-0 flex-1 flex-col lg:order-last")}>
          <div className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-2 lg:px-6">
            <div className="flex min-w-0 items-center gap-0.5 rounded-full bg-card-muted/70 p-1" role="tablist" aria-label="Reference formats">
              {RECREATE_FORMATS.map((candidate, index) => (
                <button
                  key={candidate}
                  id={`reference-tab-${candidate}`}
                  type="button"
                  role="tab"
                  aria-selected={candidate === format}
                  aria-controls="reference-gallery"
                  tabIndex={candidate === format ? 0 : -1}
                  onClick={() => changeFormat(candidate)}
                  onKeyDown={(event) => {
                    const next = event.key === "ArrowRight" ? (index + 1) % 3 : event.key === "ArrowLeft" ? (index + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : null;
                    if (next === null) return;
                    event.preventDefault();
                    changeFormat(RECREATE_FORMATS[next]);
                    document.getElementById(`reference-tab-${RECREATE_FORMATS[next]}`)?.focus();
                  }}
                  className={cn(studio.tab, "relative h-9 whitespace-nowrap px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:px-4 sm:text-sm", candidate === format ? "bg-card text-foreground-strong shadow-sm" : "text-muted hover:bg-card/40 hover:text-foreground")}
                >{RECREATE_FORMAT_LABELS[candidate]}</button>
              ))}
            </div>
            <FilterMenu activeCategories={selectedCategories} categories={categories} count={selectedCategories.length} disabled={categories.length === 0} onClear={() => setSelectedCategories([])} onToggle={toggleCategory} />
          </div>

          <div id="reference-gallery" role="tabpanel" aria-labelledby={`reference-tab-${format}`} tabIndex={0} className="max-h-[60dvh] min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus lg:max-h-none lg:p-6">
            {loading ? <ReferenceGridSkeleton /> : null}
            {!localPreview && referencesQuery.isError ? <LoadError onRetry={() => void referencesQuery.refetch()} /> : null}
            {!localPreview && !authLoading && !user ? <p className="py-8 text-sm text-muted">Sign in to browse references.</p> : null}
            {ready && filtered.length === 0 ? <EmptyReferences format={format} hasFilters={selectedCategories.length > 0} onClear={() => setSelectedCategories([])} /> : null}
            {ready && filtered.length > 0 ? <>
              {selectedCategories.length > 0 ? <div className="mb-4 flex justify-end text-[11px]">
                <button type="button" onClick={() => setSelectedCategories([])} className="rounded-full px-2 py-1 text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">Clear filters</button>
              </div> : null}
              <div className={GALLERY_GRID}>
                {filtered.map((reference) => <ReferenceCard key={reference.id} isSelected={selectedReference?.id === reference.id} onPreview={() => openPreview(reference)} onRecreate={() => selectReference(reference)} reference={reference} />)}
              </div>
            </> : null}
          </div>
        </section>
      </RecreateSplitPane>

      <ReferencePreviewDialog key={previewReference?.id ?? "empty"} open={previewOpen} reference={previewReference} onOpenChange={setPreviewOpen} />
    </section>
  );
}

function FilterMenu({ activeCategories, categories, count, disabled, onClear, onToggle }: {
  activeCategories: readonly string[];
  categories: Array<{ id: string; label: string; count: number }>;
  count: number;
  disabled: boolean;
  onClear: () => void;
  onToggle: (category: string, checked: boolean) => void;
}) {
  return <Popover>
    <PopoverTrigger render={<Button type="button" variant="outline" size="sm" className={cn("rounded-full px-3", count > 0 && "border-primary/40 bg-primary/10 text-primary")} disabled={disabled} />}>
      <SlidersHorizontal data-icon="inline-start" aria-hidden="true" /> Filter
    </PopoverTrigger>
    <PopoverContent align="end" className={cn(studio.floating, "w-64 gap-3 rounded-[24px] border-border/60 p-4")}>
      <PopoverTitle>Filter references</PopoverTitle>
      <div className="max-h-64 space-y-1 overflow-y-auto overscroll-contain">
        {categories.map((category) => <label key={category.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-control px-2 py-2 text-sm text-foreground hover:bg-card-muted">
          <span className="flex min-w-0 items-center gap-2"><Checkbox checked={activeCategories.includes(category.id)} onCheckedChange={(checked) => onToggle(category.id, checked === true)} /><span className="truncate">{category.label}</span></span>
        </label>)}
      </div>
      {count ? <button type="button" onClick={onClear} className="w-fit text-xs font-semibold text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2">Clear filters</button> : null}
    </PopoverContent>
  </Popover>;
}

function ReferenceCard({ isSelected, onPreview, onRecreate, reference }: { isSelected: boolean; onPreview: () => void; onRecreate: () => void; reference: RecreateReference }) {
  return <article className="group min-w-0">
    <div className={cn(studio.mediaFrame, "relative overflow-hidden bg-card-muted ring-offset-background hover:shadow-card", isSelected && "ring-2 ring-primary ring-offset-2")}>
      <ReferenceMedia reference={reference} onPreview={onPreview} />
      <button type="button" onClick={onRecreate} aria-pressed={isSelected} className={cn("absolute bottom-3 right-3 inline-flex size-10 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white", isSelected ? "border-primary bg-primary text-primary-foreground" : "border-white/25 bg-black/60 text-white backdrop-blur-sm hover:bg-primary hover:border-primary")} aria-label={`Recreate ${reference.title}`} title="Recreate">
        <RotateCcw className="size-5" strokeWidth={1.6} aria-hidden="true" />
      </button>
    </div>
  </article>;
}

function ReferenceMedia({ reference, onPreview }: { reference: RecreateReference; onPreview: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const playable = Boolean(reference.videoUrl);

  function play() {
    const video = videoRef.current;
    if (!video || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    video.muted = true;
    void video.play().catch(() => setPlaying(false));
  }
  function stop() {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    if (video.readyState > 0) video.currentTime = 0;
    setPlaying(false);
  }

  return <button type="button" aria-label={`Preview ${reference.title}`} onClick={onPreview} onPointerEnter={play} onPointerLeave={stop} onFocus={play} onBlur={stop} className={cn("relative block w-full overflow-hidden bg-card-muted text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus", reference.format === "slideshow" ? "aspect-[4/5]" : "aspect-[9/16]")}>
    {playable ? <video ref={videoRef} aria-hidden="true" className="absolute inset-0 size-full object-cover" muted loop playsInline preload="none" src={reference.videoUrl} onPlaying={() => setPlaying(true)} onError={() => setFailed(true)} /> : null}
    <img alt="" src={reference.posterUrl} width={reference.slides[0]?.width ?? 720} height={reference.slides[0]?.height ?? 1280} className={cn("absolute inset-0 size-full object-cover transition-opacity duration-150 motion-reduce:transition-none", playing && "opacity-0")} loading="lazy" onError={() => setFailed(true)} />
    <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/35 via-transparent to-transparent" />
    {failed ? <span className="absolute inset-0 flex items-center justify-center bg-card-muted/90 px-3 text-center text-xs text-muted">Preview unavailable</span> : null}
    <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm">{playable ? <Play className="size-3 fill-current" aria-hidden="true" /> : <><Layers3 className="size-3" aria-hidden="true" />{reference.slides.length}</>}</span>
  </button>;
}

function ReferencePreviewDialog({ onOpenChange, open, reference }: { onOpenChange: (open: boolean) => void; open: boolean; reference: RecreateReference | null }) {
  const [activeSlide, setActiveSlide] = useState(0);
  const slideshowReference = reference?.format === "slideshow" ? reference : null;
  const activeSlideData = slideshowReference?.slides[activeSlide] ?? null;

  return <Dialog open={open} onOpenChange={onOpenChange} onOpenChangeComplete={(isOpen) => { if (!isOpen) setActiveSlide(0); }}>
    <DialogContent className={cn(studio.dialog, "max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-[28px] border-border/60 p-0 sm:max-w-[850px]")} overlayClassName={cn(studio.overlay, "bg-overlay/88")}>
      {reference ? <>
        <DialogHeader className="p-4 pr-12 sm:px-5"><DialogTitle>{slideshowReference ? "Slideshow preview" : "Video preview"}</DialogTitle><DialogDescription className="sr-only">{slideshowReference ? "Browse the complete slideshow using Previous, Next or the thumbnails." : "Watch the reference using the video controls."}</DialogDescription></DialogHeader>
        <div className="min-h-0 overflow-y-auto bg-card-muted/45 p-4 sm:p-5">
          {slideshowReference && activeSlideData ? <div className="mx-auto max-w-[520px]"><img src={activeSlideData.url} width={activeSlideData.width} height={activeSlideData.height} alt={`${slideshowReference.title}, slide ${activeSlide + 1}`} className="mx-auto h-auto max-h-[62dvh] w-auto max-w-full rounded-2xl object-contain shadow-card" />
            <div className="mt-3 flex items-center justify-between gap-2"><Button type="button" variant="outline" size="sm" className="rounded-full" disabled={activeSlide === 0} onClick={() => setActiveSlide((current) => current - 1)}><ArrowLeft data-icon="inline-start" aria-hidden="true" /> Previous</Button><span aria-live="polite" className="text-[11px] font-medium tabular-nums text-muted">{activeSlide + 1} / {slideshowReference.slides.length}</span><Button type="button" variant="outline" size="sm" className="rounded-full" disabled={activeSlide === slideshowReference.slides.length - 1} onClick={() => setActiveSlide((current) => current + 1)}>Next <ArrowRight data-icon="inline-end" aria-hidden="true" /></Button></div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{slideshowReference.slides.map((slide, index) => <button key={slide.id} type="button" onClick={() => setActiveSlide(index)} aria-label={`View slide ${index + 1}`} aria-current={activeSlide === index ? "step" : undefined} className={cn("w-11 shrink-0 overflow-hidden rounded-xl border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus", activeSlide === index ? "border-primary ring-1 ring-primary/30" : "border-border")}><img alt="" src={slide.url} width={slide.width} height={slide.height} className="aspect-[4/5] w-full object-contain" /></button>)}</div>
          </div> : <video aria-label={`Preview ${reference.title}`} className="mx-auto h-auto max-h-[65dvh] w-auto max-w-full rounded-[20px] object-contain shadow-card" controls playsInline poster={reference.posterUrl} src={reference.videoUrl} />}
        </div>
      </> : null}
    </DialogContent>
  </Dialog>;
}

function ReferenceGridSkeleton() {
  return <div className={GALLERY_GRID} aria-busy="true" aria-label="Loading references">{Array.from({ length: 10 }, (_, index) => <div key={index} className="overflow-hidden rounded-[20px] bg-card"><Skeleton className="aspect-[9/16] w-full rounded-none motion-reduce:animate-none" /></div>)}</div>;
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return <div className="flex min-h-75 flex-col items-center justify-center rounded-[24px] bg-card-muted/45 px-6 text-center"><p className="text-sm font-semibold text-foreground-strong">References could not load</p><p className="mt-2 max-w-sm text-sm leading-6 text-muted">Your saved projects remain unchanged. Try loading the catalogue again.</p><Button type="button" variant="outline" className="mt-5 rounded-full" onClick={onRetry}><RefreshCw data-icon="inline-start" aria-hidden="true" /> Try again</Button></div>;
}

function EmptyReferences({ format, hasFilters, onClear }: { format: RecreateFormat; hasFilters: boolean; onClear: () => void }) {
  return <div className="flex min-h-75 flex-col items-center justify-center rounded-[24px] bg-card-muted/45 px-6 text-center"><Filter className="size-5 text-muted-subtle" aria-hidden="true" /><p className="mt-3 text-sm font-semibold text-foreground-strong">{hasFilters ? <>No {RECREATE_FORMAT_LABELS[format].toLowerCase()} match this filter</> : <>No {RECREATE_FORMAT_LABELS[format].toLowerCase()} yet</>}</p>{hasFilters ? <Button type="button" variant="outline" className="mt-5 rounded-full" onClick={onClear}>Clear filters</Button> : <p className="mt-2 text-sm leading-6 text-muted">This format will appear here when its references are ready.</p>}</div>;
}

async function fetchRecreateReferences(signal?: AbortSignal): Promise<RecreateReference[]> {
  const token = await getCurrentUserIdToken();
  if (!token) throw new Error("Sign in before opening Recreate.");
  const response = await fetch("/api/explore/recreate-references", {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  const data = await response.json().catch(() => null) as RecreateReferencesResponse | null;
  if (!response.ok || data?.ok !== true || !("items" in data) || !Array.isArray(data.items)) throw new Error(data && "message" in data && typeof data.message === "string" ? data.message : "Could not load references.");
  return data.items;
}
