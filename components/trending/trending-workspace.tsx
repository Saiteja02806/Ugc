"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ImageIcon,
  Layers3,
  Loader2,
  PlaySquare,
  RefreshCw,
  Search,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/contexts/auth-context";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { cn } from "@/lib/utils";

type CreativeCategory = "All" | "Carousel" | "Video" | "Avatar" | "Image";
type CreativeType = Exclude<CreativeCategory, "All">;
type AvatarSource = "my" | "global";

type CreativeSlide = {
  accent: string;
  hook: string;
  label: string;
};

type CreativeTemplate = {
  category: CreativeType;
  id: string;
  name: string;
  slides: CreativeSlide[];
  tone: "coral" | "green" | "navy" | "sky" | "violet";
};

type CarouselHistoryState = "error" | "idle" | "loading" | "ready";

type GeneratedCarousel = {
  carouselId: string;
  categorySlug: string | null;
  generationBatchId: string;
  projectId: string;
  readySlideCount: number;
  selectedAngle: string | null;
  slideCount: number;
  status: "completed" | "failed" | "processing";
  thumbnailUrl: string | null;
  updatedAt: string;
};

type CarouselProfileFeed = {
  error?: string | null;
  id?: string;
  state: "failed" | "missing" | "preparing" | "ready";
};

type CarouselHistoryResponse =
  | {
      ok: true;
      carousels: GeneratedCarousel[];
      profile: CarouselProfileFeed;
    }
  | {
      ok: false;
      message: string;
    };

const filters: CreativeCategory[] = ["All", "Carousel", "Video", "Avatar", "Image"];

const templates: CreativeTemplate[] = [
  {
    category: "Video",
    id: "problem-hook",
    name: "Problem Hook",
    tone: "coral",
    slides: [
      {
        accent: "Pain point",
        hook: "Stop losing buyers in the first three seconds",
        label: "Open with the moment they already feel",
      },
      {
        accent: "Shift",
        hook: "Show the old way before the product appears",
        label: "Make the contrast obvious",
      },
      {
        accent: "Payoff",
        hook: "End with one clean next step",
        label: "Keep the close direct",
      },
    ],
  },
  {
    category: "Carousel",
    id: "carousel-ad",
    name: "Carousel Ad",
    tone: "navy",
    slides: [
      {
        accent: "Slide story",
        hook: "Turn one product feature into five ad ideas",
        label: "Hook, problem, solution, proof, CTA",
      },
      {
        accent: "Flow",
        hook: "Make every swipe reveal one reason to care",
        label: "Short copy, clear movement",
      },
      {
        accent: "Close",
        hook: "Use the final slide for a simple action",
        label: "No heavy explanation",
      },
      {
        accent: "Format",
        hook: "Build a swipeable concept from brand context",
        label: "Designed for social feeds",
      },
    ],
  },
  {
    category: "Avatar",
    id: "avatar-hook",
    name: "Avatar Hook",
    tone: "green",
    slides: [
      {
        accent: "Creator",
        hook: "Start with a direct line from a real person",
        label: "Avatar-led opening",
      },
      {
        accent: "Point of view",
        hook: "Say the buyer's private objection out loud",
        label: "Conversational and fast",
      },
      {
        accent: "Bridge",
        hook: "Move from doubt to one product benefit",
        label: "Keep it human",
      },
    ],
  },
  {
    category: "Image",
    id: "founder-pov",
    name: "Founder POV",
    tone: "sky",
    slides: [
      {
        accent: "POV",
        hook: "What I wish I knew before our first launch",
        label: "Founder-style creative",
      },
      {
        accent: "Context",
        hook: "Show the messy moment before the product helps",
        label: "Natural visual setup",
      },
      {
        accent: "Result",
        hook: "Make the product feel like the obvious shortcut",
        label: "Clean final frame",
      },
    ],
  },
  {
    category: "Video",
    id: "product-demo",
    name: "Product Demo",
    tone: "violet",
    slides: [
      {
        accent: "Demo",
        hook: "Show the feature that removes the manual step",
        label: "One visible action",
      },
      {
        accent: "Before",
        hook: "Start with the task that used to take too long",
        label: "No long setup",
      },
      {
        accent: "After",
        hook: "End with the clean result on screen",
        label: "Make the value obvious",
      },
    ],
  },
];

const globalAvatars = [
  { id: "aria", name: "Aria", role: "Calm SaaS narrator" },
  { id: "nina", name: "Nina", role: "Direct product educator" },
  { id: "kai", name: "Kai", role: "Founder-style presenter" },
];

const toneClassName: Record<CreativeTemplate["tone"], string> = {
  coral: "from-[#321711] via-[#805041] to-[#ff8a68]",
  green: "from-[#0e2c25] via-[#24594c] to-[#9ad9b8]",
  navy: "from-[#07111f] via-[#173454] to-[#6aa4d8]",
  sky: "from-[#102033] via-[#526f8e] to-[#d7ecff]",
  violet: "from-[#20163a] via-[#5a437c] to-[#f1c6ff]",
};

export function TrendingWorkspace() {
  const router = useRouter();
  const { loading: authLoading, user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<CreativeCategory>("All");
  const [activeTemplateIndex, setActiveTemplateIndex] = useState(0);
  const [activeSlideByTemplateId, setActiveSlideByTemplateId] = useState<
    Record<string, number>
  >({});
  const [drawerTemplate, setDrawerTemplate] = useState<CreativeTemplate | null>(null);
  const [generatedCarousels, setGeneratedCarousels] = useState<
    GeneratedCarousel[]
  >([]);
  const [carouselHistoryError, setCarouselHistoryError] = useState<string | null>(null);
  const [carouselHistoryState, setCarouselHistoryState] =
    useState<CarouselHistoryState>("idle");
  const [carouselProfile, setCarouselProfile] = useState<CarouselProfileFeed | null>(null);
  const [carouselHistoryRefreshKey, setCarouselHistoryRefreshKey] = useState(0);
  const [avatarSource, setAvatarSource] = useState<AvatarSource>("global");
  const [prompt, setPrompt] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const deckRef = useRef<HTMLDivElement | null>(null);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const visibleTemplates = useMemo(() => {
    const categoryTemplates = activeFilter === "All"
      ? templates
      : templates.filter((template) => template.category === activeFilter);

    if (!normalizedSearchQuery) {
      return categoryTemplates;
    }

    return categoryTemplates.filter((template) =>
      [
        template.category,
        template.name,
        ...template.slides.flatMap((slide) => [slide.accent, slide.hook, slide.label]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearchQuery),
    );
  }, [activeFilter, normalizedSearchQuery]);
  const filteredGeneratedCarousels = useMemo(() => {
    if (!normalizedSearchQuery) {
      return generatedCarousels;
    }

    return generatedCarousels.filter((carousel) =>
      [carousel.selectedAngle, carousel.categorySlug]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearchQuery),
    );
  }, [generatedCarousels, normalizedSearchQuery]);
  const activeTemplate =
    visibleTemplates[
      Math.min(activeTemplateIndex, Math.max(visibleTemplates.length - 1, 0))
    ] ?? visibleTemplates[0];
  const activeSlideIndex = activeTemplate
    ? activeSlideByTemplateId[activeTemplate.id] ?? 0
    : 0;
  const showGeneratedCarousels = activeFilter === "Carousel";
  const carouselFeedProfile: CarouselProfileFeed | null = user
    ? carouselProfile
    : { state: "missing" };
  const carouselFeedLoading =
    showGeneratedCarousels &&
    (authLoading ||
      (Boolean(user) &&
        (carouselHistoryState === "idle" || carouselHistoryState === "loading")));
  const carouselSearchEmpty =
    Boolean(normalizedSearchQuery) &&
    generatedCarousels.length > 0 &&
    filteredGeneratedCarousels.length === 0;

  useEffect(() => {
    if (activeFilter !== "Carousel") {
      return;
    }

    if (!user) {
      return;
    }

    const controller = new AbortController();

    async function loadCarouselHistory() {
      setCarouselHistoryState("loading");
      setCarouselHistoryError(null);

      try {
        const idToken = await getCurrentUserIdToken();

        if (!idToken) {
          throw new Error("Sign in before viewing generated carousels.");
        }

        const response = await fetch("/api/carousel/history?limit=12", {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => null)) as
          | CarouselHistoryResponse
          | null;

        if (!response.ok || !data?.ok) {
          const message = data && !data.ok ? data.message : "Generated carousels are unavailable.";
          throw new Error(message);
        }

        setGeneratedCarousels(data.carousels);
        setCarouselProfile(data.profile);
        setCarouselHistoryState("ready");
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setGeneratedCarousels([]);
        setCarouselProfile(null);
        setCarouselHistoryError(
          error instanceof Error ? error.message : "Generated carousels are unavailable.",
        );
        setCarouselHistoryState("error");
      }
    }

    void loadCarouselHistory();

    return () => controller.abort();
  }, [activeFilter, carouselHistoryRefreshKey, user]);

  function setFilter(filter: CreativeCategory) {
    setActiveFilter(filter);
    setActiveTemplateIndex(0);
  }

  function handleFilterKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    filterIndex: number,
  ) {
    let nextIndex = filterIndex;

    if (event.key === "ArrowRight") {
      nextIndex = (filterIndex + 1) % filters.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (filterIndex - 1 + filters.length) % filters.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = filters.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextFilter = filters[nextIndex];
    setFilter(nextFilter);
    requestAnimationFrame(() => {
      document.getElementById(`trending-tab-${nextFilter.toLowerCase()}`)?.focus();
    });
  }

  function updateSearchQuery(value: string) {
    setSearchQuery(value);
    setActiveTemplateIndex(0);
  }

  function openBusinessProfile() {
    const previewSuffix =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("preview") === "1"
        ? "?preview=1"
        : "";

    router.push(`/onboarding${previewSuffix}`);
  }

  async function retryCarouselPreparation() {
    setCarouselHistoryError(null);
    try {
      const idToken = await getCurrentUserIdToken();
      if (!idToken) throw new Error("Sign in before retrying carousel preparation.");
      const response = await fetch("/api/business-profile/retry", {
        headers: { Authorization: `Bearer ${idToken}` },
        method: "POST",
      });
      const data = (await response.json().catch(() => null)) as { message?: string; ok?: boolean } | null;
      if (!response.ok || !data?.ok) throw new Error(data?.message ?? "Could not retry carousel preparation.");
      setCarouselHistoryRefreshKey((current) => current + 1);
    } catch (error) {
      setCarouselHistoryError(error instanceof Error ? error.message : "Could not retry carousel preparation.");
      setCarouselHistoryState("error");
    }
  }

  function moveTemplate(direction: number) {
    if (visibleTemplates.length === 0) {
      return;
    }

    setActiveTemplateIndex((currentIndex) => {
      const nextIndex =
        (currentIndex + direction + visibleTemplates.length) %
        visibleTemplates.length;

      return nextIndex;
    });
  }

  function selectTemplate(templateId: string) {
    const nextIndex = visibleTemplates.findIndex(
      (template) => template.id === templateId,
    );

    if (nextIndex >= 0) {
      setActiveTemplateIndex(nextIndex);
    }
  }

  function setActiveSlide(templateId: string, slideIndex: number) {
    setActiveSlideByTemplateId((currentSlides) => ({
      ...currentSlides,
      [templateId]: slideIndex,
    }));
  }

  function moveSlide(direction: number) {
    if (!activeTemplate) {
      return;
    }

    const nextSlideIndex =
      (activeSlideIndex + direction + activeTemplate.slides.length) %
      activeTemplate.slides.length;

    setActiveSlide(activeTemplate.id, nextSlideIndex);
  }

  function handlePointerEnd(clientX: number) {
    if (dragStartX === null) {
      return;
    }

    const delta = clientX - dragStartX;
    setDragStartX(null);

    if (Math.abs(delta) < 42) {
      return;
    }

    moveTemplate(delta > 0 ? -1 : 1);
  }

  return (
    <section className="relative min-h-screen flex-1 overflow-x-hidden bg-background px-4 py-5 text-foreground sm:px-7 lg:px-10 lg:py-7">
      <div className="mx-auto flex h-full max-w-7xl flex-col">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground-strong">
              Trending
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
              {getWorkspaceDescription(activeFilter)}
            </p>
          </div>

          <label className="flex h-11 w-full items-center gap-2.5 rounded-md border border-border-strong bg-white px-3 text-sm text-muted transition-[border-color,box-shadow] focus-within:border-focus focus-within:ring-2 focus-within:ring-focus/15 sm:w-[280px]">
            <Search className="size-4 shrink-0 text-muted-subtle" aria-hidden="true" />
            <span className="sr-only">
              {activeFilter === "Carousel"
                ? "Search personalized carousels"
                : "Search creative inspiration"}
            </span>
            <input
              type="search"
              name="creativeSearch"
              autoComplete="off"
              value={searchQuery}
              onChange={(event) => updateSearchQuery(event.target.value)}
              placeholder={activeFilter === "Carousel" ? "Search carousels" : "Search inspiration"}
              className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-subtle"
            />
          </label>
        </header>

        <div className="mt-6 border-b border-border">
          <div
            role="tablist"
            aria-label="Creative type"
            className="flex gap-6 overflow-x-auto"
          >
            {filters.map((filter, filterIndex) => (
              <button
                key={filter}
                id={`trending-tab-${filter.toLowerCase()}`}
                type="button"
                role="tab"
                aria-controls="trending-content"
                aria-selected={activeFilter === filter}
                onClick={() => setFilter(filter)}
                onKeyDown={(event) => handleFilterKeyDown(event, filterIndex)}
                tabIndex={activeFilter === filter ? 0 : -1}
                className={cn(
                  "relative h-11 shrink-0 touch-manipulation border-b-2 px-0.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
                  activeFilter === filter
                    ? "border-brand text-foreground-strong"
                    : "border-transparent text-muted hover:text-foreground",
                )}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div
          ref={deckRef}
          id="trending-content"
          role="tabpanel"
          aria-labelledby={`trending-tab-${activeFilter.toLowerCase()}`}
          className={cn(
            "relative mt-6 flex flex-1 justify-center",
            showGeneratedCarousels
              ? "min-h-[500px] items-start overflow-visible py-2"
              : "min-h-[520px] items-center overflow-hidden rounded-lg border border-border bg-white px-2 py-6 sm:min-h-[min(610px,calc(100dvh-190px))] sm:px-8",
          )}
          onPointerDown={
            showGeneratedCarousels || visibleTemplates.length === 0
              ? undefined
              : (event) => setDragStartX(event.clientX)
          }
          onPointerCancel={
            showGeneratedCarousels || visibleTemplates.length === 0
              ? undefined
              : () => setDragStartX(null)
          }
          onPointerUp={
            showGeneratedCarousels || visibleTemplates.length === 0
              ? undefined
              : (event) => handlePointerEnd(event.clientX)
          }
        >
          {showGeneratedCarousels ? (
            <GeneratedCarouselGallery
              carousels={filteredGeneratedCarousels}
              error={carouselHistoryError}
              loading={carouselFeedLoading}
              profile={carouselFeedProfile}
              searchEmpty={carouselSearchEmpty}
              onOpen={(carousel) => {
                const searchParams = new URLSearchParams(
                  carousel.generationBatchId
                    ? { generationBatchId: carousel.generationBatchId }
                    : { carouselId: carousel.carouselId },
                );

                router.push(`/carousel?${searchParams.toString()}`);
              }}
              onCompleteProfile={openBusinessProfile}
              onRetryHistory={() => setCarouselHistoryRefreshKey((current) => current + 1)}
              onRetryPreparation={() => void retryCarouselPreparation()}
            />
          ) : visibleTemplates.length === 0 ? (
            <SearchEmptyState onClear={() => updateSearchQuery("")} />
          ) : (
            <>
              {visibleTemplates.length > 1 ? (
                <button
                  type="button"
                  onClick={() => moveTemplate(-1)}
                  className="absolute left-3 top-1/2 z-20 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border-strong bg-white text-foreground transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 md:flex"
                  aria-label="Previous creative"
                >
                  <ChevronLeft className="size-5" aria-hidden="true" />
                </button>
              ) : null}

              <div className="relative flex h-[440px] w-full max-w-[940px] items-center justify-center sm:h-[min(540px,calc(100dvh-230px))]">
                {visibleTemplates.map((template, index) => {
                  const offset = getCircularOffset(
                    index,
                    activeTemplateIndex,
                    visibleTemplates.length,
                  );

                  if (Math.abs(offset) > 2) {
                    return null;
                  }

                  return (
                    <CreativePreviewCard
                      key={template.id}
                      active={offset === 0}
                      offset={offset}
                      showTemplateBadge={template.category === "Carousel"}
                      slideIndex={activeSlideByTemplateId[template.id] ?? 0}
                      template={template}
                      onGenerate={() => setDrawerTemplate(template)}
                      onSelect={() => selectTemplate(template.id)}
                      onSlideChange={(slideIndex) =>
                        setActiveSlide(template.id, slideIndex)
                      }
                      onSlideMove={offset === 0 ? moveSlide : undefined}
                    />
                  );
                })}
              </div>

              {visibleTemplates.length > 1 ? (
                <button
                  type="button"
                  onClick={() => moveTemplate(1)}
                  className="absolute right-3 top-1/2 z-20 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border-strong bg-white text-foreground transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 md:flex"
                  aria-label="Next creative"
                >
                  <ChevronRight className="size-5" aria-hidden="true" />
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      <GenerateDrawer
        avatarSource={avatarSource}
        prompt={prompt}
        template={drawerTemplate}
        onAvatarSourceChange={setAvatarSource}
        onClose={() => setDrawerTemplate(null)}
        onPromptChange={setPrompt}
      />
    </section>
  );
}

function getCircularOffset(index: number, activeIndex: number, itemCount: number) {
  let offset = index - activeIndex;
  const midpoint = itemCount / 2;

  if (offset > midpoint) {
    offset -= itemCount;
  }

  if (offset < -midpoint) {
    offset += itemCount;
  }

  return offset;
}

function getWorkspaceDescription(filter: CreativeCategory) {
  if (filter === "Carousel") {
    return "Personalized carousel ideas prepared from your business profile.";
  }

  if (filter === "All") {
    return "Browse creative inspiration across every format.";
  }

  return `Browse ${filter.toLowerCase()} inspiration for your next creative.`;
}

function SearchEmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex min-h-[360px] max-w-md flex-col items-center justify-center px-6 text-center">
      <span className="flex size-11 items-center justify-center rounded-md bg-surface-subtle text-muted">
        <Search className="size-5" aria-hidden="true" />
      </span>
      <h2 className="mt-5 text-xl font-semibold text-foreground-strong">
        No inspiration found
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        Try a broader term or clear the search to browse every idea.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="mt-5 inline-flex h-11 items-center rounded-md border border-border-strong bg-white px-4 text-sm font-semibold text-foreground transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
      >
        Clear search
      </button>
    </div>
  );
}

function CreativePreviewCard({
  active,
  offset,
  onGenerate,
  onSelect,
  onSlideChange,
  onSlideMove,
  showTemplateBadge,
  slideIndex,
  template,
}: {
  active: boolean;
  offset: number;
  onGenerate: () => void;
  onSelect: () => void;
  onSlideChange: (slideIndex: number) => void;
  onSlideMove?: (direction: number) => void;
  showTemplateBadge?: boolean;
  slideIndex: number;
  template: CreativeTemplate;
}) {
  const slide = template.slides[slideIndex] ?? template.slides[0];
  const translateX = offset * 235;
  const scale = active ? 1 : 0.84;
  const rotate = active ? 0 : offset * -3;
  const zIndex = active ? 30 : 20 - Math.abs(offset);

  return (
    <article
      aria-hidden={!active}
      className={cn(
        "absolute aspect-[4/5] w-[min(82vw,380px)] overflow-hidden rounded-lg bg-foreground-strong text-white shadow-[0_18px_48px_rgb(9_9_11_/_0.24)] transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none",
        active ? "opacity-100" : "cursor-pointer opacity-72 hover:opacity-88",
      )}
      style={{
        transform: `translateX(${translateX}px) scale(${scale}) rotate(${rotate}deg)`,
        zIndex,
      }}
      onClick={() => {
        if (!active) {
          onSelect();
        }
      }}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br", toneClassName[template.tone])} />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(0_0_0_/_0.08)_0%,rgb(0_0_0_/_0.06)_45%,rgb(0_0_0_/_0.68)_100%)]" />
      <div className="absolute left-8 top-7 flex gap-2">
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-foreground-strong">
          {template.category}
        </span>
        {showTemplateBadge ? (
          <span className="rounded-full bg-black/45 px-3 py-1 text-xs font-semibold text-white">
            Template
          </span>
        ) : null}
        <span className="rounded-full bg-black/45 px-3 py-1 text-xs font-semibold text-white">
          {slide.accent}
        </span>
      </div>

      <div className="absolute inset-x-8 top-[28%]">
        <p className="max-w-[15rem] text-[30px] font-black leading-[1.02] tracking-normal text-white drop-shadow-[0_3px_10px_rgb(0_0_0_/_0.38)] sm:text-[36px]">
          {slide.hook}
        </p>
        <p className="mt-3 max-w-[16rem] text-sm font-semibold leading-5 text-white/78">
          {slide.label}
        </p>
      </div>

      <DecorativeScene tone={template.tone} />

      {active ? (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSlideMove?.(-1);
            }}
            className="absolute left-5 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white transition-colors hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            aria-label="Previous slide"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSlideMove?.(1);
            }}
            className="absolute right-5 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white transition-colors hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            aria-label="Next slide"
          >
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </>
      ) : null}

      <div className="absolute inset-x-7 bottom-6 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onGenerate();
          }}
          className="inline-flex h-11 items-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-foreground-strong transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        >
          <Sparkles className="size-4 text-primary" />
          Generate
        </button>

        <div className="flex rounded-full bg-black/45 px-3 py-2">
          {template.slides.map((item, itemIndex) => (
            <button
              key={item.accent}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSlideChange(itemIndex);
              }}
              aria-label={`Show slide ${itemIndex + 1}`}
              className={cn(
                "mx-1 h-2 rounded-full transition-[width,background-color]",
                slideIndex === itemIndex ? "w-5 bg-white" : "w-2 bg-white/42",
              )}
            />
          ))}
        </div>
      </div>
    </article>
  );
}

function DecorativeScene({ tone }: { tone: CreativeTemplate["tone"] }) {
  const iconClass = "size-9 text-white/88";
  const Icon =
    tone === "green"
      ? UserRound
      : tone === "navy"
        ? Layers3
        : tone === "sky"
          ? ImageIcon
          : PlaySquare;

  return (
    <div className="absolute right-8 top-[48%] flex size-24 items-center justify-center rounded-lg bg-white/15">
      <Icon className={iconClass} strokeWidth={1.6} />
    </div>
  );
}

function GeneratedCarouselGallery({
  carousels,
  error,
  loading,
  onCompleteProfile,
  onOpen,
  onRetryHistory,
  onRetryPreparation,
  profile,
  searchEmpty,
}: {
  carousels: GeneratedCarousel[];
  error: string | null;
  loading: boolean;
  onCompleteProfile: () => void;
  onOpen: (carousel: GeneratedCarousel) => void;
  onRetryHistory: () => void;
  onRetryPreparation: () => void;
  profile: CarouselProfileFeed | null;
  searchEmpty: boolean;
}) {
  if (loading) {
    return <GeneratedCarouselSkeletons />;
  }

  if (error) {
    return (
      <CarouselFeedState
        actionIcon="refresh"
        actionLabel="Try again"
        icon="failed"
        message={error}
        onAction={onRetryHistory}
        title="Could not load carousels"
      />
    );
  }

  if (profile?.state === "missing") {
    return <CarouselFeedState actionLabel="Complete business profile" icon="missing" message="Complete your business profile to prepare personalized carousel ideas." onAction={onCompleteProfile} title="Business profile needed" />;
  }

  if (profile?.state === "failed") {
    return <CarouselFeedState actionLabel="Retry preparation" icon="failed" message={profile.error ?? "Carousel preparation did not finish."} onAction={onRetryPreparation} title="Carousel preparation failed" />;
  }

  if (searchEmpty) {
    return (
      <CarouselFeedState
        icon="missing"
        message="Try a different carousel angle or category."
        title="No matching carousels"
      />
    );
  }

  if (carousels.length === 0) {
    return <CarouselFeedState icon="preparing" message="Your personalized carousel ideas are being prepared." title="Preparing carousel ideas" />;
  }

  return (
    <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {carousels.map((carousel) => (
        <article
          key={carousel.carouselId}
          className="group overflow-hidden rounded-lg border border-border bg-white transition-colors hover:border-border-strong"
        >
          <div className="relative aspect-[4/5] bg-foreground-strong">
            {carousel.thumbnailUrl ? (
              // Rendered slides are immutable CloudFront assets and need no Next image transform.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={carousel.thumbnailUrl}
                alt={carousel.selectedAngle ?? "Generated carousel preview"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-white/70">
                {carousel.status === "failed" ? (
                  <CircleAlert className="size-8" aria-label="Carousel generation failed" />
                ) : (
                  <Loader2 className="size-8 animate-spin motion-reduce:animate-none" aria-label="Carousel is rendering" />
                )}
              </div>
            )}
            <span
              className={cn(
                "absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                carousel.status === "completed" && "bg-white text-foreground-strong",
                carousel.status === "failed" && "bg-error text-white",
                carousel.status === "processing" && "bg-foreground-strong text-white",
              )}
            >
              {getCarouselStatusLabel(carousel.status)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 px-4 py-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {getCarouselCardTitle(carousel)}
              </p>
              <p className="mt-1 text-xs text-muted">
                {getCarouselCardMeta(carousel)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpen(carousel)}
              className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border-strong text-foreground transition-colors hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
              aria-label="Open carousel"
              title="Open carousel"
            >
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function CarouselFeedState({
  actionIcon = "sparkles",
  actionLabel,
  icon,
  message,
  onAction,
  title,
}: {
  actionIcon?: "refresh" | "sparkles";
  actionLabel?: string;
  icon: "failed" | "missing" | "preparing";
  message: string;
  onAction?: () => void;
  title: string;
}) {
  const Icon = icon === "failed" ? CircleAlert : icon === "preparing" ? Loader2 : Sparkles;
  const ActionIcon = actionIcon === "refresh" ? RefreshCw : Sparkles;
  return (
    <div className="flex min-h-[420px] w-full max-w-lg flex-col items-center justify-center px-6 text-center">
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-md",
          icon === "failed" ? "bg-error/10 text-error" : "bg-brand-soft text-primary",
        )}
      >
        <Icon className={cn("size-5", icon === "preparing" && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
      </span>
      <div>
        <h2 className="mt-5 text-xl font-semibold text-foreground-strong">{title}</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted">{message}</p>
      </div>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-foreground-strong transition-[filter,transform] hover:brightness-95 active:translate-y-px active:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
        >
          <ActionIcon className="size-4" aria-hidden="true" />
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function GeneratedCarouselSkeletons() {
  return (
    <div
      role="status"
      aria-label="Loading generated carousels"
      className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
    >
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="overflow-hidden rounded-lg border border-border bg-white"
        >
          <div className="aspect-[4/5] animate-pulse bg-border motion-reduce:animate-none" />
          <div className="space-y-2 px-4 py-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-border motion-reduce:animate-none" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-border motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  );
}

function getCarouselStatusLabel(status: GeneratedCarousel["status"]) {
  if (status === "completed") {
    return "Ready";
  }

  if (status === "failed") {
    return "Failed";
  }

  return "Preparing";
}

function getCarouselCardTitle(carousel: GeneratedCarousel) {
  if (carousel.status === "completed") {
    return carousel.selectedAngle ?? "Generated carousel";
  }

  if (carousel.status === "failed") {
    return "Carousel generation failed";
  }

  if (
    carousel.slideCount > 1 &&
    carousel.readySlideCount >= carousel.slideCount - 1
  ) {
    return "Almost ready";
  }

  if (carousel.readySlideCount > 0) {
    return "Rendering slides";
  }

  if (carousel.selectedAngle) {
    return "Writing content";
  }

  return "Preparing carousel idea";
}

function getCarouselCardMeta(carousel: GeneratedCarousel) {
  if (carousel.status === "failed") {
    return "Open to review details";
  }

  return `${carousel.readySlideCount}/${carousel.slideCount} slides ready`;
}

function GenerateDrawer({
  avatarSource,
  onAvatarSourceChange,
  onClose,
  onPromptChange,
  prompt,
  template,
}: {
  avatarSource: AvatarSource;
  onAvatarSourceChange: (source: AvatarSource) => void;
  onClose: () => void;
  onPromptChange: (prompt: string) => void;
  prompt: string;
  template: CreativeTemplate | null;
}) {
  const open = Boolean(template);

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-0 z-50 flex justify-end bg-[#102033]/0 transition",
        open && "pointer-events-auto bg-[#102033]/18",
      )}
      aria-hidden={!open}
    >
      <aside
        className={cn(
          "h-full w-full max-w-[390px] translate-x-full border-l border-border bg-white px-5 py-5 shadow-[0_24px_80px_rgb(16_32_51_/_0.18)] transition-transform duration-300 sm:px-6",
          open && "translate-x-0",
        )}
      >
        {template ? (
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-primary">
                  {template.category}
                </p>
                <h2 className="mt-1 text-xl font-bold text-foreground">
                  {template.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex size-9 items-center justify-center rounded-full text-muted transition hover:bg-card-muted hover:text-foreground"
                aria-label="Close generate drawer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-6">
              <span className="text-sm font-bold text-foreground">Avatar</span>
              <div className="mt-2 grid h-10 grid-cols-2 rounded-xl border border-border bg-[#f6f1ec] p-1">
                {(["my", "global"] as AvatarSource[]).map((source) => (
                  <button
                    key={source}
                    type="button"
                    onClick={() => onAvatarSourceChange(source)}
                    className={cn(
                      "rounded-lg text-xs font-bold transition",
                      avatarSource === source
                        ? "bg-white text-foreground shadow-sm"
                        : "text-muted hover:text-foreground",
                    )}
                  >
                    {source === "my" ? "My avatars" : "Global avatars"}
                  </button>
                ))}
              </div>

              <div className="mt-3 space-y-2">
                {avatarSource === "my" ? (
                  <div className="rounded-2xl border border-dashed border-border bg-[#fbf8f4] px-4 py-4 text-sm font-medium leading-6 text-muted">
                    No personal avatars yet. Choose a global avatar to start.
                  </div>
                ) : (
                  globalAvatars.map((avatar, index) => (
                    <button
                      key={avatar.id}
                      type="button"
                      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-white px-3 py-3 text-left transition hover:border-primary/30 hover:bg-[#fffaf7]"
                    >
                      <span className="flex size-10 items-center justify-center rounded-full bg-foreground text-sm font-bold text-white">
                        {avatar.name.charAt(0)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-foreground">
                          {avatar.name}
                        </span>
                        <span className="block truncate text-xs font-semibold text-muted">
                          {avatar.role}
                        </span>
                      </span>
                      {index === 0 ? <Check className="size-4 text-success" /> : null}
                    </button>
                  ))
                )}
              </div>
            </div>

            <label className="mt-5 block">
              <span className="text-sm font-bold text-foreground">Prompt</span>
              <textarea
                value={prompt}
                onChange={(event) => onPromptChange(event.target.value)}
                placeholder="Describe what you want to create..."
                className="mt-2 min-h-24 w-full resize-none rounded-2xl border border-border bg-white px-3 py-3 text-sm font-medium leading-6 text-foreground outline-none transition placeholder:text-[#8a97a8] focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
              />
            </label>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <SettingPill label="Format" value={getPrimarySetting(template)} />
              <SettingPill label="Output" value={getOutputSetting(template)} />
            </div>

            <button
              type="button"
              className="mt-auto inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-white shadow-[0_12px_28px_rgb(255_107_74_/_0.22)] transition hover:bg-primary-hover"
            >
              <Sparkles className="size-4" />
              Generate
            </button>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function SettingPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-[#fbf8f4] px-3 py-3">
      <p className="text-[11px] font-bold uppercase text-muted">{label}</p>
      <p className="mt-1 text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

function getPrimarySetting(template: CreativeTemplate) {
  if (template.category === "Carousel") {
    return "5 slides";
  }

  if (template.category === "Image") {
    return "9:16";
  }

  return "9:16 video";
}

function getOutputSetting(template: CreativeTemplate) {
  if (template.category === "Carousel") {
    return "3 candidates";
  }

  if (template.category === "Image") {
    return "4 images";
  }

  return "1 version";
}
