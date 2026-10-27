"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import previewAssets from "@/lib/marketing/landing-preview-assets.json";
import { LANDING_GALLERY_INITIAL_POSITION, LANDING_GALLERY_STEP_MS, landingGalleryLayout, landingGalleryPosition } from "@/lib/marketing/landing-gallery-motion";
import { cn } from "@/lib/utils";
import { LandingPreviewVideo } from "./landing-preview-video";

type VideoAsset = (typeof previewAssets.videos)[keyof typeof previewAssets.videos];
type SlideshowAsset = (typeof previewAssets.slideshows)[keyof typeof previewAssets.slideshows];
type GalleryItem = { title: string } & ({ kind: "video"; asset: VideoAsset } | { kind: "slides"; asset: SlideshowAsset });
const items: GalleryItem[] = [
  { kind: "video", asset: previewAssets.videos.outerLeft, title: "Compact Hook Explore video" },
  { kind: "video", asset: previewAssets.videos.wallLeft, title: "Wall of Text Explore video" },
  { kind: "slides", asset: previewAssets.slideshows.slideshowLeft, title: "Fitness slideshow Explore preview" },
  { kind: "video", asset: previewAssets.videos.hookPrimary, title: "Primary Hook Explore video" },
  { kind: "slides", asset: previewAssets.slideshows.slideshowRight, title: "Fitness training slideshow Explore preview" },
  { kind: "video", asset: previewAssets.videos.wallRight, title: "Second Wall of Text Explore video" },
  { kind: "video", asset: previewAssets.videos.outerRight, title: "Second compact Hook Explore video" },
  { kind: "video", asset: previewAssets.videos.talkingDemo, title: "Talking Head and Demo Explore video" },
  { kind: "video", asset: previewAssets.videos.hookExtra, title: "Keyboard reaction Hook Explore video" },
  { kind: "video", asset: previewAssets.videos.demoExample, title: "Talking Head and Demo opening Explore video" },
  { kind: "video", asset: previewAssets.videos.wallExtra, title: "Story Wall of Text Explore video" },
];

export function LandingHeroGallery() {
  const stage = useRef<HTMLDivElement>(null);
  const cards = useRef<Array<HTMLDivElement | null>>([]);
  const phase = useRef(LANDING_GALLERY_INITIAL_POSITION);
  const focal = useRef(LANDING_GALLERY_INITIAL_POSITION);
  const touchStart = useRef<number | null>(null);
  const repaint = useRef<() => void>(() => {});
  const [active, setActive] = useState(LANDING_GALLERY_INITIAL_POSITION);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [touching, setTouching] = useState(false);
  const held = focused || touching;

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compact = window.matchMedia("(max-width: 639px)");
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
    let visible = false;
    let frame = 0;
    let previous = 0;
    const paint = (now: number) => {
      const moving = hovered && !paused && !held && visible && !reduced.matches && !connection?.saveData
        && navigator.onLine && document.visibilityState !== "hidden";
      if (moving && previous) phase.current = (phase.current + Math.min(now - previous, 64) / LANDING_GALLERY_STEP_MS) % items.length;
      previous = now;
      element.dataset.motion = moving ? "running" : "paused";
      element.dataset.phase = phase.current.toFixed(4);
      const next = Math.round(phase.current) % items.length;
      if (next !== focal.current) { focal.current = next; setActive(next); }
      cards.current.forEach((card, index) => {
        if (!card) return;
        const position = landingGalleryPosition(index, phase.current, items.length);
        const layout = landingGalleryLayout(position, compact.matches);
        card.style.transform = `translate3d(calc(-50% + ${layout.x}px), -50%, 0) scale(${layout.scale})`;
        card.style.opacity = String(layout.opacity);
        card.style.visibility = layout.opacity > 0 ? "visible" : "hidden";
        card.style.zIndex = String(Math.round(100 - Math.abs(position) * 10));
        const article = card.firstElementChild as HTMLElement | null;
        if (article) article.style.borderRadius = `${22 / layout.scale}px`;
        card.inert = Math.abs(position) > 3.5;
      });
      frame = moving ? requestAnimationFrame(paint) : 0;
    };
    const wake = () => { cancelAnimationFrame(frame); previous = 0; frame = requestAnimationFrame(paint); };
    repaint.current = wake;
    const observer = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); wake(); });
    observer.observe(element);
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    window.addEventListener("offline", wake);
    window.addEventListener("resize", wake);
    reduced.addEventListener("change", wake);
    connection?.addEventListener("change", wake);
    wake();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); repaint.current = () => {};
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake); window.removeEventListener("offline", wake);
      window.removeEventListener("resize", wake); reduced.removeEventListener("change", wake);
      connection?.removeEventListener("change", wake);
    };
  }, [paused, held, hovered]);

  const step = (delta: number) => {
    phase.current = (Math.round(phase.current) + delta + items.length) % items.length;
    repaint.current();
  };

  return (
    <div className="relative left-1/2 w-[calc(100vw-2rem)] max-w-[1320px] -translate-x-1/2" data-hero-gallery>
      <div aria-hidden="true" className="pointer-events-none absolute bottom-[7%] left-1/2 h-32 w-[76%] -translate-x-1/2 rounded-full bg-primary/20 blur-[72px] dark:bg-primary/15" />
      <div ref={stage} role="region" aria-roledescription="carousel" aria-label="Explore content examples"
        className="group/gallery relative h-[480px] touch-pan-y overflow-hidden sm:h-[510px]"
        onPointerEnter={event => { if (event.pointerType === "mouse") setHovered(true); }}
        onPointerLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
        onKeyDown={event => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault(); step(event.key === "ArrowRight" ? 1 : -1);
          }
        }}
        onPointerDown={event => { if (event.pointerType !== "mouse") { touchStart.current = event.clientX; setTouching(true); } }}
        onPointerUp={event => {
          if (touchStart.current !== null) {
            const delta = touchStart.current - event.clientX;
            if (Math.abs(delta) > 35) step(delta > 0 ? 1 : -1);
            touchStart.current = null; setTouching(false);
          }
        }}
        onPointerCancel={() => { touchStart.current = null; setTouching(false); }}>
        {items.map((item, index) => {
          const layout = landingGalleryLayout(landingGalleryPosition(index, LANDING_GALLERY_INITIAL_POSITION, items.length));
          return (
            <div key={item.asset.sourceId} ref={element => { cards.current[index] = element; }}
              data-hero-gallery-card data-source-id={item.asset.sourceId} data-focal={active === index}
              className="absolute left-1/2 top-1/2 h-[480px] w-[270px] will-change-transform"
              style={{ transform: `translate3d(calc(-50% + ${layout.x}px), -50%, 0) scale(${layout.scale})`, opacity: layout.opacity, visibility: layout.opacity > 0 ? "visible" : "hidden" }}>
              <article className={cn("group relative size-full overflow-hidden rounded-[22px] border bg-black shadow-[0_18px_55px_rgba(0,0,0,0.28)] ring-1 ring-white/10", active === index ? "border-border-strong" : "border-border/80")}>
                {item.kind === "video"
                  ? <LandingPreviewVideo src={item.asset.src} poster={item.asset.poster} title={item.title} autoPlay={active === index} playbackAllowed={active === index} />
                  : <SlideshowContent asset={item.asset} title={item.title} active={active === index} />}
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10" />
              </article>
            </div>
          );
        })}
        <div className="absolute bottom-0 right-1 z-[110] flex gap-1 rounded-full border border-border/80 bg-background/90 p-1 text-muted-foreground backdrop-blur-md">
          <button type="button" onClick={() => step(-1)} aria-label="Previous content example" className="flex size-8 items-center justify-center rounded-full hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"><ChevronLeft className="size-4" /></button>
          <button type="button" onClick={() => setPaused(value => !value)} aria-label={paused ? "Resume gallery motion" : "Pause gallery motion"} aria-pressed={paused}
            className="flex size-8 items-center justify-center rounded-full hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">
            {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
          </button>
          <button type="button" onClick={() => step(1)} aria-label="Next content example" className="flex size-8 items-center justify-center rounded-full hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"><ChevronRight className="size-4" /></button>
        </div>
      </div>
    </div>
  );
}

function SlideshowContent({ asset, title, active }: { asset: SlideshowAsset; title: string; active: boolean }) {
  const [activeSlide, setActiveSlide] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
      if (document.visibilityState === "hidden" || !navigator.onLine || connection?.saveData
        || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      setActiveSlide(index => (index + 1) % asset.slides.length);
    }, 2000);
    return () => clearInterval(timer);
  }, [active, asset.slides.length]);
  return (
    <div aria-label={title} data-active-slide={activeSlide} className="relative size-full">
      <Image src={asset.slides[activeSlide].src} alt="" fill sizes="270px" className="object-cover" />
      <div className="absolute inset-x-1 top-1/2 z-10 flex -translate-y-1/2 justify-between">
        {[-1, 1].map(delta => <button key={delta} type="button" aria-label={`${delta < 0 ? "Previous" : "Next"} slide in ${title}`}
          onClick={() => setActiveSlide(index => (index + delta + asset.slides.length) % asset.slides.length)}
          onKeyDown={event => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault(); event.stopPropagation();
              setActiveSlide(index => (index + (event.key === "ArrowRight" ? 1 : -1) + asset.slides.length) % asset.slides.length);
            }
          }}
          className="flex size-8 items-center justify-center rounded-full border border-white/20 bg-black/65 text-white focus-visible:outline-2 focus-visible:outline-white">
          {delta < 0 ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
        </button>)}
      </div>
    </div>
  );
}
