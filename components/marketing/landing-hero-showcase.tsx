"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Images, ScanText, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const heroMediaPath = "/marketing/showcase/hero-restored";
const slideshowImages = Array.from(
  { length: 6 },
  (_, index) => `${heroMediaPath}/slideshow/image_${index}.jpg`,
);

export function LandingHeroShowcase() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [shouldLoadVideoPreviews, setShouldLoadVideoPreviews] = useState(false);
  const [shouldLoadSideVideoPreviews, setShouldLoadSideVideoPreviews] = useState(false);

  useEffect(() => {
    if (!shouldLoadSideVideoPreviews) return;

    const timer = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slideshowImages.length);
    }, 2800);

    return () => window.clearInterval(timer);
  }, [shouldLoadSideVideoPreviews]);

  useEffect(() => {
    const desktopMedia = window.matchMedia("(min-width: 1024px)");
    let readyToLoad = false;

    function updateSidePreviews() {
      setShouldLoadSideVideoPreviews(readyToLoad && desktopMedia.matches);
    }

    const timer = window.setTimeout(() => {
      readyToLoad = true;
      setShouldLoadVideoPreviews(true);
      updateSidePreviews();
    }, 750);

    desktopMedia.addEventListener("change", updateSidePreviews);

    return () => {
      clearTimeout(timer);
      desktopMedia.removeEventListener("change", updateSidePreviews);
    };
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
      <div className="relative flex flex-col items-center justify-center gap-6 sm:gap-4 lg:flex-row lg:items-end lg:justify-center">
        {/* ========================================================= */}
        {/* 1. Left Card: supplied left_side video */}
        {/* ========================================================= */}
        <div className="relative z-0 order-2 hidden w-[240px] shrink-0 lg:order-1 lg:block lg:w-[290px]">
          <div className="transform-gpu transition-transform duration-300 lg:-rotate-[5deg] lg:origin-top-right lg:translate-y-4 hover:scale-[1.02]">
            <article className="group relative aspect-[9/16] w-full overflow-hidden rounded-[20px] sm:rounded-[24px] border border-border/80 bg-black shadow-card ring-1 ring-white/10">
              {/* Subtle format pill */}
              <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full border border-white/20 bg-black/65 px-3 py-1 text-[11px] font-semibold tracking-wide text-white backdrop-blur-md shadow-sm">
                <ScanText className="size-3.5 text-primary" aria-hidden="true" />
                <span>Wall of Text</span>
              </div>

              {/* Video preview */}
              <video
                src={
                  shouldLoadSideVideoPreviews
                    ? `${heroMediaPath}/left_side-v2.mp4`
                    : undefined
                }
                autoPlay
                muted
                loop
                playsInline
                poster={`${heroMediaPath}/left_side-v2.webp`}
                aria-label="Wall of Text video preview"
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
        {/* 2. Center Card: supplied middle video */}
        {/* ========================================================= */}
        <div className="relative z-20 order-1 w-[min(72vw,260px)] shrink-0 sm:w-[290px] lg:order-2 lg:w-[325px]">
          <div className="transform-gpu transition-transform duration-300 hover:scale-[1.02]">
            <article className="group relative aspect-[9/16] w-full overflow-hidden rounded-[22px] sm:rounded-[26px] border-2 border-border-strong bg-black shadow-floating ring-1 ring-white/20">
              {/* Format pill with accent */}
              <div className="absolute left-3.5 top-3.5 z-20 flex items-center gap-1.5 rounded-full border border-white/25 bg-black/70 px-3.5 py-1 text-xs font-semibold tracking-wide text-white backdrop-blur-md shadow-md">
                <Sparkles className="size-3.5 text-amber-400" aria-hidden="true" />
                <span>Hook+Demo</span>
              </div>

              {/* Supplied middle video playback */}
              <video
                src={
                  shouldLoadVideoPreviews
                    ? `${heroMediaPath}/middle.mp4`
                    : undefined
                }
                autoPlay
                muted
                loop
                playsInline
                poster={`${heroMediaPath}/middle.webp`}
                aria-label="Hook and demo video preview"
                preload="metadata"
                onLoadedMetadata={(event) => {
                  // Begin the supplied video at its first frame.
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
        {/* 3. Right Card: supplied right_side slideshow */}
        {/* ========================================================= */}
        <div className="relative z-0 order-3 hidden w-[240px] shrink-0 lg:block lg:w-[290px]">
          <div className="transform-gpu transition-transform duration-300 lg:rotate-[5deg] lg:origin-top-left lg:translate-y-4 hover:scale-[1.02]">
            <article className="group relative aspect-[9/16] w-full overflow-hidden rounded-[20px] sm:rounded-[24px] border border-border/80 bg-black shadow-card ring-1 ring-white/10">
              {/* Subtle format pill */}
              <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full border border-white/20 bg-black/65 px-3 py-1 text-[11px] font-semibold tracking-wide text-white backdrop-blur-md shadow-sm">
                <Images className="size-3.5 text-accent-pink" aria-hidden="true" />
                <span>Slideshow</span>
              </div>

              <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-full border border-white/20 bg-black/65 px-2.5 py-0.5 font-mono text-[10px] font-medium text-white backdrop-blur-md shadow-sm">
                <Images className="size-3 text-white/80" aria-hidden="true" />
                <span>{activeSlide + 1}/{slideshowImages.length}</span>
              </div>

              <div
                className="flex size-full transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]"
                style={{ transform: `translateX(-${activeSlide * 100}%)` }}
              >
                {slideshowImages.map((src, index) => (
                  <div key={src} className="relative size-full shrink-0">
                    <Image
                      src={src}
                      alt={`Slideshow slide ${index + 1}`}
                      fill
                      sizes="290px"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>

              <div className="absolute inset-x-2 top-1/2 z-20 flex -translate-y-1/2 justify-between opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
                <button
                  type="button"
                  onClick={() =>
                    setActiveSlide((prev) =>
                      (prev + slideshowImages.length - 1) % slideshowImages.length
                    )
                  }
                  aria-label="Previous hero slide"
                  className="flex size-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-colors hover:bg-black/80"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveSlide((prev) => (prev + 1) % slideshowImages.length)
                  }
                  aria-label="Next hero slide"
                  className="flex size-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-colors hover:bg-black/80"
                >
                  ›
                </button>
              </div>

              <div className="absolute inset-x-0 bottom-4 z-20 flex justify-center gap-1.5">
                {slideshowImages.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setActiveSlide(index)}
                    aria-label={`Go to hero slide ${index + 1}`}
                    className={cn(
                      "size-1.5 rounded-full transition-all duration-300",
                      index === activeSlide
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
