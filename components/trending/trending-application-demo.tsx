"use client";

import { useState } from "react";

export function TrendingApplicationDemo() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center px-4 py-6 sm:px-8 sm:py-8"
      style={{ containerType: "size" }}
    >
      <div
        className="pointer-events-auto w-full shrink-0 rounded-[28px] border border-white/[0.1] bg-[radial-gradient(ellipse_at_12%_0%,rgb(255_255_255_/_0.07),transparent_46%),linear-gradient(145deg,#1b1f23,#111315)] p-3 shadow-[0_18px_58px_rgb(0_0_0_/_0.34)] sm:p-5"
        style={{ width: "min(100%, 960px, 150cqh)" }}
      >
        <div className="aspect-video w-full overflow-hidden rounded-[18px] border border-white/[0.08] bg-black">
          <video
            aria-label="UGCPilot application demo"
            autoPlay
            className="block size-full object-contain"
            controls
            loop
            muted
            playsInline
            preload="auto"
            src="/marketing/showcase-part2/application-demo.mp4"
          />
        </div>
        <div className="flex justify-end pt-3 sm:pt-4">
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="min-h-10 rounded-full border border-white/20 bg-black/35 px-4 text-xs font-semibold text-white/95 transition-colors hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#151719]"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
