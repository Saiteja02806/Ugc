"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Check, Images, ScanText, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const part2Slides = [
  "/marketing/showcase-part2/slideshow/image_0.jpg",
  "/marketing/showcase-part2/slideshow/image_1.jpg",
  "/marketing/showcase-part2/slideshow/image_2.jpg",
  "/marketing/showcase-part2/slideshow/image_3.jpg",
  "/marketing/showcase-part2/slideshow/image_4.jpg",
  "/marketing/showcase-part2/slideshow/image_5.jpg",
];

export function LandingFormatsBento() {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % part2Slides.length);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* ========================================================= */}
      {/* Card 1: Reel Hooks */}
      {/* ========================================================= */}
      <article className="group flex flex-col justify-between overflow-hidden rounded-[var(--radius-panel)] border border-border bg-card shadow-card transition-all duration-300 hover:border-primary/40 hover:shadow-floating">
        <div className="p-5 sm:p-6 pb-0 sm:pb-0">
          <div className="flex items-center justify-between gap-3">
            <span className="flex size-9 items-center justify-center rounded-control bg-selected text-primary">
              <Sparkles className="size-4.5" aria-hidden="true" />
            </span>
            <span className="rounded-full border border-primary/20 bg-selected px-2.5 py-0.5 text-[11px] font-semibold text-primary">
              Format 01
            </span>
          </div>

          <h3 className="mt-4 text-xl font-semibold text-foreground-strong">
            Reel Hooks
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Stop the scroll in the first 2 seconds with AI-scripted openers tailored to your niche.
          </p>
        </div>

        {/* Video Preview */}
        <div className="p-5 sm:p-6">
          <div className="relative aspect-[9/13] w-full overflow-hidden rounded-card border border-border bg-black shadow-sm">
            <div className="absolute left-2.5 top-2.5 z-20 flex items-center gap-1 rounded-full border border-white/20 bg-black/65 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-md">
              <Sparkles className="size-3 text-amber-400" aria-hidden="true" />
              <span>Hook Video</span>
            </div>

            <video
              src="/marketing/showcase-part2/hook2-preview.mp4"
              autoPlay
              muted
              playsInline
              preload="metadata"
              className="size-full object-cover"
            />

            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/30"
              aria-hidden="true"
            />
          </div>

          {/* Key Feature Bullets */}
          <ul className="mt-4 space-y-2 text-xs leading-relaxed text-muted">
            <li className="flex items-center gap-2">
              <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span><strong>20+ daily hooks</strong> refreshed automatically</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span>High-retention viral opening angles</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span>1-click script and angle customization</span>
            </li>
          </ul>
        </div>
      </article>

      {/* ========================================================= */}
      {/* Card 2: Wall-of-Text Reels */}
      {/* ========================================================= */}
      <article className="group flex flex-col justify-between overflow-hidden rounded-[var(--radius-panel)] border border-border bg-card shadow-card transition-all duration-300 hover:border-primary/40 hover:shadow-floating">
        <div className="p-5 sm:p-6 pb-0 sm:pb-0">
          <div className="flex items-center justify-between gap-3">
            <span className="flex size-9 items-center justify-center rounded-control bg-selected text-primary">
              <ScanText className="size-4.5" aria-hidden="true" />
            </span>
            <span className="rounded-full border border-primary/20 bg-selected px-2.5 py-0.5 text-[11px] font-semibold text-primary">
              Format 02
            </span>
          </div>

          <h3 className="mt-4 text-xl font-semibold text-foreground-strong">
            Wall-of-Text Reels
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Deliver deep value fast with readable script overlays timed perfectly over moving B-roll.
          </p>
        </div>

        {/* Video Preview */}
        <div className="p-5 sm:p-6">
          <div className="relative aspect-[9/13] w-full overflow-hidden rounded-card border border-border bg-black shadow-sm">
            <div className="absolute left-2.5 top-2.5 z-20 flex items-center gap-1 rounded-full border border-white/20 bg-black/65 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-md">
              <ScanText className="size-3 text-primary" aria-hidden="true" />
              <span>Wall of Text</span>
            </div>

            <video
              src="/marketing/showcase-part2/wot2-preview.mp4"
              autoPlay
              muted
              playsInline
              preload="metadata"
              className="size-full object-cover"
            />

            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/30"
              aria-hidden="true"
            />
          </div>

          {/* Key Feature Bullets */}
          <ul className="mt-4 space-y-2 text-xs leading-relaxed text-muted">
            <li className="flex items-center gap-2">
              <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span>Auto-formatted vertical typography</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span>Curated human-safe video B-roll</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span>Paced for effortless Instagram reading</span>
            </li>
          </ul>
        </div>
      </article>

      {/* ========================================================= */}
      {/* Card 3: Slideshow Carousels */}
      {/* ========================================================= */}
      <article className="group flex flex-col justify-between overflow-hidden rounded-[var(--radius-panel)] border border-border bg-card shadow-card transition-all duration-300 hover:border-primary/40 hover:shadow-floating">
        <div className="p-5 sm:p-6 pb-0 sm:pb-0">
          <div className="flex items-center justify-between gap-3">
            <span className="flex size-9 items-center justify-center rounded-control bg-selected text-primary">
              <Images className="size-4.5" aria-hidden="true" />
            </span>
            <span className="rounded-full border border-primary/20 bg-selected px-2.5 py-0.5 text-[11px] font-semibold text-primary">
              Format 03
            </span>
          </div>

          <h3 className="mt-4 text-xl font-semibold text-foreground-strong">
            Slideshow Posts
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Build swipeable multi-slide visual decks that earn saves, shares, and high engagement.
          </p>
        </div>

        {/* Carousel Preview */}
        <div className="p-5 sm:p-6">
          <div className="relative aspect-[9/13] w-full overflow-hidden rounded-card border border-border bg-black shadow-sm group/carousel">
            <div className="absolute left-2.5 top-2.5 z-20 flex items-center gap-1 rounded-full border border-white/20 bg-black/65 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-md">
              <Images className="size-3 text-accent-pink" aria-hidden="true" />
              <span>Slideshow</span>
            </div>

            <div className="absolute right-2.5 top-2.5 z-20 rounded-full border border-white/15 bg-black/60 px-2 py-0.5 font-mono text-[10px] font-medium text-white/90 backdrop-blur-md">
              {activeSlide + 1}/{part2Slides.length}
            </div>

            {/* Horizontal sliding track */}
            <div
              className="flex size-full transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]"
              style={{ transform: `translateX(-${activeSlide * 100}%)` }}
            >
              {part2Slides.map((src, index) => (
                <div key={src} className="relative size-full shrink-0">
                  <Image
                    src={src}
                    alt={`Slideshow slide ${index + 1}`}
                    fill
                    sizes="(max-width: 768px) 240px, 320px"
                    className="object-cover"
                    priority={index === 0}
                  />
                </div>
              ))}
            </div>

            {/* Interactive hover navigation arrows */}
            <div className="absolute inset-x-2 top-1/2 z-20 flex -translate-y-1/2 justify-between opacity-0 transition-opacity duration-200 group-hover/carousel:opacity-100">
              <button
                type="button"
                onClick={() =>
                  setActiveSlide((prev) =>
                    prev === 0 ? part2Slides.length - 1 : prev - 1
                  )
                }
                aria-label="Previous slide"
                className="flex size-6 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() =>
                  setActiveSlide((prev) => (prev + 1) % part2Slides.length)
                }
                aria-label="Next slide"
                className="flex size-6 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80"
              >
                ›
              </button>
            </div>

            {/* Pagination dots */}
            <div className="absolute inset-x-0 bottom-2.5 z-20 flex justify-center gap-1">
              {part2Slides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveSlide(idx)}
                  aria-label={`Go to slide ${idx + 1}`}
                  className={cn(
                    "size-1.5 rounded-full transition-all duration-300",
                    idx === activeSlide
                      ? "w-3.5 bg-white shadow-sm"
                      : "bg-white/40 hover:bg-white/70"
                  )}
                />
              ))}
            </div>

            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/30"
              aria-hidden="true"
            />
          </div>

          {/* Key Feature Bullets */}
          <ul className="mt-4 space-y-2 text-xs leading-relaxed text-muted">
            <li className="flex items-center gap-2">
              <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span>Complete 6-slide story arcs ready to post</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span>Product asset & app screenshot integration</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span>1-click review & direct Instagram scheduling</span>
            </li>
          </ul>
        </div>
      </article>
    </div>
  );
}
