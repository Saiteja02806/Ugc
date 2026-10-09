"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Images,
  Heart,
  ScanText,
  Sparkles,
} from "lucide-react";
import { PostInteractionFeed } from "@/components/trending/post-interaction-feed";
import { usePostReviewHistory } from "@/components/trending/use-post-review-history";
import { POST_LIKE_FEEDBACK_MS } from "@/lib/trending/post-interaction";
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
  isActive = false,
}: {
  item: DeckItem;
  activeSlide?: number;
  onPrevSlide?: (e: React.MouseEvent) => void;
  onNextSlide?: (e: React.MouseEvent) => void;
  isInteractive?: boolean;
  isActive?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isActive) void video.play().catch(() => undefined);
    else video.pause();
  }, [isActive, item.videoSrc]);

  return (
    <div className="relative size-full overflow-hidden select-none pointer-events-none">
      {item.type === "slideshow" && item.slides ? (
        /* Slideshow Deck */
        <div className="relative size-full">
          <div
            data-landing-slide-strip
            className="flex size-full transition-transform duration-500 ease-out motion-reduce:transition-none"
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
          ref={videoRef}
          key={item.videoSrc}
          src={item.videoSrc}
          autoPlay={isActive}
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
  const [isLiked, setIsLiked] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const decisionLock = useRef(false);
  const decisionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const postHistory = usePostReviewHistory<DeckItem>();
  const reviewSequence = useRef(0);
  const upcoming = deckItems.map((_, index) => deckItems[(currentIndex + index) % deckItems.length]);
  const feedPosts = (postHistory.active
    ? [postHistory.active, ...postHistory.following].map((entry) => ({ id: entry.id, item: entry.value }))
    : []).concat(upcoming.map((item) => ({ id: item.id, item }))).slice(0, 3);

  useEffect(() => () => {
    if (decisionTimer.current !== null) clearTimeout(decisionTimer.current);
  }, []);

  function advance(like: boolean) {
    decisionTimer.current = null;
    postHistory.remember({ id: `reviewed-${++reviewSequence.current}`, value: deckItems[currentIndex],
      decision: like ? "liked" : "skipped" });
    setCurrentIndex((index) => (index + 1) % deckItems.length);
    setActiveSlide(0);
    setIsLiked(false);
    decisionLock.current = false;
  }

  function handleDecision(like: boolean) {
    if (decisionLock.current) return false;
    if (postHistory.browsing) {
      if (like) return false;
      setActiveSlide(0);
      return postHistory.next();
    }
    decisionLock.current = true;
    if (like) {
      setIsLiked(true);
      decisionTimer.current = setTimeout(() => advance(true), POST_LIKE_FEEDBACK_MS);
    } else advance(false);
    return true;
  }

  function previousPost() {
    setActiveSlide(0);
    return postHistory.previous();
  }

  function renderPost(item: DeckItem, isActive: boolean) {
    return <div data-post-like-target className="relative size-full overflow-hidden rounded-[20px]">
      <CardContent item={item} activeSlide={isActive ? activeSlide : 0}
        isActive={isActive} isInteractive={isActive}
        onPrevSlide={(event) => {
          event.stopPropagation();
          setActiveSlide((slide) => (slide - 1 + (item.slides?.length || 1)) % (item.slides?.length || 1));
        }}
        onNextSlide={(event) => {
          event.stopPropagation();
          setActiveSlide((slide) => (slide + 1) % (item.slides?.length || 1));
        }}
      />
    </div>;
  }

  return (
    <section
      id="interactive-feed"
      aria-labelledby="landing-feed-heading"
      className="relative overflow-hidden border-y border-border bg-card-muted/40 px-4 py-16 sm:px-6 lg:px-8 lg:py-20"
    >
      <div className="mx-auto max-w-[1200px]">
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold text-primary">
            Interactive Daily Feed
          </p>
          <h2 id="landing-feed-heading" className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.035em] text-foreground-strong sm:text-5xl">
            Double-tap to approve your daily content.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted">
            Double-tap to like, scroll to skip. In Trending, a like starts scheduling.
          </p>
        </div>

        <div className="relative mx-auto mt-10 flex w-full max-w-[500px] flex-col items-center justify-center">
          <div className="relative flex w-full max-w-[270px] sm:max-w-[290px] flex-col items-center">
            <div className="relative aspect-[9/16] w-full select-none">
              <div className="absolute inset-0">
                <PostInteractionFeed
                  label="Daily content preview. Double-tap to like, scroll to skip or scroll back to revisit."
                  className="h-full w-full border border-border-strong bg-black"
                  disabled={isLiked}
                  liked={isLiked}
                  onLike={() => handleDecision(true)}
                  onSkip={() => handleDecision(false)}
                  onPrevious={previousPost}
                  previousItem={postHistory.preceding ? {
                    id: postHistory.preceding.id, content: renderPost(postHistory.preceding.value, false),
                  } : null}
                  items={feedPosts.map((post, index) => ({ id: post.id, content: renderPost(post.item, index === 0) }))}
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-center gap-6">
              <button
                type="button"
                disabled={isLiked}
                onClick={() => handleDecision(false)}
                aria-label="Skip preview post"
                className="group/btn flex size-14 items-center justify-center rounded-full border border-red-500/25 bg-card text-red-500 transition duration-200 hover:scale-105 hover:border-red-500 hover:bg-red-500/10 active:scale-95 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 motion-reduce:transform-none motion-reduce:transition-none"
              >
                <ArrowDown className="size-6 stroke-[2.6]" aria-hidden="true" />
              </button>

              <button
                type="button"
                disabled={isLiked || postHistory.browsing}
                onClick={() => handleDecision(true)}
                aria-label="Like preview post"
                className="group/btn flex size-14 items-center justify-center rounded-full border border-emerald-500/25 bg-card text-emerald-500 transition duration-200 hover:scale-105 hover:border-emerald-500 hover:bg-emerald-500/10 active:scale-95 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 motion-reduce:transform-none motion-reduce:transition-none"
              >
                <Heart className="size-6 stroke-[2.6]" aria-hidden="true" />
              </button>
            </div>
            <p data-post-review-status className="mt-4 text-center text-xs text-muted">{postHistory.active
              ? `Previously ${postHistory.active.decision} · Scroll to browse`
              : `Interactive preview · ${currentIndex + 1} of ${deckItems.length} · Scroll back to revisit`}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
