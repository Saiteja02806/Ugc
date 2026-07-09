"use client";

import { Loader2 } from "lucide-react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useRef } from "react";

import {
  CarouselCandidateCard,
  type CarouselCandidate,
} from "@/components/carousel/carousel-candidate-card";
import { cn } from "@/lib/utils";

type CarouselCandidateDeckProps = {
  activeCandidateIndex: number;
  activeSlideByCandidateId: Record<string, number>;
  candidates: CarouselCandidate[];
  isLoadingMore?: boolean;
  lazyLoadError?: string | null;
  onActiveCandidateChange: (index: number) => void;
  onActiveSlideChange: (candidateId: string, index: number) => void;
};

type PointerStart = {
  id: number;
  x: number;
  y: number;
};

const SWIPE_THRESHOLD = 48;

function isInteractiveControl(target: EventTarget | null) {
  return target instanceof Element
    ? Boolean(
        target.closest(
          'button, a, input, select, textarea, [data-carousel-control="true"]',
        ),
      )
    : false;
}

export function CarouselCandidateDeck({
  activeCandidateIndex,
  activeSlideByCandidateId,
  candidates,
  isLoadingMore = false,
  lazyLoadError,
  onActiveCandidateChange,
  onActiveSlideChange,
}: CarouselCandidateDeckProps) {
  const pointerStart = useRef<PointerStart | null>(null);
  const lastIndex = candidates.length - 1;
  const safeCandidateIndex = candidates.length
    ? Math.min(Math.max(activeCandidateIndex, 0), lastIndex)
    : 0;
  const activeCandidate = candidates[safeCandidateIndex];
  const canGoPrevious = safeCandidateIndex > 0;
  const canGoNext = safeCandidateIndex < lastIndex;
  const visibleCandidateIndexes = [
    safeCandidateIndex - 1,
    safeCandidateIndex,
    safeCandidateIndex + 1,
  ].filter((index) => index >= 0 && index <= lastIndex);

  function selectCandidate(index: number) {
    if (index < 0 || index > lastIndex || index === safeCandidateIndex) {
      return;
    }

    onActiveCandidateChange(index);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowLeft" && canGoPrevious) {
      event.preventDefault();
      selectCandidate(safeCandidateIndex - 1);
    }

    if (event.key === "ArrowRight" && canGoNext) {
      event.preventDefault();
      selectCandidate(safeCandidateIndex + 1);
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }

    if (isInteractiveControl(event.target)) {
      return;
    }

    pointerStart.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const start = pointerStart.current;
    pointerStart.current = null;

    if (!start || start.id !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const isHorizontalSwipe =
      Math.abs(deltaX) >= SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY) * 1.15;

    if (isHorizontalSwipe && deltaX < 0 && canGoNext) {
      selectCandidate(safeCandidateIndex + 1);
    } else if (isHorizontalSwipe && deltaX > 0 && canGoPrevious) {
      selectCandidate(safeCandidateIndex - 1);
    }
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    pointerStart.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Carousel version deck"
      aria-roledescription="carousel"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="w-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4"
    >
      <div
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className="relative mx-auto h-[min(112vw,510px)] w-full max-w-[820px] touch-pan-y overflow-hidden sm:h-[510px]"
      >
        {visibleCandidateIndexes.map((index) => {
          const candidate = candidates[index];
          const position =
            index < safeCandidateIndex
              ? "previous"
              : index > safeCandidateIndex
                ? "next"
                : "active";

          return (
            <div
              key={candidate.carouselId}
              className={cn(
                "absolute inset-0 m-auto w-[min(78vw,380px)] transition-[transform,opacity,filter] duration-300 ease-out motion-reduce:transition-none",
                position === "active" && "z-20 translate-x-0 scale-100 opacity-100",
                position === "previous" &&
                  "z-10 -translate-x-[52%] scale-[0.86] opacity-65 brightness-[0.92] sm:-translate-x-[58%]",
                position === "next" &&
                  "z-10 translate-x-[52%] scale-[0.86] opacity-65 brightness-[0.92] sm:translate-x-[58%]",
              )}
            >
              <CarouselCandidateCard
                activeSlideIndex={activeSlideByCandidateId[candidate.carouselId] ?? 0}
                candidate={candidate}
                candidateNumber={candidate.candidateIndex + 1}
                position={position}
                onSelectCandidate={
                  position === "active" ? undefined : () => selectCandidate(index)
                }
                onSlideSelect={(slideIndex) =>
                  onActiveSlideChange(candidate.carouselId, slideIndex)
                }
              />
            </div>
          );
        })}
      </div>

      <p
        aria-live="polite"
        className="mx-auto mt-3 w-fit rounded-full border border-[#e5ded6] bg-white/70 px-3 py-1 text-[11px] font-bold text-[#68798b] shadow-[0_4px_14px_rgb(16_32_51_/_0.06)]"
      >
        Version {(activeCandidate?.candidateIndex ?? safeCandidateIndex) + 1} of{" "}
        {candidates.length}
      </p>

      {isLoadingMore ? (
        <p className="mx-auto mt-2 flex w-fit items-center gap-2 rounded-full border border-[#e5ded6] bg-white/75 px-3 py-1 text-[11px] font-bold text-[#68798b] shadow-[0_4px_14px_rgb(16_32_51_/_0.06)]">
          <Loader2 className="size-3 animate-spin text-primary" aria-hidden="true" />
          Loading more
        </p>
      ) : lazyLoadError ? (
        <p className="mx-auto mt-2 w-fit rounded-full border border-[#f4c7c2] bg-[#fff5f4] px-3 py-1 text-[11px] font-bold text-error shadow-[0_4px_14px_rgb(16_32_51_/_0.06)]">
          {lazyLoadError}
        </p>
      ) : null}
    </section>
  );
}
