"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Clapperboard, Images, ScanText, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const part2Slides = [
  "/marketing/showcase-part2/slideshow/image_0.jpg",
  "/marketing/showcase-part2/slideshow/image_1.jpg",
  "/marketing/showcase-part2/slideshow/image_2.jpg",
  "/marketing/showcase-part2/slideshow/image_3.jpg",
  "/marketing/showcase-part2/slideshow/image_4.jpg",
  "/marketing/showcase-part2/slideshow/image_5.jpg",
];

export function LandingFormatShelf() {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % part2Slides.length);
    }, 2600);
    return () => clearInterval(timer);
  }, []);

  return (
    <article className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-card shadow-card">
      <div className="flex items-start justify-between gap-4 border-b border-border p-6">
        <div>
          <p className="text-sm font-semibold text-primary">
            Trending formats layout
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-foreground-strong">
            A visual shelf for your approved formats.
          </h3>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
            Fresh trending formats matched to your brand niche daily. Pick your
            favorite angle, customize the script, and schedule in one click.
          </p>
        </div>
        <Clapperboard className="size-5 shrink-0 text-primary" aria-hidden="true" />
      </div>

      <div className="grid grid-cols-3 gap-2.5 bg-card-muted p-3.5 sm:gap-4 sm:p-6">
        {/* ========================================================= */}
        {/* Slot 1: Hook Video */}
        {/* ========================================================= */}
        <div className="relative aspect-[9/15] overflow-hidden rounded-[14px] sm:rounded-[18px] border border-border/80 bg-black shadow-card ring-1 ring-white/10">
          {/* Frosted format badge */}
          <div className="absolute left-2 top-2 z-20 flex items-center gap-1 rounded-full border border-white/20 bg-black/65 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-white backdrop-blur-md shadow-sm">
            <Sparkles className="size-3 text-amber-400" aria-hidden="true" />
            <span>Hook</span>
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

        {/* ========================================================= */}
        {/* Slot 2: Wall of Text */}
        {/* ========================================================= */}
        <div className="relative aspect-[9/15] overflow-hidden rounded-[14px] sm:rounded-[18px] border border-border/80 bg-black shadow-card ring-1 ring-white/10">
          {/* Frosted format badge */}
          <div className="absolute left-2 top-2 z-20 flex items-center gap-1 rounded-full border border-white/20 bg-black/65 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-white backdrop-blur-md shadow-sm">
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

        {/* ========================================================= */}
        {/* Slot 3: Slideshow */}
        {/* ========================================================= */}
        <div className="relative aspect-[9/15] overflow-hidden rounded-[14px] sm:rounded-[18px] border border-border/80 bg-black shadow-card ring-1 ring-white/10">
          {/* Frosted format badge */}
          <div className="absolute left-2 top-2 z-20 flex items-center gap-1 rounded-full border border-white/20 bg-black/65 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold text-white backdrop-blur-md shadow-sm">
            <Images className="size-3 text-accent-pink" aria-hidden="true" />
            <span>Slideshow</span>
          </div>

          {/* Slide counter */}
          <div className="absolute right-2 top-2 z-20 rounded-full border border-white/15 bg-black/60 px-1.5 py-0.5 font-mono text-[9px] font-medium text-white/90 backdrop-blur-md">
            {activeSlide + 1}/{part2Slides.length}
          </div>

          {/* Horizontal sliding carousel track */}
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
                  sizes="(max-width: 768px) 120px, 180px"
                  className="object-cover"
                  priority={index === 0}
                />
              </div>
            ))}
          </div>

          {/* Slide pagination dots at bottom */}
          <div className="absolute inset-x-0 bottom-2.5 z-20 flex justify-center gap-1">
            {part2Slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveSlide(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={cn(
                  "size-1 rounded-full transition-all duration-300",
                  idx === activeSlide
                    ? "w-3 bg-white shadow-sm"
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
      </div>
    </article>
  );
}
