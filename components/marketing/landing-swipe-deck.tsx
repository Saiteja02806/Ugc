"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Images,
  ScanText,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DeckItem {
  id: string;
  type: "hook" | "wot" | "slideshow";
  pillLabel: string;
  icon: typeof Sparkles;
  pillColor: string;
  videoSrc?: string;
  slides?: string[];
}

const deckItems: DeckItem[] = [
  {
    id: "item-hook",
    type: "hook",
    pillLabel: "Hook Video + Demo",
    icon: Sparkles,
    pillColor: "text-amber-400 border-amber-400/30 bg-black/70",
    videoSrc: "/marketing/showcase-part2/hook2-preview.mp4",
  },
  {
    id: "item-wot",
    type: "wot",
    pillLabel: "Wall of Text",
    icon: ScanText,
    pillColor: "text-primary border-primary/30 bg-black/70",
    videoSrc: "/marketing/showcase-part2/wot2-preview.mp4",
  },
  {
    id: "item-slideshow",
    type: "slideshow",
    pillLabel: "Slideshow",
    icon: Images,
    pillColor: "text-accent-pink border-accent-pink/30 bg-black/70",
    slides: [
      "/marketing/showcase-part2/slideshow/image_0.jpg",
      "/marketing/showcase-part2/slideshow/image_1.jpg",
      "/marketing/showcase-part2/slideshow/image_2.jpg",
      "/marketing/showcase-part2/slideshow/image_3.jpg",
      "/marketing/showcase-part2/slideshow/image_4.jpg",
      "/marketing/showcase-part2/slideshow/image_5.jpg",
    ],
  },
];

function CardContent({
  item,
  activeSlide = 0,
  onPrevSlide,
  onNextSlide,
  isInteractive = false,
}: {
  item: DeckItem;
  activeSlide?: number;
  onPrevSlide?: (e: React.MouseEvent) => void;
  onNextSlide?: (e: React.MouseEvent) => void;
  isInteractive?: boolean;
}) {
  return (
    <div className="relative size-full overflow-hidden select-none pointer-events-none">
      {item.type === "slideshow" && item.slides ? (
        /* Slideshow Deck */
        <div className="relative size-full">
          <div
            className="flex size-full transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${activeSlide * 100}%)` }}
          >
            {item.slides.map((src, idx) => (
              <div key={src} className="relative size-full shrink-0">
                <Image
                  src={src}
                  alt={`Slide ${idx + 1}`}
                  fill
                  sizes="290px"
                  draggable={false}
                  className="object-cover pointer-events-none select-none"
                  priority={idx === 0}
                />
              </div>
            ))}
          </div>

          {/* Interactive Navigation Chevrons */}
          {isInteractive && onPrevSlide && onNextSlide && (
            <div className="absolute inset-x-2 top-1/2 z-20 flex -translate-y-1/2 justify-between pointer-events-auto">
              <button
                type="button"
                onClick={onPrevSlide}
                className="flex size-6 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition-colors"
                aria-label="Previous slide"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={onNextSlide}
                className="flex size-6 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition-colors"
                aria-label="Next slide"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          )}

          {/* Pagination Dots */}
          <div className="absolute inset-x-0 bottom-3.5 z-20 flex justify-center gap-1">
            {item.slides.map((_, idx) => (
              <span
                key={idx}
                className={cn(
                  "size-1.5 rounded-full transition-all duration-300",
                  idx === activeSlide ? "w-3 bg-white" : "bg-white/40"
                )}
              />
            ))}
          </div>
        </div>
      ) : (
        /* Video Player for Hook & Wall of Text */
        <video
          key={item.videoSrc}
          src={item.videoSrc}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="size-full object-cover pointer-events-none select-none"
        />
      )}

      {/* Top Format Pill (Clean, without @yourbrand) */}
      <div className="absolute left-3 top-3 z-20 pointer-events-none">
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-md shadow-md",
            item.pillColor
          )}
        >
          <item.icon className="size-3" aria-hidden="true" />
          <span>{item.pillLabel}</span>
        </div>
      </div>
    </div>
  );
}

export function LandingSwipeDeck() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [flyDirection, setFlyDirection] = useState<"left" | "right" | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDecision = useCallback(
    (direction: "left" | "right") => {
      if (flyDirection) return;
      setFlyDirection(direction);

      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % deckItems.length);
        setFlyDirection(null);
        setDragOffset({ x: 0, y: 0 });
        setActiveSlide(0);
      }, 320);
    },
    [flyDirection]
  );

  // Pointer/Touch Drag Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (flyDirection) return;
    // Don't drag if clicking chevron buttons
    if ((e.target as HTMLElement).closest("button")) return;

    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || flyDirection) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setDragOffset({ x: dx, y: dy * 0.35 });
  };

  const handlePointerUp = () => {
    if (!isDragging || flyDirection) return;
    setIsDragging(false);

    if (dragOffset.x > 75) {
      handleDecision("right");
    } else if (dragOffset.x < -75) {
      handleDecision("left");
    } else {
      setDragOffset({ x: 0, y: 0 });
    }
  };

  // 3 items in current order
  const activeItem = deckItems[currentIndex % deckItems.length];
  const secondItem = deckItems[(currentIndex + 1) % deckItems.length];
  const thirdItem = deckItems[(currentIndex + 2) % deckItems.length];

  const rotationDeg = dragOffset.x * 0.08;
  const isPassing = dragOffset.x < -30;
  const isApproving = dragOffset.x > 30;

  return (
    <section
      id="interactive-feed"
      className="relative overflow-hidden border-y border-border bg-card-muted/40 px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
    >
      <div className="mx-auto max-w-[1200px]">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold text-primary">
            Interactive Daily Feed
          </p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.035em] text-foreground-strong sm:text-5xl">
            Swipe to approve your daily content.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted">
            Test the workflow in real-time. Swipe right or click ✓ to post, swipe left or click ✕ to reject.
          </p>
        </div>

        {/* Swipe Deck Arena */}
        <div className="relative mx-auto mt-10 flex w-full max-w-[500px] flex-col items-center justify-center">
          {/* Central Compact 9:16 Vertical Card Deck */}
          <div className="relative flex w-full max-w-[270px] sm:max-w-[290px] flex-col items-center">
            {/* Deck Container */}
            <div className="relative aspect-[9/16] w-full select-none touch-none">
              {/* ========================================================= */}
              {/* Card 3: Deepest Layer (Offset Right 18px, 4° tilt) with REAL Content */}
              {/* ========================================================= */}
              <div
                className="absolute inset-0 z-0 overflow-hidden rounded-[22px] border border-border/70 bg-black shadow-sm transition-transform duration-300 pointer-events-none"
                style={{
                  transform: "translateX(18px) translateY(6px) rotate(3.5deg) scale(0.92)",
                  opacity: 0.45,
                }}
                aria-hidden="true"
              >
                <CardContent item={thirdItem} />
              </div>

              {/* ========================================================= */}
              {/* Card 2: Middle Layer (Offset Right 9px, 2° tilt) with REAL Content */}
              {/* ========================================================= */}
              <div
                className="absolute inset-0 z-10 overflow-hidden rounded-[22px] border border-border/80 bg-black shadow-card transition-transform duration-300 pointer-events-none"
                style={{
                  transform: "translateX(9px) translateY(3px) rotate(1.8deg) scale(0.96)",
                  opacity: 0.85,
                }}
                aria-hidden="true"
              >
                <CardContent item={secondItem} />
              </div>

              {/* ========================================================= */}
              {/* Card 1: Active Interactive Front Card */}
              {/* ========================================================= */}
              <div
                ref={cardRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className={cn(
                  "group absolute inset-0 z-20 flex flex-col justify-between overflow-hidden rounded-[22px] border-2 border-border-strong bg-black shadow-floating cursor-grab active:cursor-grabbing transform-gpu select-none",
                  !isDragging && !flyDirection && "transition-transform duration-300 ease-out",
                  flyDirection === "left" && "transition-all duration-300 -translate-x-[160%] -rotate-12 opacity-0",
                  flyDirection === "right" && "transition-all duration-300 translate-x-[160%] rotate-12 opacity-0"
                )}
                style={
                  !flyDirection
                    ? {
                        transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) rotate(${rotationDeg}deg)`,
                      }
                    : undefined
                }
              >
                {/* Stamp: REJECTED ✕ (Red) */}
                <div
                  className={cn(
                    "pointer-events-none absolute left-3 top-14 z-30 -rotate-12 rounded-lg border-2 border-red-500 bg-red-500/25 px-3 py-1 text-sm font-black tracking-wider text-red-500 backdrop-blur-md transition-opacity duration-150",
                    isPassing || flyDirection === "left" ? "opacity-100 scale-105" : "opacity-0"
                  )}
                >
                  REJECTED ✕
                </div>

                {/* Stamp: POSTED ✓ (Green) */}
                <div
                  className={cn(
                    "pointer-events-none absolute right-3 top-14 z-30 rotate-12 rounded-lg border-2 border-emerald-500 bg-emerald-500/25 px-3 py-1 text-sm font-black tracking-wider text-emerald-400 backdrop-blur-md transition-opacity duration-150",
                    isApproving || flyDirection === "right" ? "opacity-100 scale-105" : "opacity-0"
                  )}
                >
                  POSTED ✓
                </div>

                {/* Card Media (Clean unblocked 9:16) */}
                <CardContent
                  item={activeItem}
                  activeSlide={activeSlide}
                  isInteractive={true}
                  onPrevSlide={(e) => {
                    e.stopPropagation();
                    setActiveSlide((prev) =>
                      prev === 0 ? (activeItem.slides?.length || 1) - 1 : prev - 1
                    );
                  }}
                  onNextSlide={(e) => {
                    e.stopPropagation();
                    setActiveSlide((prev) =>
                      (prev + 1) % (activeItem.slides?.length || 1)
                    );
                  }}
                />
              </div>
            </div>

            {/* Circular Action Buttons Below Card: (✕ Dislike) & (✓ Like) */}
            <div className="mt-6 flex items-center justify-center gap-6">
              {/* Dislike (✕) Button */}
              <button
                type="button"
                onClick={() => handleDecision("left")}
                aria-label="Dislike post"
                className="group/btn flex size-14 items-center justify-center rounded-full border border-red-500/25 bg-card text-red-500 shadow-card transition-all duration-200 hover:scale-110 hover:border-red-500 hover:bg-red-500/10 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <X className="size-6 stroke-[2.6] transition-transform duration-200 group-hover/btn:scale-110" />
              </button>

              {/* Like (✓) Button */}
              <button
                type="button"
                onClick={() => handleDecision("right")}
                aria-label="Like and post"
                className="group/btn flex size-14 items-center justify-center rounded-full border border-emerald-500/25 bg-card text-emerald-500 shadow-card transition-all duration-200 hover:scale-110 hover:border-emerald-500 hover:bg-emerald-500/10 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <Check className="size-6 stroke-[2.8] transition-transform duration-200 group-hover/btn:scale-110" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
