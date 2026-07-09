"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";
import type { KeyboardEvent, MouseEvent } from "react";

import { CarouselSlideDots } from "@/components/carousel/carousel-slide-dots";
import { cn } from "@/lib/utils";

export type CarouselSlide = {
  headline: string;
  renderedUrl: string;
  slideNumber: number;
  slideType: string;
  status?: string;
  subtext?: string | null;
};

export type CarouselCandidate = {
  angle: string | null;
  candidateIndex: number;
  carouselId: string;
  categorySlug: string | null;
  format: "1:1" | "4:5";
  slideCount: number;
  slides: CarouselSlide[];
  status: "completed" | "failed" | "processing";
};

type CarouselCandidateCardProps = {
  activeSlideIndex: number;
  candidate: CarouselCandidate;
  candidateNumber: number;
  onSelectCandidate?: () => void;
  onSlideSelect: (index: number) => void;
  position: "active" | "next" | "previous";
};

export function CarouselCandidateCard({
  activeSlideIndex,
  candidate,
  candidateNumber,
  onSelectCandidate,
  onSlideSelect,
  position,
}: CarouselCandidateCardProps) {
  const isActive = position === "active";
  const safeSlideIndex = candidate.slides.length
    ? Math.min(Math.max(activeSlideIndex, 0), candidate.slides.length - 1)
    : 0;
  const activeSlide = candidate.slides[safeSlideIndex] ?? candidate.slides[0];
  const slideCount = candidate.slides.length;
  const canCycleSlides = isActive && slideCount > 1;
  const visibleSlides = isActive
    ? candidate.slides
    : candidate.slides[0]
      ? [candidate.slides[0]]
      : [];

  useEffect(() => {
    if (!isActive || candidate.slides.length <= 1) {
      return;
    }

    const preloaders = candidate.slides.map((slide) => {
      const image = new Image();
      image.decoding = "async";
      image.src = slide.renderedUrl;
      void image.decode?.().catch(() => undefined);

      return image;
    });

    return () => {
      for (const image of preloaders) {
        image.src = "";
      }
    };
  }, [candidate.carouselId, candidate.slides, isActive]);

  function selectCandidate(event: MouseEvent<HTMLElement>) {
    if (!isActive && onSelectCandidate) {
      event.preventDefault();
      onSelectCandidate();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!isActive && onSelectCandidate && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      onSelectCandidate();
    }
  }

  function selectSlide(event: MouseEvent<HTMLButtonElement>, index: number) {
    event.preventDefault();
    event.stopPropagation();

    if (!slideCount) {
      return;
    }

    onSlideSelect((index + slideCount) % slideCount);
  }

  return (
    <article
      aria-label={`Carousel version ${candidateNumber}${isActive ? ", selected" : ""}`}
      aria-current={isActive ? "true" : undefined}
      role={isActive ? undefined : "button"}
      tabIndex={isActive ? undefined : 0}
      onClick={selectCandidate}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative aspect-[4/5] w-full overflow-hidden rounded-[24px] border bg-[#101820] text-left shadow-[0_26px_70px_rgb(16_32_51_/_0.24)] outline-none",
        isActive
          ? "border-white/80"
          : "cursor-pointer border-white/50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4",
      )}
    >
      {activeSlide ? (
        visibleSlides.map((slide) => {
          const isVisibleSlide = slide.slideNumber === activeSlide.slideNumber;

          return (
            // Rendered slides are immutable CloudFront assets and need no Next image transform.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={slide.slideNumber}
              src={slide.renderedUrl}
              alt={
                isVisibleSlide
                  ? `Version ${candidateNumber}, slide ${slide.slideNumber}: ${slide.headline}`
                  : ""
              }
              aria-hidden={isVisibleSlide ? undefined : "true"}
              draggable={false}
              loading={isActive ? "eager" : "lazy"}
              decoding="async"
              className={cn(
                "absolute inset-0 size-full select-none object-cover transition-opacity duration-150 ease-out motion-reduce:transition-none",
                isVisibleSlide ? "opacity-100" : "opacity-0",
              )}
            />
          );
        })
      ) : (
        <div className="absolute inset-0 flex size-full items-center justify-center bg-[#182333] px-6 text-center text-sm font-semibold text-white/80">
          Slides are still rendering
        </div>
      )}

      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 via-black/25 to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/70 via-black/25 to-transparent"
      />

      <div className="absolute right-3 top-3 rounded-full border border-white/20 bg-black/45 px-3 py-1.5 text-[11px] font-bold text-white shadow-[0_8px_20px_rgb(0_0_0_/_0.18)] backdrop-blur-md">
        {slideCount ? `${safeSlideIndex + 1} / ${slideCount}` : "0 / 0"}
      </div>

      {isActive ? (
        <>
          {canCycleSlides ? (
            <>
              <button
                type="button"
                data-carousel-control="true"
                aria-label="Previous slide"
                onClick={(event) => selectSlide(event, safeSlideIndex - 1)}
                className="absolute left-3 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white shadow-[0_8px_22px_rgb(0_0_0_/_0.24)] backdrop-blur-md transition hover:scale-105 hover:bg-black/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <ChevronLeft className="size-5" aria-hidden="true" />
              </button>

              <button
                type="button"
                data-carousel-control="true"
                aria-label="Next slide"
                onClick={(event) => selectSlide(event, safeSlideIndex + 1)}
                className="absolute right-3 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white shadow-[0_8px_22px_rgb(0_0_0_/_0.24)] backdrop-blur-md transition hover:scale-105 hover:bg-black/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>
            </>
          ) : null}

          <div
            data-carousel-control="true"
            className="absolute inset-x-0 bottom-3 flex justify-center px-4"
          >
            <CarouselSlideDots
              activeIndex={safeSlideIndex}
              total={slideCount}
              onSelect={onSlideSelect}
            />
          </div>
        </>
      ) : (
        <span className="sr-only">
          Select version {candidateNumber}
          {candidate.angle ? `, ${candidate.angle}` : ""}
        </span>
      )}
    </article>
  );
}
