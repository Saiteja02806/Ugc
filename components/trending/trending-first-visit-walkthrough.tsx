"use client";

import Image from "next/image";
import {
  AtSign,
  CalendarClock,
  Check,
  Clapperboard,
  Images,
  MousePointer2,
  Pointer,
  ScanText,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { cn } from "@/lib/utils";

type Format = "hook" | "slideshow" | "wall";
type StepKind =
  | "hook_preview"
  | "hook_swipe"
  | "hook_demo"
  | "hook_schedule"
  | "wall_preview"
  | "wall_swipe"
  | "wall_schedule"
  | "slideshow_preview"
  | "slideshow_swipe"
  | "slideshow_schedule"
  | "complete";

type Step = { durationMs: number; kind: StepKind };
type WalkthroughPhase = "preview" | "controls";
type ControlGuideStep = "waiting_for_edit" | "edit" | "adjust";
type ControlGuidePosition = { arrowLeft: number; left: number; top: number };

const SCENE_TRANSITION_MS = 420;

const STEPS: readonly Step[] = [
  { durationMs: 2_300, kind: "hook_preview" },
  { durationMs: 2_100, kind: "hook_swipe" },
  { durationMs: 3_100, kind: "hook_demo" },
  { durationMs: 2_700, kind: "hook_schedule" },
  { durationMs: 2_000, kind: "wall_preview" },
  { durationMs: 2_100, kind: "wall_swipe" },
  { durationMs: 2_400, kind: "wall_schedule" },
  { durationMs: 2_000, kind: "slideshow_preview" },
  { durationMs: 2_100, kind: "slideshow_swipe" },
  { durationMs: 2_400, kind: "slideshow_schedule" },
  { durationMs: 900, kind: "complete" },
];

const CONTROL_GUIDE = {
  adjust: {
    action: "Got it",
    description:
      "Choose which content types you want more or less of. This shapes future posts and does not change this one.",
    heading: "Adjust future content",
    selector: "[data-trending-adjust-control]",
    step: "2 of 2",
  },
  edit: {
    action: "Next",
    description:
      "Change the copy, media, or layout of the post you are viewing. This affects this post only.",
    heading: "Edit this post",
    selector: "[data-trending-edit-control]",
    step: "1 of 2",
  },
} as const;

const CONTROL_GUIDE_WIDTH = 284;

const SLIDES = [
  "/marketing/showcase-part2/slideshow/image_0.jpg",
  "/marketing/showcase-part2/slideshow/image_1.jpg",
  "/marketing/showcase-part2/slideshow/image_2.jpg",
  "/marketing/showcase-part2/slideshow/image_3.jpg",
  "/marketing/showcase-part2/slideshow/image_4.jpg",
  "/marketing/showcase-part2/slideshow/image_5.jpg",
] as const;

const WALKTHROUGH_DEMO_SOURCE = "/marketing/showcase-part2/demo-preview.mp4";
const WALKTHROUGH_DESKTOP_QUERY = "(min-width: 1024px)";

const FORMAT: Record<
  Format,
  { label: string; source?: string; tone: "amber" | "blue" | "violet" }
> = {
  hook: {
    label: "Hook Video + Demo",
    source: "/marketing/showcase-part2/hook2-preview.mp4",
    tone: "amber",
  },
  slideshow: { label: "Slideshow", tone: "blue" },
  wall: {
    label: "Wall of Text",
    source: "/marketing/showcase-part2/wot2-preview.mp4",
    tone: "violet",
  },
};

export function TrendingFirstVisitWalkthrough({
  preview = false,
  userId,
}: {
  preview?: boolean;
  userId: string;
}) {
  const [visibility, setVisibility] = useState<"checking" | "hidden" | "visible">(
    preview ? "visible" : "checking",
  );
  const [desktopEligible, setDesktopEligible] = useState(false);
  const [phase, setPhase] = useState<WalkthroughPhase>("preview");
  const [stepIndex, setStepIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const finishingRef = useRef(false);
  const step = STEPS[stepIndex] ?? STEPS[0];

  useEffect(() => {
    const query = window.matchMedia(WALKTHROUGH_DESKTOP_QUERY);
    const sync = () => setDesktopEligible(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (preview || !desktopEligible) return;
    const controller = new AbortController();
    let live = true;

    async function load() {
      try {
        const token = await getCurrentUserIdToken();
        if (!token) throw new Error("No signed-in user is available.");
        const response = await fetch("/api/trending/walkthrough", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const body = (await response.json().catch(() => null)) as
          | { completed: boolean; ok: true }
          | null;
        if (live && !controller.signal.aborted) {
          setVisibility(response.ok && body?.ok && !body.completed ? "visible" : "hidden");
        }
      } catch {
        if (live && !controller.signal.aborted) setVisibility("hidden");
      }
    }

    void load();
    return () => {
      live = false;
      controller.abort();
    };
  }, [desktopEligible, preview, userId]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(!preview && query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [preview]);

  const finish = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    try {
      if (!preview) {
        const token = await getCurrentUserIdToken();
        if (token) {
          await fetch("/api/trending/walkthrough", {
            cache: "no-store",
            headers: { Authorization: `Bearer ${token}` },
            method: "POST",
          });
        }
      }
    } finally {
      setVisibility("hidden");
    }
  }, [preview]);

  const showControlGuide = useCallback(() => {
    setPhase("controls");
  }, []);

  useEffect(() => {
    if (!desktopEligible || visibility !== "visible" || phase !== "preview") return;
    let active = true;
    let currentIndex = 0;
    let timer: number | undefined;

    const scheduleNextStep = () => {
      const currentStep = STEPS[currentIndex] ?? STEPS[0];
      timer = window.setTimeout(
        () => {
          if (!active) return;
          if (currentStep.kind === "complete") {
            setPhase("controls");
            return;
          }

          currentIndex = Math.min(currentIndex + 1, STEPS.length - 1);
          setStepIndex(currentIndex);
          scheduleNextStep();
        },
        reducedMotion ? 700 : currentStep.durationMs,
      );
    };

    scheduleNextStep();

    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [desktopEligible, phase, reducedMotion, visibility]);

  if (!desktopEligible || visibility !== "visible") return null;
  if (phase === "controls") return <ControlsHighlight onComplete={finish} />;

  return (
    <div
      aria-label="Visual walkthrough of swiping a Trending post, adding a demo, and scheduling it"
      aria-live="polite"
      className="pointer-events-none absolute bottom-[-0.75rem] right-[-1rem] z-40 flex w-[640px] items-end justify-end overflow-visible bg-transparent"
      data-walkthrough-floating-panel
      role="status"
    >
      <div className="pointer-events-auto w-full">
        <WalkthroughCanvas
          onSkip={showControlGuide}
          reducedMotion={reducedMotion}
          step={step}
        />
      </div>
    </div>
  );
}

function WalkthroughCanvas({
  onSkip,
  reducedMotion,
  step,
}: {
  onSkip: () => void;
  reducedMotion: boolean;
  step: Step;
}) {
  const [slide, setSlide] = useState(0);
  const activeStepRef = useRef(step);
  const [sceneState, setSceneState] = useState<{
    active: Step;
    leaving: Step | null;
  }>({ active: step, leaving: null });

  useEffect(() => {
    for (const source of SLIDES) {
      const image = new window.Image();
      image.decoding = "async";
      image.src = source;
    }
  }, []);

  useEffect(() => {
    if (activeStepRef.current.kind === step.kind) return;

    const previousStep = activeStepRef.current;
    activeStepRef.current = step;
    setSceneState({ active: step, leaving: previousStep });

    const timer = window.setTimeout(
      () => setSceneState((current) => ({ ...current, leaving: null })),
      SCENE_TRANSITION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    if (!step.kind.startsWith("slideshow")) return;
    const timer = window.setInterval(() => setSlide((value) => (value + 1) % SLIDES.length), 850);
    return () => window.clearInterval(timer);
  }, [step.kind]);

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-[18px] border border-white/[0.12] bg-[#101316] shadow-[0_18px_48px_rgb(0_0_0_/_0.3)]",
        reducedMotion && "trending-walkthrough-reduced-motion",
      )}
      data-walkthrough-step={step.kind}
      style={{ height: "min(500px, calc(100dvh - 10rem))" }}
    >
      <WalkthroughKeyframes />
      <div className="absolute inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-white/[0.08] bg-[#101316]/92 px-5 backdrop-blur-sm">
        <span className="min-w-0 truncate pr-4 text-xs font-semibold tracking-[-0.01em] text-white/90">
          How our Trending feed works
        </span>
        <button
          aria-label="Skip walkthrough"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-white/[0.13] bg-[#1b1f23] px-3 text-xs font-semibold text-white/75 transition-colors hover:border-white/25 hover:bg-[#22272e] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          data-trending-walkthrough-skip
          onClick={onSkip}
          type="button"
        >
          Skip
          <X aria-hidden="true" className="size-3.5" />
        </button>
      </div>
      <div
        className="absolute inset-x-0 bottom-0 top-14 overflow-hidden"
        data-walkthrough-stage
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_45%_42%,rgba(112,77,255,0.16),transparent_34%),radial-gradient(circle_at_96%_6%,rgba(251,191,36,0.12),transparent_24%)]" />
        {sceneState.leaving ? (
          <SceneLayer key={sceneState.leaving.kind} leaving>
            <WalkthroughScene slide={slide} step={sceneState.leaving} />
          </SceneLayer>
        ) : null}
        <SceneLayer key={sceneState.active.kind}>
          <WalkthroughScene slide={slide} step={sceneState.active} />
        </SceneLayer>
      </div>
    </div>
  );
}

function SceneLayer({
  children,
  leaving = false,
}: {
  children: ReactNode;
  leaving?: boolean;
}) {
  return (
    <div
      aria-hidden={leaving || undefined}
      className="pointer-events-none absolute inset-0"
      data-walkthrough-scene={leaving ? "leaving" : "active"}
      style={{
        animation: leaving
          ? `trendingWalkthroughSceneExit ${SCENE_TRANSITION_MS}ms ease-in both`
          : `trendingWalkthroughSceneEnter ${SCENE_TRANSITION_MS}ms cubic-bezier(.2,.8,.2,1) both`,
      }}
    >
      {children}
    </div>
  );
}

function WalkthroughScene({ slide, step }: { slide: number; step: Step }) {
  if (step.kind === "hook_preview") return <ReviewScene format="hook" />;
  if (step.kind === "hook_swipe") return <ReviewScene format="hook" swipe />;
  if (step.kind === "hook_demo") return <DemoScene />;
  if (step.kind === "hook_schedule") return <ScheduleScene format="hook" />;
  if (step.kind === "wall_preview") return <ReviewScene format="wall" />;
  if (step.kind === "wall_swipe") return <ReviewScene format="wall" swipe />;
  if (step.kind === "wall_schedule") return <ScheduleScene format="wall" />;
  if (step.kind === "slideshow_preview") {
    return <ReviewScene format="slideshow" slide={slide} />;
  }
  if (step.kind === "slideshow_swipe") {
    return <ReviewScene format="slideshow" slide={slide} swipe />;
  }
  if (step.kind === "slideshow_schedule") {
    return <ScheduleScene format="slideshow" slide={slide} />;
  }
  return <CompletionMark />;
}

function ReviewScene({ format, slide = 0, swipe = false }: { format: Format; slide?: number; swipe?: boolean }) {
  const nextAction = format === "hook" ? "Add demo" : "Schedule post";

  return (
    <>
      <div className="absolute inset-x-0 top-[17%] flex justify-center">
        <div
          key={`${format}-${swipe ? "swipe" : "preview"}`}
          className="w-[23%]"
          style={
            swipe
              ? {
                  animation:
                    "trendingWalkthroughSwipeCard 1750ms cubic-bezier(.14,.8,.24,1) both",
                }
              : undefined
          }
        >
          <MediaCard format={format} slide={slide} />
        </div>
      </div>
      <div
        key={`${format}-${swipe ? "swipe-hand" : "preview-hand"}`}
        className="absolute left-[44%] top-[56%] z-30"
        style={
          swipe
            ? {
                animation:
                  "trendingWalkthroughSwipeHand 1650ms cubic-bezier(.14,.8,.24,1) both",
              }
            : undefined
        }
      >
        <GestureHand />
      </div>
      {swipe ? (
        <span
          aria-label={`Accepted. Next: ${nextAction}`}
          className="absolute right-[7%] top-[47%] flex h-[12%] min-w-[24%] items-center justify-center gap-2 rounded-full border border-success/40 bg-[#172823]/95 px-[3%] text-success shadow-[0_12px_30px_rgba(0,0,0,0.26)]"
          data-walkthrough-next-action={nextAction}
          style={{
            animation: "trendingWalkthroughSwipeApproval 1750ms ease-out both",
          }}
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
            <Check className="size-3.5 stroke-[3]" />
          </span>
          <span className="text-[clamp(9px,1vw,12px)] font-bold tracking-[-0.01em] text-white">
            {nextAction}
          </span>
        </span>
      ) : null}
    </>
  );
}

function MediaCard({ format, slide }: { format: Format; slide: number }) {
  const details = FORMAT[format];
  return (
    <div className="w-full">
      <div
        className="mb-2 flex h-6 items-center justify-between gap-1.5"
        data-walkthrough-format-label
      >
        <span
          className={cn(
            "inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/[0.14] bg-[#191d22] px-2.5 py-1 text-[clamp(8px,0.8vw,10px)] font-bold text-white/90 shadow-[0_4px_12px_rgb(0_0_0_/_0.2)]",
            details.tone === "amber" && "[&_svg]:text-amber-300",
            details.tone === "violet" && "[&_svg]:text-accent-purple",
            details.tone === "blue" && "[&_svg]:text-primary",
          )}
        >
          <FormatIcon format={format} />
          {details.label}
        </span>
        {format === "slideshow" ? (
          <span className="shrink-0 rounded-full border border-white/[0.12] bg-[#191d22] px-2 py-1 text-[clamp(8px,0.75vw,9px)] font-bold text-white/75">
            {slide + 1}/{SLIDES.length}
          </span>
        ) : null}
      </div>
      <div
        className="relative aspect-[9/16] w-full overflow-hidden rounded-[16px] border border-white/[0.16] bg-black shadow-[0_16px_34px_rgb(0_0_0_/_0.3)]"
        data-walkthrough-media-frame
      >
        {format === "slideshow" ? (
          <Image
            alt="Slideshow format preview"
            className="object-cover"
            fill
            key={SLIDES[slide]}
            loading="eager"
            sizes="(max-width: 1024px) 23vw, 147px"
            src={SLIDES[slide]}
            style={{
              animation:
                "trendingWalkthroughMediaFade 360ms cubic-bezier(.2,.8,.2,1) both",
            }}
          />
        ) : (
          <video
            autoPlay
            className="size-full object-cover"
            loop
            muted
            playsInline
            preload="auto"
            src={details.source}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/16" />
      </div>
    </div>
  );
}

function DemoScene() {
  return (
    <>
      <div className="absolute left-[12%] top-[18%] w-[20%]"><MediaCard format="hook" slide={0} /></div>
      <div className="absolute left-[39%] top-[14%] h-[72%] w-[39%] overflow-hidden rounded-[18px] border border-dashed border-primary/65 bg-primary/[0.06] p-[2%]">
        <div className="flex size-full items-center justify-center rounded-[15px] border border-white/[0.09] bg-[#14181d]"><Clapperboard className="size-[20%] text-primary/75" /></div>
        <div className="absolute inset-[5%] overflow-hidden rounded-[15px] bg-black opacity-0" style={{ animation: "trendingWalkthroughReveal 220ms ease-out 1900ms forwards" }}><video autoPlay className="size-full object-contain" loop muted playsInline preload="auto" src={WALKTHROUGH_DEMO_SOURCE} /><span className="absolute bottom-[7%] left-[7%] inline-flex items-center gap-1 rounded-full bg-success px-2 py-1 text-[clamp(8px,0.8vw,10px)] font-bold text-success-foreground"><Check className="size-3 stroke-[3]" />Demo added</span></div>
      </div>
      <div className="absolute left-[79%] top-[55%] z-20 flex h-[16%] w-[14%] items-center gap-2 rounded-[13px] border border-white/[0.13] bg-[#20252c] p-2 shadow-[0_10px_24px_rgb(0_0_0_/_0.3)]" style={{ animation: "trendingWalkthroughDemoDrag 2200ms cubic-bezier(.18,.86,.24,1) 180ms both" }}><div className="relative aspect-square h-full overflow-hidden rounded-[10px]"><video autoPlay className="size-full object-cover" loop muted playsInline preload="auto" src={WALKTHROUGH_DEMO_SOURCE} /></div><span className="hidden text-[clamp(8px,0.8vw,11px)] font-bold text-white/85 sm:block">Demo</span></div>
      <MousePointer2 aria-hidden="true" className="absolute z-30 size-[3.1%] fill-white text-black drop-shadow-[0_3px_4px_rgba(0,0,0,0.5)]" style={{ animation: "trendingWalkthroughCursorToDemo 2200ms cubic-bezier(.18,.86,.24,1) 180ms both" }} />
    </>
  );
}

function ScheduleScene({ format, slide = 0 }: { format: Format; slide?: number }) {
  const [scheduled, setScheduled] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setScheduled(true), 1_650);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      <div className="absolute left-[11%] top-[22%] w-[19%]"><MediaCard format={format} slide={slide} /></div>
      <div className="absolute left-[35%] top-[14%] h-[72%] w-[52%] rounded-[18px] border border-white/[0.11] bg-[#1a1f25]/95 p-[3%] shadow-[0_14px_38px_rgb(0_0_0_/_0.26)]">
        <div className="flex items-center gap-2 text-[clamp(10px,1.1vw,14px)] font-bold text-white"><CalendarClock className="size-[1.25em] text-primary" />Schedule Post</div>
        <div className="mt-[7%] space-y-[4%]"><Setting icon={<AtSign className="text-[#f56040]" />} value="Instagram account" /><Setting icon={<CalendarClock className="text-primary" />} value="Tomorrow · 6:30 PM" /></div>
        <div className={cn("absolute bottom-[9%] right-[8%] flex h-[14%] min-w-[24%] items-center justify-center rounded-[9px] px-2.5 text-[clamp(8px,0.8vw,10px)] font-bold text-primary-foreground transition-colors duration-200", scheduled ? "bg-success" : "bg-primary")}>
          {scheduled ? <><Check className="size-[1.1em] stroke-[3]" />Scheduled</> : "Schedule"}
        </div>
      </div>
      <MousePointer2 aria-hidden="true" className="absolute z-30 size-[3.1%] fill-white text-black drop-shadow-[0_3px_4px_rgba(0,0,0,0.5)]" style={{ animation: "trendingWalkthroughCursorToSchedule 1820ms cubic-bezier(.18,.86,.24,1) 220ms both" }} />
      <div className="absolute right-[8%] top-[28%] z-20 flex w-[20%] items-center gap-2 rounded-[13px] border border-success/35 bg-[#172823] px-3 py-2.5 opacity-0 shadow-[0_12px_28px_rgb(0_0_0_/_0.24)]" style={{ animation: "trendingWalkthroughScheduledToast 260ms cubic-bezier(.2,.82,.28,1) 1830ms forwards" }}><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground"><Check className="size-4 stroke-[3]" /></span><span><span className="block text-[clamp(8px,0.8vw,11px)] font-bold text-white">Scheduled post</span><span className="block text-[clamp(7px,0.7vw,10px)] text-success/90">{FORMAT[format].label}</span></span></div>
    </>
  );
}

function Setting({ icon, value }: { icon: ReactNode; value: string }) {
  return <div className="flex items-center gap-2 rounded-[12px] border border-white/[0.08] bg-black/15 px-3 py-2.5 text-[clamp(8px,0.86vw,11px)] font-medium text-white/75"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] [&_svg]:size-3.5">{icon}</span><span>{value}</span><Check className="ml-auto size-3.5 text-success" /></div>;
}

function GestureHand() {
  return <span className="relative block -rotate-6 text-white drop-shadow-[0_7px_12px_rgba(0,0,0,0.62)]"><span className="absolute inset-[10%] -z-10 rounded-full bg-black/45 blur-md" /><Pointer className="size-[clamp(40px,5.3vw,62px)] stroke-[2.6]" /></span>;
}

function FormatIcon({ format }: { format: Format }) {
  if (format === "hook") return <Sparkles className="size-[1em]" />;
  if (format === "wall") return <ScanText className="size-[1em]" />;
  return <Images className="size-[1em]" />;
}

function CompletionMark() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="inline-flex items-center gap-2.5 rounded-full border border-success/40 bg-[#172823]/95 px-4 py-2.5 text-success shadow-[0_14px_34px_rgba(0,0,0,0.28)]">
        <span className="flex size-7 items-center justify-center rounded-full bg-success text-success-foreground">
          <Check className="size-4 stroke-[3]" />
        </span>
        <span className="text-sm font-bold text-white">You&apos;re ready</span>
      </span>
    </div>
  );
}

function ControlsHighlight({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<ControlGuideStep>("waiting_for_edit");
  const [position, setPosition] = useState<ControlGuidePosition | null>(null);

  useEffect(() => {
    const activeControls = new Set<HTMLElement>();
    const guide = step === "waiting_for_edit" ? null : CONTROL_GUIDE[step];

    const sync = () => {
      const editControl = document.querySelector<HTMLElement>(
        CONTROL_GUIDE.edit.selector,
      );

      if (step === "waiting_for_edit") {
        if (editControl) setStep("edit");
        return;
      }

      const control = document.querySelector<HTMLElement>(guide!.selector);
      if (!control) {
        setPosition(null);
        return;
      }

      activeControls.add(control);
      control.classList.add("trending-walkthrough-control-highlight");

      const rect = control.getBoundingClientRect();
      const left = Math.min(
        Math.max(16, rect.left),
        Math.max(16, window.innerWidth - CONTROL_GUIDE_WIDTH - 16),
      );
      setPosition({
        arrowLeft: Math.min(
          CONTROL_GUIDE_WIDTH - 28,
          Math.max(28, rect.left + rect.width / 2 - left),
        ),
        left,
        top: rect.bottom + 12,
      });
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
      activeControls.forEach((control) =>
        control.classList.remove("trending-walkthrough-control-highlight"),
      );
    };
  }, [step]);

  const guide = step === "waiting_for_edit" ? null : CONTROL_GUIDE[step];

  return (
    <>
      <style>{`
        @keyframes trendingWalkthroughControlHighlight {
          0%,100% { border-color: rgb(255 255 255 / 0.14); box-shadow: none; transform: translateY(0); }
          45% { border-color: rgb(255 90 31 / 0.78); box-shadow: 0 0 0 4px rgb(255 90 31 / 0.16), 0 0 28px rgb(255 90 31 / 0.28); transform: translateY(-1px); }
        }
        .trending-walkthrough-control-highlight { animation: trendingWalkthroughControlHighlight 1.25s ease-in-out 2; }
        @media (prefers-reduced-motion: reduce) { .trending-walkthrough-control-highlight { animation-duration: 1ms; } }
      `}</style>
      {guide && position
        ? createPortal(
            <aside
              aria-label={guide.heading}
              className="fixed z-[70] w-[284px] rounded-[16px] border border-white/[0.14] bg-[#101316] p-4 text-white shadow-[0_18px_48px_rgb(0_0_0_/_0.32)]"
              data-trending-walkthrough-control-guide
              data-trending-walkthrough-control-step={step}
              role="dialog"
              style={{ left: position.left, top: position.top }}
            >
              <span
                aria-hidden="true"
                className="absolute -top-1.5 size-3 rotate-45 border-l border-t border-white/[0.14] bg-[#101316]"
                style={{ left: position.arrowLeft - 6 }}
              />
              <div className="relative">
                <p className="text-sm font-bold tracking-[-0.01em] text-white">
                  {guide.heading}
                </p>
                <p className="mt-1.5 text-sm leading-5 text-white/72">
                  {guide.description}
                </p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-white/45">{guide.step}</span>
                  <button
                    className="inline-flex h-8 items-center rounded-full bg-primary px-3 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101316]"
                    onClick={() => {
                      if (step === "edit") {
                        setStep("adjust");
                        return;
                      }
                      void onComplete();
                    }}
                    type="button"
                  >
                    {guide.action}
                  </button>
                </div>
              </div>
            </aside>,
            document.body,
          )
        : null}
    </>
  );
}

function WalkthroughKeyframes() {
  return <style>{`
    @keyframes trendingWalkthroughSceneEnter { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
    @keyframes trendingWalkthroughSceneExit { from{opacity:1} to{opacity:0} }
    @keyframes trendingWalkthroughSwipeCard { 0%,12%{opacity:1;transform:translateX(0) rotate(0)} 82%,100%{opacity:0;transform:translateX(235%) rotate(11deg)} }
    @keyframes trendingWalkthroughSwipeHand { 0%,12%{opacity:1;transform:translateX(0)} 82%,100%{opacity:0;transform:translateX(650%) translateY(3%)} }
    @keyframes trendingWalkthroughSwipeApproval { 0%,62%{opacity:0;transform:translateX(-10px) scale(.94)} 80%,100%{opacity:1;transform:translateX(0) scale(1)} }
    @keyframes trendingWalkthroughDemoDrag { 0%,12%{left:79%;top:55%;transform:rotate(2deg) scale(1)} 23%{transform:rotate(2deg) scale(1.06)} 82%,100%{left:51%;top:39%;transform:rotate(-2deg) scale(.82)} }
    @keyframes trendingWalkthroughCursorToDemo { 0%,12%{left:84%;top:67%;transform:scale(1)} 23%{transform:scale(.84)} 82%,100%{left:55%;top:47%;transform:scale(1)} }
    @keyframes trendingWalkthroughCursorToSchedule { 0%,16%{left:84%;top:82%;transform:scale(1)} 57%{left:76%;top:74.5%;transform:scale(1)} 69%{left:76%;top:74.5%;transform:scale(.82)} 100%{left:76%;top:74.5%;transform:scale(1)} }
    @keyframes trendingWalkthroughReveal { from{opacity:0;transform:translateY(6px) scale(.96)} to{opacity:1;transform:translateY(0) scale(1)} }
    @keyframes trendingWalkthroughMediaFade { from{opacity:0;transform:scale(1.015)} to{opacity:1;transform:scale(1)} }
    @keyframes trendingWalkthroughScheduledToast { from{opacity:0;transform:translateY(12px) scale(.92)} to{opacity:1;transform:translateY(0) scale(1)} }
    .trending-walkthrough-reduced-motion [style*="trendingWalkthrough"] { animation-duration:1ms !important; animation-delay:0ms !important; }
  `}</style>;
}
