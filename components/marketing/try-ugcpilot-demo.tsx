"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, Flame, LoaderCircle, Pointer, Redo2, RotateCcw, Sparkles, Undo2, Wifi, X } from "lucide-react";

type WallOfTextPost = {
  id: string;
  topic: string;
  hook: string;
  wallOfText: string;
};

type BusinessContext = {
  brand: string;
  url: string;
  title: string;
  description: string;
  markdown: string;
};

type AnalyzeResponse = {
  businessContext: BusinessContext;
  posts: WallOfTextPost[];
};

type RefillResponse = { posts: WallOfTextPost[] };

const CARD_IMAGES = [
  "/try-ugcpilot/card-1.jpg",
  "/try-ugcpilot/card-2.jpg",
  "/try-ugcpilot/card-3.jpg",
  "/try-ugcpilot/card-4.jpg",
];

const DEMO_POSTS: WallOfTextPost[] = [
  {
    id: "demo-1",
    topic: "Clearer decisions",
    hook: "the fastest way to lose momentum is guessing what to do next",
    wallOfText:
      "the fastest way to lose momentum is guessing what to do next. one clear measurement, one small action, and one honest review beat a complicated plan you never follow. progress becomes much easier when the next step is obvious.",
  },
  {
    id: "demo-2",
    topic: "Consistency",
    hook: "you do not need a perfect routine to make progress",
    wallOfText:
      "you do not need a perfect routine to make progress. you need a useful system that still works on a busy Tuesday, after a bad night of sleep, and when motivation disappears. consistency is simply making the easy choice repeatable.",
  },
  {
    id: "demo-3",
    topic: "Less friction",
    hook: "most people are not lazy, their next step is just too hard",
    wallOfText:
      "most people are not lazy, their next step is just too hard. remove the setup, make the choice visible, and lower the effort needed to begin. when a useful action takes seconds instead of twenty minutes, it finally becomes a habit.",
  },
  {
    id: "demo-4",
    topic: "Simple systems",
    hook: "a simple system you use beats an impressive system you ignore",
    wallOfText:
      "a simple system you use beats an impressive system you ignore. start with the smallest version that gives you useful feedback, then improve it after you have proof it fits real life. the best process is the one that actually survives your week.",
  },
  {
    id: "demo-5",
    topic: "Focus",
    hook: "more information is not always the answer",
    wallOfText:
      "more information is not always the answer. when every option feels urgent, choose the signal that tells you what matters today. a focused decision creates momentum, while a crowded to do list can quietly turn every important goal into background noise.",
  },
  {
    id: "demo-6",
    topic: "Action",
    hook: "the plan is only useful when it changes what you do today",
    wallOfText:
      "the plan is only useful when it changes what you do today. turn the next idea into one visible action, complete it before you reconsider it, and use the result to decide what comes next. small proof creates more confidence than endless preparation.",
  },
];

function errorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object" &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }
  return "The analysis is temporarily unavailable. Please try again.";
}

export function TryUgcPilotDemo() {
  const [url, setUrl] = useState("");
  const [cards, setCards] = useState<WallOfTextPost[]>(DEMO_POSTS);
  const [businessContext, setBusinessContext] = useState<BusinessContext | null>(null);
  const [nextPostNumber, setNextPostNumber] = useState(17);
  const [recentHooks, setRecentHooks] = useState<string[]>([]);
  const [swipedCount, setSwipedCount] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRefilling, setIsRefilling] = useState(false);
  const [notice, setNotice] = useState("Try a public product website to generate 16 tailored posts.");
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exitDirection, setExitDirection] = useState<"left" | "right" | null>(null);
  const [showSwipeGuide, setShowSwipeGuide] = useState(true);
  const dragStartX = useRef<number | null>(null);
  const refillAttemptFor = useRef<string | null>(null);

  const topCard = cards[0];
  const readyCount = cards.length;
  const brand = businessContext?.brand ?? "UGCPilot demo";

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        swipe("left");
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        swipe("right");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    let animationFrame: number | null = null;
    try {
      if (window.localStorage.getItem("ugcpilot-demo-swipe-guide-seen") === "true") {
        animationFrame = window.requestAnimationFrame(() => setShowSwipeGuide(false));
      }
    } catch {
      // The guide is optional when browser storage is unavailable.
    }
    return () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  function dismissSwipeGuide() {
    if (!showSwipeGuide) return;
    setShowSwipeGuide(false);
    try {
      window.localStorage.setItem("ugcpilot-demo-swipe-guide-seen", "true");
    } catch {
      // The guide still dismisses for the current visit when storage is unavailable.
    }
  }

  useEffect(() => {
    const refillKey = `${nextPostNumber}:${readyCount}`;
    if (!businessContext || readyCount >= 6 || isRefilling || refillAttemptFor.current === refillKey) {
      return;
    }

    const startNumber = nextPostNumber;
    refillAttemptFor.current = refillKey;
    let cancelled = false;
    setIsRefilling(true);
    setNotice("Generating 10 more Wall-of-Text posts in the background…");

    void fetch("/api/try-ugcpilot/next", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessContext,
        nextPostNumber: startNumber,
        recentHooks,
      }),
    })
      .then(async (response) => {
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error(errorMessage(payload));
        const data = payload as RefillResponse;
        if (!Array.isArray(data.posts) || data.posts.length !== 10) {
          throw new Error("The background content response was incomplete.");
        }
        if (cancelled) return;
        setCards((current) => [...current, ...data.posts]);
        setRecentHooks((current) => [...current, ...data.posts.map((post) => post.hook)].slice(-32));
        setNextPostNumber(startNumber + data.posts.length);
        setNotice("10 more Wall-of-Text posts are ready.");
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setNotice(error instanceof Error ? error.message : "More content could not be generated right now.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsRefilling(false);
      });

    return () => {
      cancelled = true;
    };
  }, [businessContext, isRefilling, nextPostNumber, readyCount, recentHooks]);

  function swipe(direction: "left" | "right") {
    if (!topCard || exitDirection) return;
    dismissSwipeGuide();
    setExitDirection(direction);
    window.setTimeout(() => {
      setCards((current) => current.slice(1));
      setSwipedCount((count) => count + 1);
      if (direction === "right") {
        setNotice(`Posted: “${topCard.hook}”`);
      } else {
        setNotice(`Skipped: “${topCard.hook}”`);
      }
      setDragX(0);
      setExitDirection(null);
    }, 260);
  }

  async function analyze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requestedUrl = url.trim();
    if (!requestedUrl || isAnalyzing) return;

    setIsAnalyzing(true);
    setNotice("Reading the website and generating 16 Wall-of-Text posts…");
    try {
      const response = await fetch("/api/try-ugcpilot/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: requestedUrl }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorMessage(payload));
      const data = payload as AnalyzeResponse;
      if (!data.businessContext || !Array.isArray(data.posts) || data.posts.length !== 16) {
        throw new Error("The analysis did not return enough Wall-of-Text posts. Please try again.");
      }

      refillAttemptFor.current = null;
      setBusinessContext(data.businessContext);
      setCards(data.posts);
      setNextPostNumber(17);
      setRecentHooks(data.posts.map((post) => post.hook).slice(-32));
      setSwipedCount(0);
      setNotice(`16 tailored Wall-of-Text posts are ready for ${data.businessContext.brand}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The analysis is temporarily unavailable. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function resetDemo() {
    refillAttemptFor.current = null;
    setBusinessContext(null);
    setCards(DEMO_POSTS);
    setRecentHooks([]);
    setSwipedCount(0);
    setNextPostNumber(17);
    setDragX(0);
    setExitDirection(null);
    setNotice("The demonstration deck has been reset.");
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!topCard || exitDirection) return;
    dismissSwipeGuide();
    dragStartX.current = event.clientX;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging || dragStartX.current === null) return;
    setDragX(event.clientX - dragStartX.current);
  }

  function onPointerEnd() {
    if (!dragging) return;
    const finalDragX = dragX;
    dragStartX.current = null;
    setDragging(false);
    if (finalDragX > 90) swipe("right");
    else if (finalDragX < -90) swipe("left");
    else setDragX(0);
  }

  return (
    <main className="min-h-dvh bg-[#101010] px-4 py-5 text-white sm:px-6 lg:px-10">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[310px_minmax(0,1fr)] lg:items-center">
        <section className="order-2 rounded-3xl border border-white/10 bg-zinc-900 p-5 text-white shadow-2xl lg:order-1">
          <div className="mb-5 flex items-center justify-between">
            <Link href="/" className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-300 hover:text-[#ff6a35]">
              <ChevronLeft className="size-4" aria-hidden="true" /> UGCPilot
            </Link>
            <span className="rounded-full bg-orange-500/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#ff6a35]">
              Live demo
            </span>
          </div>

          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#e04810]">AI content engine</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">Website to Wall-of-Text content.</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Enter a public product website. UGCPilot reads the business context, then gives you ready-to-review content cards.
            </p>
          </div>

          <form className="space-y-3" onSubmit={analyze}>
            <label className="block text-xs font-bold uppercase tracking-wide text-zinc-400" htmlFor="product-url">
              Product website URL
            </label>
            <input
              id="product-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://yourproduct.com"
              inputMode="url"
              className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm font-medium text-white outline-none transition placeholder:text-zinc-600 focus:border-[#ff5a1f] focus:ring-4 focus:ring-orange-500/20"
            />
            <button
              type="submit"
              disabled={isAnalyzing || !url.trim()}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#ff5a1f] px-4 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition hover:bg-[#e04810] disabled:cursor-wait disabled:opacity-65"
            >
              {isAnalyzing ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
              {isAnalyzing ? "Analyzing…" : "Analyze URL"}
            </button>
          </form>

          <div className="mt-5 space-y-3 rounded-2xl bg-zinc-950 p-4 text-sm">
            <StatusRow done={Boolean(businessContext)} label={businessContext ? `Analyzed: ${businessContext.url.replace(/^https?:\/\//, "")}` : "Website context ready"} />
            <StatusRow done={Boolean(businessContext)} label={businessContext ? `Brand: ${brand}` : "Brand identified"} />
            <StatusRow done={Boolean(businessContext) && !isRefilling} loading={isAnalyzing || isRefilling} label={isRefilling ? "Generating 10 more posts…" : "Wall-of-Text posts ready"} />
          </div>

          <p aria-live="polite" className="mt-4 min-h-10 text-sm leading-5 text-zinc-400">
            {notice}
          </p>

          <button type="button" onClick={resetDemo} className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300 hover:text-[#ff6a35]">
            <RotateCcw className="size-4" aria-hidden="true" /> Reset demo deck
          </button>
        </section>

        <section className="order-1 flex flex-col items-center lg:order-2">
          <div className="relative h-[min(900px,calc(100svh-2rem))] min-h-[660px] w-full max-w-[510px] overflow-hidden rounded-[48px] border-2 border-[#272727] bg-[#080808] p-[9px] shadow-[0_34px_90px_rgba(0,0,0,0.82),inset_0_0_0_1px_rgba(255,255,255,0.04)]">
            <div className="relative h-full overflow-hidden rounded-[38px] border border-white/[0.045] bg-[#101011]">
            <div className="relative z-40 flex h-[54px] items-center justify-between px-7 text-[16px] font-bold tracking-[-0.04em] text-white">
              <span>3:42</span>
              <span className="absolute left-1/2 top-[11px] h-[32px] w-[114px] -translate-x-1/2 rounded-[22px] bg-black" aria-hidden="true" />
              <span className="flex items-center gap-1.5" aria-label="Phone status">
                <span className="flex h-4 items-end gap-[2px]" aria-hidden="true">
                  <i className="h-[5px] w-[2px] rounded-t-sm bg-white" />
                  <i className="h-[8px] w-[2px] rounded-t-sm bg-white" />
                  <i className="h-[11px] w-[2px] rounded-t-sm bg-white" />
                  <i className="h-[14px] w-[2px] rounded-t-sm bg-white" />
                </span>
                <Wifi className="size-4" strokeWidth={2.8} aria-hidden="true" />
                <span className="relative h-[14px] w-[25px] rounded-[5px] border-2 border-white" aria-hidden="true">
                  <span className="absolute inset-[2px] rounded-[2px] bg-white" />
                  <span className="absolute -right-[4px] top-[3px] h-[5px] w-[2px] rounded-r-sm bg-white" />
                </span>
              </span>
            </div>

            <div className="absolute inset-x-5 top-[63px] z-40 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-[14px] font-bold tracking-[-0.02em] text-white shadow-[0_6px_18px_rgba(0,0,0,0.18)]">
                <Flame className="size-4 text-[#ff526b]" fill="currentColor" aria-hidden="true" />
                Trending Content
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/45 bg-emerald-400/[0.08] px-3 py-1.5 text-[14px] font-bold tracking-[-0.02em] text-emerald-300 shadow-[0_6px_18px_rgba(0,0,0,0.18)]">
                <Check className="size-4 stroke-[3]" aria-hidden="true" />
                Posted
              </span>
            </div>

            <div className="absolute inset-x-4 bottom-[104px] top-[122px]" aria-label={`${readyCount} content cards ready`}>
            {cards.slice(0, 3).map((card, index) => {
              const isTop = index === 0;
              const rotation = isTop ? dragX * 0.075 : 0;
              const transform = exitDirection && isTop
                ? `translateX(${exitDirection === "right" ? 520 : -520}px) translateY(20px) rotate(${exitDirection === "right" ? 24 : -24}deg)`
                : isTop
                  ? `translateX(${dragX}px) rotate(${rotation}deg)`
                  : `translateY(${index * 12}px) scale(${1 - index * 0.04})`;
              const image = CARD_IMAGES[(swipedCount + index) % CARD_IMAGES.length] ?? CARD_IMAGES[0];
              return (
                <div
                  key={card.id}
                  onPointerDown={isTop ? onPointerDown : undefined}
                  onPointerMove={isTop ? onPointerMove : undefined}
                  onPointerUp={isTop ? onPointerEnd : undefined}
                  onPointerCancel={isTop ? onPointerEnd : undefined}
                  aria-label={isTop ? "Wall-of-Text content card. Swipe left to skip or right to post." : undefined}
                  className={`absolute inset-0 overflow-hidden rounded-[29px] border border-white/10 bg-zinc-900 shadow-[0_20px_45px_rgba(0,0,0,0.5)] ${isTop ? "cursor-grab touch-none select-none active:cursor-grabbing" : "pointer-events-none"} ${dragging ? "transition-none" : "transition-[transform,opacity] duration-300"}`}
                  style={{ transform, zIndex: 30 - index, opacity: isTop && exitDirection ? 0 : 1 }}
                >
                  <Image
                    src={image}
                    alt="Creator content background"
                    fill
                    sizes="390px"
                    loading={index === 0 ? "eager" : "lazy"}
                    className="object-cover"
                    draggable={false}
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/5 to-black/65" />
                  <div
                    className="absolute inset-x-8 top-[185px] text-center text-base font-semibold leading-[1.42] tracking-[-0.15px] text-white [text-shadow:-0.5px_-0.5px_0_rgba(0,0,0,0.85),0.5px_-0.5px_0_rgba(0,0,0,0.85),-0.5px_0.5px_0_rgba(0,0,0,0.85),0.5px_0.5px_0_rgba(0,0,0,0.85),0_1px_3px_rgba(0,0,0,0.9),0_3px_8px_rgba(0,0,0,0.85)]"
                    style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Rounded', Inter, sans-serif" }}
                  >
                    {card.wallOfText}
                  </div>
                  <div className={`absolute left-6 top-9 rounded-lg border-4 px-3 py-1 text-xl font-black tracking-wider transition-opacity ${dragX > 0 || exitDirection === "right" ? "border-emerald-300 text-emerald-200" : "border-emerald-300 text-emerald-200 opacity-0"}`}>
                    POSTED
                  </div>
                  <div className={`absolute right-6 top-9 rounded-lg border-4 px-3 py-1 text-xl font-black tracking-wider transition-opacity ${dragX < 0 || exitDirection === "left" ? "border-rose-300 text-rose-200" : "border-rose-300 text-rose-200 opacity-0"}`}>
                    SKIP
                  </div>
                  {isTop && showSwipeGuide ? <SwipeGuide /> : null}
                </div>
              );
            })}

            {!topCard ? (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center px-8 text-center">
                <Check className="size-9 text-emerald-300" aria-hidden="true" />
                <h2 className="mt-3 text-xl font-bold">Deck reviewed</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-300">Analyze another website or reset this demonstration deck to continue.</p>
              </div>
            ) : null}
            </div>

            <div className="absolute inset-x-0 bottom-0 z-40 flex h-[104px] items-center justify-center gap-20 bg-[#101011]">
              <button
                type="button"
                aria-label="Skip"
                onClick={() => swipe("left")}
                disabled={!topCard || Boolean(exitDirection)}
                className="grid size-[68px] place-items-center rounded-full border border-rose-400/35 bg-white/5 text-rose-400 shadow-[0_12px_28px_rgba(0,0,0,0.45)] transition hover:scale-105 hover:bg-rose-400/10 disabled:opacity-50"
              >
                <X className="size-7" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Posted"
                onClick={() => swipe("right")}
                disabled={!topCard || Boolean(exitDirection)}
                className="grid size-[68px] place-items-center rounded-full border border-emerald-400/35 bg-white/5 text-emerald-400 shadow-[0_12px_28px_rgba(0,0,0,0.45)] transition hover:scale-105 hover:bg-emerald-400/10 disabled:opacity-50"
              >
                <Check className="size-7" aria-hidden="true" />
              </button>
            </div>
            <div className="absolute bottom-2 left-1/2 z-50 h-[4.5px] w-[130px] -translate-x-1/2 rounded-full bg-white/25" aria-hidden="true" />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SwipeGuide() {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 text-center" aria-hidden="true">
      <div className="absolute inset-0 bg-black/[0.08]" />
      <div className="absolute left-3 top-[42%] flex w-[31%] flex-col items-center text-[#ff6b82] drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]">
        <Undo2 className="size-8 -rotate-12 stroke-[2.6]" />
        <span className="mt-1 text-[10px] font-black tracking-[0.04em]">SWIPE LEFT</span>
        <span className="mt-1 rounded-full border border-rose-300/70 bg-rose-500/75 px-3 py-1 text-xs font-black text-white shadow-lg">SKIP</span>
      </div>
      <div className="absolute right-3 top-[42%] flex w-[31%] flex-col items-center text-emerald-300 drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]">
        <Redo2 className="size-8 rotate-12 stroke-[2.6]" />
        <span className="mt-1 text-[10px] font-black tracking-[0.04em]">SWIPE RIGHT</span>
        <span className="mt-1 rounded-full border border-emerald-300/70 bg-emerald-500/75 px-3 py-1 text-xs font-black text-white shadow-lg">POSTED</span>
      </div>
      <div className="absolute left-1/2 top-[43%] -translate-x-1/2 text-white drop-shadow-[0_6px_12px_rgba(0,0,0,0.85)]">
        <Pointer className="size-[68px] -rotate-6 fill-white text-white stroke-black stroke-[1.5]" />
      </div>
      <span className="absolute bottom-[31%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/30 bg-black/80 px-4 py-1.5 text-xs font-bold text-white shadow-[0_8px_20px_rgba(0,0,0,0.55)]">
        Tap or swipe card to start
      </span>
    </div>
  );
}

function StatusRow({ done, label, loading = false }: { done: boolean; label: string; loading?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`grid size-5 place-items-center rounded-full ${done ? "bg-[#ff5a1f] text-white" : "bg-zinc-800 text-zinc-400"}`}>
        {loading ? <LoaderCircle className="size-3 animate-spin" aria-hidden="true" /> : done ? <Check className="size-3" aria-hidden="true" /> : <span className="size-1.5 rounded-full bg-current" />}
      </span>
      <span className="truncate text-xs font-medium text-zinc-300">{label}</span>
    </div>
  );
}
