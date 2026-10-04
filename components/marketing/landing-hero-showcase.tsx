"use client";

import { useEffect, useState } from "react";
import { Clapperboard, Sparkles, UserRound } from "lucide-react";

const heroMediaPath = "/marketing/showcase/hero-2026-10-03";

export function LandingHeroShowcase() {
  const [shouldLoadVideoPreviews, setShouldLoadVideoPreviews] = useState(false);
  const [shouldLoadSideVideoPreviews, setShouldLoadSideVideoPreviews] = useState(false);

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
                <UserRound className="size-3.5 text-primary" aria-hidden="true" />
                <span>Talking Head</span>
              </div>

              {/* Video preview */}
              <video
                src={
                  shouldLoadSideVideoPreviews
                    ? `${heroMediaPath}/left_side.mp4`
                    : undefined
                }
                autoPlay
                muted
                loop
                playsInline
                poster={`${heroMediaPath}/left_side.webp`}
                aria-label="Talking-head video preview"
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
                <span>UGC Video</span>
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
                aria-label="UGC video preview"
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
        {/* 3. Right Card: supplied right_side video */}
        {/* ========================================================= */}
        <div className="relative z-0 order-3 hidden w-[240px] shrink-0 lg:block lg:w-[290px]">
          <div className="transform-gpu transition-transform duration-300 lg:rotate-[5deg] lg:origin-top-left lg:translate-y-4 hover:scale-[1.02]">
            <article className="group relative aspect-[9/16] w-full overflow-hidden rounded-[20px] sm:rounded-[24px] border border-border/80 bg-black shadow-card ring-1 ring-white/10">
              {/* Subtle format pill */}
              <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full border border-white/20 bg-black/65 px-3 py-1 text-[11px] font-semibold tracking-wide text-white backdrop-blur-md shadow-sm">
                <Clapperboard className="size-3.5 text-accent-pink" aria-hidden="true" />
                <span>Hook+Demo</span>
              </div>

              <video
                src={
                  shouldLoadSideVideoPreviews
                    ? `${heroMediaPath}/right_side.mp4`
                    : undefined
                }
                autoPlay
                muted
                loop
                playsInline
                poster={`${heroMediaPath}/right_side.webp`}
                aria-label="Hook and demo video preview"
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
      </div>
    </div>
  );
}
