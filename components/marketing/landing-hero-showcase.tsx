"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Images, ScanText, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const slideshowImages = [
  "/marketing/showcase/slideshow/image_0.jpg",
  "/marketing/showcase/slideshow/image_1.jpg",
  "/marketing/showcase/slideshow/image_2.jpg",
  "/marketing/showcase/slideshow/image_3.jpg",
  "/marketing/showcase/slideshow/image_4.jpg",
  "/marketing/showcase/slideshow/image_5.jpg",
];

export function LandingHeroShowcase() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [shouldLoadVideoPreviews, setShouldLoadVideoPreviews] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slideshowImages.length);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShouldLoadVideoPreviews(true);
    }, 750);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-[1140px] px-2 sm:px-4">
      {/* Visual background ambient glow behind center hero */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-[320px] sm:size-[460px] rounded-full opacity-35 blur-[70px]"
        style={{
          background:
            "radial-gradient(circle, var(--instagram-orange) 0%, var(--instagram-rose) 50%, var(--instagram-violet) 100%)",
        }}
        aria-hidden="true"
      />

      {/* 3-Card Showcase Stage */}
      <div className="relative flex flex-col items-center justify-center gap-6 sm:gap-4 md:flex-row md:items-end md:justify-center">
        {/* ========================================================= */}
        {/* 1. Left Card: Wall of Text (Tilted -5°, Left corner dipped) */}
        {/* ========================================================= */}
        <div className="relative z-0 order-2 w-[240px] sm:w-[260px] lg:w-[290px] md:order-1 shrink-0">
          <div className="transform-gpu transition-transform duration-300 md:-rotate-[5deg] md:origin-top-right md:translate-y-4 hover:scale-[1.02]">
            <article className="group relative aspect-[9/16] w-full overflow-hidden rounded-[20px] sm:rounded-[24px] border border-border/80 bg-black shadow-card ring-1 ring-white/10">
              {/* Subtle format pill */}
              <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full border border-white/20 bg-black/65 px-3 py-1 text-[11px] font-semibold tracking-wide text-white backdrop-blur-md shadow-sm">
                <ScanText className="size-3.5 text-primary" aria-hidden="true" />
                <span>Wall of Text</span>
              </div>

              {/* Video preview */}
              <video
                src={
                  shouldLoadVideoPreviews
                    ? "/marketing/showcase/wot-preview-v2.mp4"
                    : undefined
                }
                autoPlay
                muted
                loop
                playsInline
                poster="/marketing/showcase/wot-preview-poster-v2.webp"
                preload="metadata"
                className="size-full object-cover"
              />

              {/* Subtle edge overlay for visual polish */}
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/30"
                aria-hidden="true"
              />
            </article>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. Center Card: Hook Video (100% visible, Upright 0°, z-20) */}
        {/* ========================================================= */}
        <div className="relative z-20 order-1 w-[260px] sm:w-[290px] lg:w-[325px] md:order-2 shrink-0">
          <div className="transform-gpu transition-transform duration-300 hover:scale-[1.02]">
            <article className="group relative aspect-[9/16] w-full overflow-hidden rounded-[22px] sm:rounded-[26px] border-2 border-border-strong bg-black shadow-floating ring-1 ring-white/20">
              {/* Format pill with accent */}
              <div className="absolute left-3.5 top-3.5 z-20 flex items-center gap-1.5 rounded-full border border-white/25 bg-black/70 px-3.5 py-1 text-xs font-semibold tracking-wide text-white backdrop-blur-md shadow-md">
                <Sparkles className="size-3.5 text-amber-400" aria-hidden="true" />
                <span>Hook+Demo</span>
              </div>

              {/* Real Hook Video playback */}
              <video
                src={
                  shouldLoadVideoPreviews
                    ? "/marketing/showcase/hook-preview-v3.mp4"
                    : undefined
                }
                autoPlay
                muted
                loop
                playsInline
                poster="/marketing/showcase/hook-preview-poster-v3.webp"
                preload="metadata"
                onLoadedMetadata={(event) => {
                  // Always begin the hero preview at its influencer cover frame.
                  event.currentTarget.currentTime = 0;
                }}
                className="size-full object-cover"
              />

              {/* Polished ambient highlight */}
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/25"
                aria-hidden="true"
              />
            </article>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 3. Right Card: Slideshow (Tilted +5°, Right corner dipped) */}
        {/* ========================================================= */}
        <div className="relative z-0 order-3 w-[240px] sm:w-[260px] lg:w-[290px] shrink-0">
          <div className="transform-gpu transition-transform duration-300 md:rotate-[5deg] md:origin-top-left md:translate-y-4 hover:scale-[1.02]">
            {/* Stacked card deck layer underneath to immediately signal a multi-slide carousel */}
            <div
              className="absolute -right-1.5 -top-1.5 bottom-1.5 w-full rounded-[22px] sm:rounded-[26px] border border-white/10 bg-white/5 backdrop-blur-[2px]"
              aria-hidden="true"
            />
            <div
              className="absolute -right-3 -top-3 bottom-3 w-full rounded-[22px] sm:rounded-[26px] border border-white/5 bg-white/[0.02]"
              aria-hidden="true"
            />

            <article className="group relative aspect-[9/16] w-full overflow-hidden rounded-[20px] sm:rounded-[24px] border border-border/80 bg-black shadow-card ring-1 ring-white/10">
              {/* Subtle format pill */}
              <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full border border-white/20 bg-black/65 px-3 py-1 text-[11px] font-semibold tracking-wide text-white backdrop-blur-md shadow-sm">
                <Images className="size-3.5 text-accent-pink" aria-hidden="true" />
                <span>Slideshow</span>
              </div>

              {/* Multi-slide carousel indicator badge */}
              <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-full border border-white/20 bg-black/65 px-2.5 py-0.5 font-mono text-[10px] font-medium text-white backdrop-blur-md shadow-sm">
                <Images className="size-3 text-white/80" aria-hidden="true" />
                <span>{activeSlide + 1}/{slideshowImages.length}</span>
              </div>

              {/* Horizontal sliding track for true carousel motion */}
              <div
                className="flex size-full transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]"
                style={{ transform: `translateX(-${activeSlide * 100}%)` }}
              >
                {slideshowImages.map((src, index) => (
                  <div
                    key={src}
                    className="relative size-full shrink-0"
                  >
                    <Image
                      src={src}
                      alt={`Slideshow slide ${index + 1}`}
                      fill
                      sizes="(max-width: 768px) 240px, (max-width: 1024px) 260px, 290px"
                      className="object-cover"
                      priority={index === 0}
                    />
                  </div>
                ))}
              </div>

              {/* Carousel navigation buttons on hover/interaction */}
              <div className="absolute inset-x-2 top-1/2 z-20 flex -translate-y-1/2 justify-between opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() =>
                    setActiveSlide((prev) =>
                      prev === 0 ? slideshowImages.length - 1 : prev - 1
                    )
                  }
                  aria-label="Previous slide"
                  className="flex size-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-colors hover:bg-black/80"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveSlide((prev) =>
                      (prev + 1) % slideshowImages.length
                    )
                  }
                  aria-label="Next slide"
                  className="flex size-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-colors hover:bg-black/80"
                >
                  ›
                </button>
              </div>

              {/* Slide pagination pill dots at bottom */}
              <div className="absolute inset-x-0 bottom-4 z-20 flex justify-center gap-1.5">
                {slideshowImages.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveSlide(idx)}
                    aria-label={`Go to slide ${idx + 1}`}
                    className={cn(
                      "size-1.5 rounded-full transition-all duration-300",
                      idx === activeSlide
                        ? "w-4 bg-white shadow-sm"
                        : "bg-white/40 hover:bg-white/70"
                    )}
                  />
                ))}
              </div>

              {/* Subtle edge overlay for visual polish */}
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/30"
                aria-hidden="true"
              />
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}
