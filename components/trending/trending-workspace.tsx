"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Layers3,
  PlaySquare,
  Search,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

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
  const [activeFilter, setActiveFilter] = useState<CreativeCategory>("All");
  const [activeTemplateIndex, setActiveTemplateIndex] = useState(0);
  const [activeSlideByTemplateId, setActiveSlideByTemplateId] = useState<
    Record<string, number>
  >({});
  const [drawerTemplate, setDrawerTemplate] = useState<CreativeTemplate | null>(null);
  const [avatarSource, setAvatarSource] = useState<AvatarSource>("global");
  const [prompt, setPrompt] = useState("");
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const deckRef = useRef<HTMLDivElement | null>(null);

  const visibleTemplates = useMemo(() => {
    return activeFilter === "All"
      ? templates
      : templates.filter((template) => template.category === activeFilter);
  }, [activeFilter]);
  const activeTemplate =
    visibleTemplates[
      Math.min(activeTemplateIndex, Math.max(visibleTemplates.length - 1, 0))
    ] ?? visibleTemplates[0];
  const activeSlideIndex = activeTemplate
    ? activeSlideByTemplateId[activeTemplate.id] ?? 0
    : 0;

  function setFilter(filter: CreativeCategory) {
    setActiveFilter(filter);
    setActiveTemplateIndex(0);
  }

  function moveTemplate(direction: number) {
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
    <section className="relative min-h-screen flex-1 overflow-hidden bg-background px-4 py-4 text-foreground sm:px-7 lg:px-10 lg:py-6">
      <div className="mx-auto flex h-full max-w-7xl flex-col">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-normal text-foreground">
              Trending
            </h1>
            <p className="mt-1 text-sm font-medium text-muted">
              Pick a creative idea and generate from it.
            </p>
          </div>

          <label className="flex h-10 w-full items-center gap-2 rounded-full border border-border bg-white px-3 text-sm font-semibold text-[#405977] shadow-sm sm:w-[260px]">
            <Search className="size-4 shrink-0" aria-hidden="true" />
            <span className="sr-only">Search creative templates</span>
            <input
              type="search"
              placeholder="Search"
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#8a97a8]"
            />
          </label>
        </header>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {filters.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setFilter(filter)}
              className={cn(
                "h-8 shrink-0 rounded-full border px-3 text-xs font-bold transition",
                activeFilter === filter
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-white/75 text-[#52677d] hover:bg-white",
              )}
            >
              {filter}
            </button>
          ))}
        </div>

        <div
          ref={deckRef}
          className="relative mt-5 flex min-h-[590px] flex-1 items-center justify-center overflow-hidden rounded-[2rem] bg-[#f8f4ef] px-2 py-7 sm:min-h-[620px] sm:px-8"
          onPointerDown={(event) => setDragStartX(event.clientX)}
          onPointerCancel={() => setDragStartX(null)}
          onPointerUp={(event) => handlePointerEnd(event.clientX)}
        >
          <button
            type="button"
            onClick={() => moveTemplate(-1)}
            className="absolute left-3 top-1/2 z-20 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white/85 text-[#173454] shadow-sm backdrop-blur transition hover:bg-white md:flex"
            aria-label="Previous creative"
          >
            <ChevronLeft className="size-5" />
          </button>

          <div className="relative flex h-[520px] w-full max-w-[940px] items-center justify-center sm:h-[560px]">
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

          <button
            type="button"
            onClick={() => moveTemplate(1)}
            className="absolute right-3 top-1/2 z-20 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white/85 text-[#173454] shadow-sm backdrop-blur transition hover:bg-white md:flex"
            aria-label="Next creative"
          >
            <ChevronRight className="size-5" />
          </button>
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

function CreativePreviewCard({
  active,
  offset,
  onGenerate,
  onSelect,
  onSlideChange,
  onSlideMove,
  slideIndex,
  template,
}: {
  active: boolean;
  offset: number;
  onGenerate: () => void;
  onSelect: () => void;
  onSlideChange: (slideIndex: number) => void;
  onSlideMove?: (direction: number) => void;
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
        "absolute aspect-[4/5] w-[min(82vw,420px)] overflow-hidden rounded-[28px] border border-white/35 bg-[#102033] text-white shadow-[0_28px_80px_rgb(16_32_51_/_0.28)] transition-all duration-300 ease-out",
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
        <span className="rounded-full border border-white/25 bg-white/18 px-3 py-1 text-xs font-bold backdrop-blur">
          {template.category}
        </span>
        <span className="rounded-full border border-white/20 bg-black/20 px-3 py-1 text-xs font-bold backdrop-blur">
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
            className="absolute left-5 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/18 bg-black/28 text-white shadow-sm backdrop-blur transition hover:bg-black/42"
            aria-label="Previous slide"
          >
            <ArrowLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSlideMove?.(1);
            }}
            className="absolute right-5 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/18 bg-black/28 text-white shadow-sm backdrop-blur transition hover:bg-black/42"
            aria-label="Next slide"
          >
            <ArrowRight className="size-4" />
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
          className="inline-flex h-11 items-center gap-2 rounded-full border border-white/18 bg-white px-4 text-sm font-black text-foreground shadow-[0_10px_24px_rgb(0_0_0_/_0.18)] transition hover:scale-[1.02]"
        >
          <Sparkles className="size-4 text-primary" />
          Generate
        </button>

        <div className="flex rounded-full bg-black/34 px-3 py-2 backdrop-blur">
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
                "mx-1 h-2 rounded-full transition-all",
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
    <div className="absolute right-8 top-[48%] flex size-28 items-center justify-center rounded-[2rem] border border-white/12 bg-white/12 shadow-[0_18px_46px_rgb(0_0_0_/_0.16)] backdrop-blur-md">
      <Icon className={iconClass} strokeWidth={1.6} />
    </div>
  );
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
