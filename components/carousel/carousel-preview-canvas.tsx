"use client";

import { AlertTriangle, Layers3, Sparkles } from "lucide-react";

import { CarouselCandidateDeck } from "@/components/carousel/carousel-candidate-deck";
import type { CarouselCandidate } from "@/components/carousel/carousel-candidate-card";

type CarouselPreviewCanvasProps = {
  activeCandidateIndex: number;
  activeSlideByCandidateId: Record<string, number>;
  candidates: CarouselCandidate[];
  errorMessage?: string | null;
  expectedCandidateCount: number;
  isLoadingMore?: boolean;
  lazyLoadError?: string | null;
  status: "empty" | "loading" | "completed" | "failed";
  totalCandidates?: number;
  onActiveCandidateChange: (index: number) => void;
  onActiveSlideChange: (candidateId: string, index: number) => void;
};

function getFriendlyErrorMessage(errorMessage?: string | null) {
  const normalizedMessage = errorMessage?.trim();

  if (!normalizedMessage) {
    return "Please try generating the carousel versions again.";
  }

  const lowerCaseMessage = normalizedMessage.toLowerCase();

  if (
    lowerCaseMessage.includes("not enough category images") ||
    lowerCaseMessage.includes("seed category") ||
    lowerCaseMessage.includes("needs image assets")
  ) {
    return "This category needs image assets before carousel generation.";
  }

  const looksTechnical =
    normalizedMessage.includes("\n") ||
    lowerCaseMessage.includes("stack trace") ||
    lowerCaseMessage.includes(" at ") ||
    normalizedMessage.length > 160;

  return looksTechnical
    ? "Please try generating the carousel versions again."
    : normalizedMessage;
}

export function CarouselPreviewCanvas({
  activeCandidateIndex,
  activeSlideByCandidateId,
  candidates,
  errorMessage,
  expectedCandidateCount,
  isLoadingMore = false,
  lazyLoadError,
  status,
  totalCandidates,
  onActiveCandidateChange,
  onActiveSlideChange,
}: CarouselPreviewCanvasProps) {
  const hasCompletedCandidates = status === "completed" && candidates.length > 0;
  const displayCandidateCount = Math.max(
    candidates.length,
    totalCandidates ?? expectedCandidateCount,
  );

  return (
    <section
      aria-label="Carousel version preview"
      className="overflow-hidden rounded-[20px] border border-border bg-white shadow-[0_18px_50px_rgb(16_32_51_/_0.08)]"
    >
      <header className="flex min-h-18 items-center justify-between gap-4 border-b border-[#ebe6e1] px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">Creative versions</p>
          <p className="mt-0.5 truncate text-xs font-medium text-muted">
            Compare complete carousel versions
          </p>
        </div>

        <div
          aria-label={`${candidates.length} carousel versions`}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-[#e2ddd8] bg-[#f8f9fa] px-3 text-xs font-semibold text-[#405977]"
        >
          <Layers3 className="size-3.5" aria-hidden="true" />
          {candidates.length ? `${candidates.length}/${displayCandidateCount}` : displayCandidateCount} versions
        </div>
      </header>

      <div className="flex min-h-[610px] items-center justify-center bg-[#f6f7f9] px-3 py-8 sm:min-h-[700px] sm:px-6">
        {status === "loading" ? <CandidateLoadingState /> : null}

        {status === "failed" ? (
          <CandidateFailedState message={getFriendlyErrorMessage(errorMessage)} />
        ) : null}

        {(status === "empty" || (status === "completed" && !candidates.length)) ? (
          <CandidateEmptyState />
        ) : null}

        {hasCompletedCandidates ? (
          <CarouselCandidateDeck
            activeCandidateIndex={activeCandidateIndex}
            activeSlideByCandidateId={activeSlideByCandidateId}
            candidates={candidates}
            isLoadingMore={isLoadingMore}
            lazyLoadError={lazyLoadError}
            onActiveCandidateChange={onActiveCandidateChange}
            onActiveSlideChange={onActiveSlideChange}
          />
        ) : null}
      </div>
    </section>
  );
}

function CandidateEmptyState() {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center text-center">
      <div className="relative mb-7 h-48 w-52" aria-hidden="true">
        <div className="absolute inset-y-5 left-1 aspect-[4/5] rounded-2xl border border-[#d8dce2] bg-white/75 -rotate-6" />
        <div className="absolute inset-y-5 right-1 aspect-[4/5] rounded-2xl border border-[#d8dce2] bg-white/75 rotate-6" />
        <div className="absolute inset-y-0 left-1/2 aspect-[4/5] -translate-x-1/2 rounded-[20px] border border-[#d9d4cf] bg-white shadow-[0_16px_34px_rgb(16_32_51_/_0.08)]">
          <div className="flex size-full items-center justify-center">
            <Layers3 className="size-8 text-primary" strokeWidth={1.7} />
          </div>
        </div>
      </div>

      <h3 className="text-lg font-bold text-foreground">No carousel versions yet</h3>
      <p className="mt-2 text-sm leading-6 text-muted">
        Generate a few complete versions, then compare their angles and slides.
      </p>
    </div>
  );
}

function CandidateLoadingState() {
  return (
    <div role="status" aria-live="polite" className="flex w-full flex-col items-center text-center">
      <div
        className="relative mx-auto h-[min(112vw,510px)] w-full max-w-[820px] overflow-hidden sm:h-[510px]"
        aria-hidden="true"
      >
        <div className="absolute inset-0 m-auto aspect-[4/5] w-[min(78vw,380px)] -translate-x-[52%] scale-[0.86] rounded-[24px] border border-white/70 bg-[#e2e6eb] opacity-65 shadow-[0_18px_46px_rgb(16_32_51_/_0.08)] sm:-translate-x-[58%]" />
        <div className="absolute inset-0 m-auto aspect-[4/5] w-[min(78vw,380px)] translate-x-[52%] scale-[0.86] rounded-[24px] border border-white/70 bg-[#e2e6eb] opacity-65 shadow-[0_18px_46px_rgb(16_32_51_/_0.08)] sm:translate-x-[58%]" />
        <div className="absolute inset-0 z-10 m-auto aspect-[4/5] w-[min(78vw,380px)] animate-pulse overflow-hidden rounded-[24px] border border-white/80 bg-[#dfe5eb] shadow-[0_26px_70px_rgb(16_32_51_/_0.18)] motion-reduce:animate-none">
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/25 to-transparent" />
          <div className="absolute left-3 top-3 h-7 w-24 rounded-full bg-white/70" />
          <div className="absolute right-3 top-3 h-7 w-20 rounded-full bg-white/70" />
          <div className="absolute left-3 top-1/2 size-10 -translate-y-1/2 rounded-full bg-black/20" />
          <div className="absolute right-3 top-1/2 size-10 -translate-y-1/2 rounded-full bg-black/20" />
          <div className="absolute bottom-3 left-1/2 h-7 w-28 -translate-x-1/2 rounded-full bg-black/20" />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2 text-sm font-bold text-foreground">
        <Sparkles className="size-4 animate-pulse text-primary motion-reduce:animate-none" />
        Generating carousel versions...
      </div>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted">
        Creating distinct angles, selecting images, and rendering every slide.
      </p>
    </div>
  );
}

function CandidateFailedState({ message }: { message: string }) {
  return (
    <div role="alert" className="mx-auto max-w-md text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-error/15 bg-error/5 text-error">
        <AlertTriangle className="size-5" aria-hidden="true" />
      </div>
      <h3 className="mt-5 text-lg font-bold text-foreground">
        Could not generate carousel versions
      </h3>
      <p className="mt-2 text-sm leading-6 text-muted">{message}</p>
    </div>
  );
}
