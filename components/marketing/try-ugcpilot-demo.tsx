"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, LoaderCircle, RotateCcw, Sparkles, X } from "lucide-react";

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
  const [accepted, setAccepted] = useState<WallOfTextPost[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const [swipedCount, setSwipedCount] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRefilling, setIsRefilling] = useState(false);
  const [notice, setNotice] = useState("Try a public product website to generate 16 tailored posts.");
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exitDirection, setExitDirection] = useState<"left" | "right" | null>(null);
  const dragStartX = useRef<number | null>(null);
  const refillAttemptFor = useRef<number | null>(null);

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
    if (!businessContext || readyCount >= 6 || isRefilling || refillAttemptFor.current === nextPostNumber) {
      return;
    }

    const startNumber = nextPostNumber;
    refillAttemptFor.current = startNumber;
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
          refillAttemptFor.current = null;
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
    setExitDirection(direction);
    window.setTimeout(() => {
      setCards((current) => current.slice(1));
      setSwipedCount((count) => count + 1);
      if (direction === "right") {
        setAccepted((current) => [topCard, ...current]);
        setNotice(`Posted: “${topCard.hook}”`);
      } else {
        setSkippedCount((count) => count + 1);
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
      setAccepted([]);
      setSkippedCount(0);
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
    setAccepted([]);
    setSkippedCount(0);
    setSwipedCount(0);
    setNextPostNumber(17);
    setDragX(0);
    setExitDirection(null);
    setNotice("The demonstration deck has been reset.");
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!topCard || exitDirection) return;
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
          <div className="mb-4 flex w-full max-w-[390px] items-center justify-between text-sm text-zinc-400">
            <span className="font-semibold">{brand}</span>
            <span>{readyCount} ready · {isRefilling ? "refilling" : "swipe to review"}</span>
          </div>

          <div className="relative h-[620px] w-full max-w-[390px] overflow-hidden rounded-[42px] border-[8px] border-zinc-800 bg-zinc-900 shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
            <div className="absolute inset-x-0 top-0 z-40 flex h-14 items-center justify-between px-5 text-xs font-semibold text-white/80">
              <span>Trending content</span>
              <span>Posted {accepted.length}</span>
            </div>

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
                  className={`absolute inset-0 overflow-hidden bg-zinc-900 ${isTop ? "cursor-grab touch-none" : "pointer-events-none"} ${dragging ? "transition-none" : "transition-[transform,opacity] duration-300"}`}
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
                  <div className="absolute inset-x-6 top-24 text-center text-[14px] font-bold leading-6 text-white drop-shadow-[0_2px_5px_rgba(0,0,0,0.85)] sm:text-[16px] sm:leading-7">
                    {card.wallOfText}
                  </div>
                  <div className={`absolute left-6 top-20 rounded-lg border-4 px-3 py-1 text-xl font-black tracking-wider transition-opacity ${dragX > 0 || exitDirection === "right" ? "border-emerald-300 text-emerald-200" : "border-emerald-300 text-emerald-200 opacity-0"}`}>
                    POSTED
                  </div>
                  <div className={`absolute right-6 top-20 rounded-lg border-4 px-3 py-1 text-xl font-black tracking-wider transition-opacity ${dragX < 0 || exitDirection === "left" ? "border-rose-300 text-rose-200" : "border-rose-300 text-rose-200 opacity-0"}`}>
                    SKIP
                  </div>
                  <div className="absolute inset-x-5 bottom-7">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/65">{card.topic}</p>
                    <p className="mt-1 text-base font-semibold leading-5 text-white">{card.hook}</p>
                  </div>
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

          <div className="mt-5 flex items-center gap-8">
            <button
              type="button"
              aria-label="Skip"
              onClick={() => swipe("left")}
              disabled={!topCard || Boolean(exitDirection)}
              className="grid size-16 place-items-center rounded-full border border-rose-400/35 bg-zinc-900 text-rose-400 shadow-lg transition hover:scale-105 hover:bg-rose-400/10 disabled:opacity-50"
            >
              <X className="size-7" aria-hidden="true" />
            </button>
            <div className="text-center text-xs text-zinc-400">
              <p>Skipped {skippedCount}</p>
              <p className="mt-1">Posted {accepted.length}</p>
            </div>
            <button
              type="button"
              aria-label="Posted"
              onClick={() => swipe("right")}
              disabled={!topCard || Boolean(exitDirection)}
              className="grid size-16 place-items-center rounded-full border border-emerald-400/35 bg-zinc-900 text-emerald-400 shadow-lg transition hover:scale-105 hover:bg-emerald-400/10 disabled:opacity-50"
            >
              <Check className="size-7" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-4 text-center text-xs text-zinc-500">Swipe left to skip · Swipe right to post · Arrow keys work too</p>
        </section>
      </div>
    </main>
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
