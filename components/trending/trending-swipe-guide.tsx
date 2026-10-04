"use client";
import { ArrowDown, Heart } from "lucide-react";
/** The parent consumes the acknowledgement before deciding the post. */
export function TrendingSwipeGuide({ demo = false }: { demo?: boolean }) {
  return <div data-trending-swipe-guide role="status" aria-live="polite"
    className="pointer-events-none absolute inset-0 z-40 flex select-none flex-col items-center justify-center gap-6 rounded-[20px] bg-black/60 px-6 text-center text-white backdrop-blur-[16px]">
    <div className="flex flex-col items-center gap-2">
      <Heart className="size-10 fill-rose-500 text-rose-500 motion-safe:animate-pulse" aria-hidden="true" />
      <span className="text-base font-semibold">Double-tap to schedule</span>
      <span className="text-xs text-white/75">{demo ? "Preview how you’ll choose posts for scheduling." : "Like a post to start scheduling it."}</span>
    </div>
    <div className="flex items-center gap-2 text-sm font-medium"><ArrowDown className="size-5" aria-hidden="true" /> Scroll to skip</div>
    <span className="rounded-full border border-white/25 bg-black/40 px-4 py-2 text-xs text-white/85">Tap once to start</span>
  </div>;
}
