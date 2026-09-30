"use client";

import Image from "next/image";

/**
 * A visual-only first-card guide. Its parent owns completion and keeps the
 * first input from also deciding the card beneath it.
 */
export function TrendingSwipeGuide() {
  return (
    <>
      <style>{`
        @keyframes trending-swipe-guide-hand-glide {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          15%, 32% { transform: translateX(36px) rotate(9deg); }
          50% { transform: translateX(0) rotate(0deg); }
          65%, 82% { transform: translateX(-36px) rotate(-9deg); }
        }
        @keyframes trending-swipe-guide-left-pulse {
          0%, 50%, 100% { opacity: 0.6; transform: scale(0.98); }
          65%, 82% { opacity: 1; transform: scale(1.06); }
        }
        @keyframes trending-swipe-guide-right-pulse {
          0%, 48%, 100% { opacity: 0.6; transform: scale(0.98); }
          15%, 32% { opacity: 1; transform: scale(1.06); }
        }
        @keyframes trending-swipe-guide-ring-pulse {
          0% { transform: scale(0.7); opacity: 0.8; }
          100% { transform: scale(1.55); opacity: 0; }
        }
        .trending-swipe-guide-hand { animation: trending-swipe-guide-hand-glide 3.2s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite; }
        .trending-swipe-guide-left { animation: trending-swipe-guide-left-pulse 3.2s ease-in-out infinite; }
        .trending-swipe-guide-right { animation: trending-swipe-guide-right-pulse 3.2s ease-in-out infinite; }
        .trending-swipe-guide-ring { animation: trending-swipe-guide-ring-pulse 2s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .trending-swipe-guide-hand, .trending-swipe-guide-left, .trending-swipe-guide-right, .trending-swipe-guide-ring { animation: none; }
        }
      `}</style>
      <div
        aria-live="polite"
        className="pointer-events-none absolute inset-0 z-30 select-none rounded-[20px] bg-black/[0.58] text-center text-white backdrop-blur-[16px]"
        data-trending-swipe-guide
        role="status"
      >
        <span className="sr-only">
          Swipe left to skip or right to accept. Tap or swipe the card to start.
        </span>
        <div className="absolute left-1/2 top-[47%] flex w-[min(310px,calc(100%-24px))] -translate-x-1/2 -translate-y-1/2 items-center justify-between">
          <div className="trending-swipe-guide-left flex w-[86px] flex-col items-center gap-1.5 text-white drop-shadow-[0_3px_8px_rgba(0,0,0,0.9)]">
            <svg viewBox="0 0 44 32" width="34" height="25" fill="none" aria-hidden="true">
              <path d="M40 26 C26 26 12 18 6 6" stroke="#f43f5e" strokeWidth="2.6" strokeLinecap="round" />
              <polyline points="14 5 5 5 5 14" stroke="#f43f5e" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-xs font-extrabold uppercase tracking-[0.4px]">Swipe left</span>
            <span className="rounded-full border-[1.5px] border-white/40 bg-rose-500/[0.88] px-[11px] py-[3px] text-[11px] font-extrabold uppercase tracking-[0.8px] text-white shadow-[0_4px_16px_rgba(244,63,94,0.7)]">Skip</span>
          </div>
          <div className="trending-swipe-guide-hand relative grid size-[76px] place-items-center">
            <span className="trending-swipe-guide-ring absolute size-[58px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.35)_0%,transparent_70%)]" />
            <Image
              src="/try-ugcpilot/hand-pointer.png"
              alt=""
              width={62}
              height={62}
              sizes="62px"
              className="relative size-[62px] select-none object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)]"
              draggable={false}
            />
          </div>
          <div className="trending-swipe-guide-right flex w-[86px] flex-col items-center gap-1.5 text-white drop-shadow-[0_3px_8px_rgba(0,0,0,0.9)]">
            <svg viewBox="0 0 44 32" width="34" height="25" fill="none" aria-hidden="true">
              <path d="M4 26 C18 26 32 18 38 6" stroke="#10b981" strokeWidth="2.6" strokeLinecap="round" />
              <polyline points="30 5 39 5 39 14" stroke="#10b981" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-xs font-extrabold uppercase tracking-[0.4px]">Swipe right</span>
            <span className="rounded-full border-[1.5px] border-white/40 bg-emerald-500/[0.88] px-[11px] py-[3px] text-[11px] font-extrabold uppercase tracking-[0.8px] text-white shadow-[0_4px_16px_rgba(16,185,129,0.7)]">Accept</span>
          </div>
        </div>
        <span className="absolute left-1/2 top-[61%] -translate-x-1/2 whitespace-nowrap rounded-full border border-white/30 bg-black/[0.72] px-[18px] py-[7px] text-[11.5px] font-semibold tracking-[0.3px] text-white shadow-[0_4px_20px_rgba(0,0,0,0.7)]">
          Tap or swipe card to start
        </span>
      </div>
    </>
  );
}
