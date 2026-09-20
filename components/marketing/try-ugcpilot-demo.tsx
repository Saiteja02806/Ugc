"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Check, Flame, LoaderCircle, RotateCcw, Volume2, VolumeX, Wifi, X } from "lucide-react";

import { ProductLogoMark } from "@/components/brand/product-logo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  parseTryUgcPilotBrowserSession,
  serializeTryUgcPilotBrowserSession,
  TRY_UGCPILOT_BROWSER_SESSION_KEY,
  type TryUgcPilotBusinessContext as BusinessContext,
  type TryUgcPilotWallOfTextPost as WallOfTextPost,
} from "@/lib/try-ugcpilot/browser-session";

type AnalyzeResponse = {
  businessContext: BusinessContext;
  posts: WallOfTextPost[];
};

type RefillResponse = { posts: WallOfTextPost[] };

// The default Cal AI deck is one Wall-of-Text post for every video in the
// original pool (14 videos in `videos (7)` and 15 in `videos (8)`). Audio is
// paired with the same index. Production serves the release assets from GCS so
// the app bundle and Git history do not carry the large media files; the local
// path keeps the developer preview usable when the public base URL is absent.
const tryUgcPilotMediaBaseUrl =
  process.env.NEXT_PUBLIC_TRY_UGCPILOT_MEDIA_BASE_URL?.replace(/\/$/, "") ??
  "/try-ugcpilot/media";

const CARD_MEDIA = Array.from({ length: 29 }, (_, index) => {
  const number = String(index + 1).padStart(2, "0");
  return {
    video: `${tryUgcPilotMediaBaseUrl}/videos/card-${number}.mp4`,
    audio: `${tryUgcPilotMediaBaseUrl}/audio/track-${number}.mp3`,
  };
});

const DEFAULT_CAL_AI_CONTEXT: BusinessContext = {
  brand: "Cal AI",
  url: "https://calai.com",
  title: "Cal AI",
  description: "A calorie and nutrition tracking app.",
  markdown: "Cal AI default demonstration content.",
};

const DEMO_POSTS: WallOfTextPost[] = [
  {
    id: "cal-ai-1",
    topic: "Hidden Calories",
    hook: "you don't have a slow metabolism",
    wallOfText:
      "hot take, you don't have\na slow metabolism\nyou're just drinking 400 calories\nin your iced latte\nand forgetting to track the oil\nyou cook your eggs in\ni started using this tracker because\nit scans the plate in 2 seconds\ninstead of searching a database\nfor 15 minutes\ncount accurately for 7 days\nand watch what happens",
  },
  {
    id: "cal-ai-2",
    topic: "Calorie Deficit",
    hook: "you don't need to cut carbs",
    wallOfText:
      "unpopular opinion:\nyou don't need to cut carbs\nor do 2 hours of cardio\nyou just need to stay\nin a 300 calorie deficit\nand eat enough protein\ni stopped overcomplicating it\nand started photo tracking\nevery single meal\nvisible abs are built\non boring consistency",
  },
  {
    id: "cal-ai-3",
    topic: "Metabolism Myth",
    hook: "the biggest lie in fitness",
    wallOfText:
      "the biggest lie in fitness:\n\"i only eat 1,200 calories\nand can't lose weight\"\none handful of almonds\ntwo tablespoons of salad dressing\nand a splash of coffee creamer\nadds 600 hidden calories\ntrack what you actually swallow\nnot what you think you ate",
  },
  {
    id: "cal-ai-4",
    topic: "Photo Tracking",
    hook: "stop trying to guess calories",
    wallOfText:
      "stop trying to guess\nhow many calories are in that bowl\nyour brain will always\nunderestimate by 30%\ni snap a photo before i eat\nthe AI breaks down macros\nbefore my fork hits the plate\naccurate data beats willpower\nevery single time",
  },
  {
    id: "cal-ai-5",
    topic: "Weekend Ruin",
    hook: "how you undo your whole week",
    wallOfText:
      "you eat clean Monday to Friday\nin a 400 calorie deficit\nthen drink 4 margaritas on Saturday\nand order late-night pizza\nboom, you just wiped out\nthe entire week's fat loss\nconsistency on the weekend\nis what actually separates\nresults from frustration",
  },
  {
    id: "cal-ai-6",
    topic: "Protein Priority",
    hook: "why you feel starving on diets",
    wallOfText:
      "if you feel starving on a diet\nit's not low calories\nit's low protein\naim for 0.8g per pound of bodyweight\nand watch your cravings disappear\nfill your plate with high volume\nand stop suffering unnecessarily",
  },
  {
    id: "cal-ai-7",
    topic: "Liquid Calories",
    hook: "stop drinking your calories",
    wallOfText:
      "the easiest 10 pounds you will ever lose:\nstop drinking your calories\nswapping soda, sweet tea, and lattes\nfor water and zero-calorie drinks\ncuts 500 calories a day\nwithout changing a single bite\nof real food",
  },
  {
    id: "cal-ai-8",
    topic: "Scale Weight Anxiety",
    hook: "the scale went up 3 pounds overnight",
    wallOfText:
      "you didn't gain 3 pounds of fat\nfrom yesterday's dinner\nyou gained water weight from sodium\nand carbohydrate glycogen\nstop freaking out at daily fluctuations\ntrack your weekly average\nand look at the 30-day trend",
  },
  {
    id: "cal-ai-9",
    topic: "Portion Blindness",
    hook: "healthy food still has calories",
    wallOfText:
      "healthy food still has calories. a spoon of peanut butter, a handful of trail mix, and an extra pour of olive oil can turn a light lunch into your whole afternoon. take the picture before the first bite. seeing the estimate makes the next choice easier.",
  },
  {
    id: "cal-ai-10",
    topic: "Restaurant Guessing",
    hook: "eating out does not ruin progress",
    wallOfText:
      "eating out does not ruin progress. guessing that a restaurant meal is perfect is what makes the week feel confusing. photograph the plate, get a reasonable estimate, and move on. one meal with context is better than a whole day of pretending it did not count.",
  },
  {
    id: "cal-ai-11",
    topic: "Breakfast Pattern",
    hook: "your breakfast is setting the whole day",
    wallOfText:
      "your breakfast is setting the whole day. if it leaves you hungry an hour later, every decision after that gets harder. track the meal once, notice the protein and fiber, then make one small swap tomorrow. sustainable progress starts with repeatable mornings.",
  },
  {
    id: "cal-ai-12",
    topic: "Macro Clarity",
    hook: "calories tell only half the story",
    wallOfText:
      "calories tell only half the story. two meals can have the same number and leave you feeling completely different. use the photo to see the protein, carbs, and fats together. when your meals keep you full, consistency stops feeling like a fight.",
  },
  {
    id: "cal-ai-13",
    topic: "Snack Audit",
    hook: "the snacks between meals matter",
    wallOfText:
      "the snacks between meals matter more than the meal plan you wrote on sunday. a few bites while cooking and a coffee run can quietly erase your deficit. track the ordinary moments for one week. the answer is usually hiding in the routine, not your motivation.",
  },
  {
    id: "cal-ai-14",
    topic: "Progress Plateau",
    hook: "a plateau is usually missing information",
    wallOfText:
      "a plateau is usually missing information, not a broken metabolism. before changing everything, look at seven days of real meals, drinks, and portions. photo tracking gives you something useful to adjust. data turns a frustrating guess into one clear next step.",
  },
  {
    id: "cal-ai-15",
    topic: "Protein Snacks",
    hook: "hunger is not a personality flaw",
    wallOfText:
      "hunger is not a personality flaw. if every snack is quick sugar, your energy crashes and dinner becomes impossible to control. build one protein option into the afternoon, log it with a photo, and notice what changes. a fuller day makes the plan much easier to follow.",
  },
  {
    id: "cal-ai-16",
    topic: "Food Scale Freedom",
    hook: "you do not need to weigh every bite forever",
    wallOfText:
      "you do not need to weigh every bite forever. use a tool long enough to learn what your normal portions actually look like. a quick meal photo can give you that feedback without turning dinner into a math problem. awareness first, then flexibility.",
  },
  {
    id: "cal-ai-17",
    topic: "Late Night Eating",
    hook: "late night eating is not the real problem",
    wallOfText:
      "late night eating is not the real problem. arriving there starving because lunch was tiny is the problem. track the full day instead of blaming the final snack. when daytime meals have enough protein and volume, evenings stop feeling like a test of willpower.",
  },
  {
    id: "cal-ai-18",
    topic: "Consistency Over Perfection",
    hook: "one imperfect meal changes nothing",
    wallOfText:
      "one imperfect meal changes nothing. the all-or-nothing spiral after it is what slows progress down. log the meal, learn from it, and make your next choice normal. the people who get results are not perfect; they return to their routine quickly.",
  },
  {
    id: "cal-ai-19",
    topic: "Weekend Plan",
    hook: "weekends need a plan too",
    wallOfText:
      "weekends need a plan too, not a punishment. you can have brunch, dinner out, and a social life when you know the bigger picture. get an estimate from the photo, prioritize what you actually enjoy, and let the rest of the week stay simple.",
  },
  {
    id: "cal-ai-20",
    topic: "Mindless Eating",
    hook: "your phone is changing your portions",
    wallOfText:
      "your phone is changing your portions more than you think. when you eat while scrolling, fullness arrives late and the plate disappears fast. take one photo before you begin. that two-second pause creates enough awareness to notice whether you are still hungry.",
  },
  {
    id: "cal-ai-21",
    topic: "Realistic Deficit",
    hook: "the best deficit is the one you can repeat",
    wallOfText:
      "the best deficit is the one you can repeat on a busy tuesday. extreme plans work only until life happens. start with the meals you already eat, understand their calories, and make a few changes you do not resent. boring and repeatable wins.",
  },
  {
    id: "cal-ai-22",
    topic: "Fiber Habit",
    hook: "fullness is a system",
    wallOfText:
      "fullness is a system. protein, fiber, water, and enough food on the plate all work together. if you are hungry every night, stop blaming yourself and inspect the meals. a picture makes patterns visible that memory never catches.",
  },
  {
    id: "cal-ai-23",
    topic: "Coffee Check",
    hook: "your coffee might be a meal",
    wallOfText:
      "your coffee might be a meal and that is fine, as long as you count it like one. syrups, creamers, and cold foam add up quickly when they are invisible. take the photo, see the estimate, and choose the version that still fits your day.",
  },
  {
    id: "cal-ai-24",
    topic: "Meal Prep Reality",
    hook: "meal prep does not need to be perfect",
    wallOfText:
      "meal prep does not need matching containers and a perfect sunday. knowing the rough calories in three reliable meals is enough to remove daily decision fatigue. save the meals that work, photograph the new ones, and let your system grow from there.",
  },
  {
    id: "cal-ai-25",
    topic: "Maintenance Mindset",
    hook: "learning maintenance starts now",
    wallOfText:
      "learning maintenance starts now, not after you reach a goal weight. the same awareness that helps you lose weight helps you keep it off. use the tracker to understand your normal meals, then trust the pattern instead of restarting another strict plan.",
  },
  {
    id: "cal-ai-26",
    topic: "Grocery Choices",
    hook: "the grocery cart decides dinner",
    wallOfText:
      "the grocery cart decides dinner before willpower gets involved. keep a few foods you enjoy that make protein and fiber easy. when the simple option is already in the fridge, tracking becomes confirmation instead of a stressful correction.",
  },
  {
    id: "cal-ai-27",
    topic: "Progress Photos",
    hook: "the scale is one signal",
    wallOfText:
      "the scale is one signal, not the whole story. sleep, sodium, training, and digestion can move it around overnight. use your food data alongside the weekly trend. you need enough context to stay calm while your habits do their work.",
  },
  {
    id: "cal-ai-28",
    topic: "Simple Tracking",
    hook: "the easiest system is the system you use",
    wallOfText:
      "the easiest system is the system you use when you are busy. a photo before a meal is faster than searching a giant database and more useful than guessing. make the helpful action small enough that it survives real life.",
  },
  {
    id: "cal-ai-29",
    topic: "One Week Experiment",
    hook: "give yourself seven honest days",
    wallOfText:
      "give yourself seven honest days before deciding the plan is not working. track meals, drinks, snacks, and the weekend without judgment. patterns will show up quickly. then you can change the one thing that matters instead of starting over again.",
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
  const [generatedCount, setGeneratedCount] = useState(DEMO_POSTS.length);
  const [postedCount, setPostedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRefilling, setIsRefilling] = useState(false);
  const [notice, setNotice] = useState("Loaded Cal AI Wall-of-Text content.");
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exitDirection, setExitDirection] = useState<"left" | "right" | null>(null);
  const [showSwipeGuide, setShowSwipeGuide] = useState(true);
  const [isMediaMuted, setIsMediaMuted] = useState(true);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const [isSessionRestored, setIsSessionRestored] = useState(false);
  const [browserStorageAvailable, setBrowserStorageAvailable] = useState(false);
  const dragStartX = useRef<number | null>(null);
  const refillAttemptFor = useRef<string | null>(null);
  const refillInFlight = useRef(false);
  const refillRequestId = useRef(0);
  const deckVersion = useRef(0);
  const audioContext = useRef<AudioContext | null>(null);
  const activeVideo = useRef<HTMLVideoElement | null>(null);
  const activeAudio = useRef<HTMLAudioElement | null>(null);
  const mobileControlsLauncher = useRef<HTMLButtonElement | null>(null);

  const topCard = cards[0];
  const readyCount = cards.length;
  const activeContext = businessContext ?? DEFAULT_CAL_AI_CONTEXT;
  const brand = activeContext.brand;
  const shouldShowMobileControls = swipedCount >= 3;

  function closeMobileControls() {
    setMobileControlsOpen(false);
    window.requestAnimationFrame(() => {
      if (window.matchMedia("(max-width: 1279px)").matches) {
        mobileControlsLauncher.current?.focus();
      }
    });
  }

  function handleMobileControlsOpenChange(open: boolean) {
    if (open) {
      setMobileControlsOpen(true);
      return;
    }
    closeMobileControls();
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (mobileControlsOpen) {
        if (event.key === "Escape") {
          closeMobileControls();
          event.preventDefault();
          return;
        }
        if (
          (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
          !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
        ) {
          event.preventDefault();
          return;
        }
      }
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
    const desktopQuery = window.matchMedia("(min-width: 1280px)");
    const closeMobileControlsOnDesktop = () => {
      if (desktopQuery.matches) setMobileControlsOpen(false);
    };
    closeMobileControlsOnDesktop();
    desktopQuery.addEventListener("change", closeMobileControlsOnDesktop);
    return () => desktopQuery.removeEventListener("change", closeMobileControlsOnDesktop);
  }, []);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      try {
        const restored = parseTryUgcPilotBrowserSession(
          window.localStorage.getItem(TRY_UGCPILOT_BROWSER_SESSION_KEY),
        );

        setBrowserStorageAvailable(true);
        if (restored) {
          setUrl(restored.url);
          setCards(restored.cards);
          setBusinessContext(restored.businessContext);
          setNextPostNumber(restored.nextPostNumber);
          setRecentHooks(restored.recentHooks);
          setSwipedCount(restored.swipedCount);
          setGeneratedCount(restored.generatedCount);
          setPostedCount(restored.postedCount);
          setSkippedCount(restored.skippedCount);
          setNotice(
            restored.businessContext
              ? `Restored your saved Wall-of-Text deck for ${restored.businessContext.brand}.`
              : "Restored your saved demo deck.",
          );
        }
      } catch {
        // Browser storage can be disabled by a visitor's privacy settings.
      } finally {
        setIsSessionRestored(true);
      }
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, []);

  useEffect(() => {
    if (
      !isSessionRestored ||
      !browserStorageAvailable ||
      isAnalyzing ||
      isRefilling ||
      dragging ||
      exitDirection
    ) {
      return;
    }

    try {
      window.localStorage.setItem(
        TRY_UGCPILOT_BROWSER_SESSION_KEY,
        serializeTryUgcPilotBrowserSession({
          url,
          cards,
          businessContext,
          nextPostNumber,
          recentHooks,
          swipedCount,
          generatedCount,
          postedCount,
          skippedCount,
          notice,
        }),
      );
    } catch {
      window.requestAnimationFrame(() => setBrowserStorageAvailable(false));
    }
  }, [
    browserStorageAvailable,
    businessContext,
    cards,
    dragging,
    exitDirection,
    generatedCount,
    isAnalyzing,
    isRefilling,
    isSessionRestored,
    nextPostNumber,
    notice,
    postedCount,
    recentHooks,
    skippedCount,
    swipedCount,
    url,
  ]);

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

  function playSwipeSound(direction: "left" | "right") {
    try {
      const AudioContextConstructor = window.AudioContext ?? (
        window as Window & { webkitAudioContext?: typeof AudioContext }
      ).webkitAudioContext;
      if (!AudioContextConstructor) return;
      const context = audioContext.current ?? new AudioContextConstructor();
      audioContext.current = context;
      if (context.state === "suspended") void context.resume();

      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      if (direction === "left") {
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(460, now);
        oscillator.frequency.exponentialRampToValueAtTime(110, now + 0.12);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      } else {
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(523.25, now);
        oscillator.frequency.exponentialRampToValueAtTime(783.99, now + 0.2);
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      }

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + (direction === "left" ? 0.13 : 0.24));
    } catch {
      // Sound feedback is optional; swiping must still work when audio is unavailable.
    }
  }

  useEffect(() => {
    const video = activeVideo.current;
    const audio = activeAudio.current;

    if (showSwipeGuide) {
      video?.pause();
      audio?.pause();
      return;
    }

    if (video) {
      video.muted = true;
      void video.play().catch(() => {
        // Browsers can defer video playback until the guide is dismissed.
      });
    }
    if (!audio) return;
    audio.volume = 0.85;
    audio.muted = isMediaMuted;

    if (isMediaMuted) {
      audio.pause();
      return;
    }

    if (video && Number.isFinite(video.currentTime)) {
      audio.currentTime = video.currentTime;
    }
    void audio.play().catch(() => {
      // Sound is enabled only after a user gesture, per browser autoplay rules.
    });
  }, [isMediaMuted, showSwipeGuide, topCard?.id]);

  function toggleMediaAudio() {
    const nextMuted = !isMediaMuted;
    setIsMediaMuted(nextMuted);

    const audio = activeAudio.current;
    if (!audio) return;
    audio.volume = 0.85;
    audio.muted = nextMuted;
    if (nextMuted) {
      audio.pause();
      return;
    }

    const video = activeVideo.current;
    if (video && Number.isFinite(video.currentTime)) {
      audio.currentTime = video.currentTime;
    }
    void audio.play().catch(() => {
      setNotice("Audio could not start. Tap the sound control once more.");
    });
  }

  useEffect(() => {
    const refillKey = `${nextPostNumber}:${readyCount}`;
    if (
      !businessContext ||
      isAnalyzing ||
      readyCount >= 6 ||
      refillInFlight.current ||
      refillAttemptFor.current === refillKey
    ) {
      return;
    }

    const startNumber = nextPostNumber;
    const requestId = ++refillRequestId.current;
    const requestDeckVersion = deckVersion.current;
    refillAttemptFor.current = refillKey;
    refillInFlight.current = true;
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
        if (refillRequestId.current !== requestId || deckVersion.current !== requestDeckVersion) return;
        setCards((current) => [...current, ...data.posts]);
        setGeneratedCount((count) => count + data.posts.length);
        setRecentHooks((current) => [...current, ...data.posts.map((post) => post.hook)].slice(-32));
        setNextPostNumber(startNumber + data.posts.length);
        setNotice("10 more Wall-of-Text posts are ready.");
      })
      .catch((error: unknown) => {
        if (refillRequestId.current === requestId && deckVersion.current === requestDeckVersion) {
          setNotice(error instanceof Error ? error.message : "More content could not be generated right now.");
        }
      })
      .finally(() => {
        if (refillRequestId.current === requestId) {
          refillInFlight.current = false;
          if (deckVersion.current === requestDeckVersion) setIsRefilling(false);
        }
      });
  }, [businessContext, isAnalyzing, nextPostNumber, readyCount, recentHooks]);

  function swipe(direction: "left" | "right") {
    // A first interaction is only an onboarding acknowledgement. It must not
    // perform the Skip/Posted action the tutorial is explaining.
    if (showSwipeGuide) {
      dismissSwipeGuide();
      return;
    }
    if (!topCard || exitDirection) return;
    if (!isMediaMuted) playSwipeSound(direction);
    setExitDirection(direction);
    window.setTimeout(() => {
      setCards((current) => current.slice(1));
      setSwipedCount((count) => count + 1);
      if (direction === "right") {
        setPostedCount((count) => count + 1);
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

    deckVersion.current += 1;
    refillRequestId.current += 1;
    refillInFlight.current = false;
    setIsRefilling(false);
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
      setGeneratedCount(data.posts.length);
      setPostedCount(0);
      setSkippedCount(0);
      setMobileControlsOpen(false);
      setNotice(`16 tailored Wall-of-Text posts are ready for ${data.businessContext.brand}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The analysis is temporarily unavailable. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function resetDemo() {
    deckVersion.current += 1;
    refillRequestId.current += 1;
    refillInFlight.current = false;
    refillAttemptFor.current = null;
    setBusinessContext(null);
    setCards(DEMO_POSTS);
    setRecentHooks([]);
    setSwipedCount(0);
    setGeneratedCount(DEMO_POSTS.length);
    setPostedCount(0);
    setSkippedCount(0);
    setNextPostNumber(17);
    setDragX(0);
    setExitDirection(null);
    setIsRefilling(false);
    setMobileControlsOpen(false);
    setNotice("Loaded Cal AI Wall-of-Text content.");
    try {
      window.localStorage.removeItem(TRY_UGCPILOT_BROWSER_SESSION_KEY);
      setBrowserStorageAvailable(true);
    } catch {
      setBrowserStorageAvailable(false);
    }
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!topCard || exitDirection) return;
    // The tutorial is deliberately a separate first step. Do not begin a
    // drag in the same gesture that makes the instructions disappear.
    if (showSwipeGuide) {
      dismissSwipeGuide();
      return;
    }
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
    <main className="relative min-h-dvh overflow-x-hidden bg-[#101010] text-white">
      <section className="relative z-50 mx-auto hidden w-full max-w-[280px] xl:fixed xl:left-8 xl:top-1/2 xl:block xl:w-[280px] xl:max-h-[calc(100dvh-160px)] xl:max-w-none xl:-translate-y-1/2 xl:overflow-y-auto">
        <ProductControlPanel
          inputId="desktop-product-url"
          url={url}
          onUrlChange={setUrl}
          onSubmit={analyze}
          isAnalyzing={isAnalyzing}
          activeContext={activeContext}
          brand={brand}
          isRefilling={isRefilling}
          browserStorageAvailable={browserStorageAvailable}
          onReset={resetDemo}
        />
      </section>

      <aside className="fixed bottom-6 left-8 z-40 hidden w-[280px] text-left xl:block" aria-live="polite">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">Content Activity</p>
        <p className="mt-1 text-sm font-semibold text-zinc-200">
          <span className="mr-1 text-xl font-bold text-white">{generatedCount}</span>
          posts generated
        </p>
        <p className="mt-1 text-xs font-medium text-zinc-400">
          Posted {postedCount} / Skipped {skippedCount} / Generating {isAnalyzing ? 16 : isRefilling ? 10 : 0}
        </p>
        <p className="mt-2 truncate text-xs leading-4 text-zinc-500">{notice}</p>
      </aside>

      {shouldShowMobileControls && !mobileControlsOpen ? (
        <button
          ref={mobileControlsLauncher}
          type="button"
          aria-label="Open product controls"
          aria-expanded={false}
          title="Open Product URL"
          onClick={() => setMobileControlsOpen(true)}
          className="fixed bottom-[calc(136px+env(safe-area-inset-bottom))] right-4 z-50 grid size-11 place-items-center rounded-full border border-white/70 bg-white p-1.5 shadow-[0_8px_22px_rgba(255,90,31,0.38)] transition hover:scale-105 hover:border-[#ff5a1f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f] focus-visible:ring-offset-2 focus-visible:ring-offset-[#101010] xl:hidden"
        >
          <ProductLogoMark className="size-full" sizes="40px" />
        </button>
      ) : null}

      <Dialog open={mobileControlsOpen} onOpenChange={handleMobileControlsOpenChange}>
        <DialogContent
          className="w-[min(320px,calc(100%-2rem))] gap-0 border-white/10 bg-zinc-900 p-0 text-white shadow-[0_24px_80px_rgba(0,0,0,0.64)] xl:hidden"
          overlayClassName="bg-black/70 backdrop-blur-md xl:hidden"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Product controls</DialogTitle>
            <DialogDescription>Enter a product website to generate Wall-of-Text content.</DialogDescription>
          </DialogHeader>
          <ProductControlPanel
            inputId="mobile-product-url"
            url={url}
            onUrlChange={setUrl}
            onSubmit={analyze}
            isAnalyzing={isAnalyzing}
            activeContext={activeContext}
            brand={brand}
            isRefilling={isRefilling}
            browserStorageAvailable={browserStorageAvailable}
            onReset={resetDemo}
          />
        </DialogContent>
      </Dialog>

      <section className="flex h-[100svh] min-h-0 w-full items-center justify-center px-0 py-0 xl:min-h-dvh xl:h-auto xl:px-4 xl:py-5">
          <div className="relative h-full min-h-0 w-full max-w-[505px] xl:h-[min(900px,calc(100svh-2rem))] xl:min-h-[660px] xl:max-w-[368px]">
            <div className="relative h-full overflow-hidden bg-[#101011]">
            <div className="relative z-40 flex h-[54px] items-center justify-between px-[clamp(24px,7.5vw,39px)] text-[16px] font-bold tracking-[-0.04em] text-white xl:px-7">
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

            <div className="absolute inset-x-[clamp(16px,6.5vw,33px)] top-[63px] z-40 flex items-center justify-between xl:inset-x-5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-[14px] font-bold tracking-[-0.02em] text-white shadow-[0_6px_18px_rgba(0,0,0,0.18)]">
                <Flame className="size-4 text-[#ff526b]" fill="currentColor" aria-hidden="true" />
                Trending Content
              </span>
            </div>

            <div className="absolute inset-x-[clamp(12px,5.5vw,28px)] bottom-[120px] top-[122px] xl:inset-x-4 xl:bottom-[104px]" aria-label={`${readyCount} content cards ready`}>
            {cards.slice(0, 3).map((card, index) => {
              const isTop = index === 0;
              const rotation = isTop ? dragX * 0.075 : 0;
              const transform = exitDirection && isTop
                ? `translateX(${exitDirection === "right" ? 520 : -520}px) translateY(20px) rotate(${exitDirection === "right" ? 24 : -24}deg)`
                : isTop
                  ? `translateX(${dragX}px) rotate(${rotation}deg)`
                  : `translateY(${index * 12}px) scale(${1 - index * 0.04})`;
              const media = CARD_MEDIA[(swipedCount + index) % CARD_MEDIA.length] ?? CARD_MEDIA[0];
              return (
                <div
                  key={card.id}
                  onPointerDown={isTop ? onPointerDown : undefined}
                  onPointerMove={isTop ? onPointerMove : undefined}
                  onPointerUp={isTop ? onPointerEnd : undefined}
                  onPointerCancel={isTop ? onPointerEnd : undefined}
                  aria-label={isTop ? "Wall-of-Text content card. Swipe left to skip or right to post." : undefined}
                  className={`absolute inset-0 overflow-hidden rounded-[31px] border border-white/10 bg-zinc-900 shadow-[0_20px_45px_rgba(0,0,0,0.5)] xl:rounded-[29px] ${isTop ? "cursor-grab touch-none select-none active:cursor-grabbing" : "pointer-events-none"} ${dragging ? "transition-none" : "transition-[transform,opacity] duration-300"}`}
                  style={{ transform, zIndex: 30 - index, opacity: isTop && exitDirection ? 0 : 1 }}
                >
                  <video
                    ref={isTop ? activeVideo : undefined}
                    src={media.video}
                    autoPlay={isTop && !showSwipeGuide}
                    loop
                    muted
                    playsInline
                    preload={isTop ? "auto" : "metadata"}
                    aria-label="Creator content background video"
                    className="absolute inset-0 size-full object-cover"
                  />
                  {isTop ? (
                    <audio
                      ref={activeAudio}
                      src={media.audio}
                      loop
                      muted={isMediaMuted}
                      preload="auto"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/5 to-black/65" />
                  {isTop ? (
                    <button
                      type="button"
                      aria-label={isMediaMuted ? "Turn on background audio" : "Mute background audio"}
                      aria-pressed={!isMediaMuted}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleMediaAudio();
                      }}
                      className="absolute right-5 top-5 z-30 grid size-12 place-items-center rounded-full border border-white/25 bg-black/45 text-white shadow-[0_5px_16px_rgba(0,0,0,0.45)] backdrop-blur-sm transition hover:bg-black/65 xl:right-4 xl:top-4 xl:size-11"
                    >
                      {isMediaMuted ? <VolumeX className="size-4" aria-hidden="true" /> : <Volume2 className="size-4" aria-hidden="true" />}
                    </button>
                  ) : null}
                  <div
                    className="absolute left-1/2 top-[185px] w-[min(295px,calc(100%-72px))] -translate-x-1/2 break-words whitespace-pre-line text-center text-base font-semibold leading-[1.42] tracking-[-0.15px] text-white [paint-order:stroke_fill] [text-shadow:0_2px_5px_rgba(0,0,0,0.82)]"
                    style={{
                      fontFamily: "var(--font-try-ugcpilot-wall-text), Inter, -apple-system, BlinkMacSystemFont, 'SF Pro Rounded', 'Plus Jakarta Sans', Roboto, sans-serif",
                      // Fractional, stacked shadow offsets rasterize independently and can
                      // leave visible seams inside glyphs at different browser zoom/DPRs.
                      WebkitTextStroke: "1px rgba(0, 0, 0, 0.92)",
                    }}
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

            <div className="absolute inset-x-0 bottom-0 z-40 flex h-[120px] items-center justify-center gap-[116px] bg-[#101011] xl:h-[104px] xl:gap-20">
              <button
                type="button"
                aria-label="Skip"
                onClick={() => swipe("left")}
                disabled={!topCard || Boolean(exitDirection)}
                className="grid size-[84px] place-items-center rounded-full border border-rose-400/35 bg-white/5 text-rose-400 shadow-[0_12px_28px_rgba(0,0,0,0.45)] transition hover:scale-105 hover:bg-rose-400/10 disabled:opacity-50 xl:size-[68px]"
              >
                <X className="size-7" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Posted"
                onClick={() => swipe("right")}
                disabled={!topCard || Boolean(exitDirection)}
                className="grid size-[84px] place-items-center rounded-full border border-emerald-400/35 bg-white/5 text-emerald-400 shadow-[0_12px_28px_rgba(0,0,0,0.45)] transition hover:scale-105 hover:bg-emerald-400/10 disabled:opacity-50 xl:size-[68px]"
              >
                <Check className="size-7" aria-hidden="true" />
              </button>
            </div>
            <div className="absolute bottom-2 left-1/2 z-50 h-[4.5px] w-[130px] -translate-x-1/2 rounded-full bg-white/25" aria-hidden="true" />
            </div>
          </div>
      </section>
    </main>
  );
}

function ProductControlPanel({
  inputId,
  url,
  onUrlChange,
  onSubmit,
  isAnalyzing,
  activeContext,
  brand,
  isRefilling,
  browserStorageAvailable,
  onReset,
}: {
  inputId: string;
  url: string;
  onUrlChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  isAnalyzing: boolean;
  activeContext: BusinessContext;
  brand: string;
  isRefilling: boolean;
  browserStorageAvailable: boolean;
  onReset: () => void;
}) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-zinc-900 p-4 text-white shadow-2xl">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="size-2.5 rounded-full bg-[#ff5a1f] shadow-[0_0_10px_rgba(255,90,31,0.8)]" aria-hidden="true" />
        <p className="text-[13px] font-bold uppercase tracking-[0.8px] text-zinc-300">AI Content Engine</p>
      </div>

      <form className="space-y-2.5" onSubmit={onSubmit}>
        <label className="block text-[11px] font-bold uppercase tracking-[0.6px] text-zinc-400" htmlFor={inputId}>
          Product URL
        </label>
        <div className="flex h-10 items-center rounded-[11px] border border-white/15 bg-zinc-950 px-3 transition-[border-color,box-shadow] focus-within:border-[#ff5a1f] focus-within:ring-2 focus-within:ring-orange-500/20">
          <input
            id={inputId}
            name="productUrl"
            type="url"
            value={url}
            onChange={(event) => onUrlChange(event.target.value)}
            placeholder="calai.com"
            inputMode="url"
            autoComplete="url"
            className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-white outline-none placeholder:text-zinc-600"
          />
        </div>
        <button
          type="submit"
          disabled={isAnalyzing || !url.trim()}
          className="flex h-10 w-full items-center justify-center rounded-[11px] bg-[#ff5a1f] px-4 text-[13px] font-bold text-white shadow-lg shadow-orange-500/20 transition hover:bg-[#e04810] disabled:cursor-wait disabled:opacity-65"
        >
          {isAnalyzing ? <LoaderCircle className="mr-2 size-3.5 animate-spin" aria-hidden="true" /> : null}
          {isAnalyzing ? "Analyzing…" : "Analyze URL"}
        </button>
      </form>

      <div className="mt-4 space-y-2.5 rounded-xl bg-zinc-950 p-3 text-sm">
        <StatusRow done label={`Analyzed: ${activeContext.url.replace(/^https?:\/\//, "")}`} />
        <StatusRow done label={`Brand: ${brand}`} />
        <StatusRow
          done={!isRefilling}
          loading={isAnalyzing || isRefilling}
          label={isRefilling ? "Generating 10 more posts…" : "Wall-of-Text posts ready"}
        />
      </div>

      <button type="button" onClick={onReset} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-[#ff6a35]">
        <RotateCcw className="size-3.5" aria-hidden="true" /> Reset demo deck
      </button>
      {browserStorageAvailable ? (
        <p className="mt-2 text-[11px] leading-4 text-zinc-500">
          This deck is saved on this device for 30 days.
        </p>
      ) : null}
    </div>
  );
}

function SwipeGuide() {
  return (
    <>
      <style>{`
        @keyframes ugcpilot-guide-hand-glide {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          15%, 32% { transform: translateX(36px) rotate(9deg); }
          50% { transform: translateX(0) rotate(0deg); }
          65%, 82% { transform: translateX(-36px) rotate(-9deg); }
        }
        @keyframes ugcpilot-guide-left-pulse {
          0%, 50%, 100% { opacity: 0.6; transform: scale(0.98); }
          65%, 82% { opacity: 1; transform: scale(1.06); }
        }
        @keyframes ugcpilot-guide-right-pulse {
          0%, 48%, 100% { opacity: 0.6; transform: scale(0.98); }
          15%, 32% { opacity: 1; transform: scale(1.06); }
        }
        @keyframes ugcpilot-guide-ring-pulse {
          0% { transform: scale(0.7); opacity: 0.8; }
          100% { transform: scale(1.55); opacity: 0; }
        }
        .ugcpilot-guide-hand { animation: ugcpilot-guide-hand-glide 3.2s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite; }
        .ugcpilot-guide-left { animation: ugcpilot-guide-left-pulse 3.2s ease-in-out infinite; }
        .ugcpilot-guide-right { animation: ugcpilot-guide-right-pulse 3.2s ease-in-out infinite; }
        .ugcpilot-guide-ring { animation: ugcpilot-guide-ring-pulse 2s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .ugcpilot-guide-hand, .ugcpilot-guide-left, .ugcpilot-guide-right, .ugcpilot-guide-ring { animation: none; }
        }
      `}</style>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-30 select-none rounded-[31px] bg-black/[0.58] text-center backdrop-blur-[16px] xl:rounded-[29px]"
      >
        <div className="absolute left-1/2 top-[47%] flex w-[310px] max-w-[calc(100%-24px)] -translate-x-1/2 -translate-y-1/2 items-center justify-between">
          <div className="ugcpilot-guide-left flex w-[86px] flex-col items-center gap-1.5 text-white drop-shadow-[0_3px_8px_rgba(0,0,0,0.9)]">
            <svg viewBox="0 0 44 32" width="34" height="25" fill="none" aria-hidden="true">
              <path d="M40 26 C26 26 12 18 6 6" stroke="#f43f5e" strokeWidth="2.6" strokeLinecap="round" />
              <polyline points="14 5 5 5 5 14" stroke="#f43f5e" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-xs font-extrabold uppercase tracking-[0.4px]">Swipe left</span>
            <span className="rounded-full border-[1.5px] border-white/40 bg-rose-500/[0.88] px-[11px] py-[3px] text-[11px] font-extrabold uppercase tracking-[0.8px] text-white shadow-[0_4px_16px_rgba(244,63,94,0.7)]">Skip</span>
          </div>
          <div className="ugcpilot-guide-hand relative grid size-[76px] place-items-center">
            <span className="ugcpilot-guide-ring absolute size-[58px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.35)_0%,transparent_70%)]" />
            <Image
              src="/try-ugcpilot/hand-pointer.png"
              alt=""
              width={62}
              height={62}
              className="relative size-[62px] select-none object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)]"
              draggable={false}
              unoptimized
            />
          </div>
          <div className="ugcpilot-guide-right flex w-[86px] flex-col items-center gap-1.5 text-white drop-shadow-[0_3px_8px_rgba(0,0,0,0.9)]">
            <svg viewBox="0 0 44 32" width="34" height="25" fill="none" aria-hidden="true">
              <path d="M4 26 C18 26 32 18 38 6" stroke="#10b981" strokeWidth="2.6" strokeLinecap="round" />
              <polyline points="30 5 39 5 39 14" stroke="#10b981" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-xs font-extrabold uppercase tracking-[0.4px]">Swipe right</span>
            <span className="rounded-full border-[1.5px] border-white/40 bg-emerald-500/[0.88] px-[11px] py-[3px] text-[11px] font-extrabold uppercase tracking-[0.8px] text-white shadow-[0_4px_16px_rgba(16,185,129,0.7)]">Posted</span>
          </div>
        </div>
        <span className="absolute left-1/2 top-[61%] -translate-x-1/2 whitespace-nowrap rounded-full border border-white/30 bg-black/[0.72] px-[18px] py-[7px] text-[11.5px] font-semibold tracking-[0.3px] text-white shadow-[0_4px_20px_rgba(0,0,0,0.7)]">
          Tap or swipe card to start
        </span>
      </div>
    </>
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
