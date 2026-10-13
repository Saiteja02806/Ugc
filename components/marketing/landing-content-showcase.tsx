"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Images } from "lucide-react";
import { cn } from "@/lib/utils";

const slides = Array.from(
  { length: 6 },
  (_, index) => `/marketing/showcase-part2/slideshow/image_${index}.jpg`,
);

export function LandingContentShowcase() {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !reducedMotion.matches) {
        setActiveSlide((slide) => (slide + 1) % slides.length);
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section
      id="content-showcase"
      aria-labelledby="landing-content-heading"
      className="relative overflow-hidden border-y border-border bg-card-muted/40 px-4 py-14 sm:px-6 lg:px-8 lg:py-16"
    >
      <div className="mx-auto max-w-[1200px]">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold text-primary">Daily slideshows</p>
          <h2 id="landing-content-heading" className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.035em] text-foreground-strong sm:text-5xl">
            Create a repeatable content format.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted">
            Turn a proven slideshow format into content for your business.
          </p>
        </div>

        <div className="relative mx-auto mt-8 w-full max-w-[270px] sm:max-w-[290px]">
          <div data-landing-slideshow className="relative aspect-[9/16] w-full overflow-hidden rounded-[20px] border border-border-strong bg-black">
            <div
              data-landing-slide-strip
              className="flex size-full transition-transform duration-500 ease-out motion-reduce:transition-none"
              style={{ transform: `translateX(-${activeSlide * 100}%)` }}
            >
              {slides.map((src, index) => (
                <div key={src} className="relative size-full shrink-0" aria-hidden={index !== activeSlide}>
                  <Image src={src} alt={`Slideshow example, slide ${index + 1} of ${slides.length}`} fill sizes="(min-width: 640px) 290px, 270px" draggable={false} className="object-cover" />
                </div>
              ))}
            </div>

            <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-white/20 bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
              <Images className="size-3 text-accent-pink" aria-hidden="true" />
              <span>Slideshow</span>
            </div>
            <span aria-hidden="true" className="pointer-events-none absolute right-3 top-3 rounded-full border border-white/20 bg-black/70 px-2.5 py-1 text-[11px] text-white backdrop-blur-md">
              {activeSlide + 1}/{slides.length}
            </span>
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-3.5 flex justify-center gap-1">
              {slides.map((_, index) => (
                <span key={index} className={cn("size-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none", index === activeSlide ? "w-3 bg-white" : "bg-white/40")} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
