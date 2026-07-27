"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Download,
  ImageIcon,
  Lock,
  Loader2,
  Sparkles,
} from "lucide-react";
import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";

import { ReferenceImageAttachment } from "@/components/generation/reference-image-attachment";
import { getCurrentUserIdToken } from "@/lib/firebase/auth";
import { cn } from "@/lib/utils";

type AspectRatio = "4:5" | "1:1" | "9:16" | "16:9";
type ImageCount = 1 | 2 | 4;

type GenerateResponse =
  | {
      ok: true;
      generationId: string;
      jobId: string;
      message: string;
    }
  | {
      ok: false;
      message: string;
    };

type StatusResponse =
  | {
      ok: true;
      job: {
        error: string | null;
        id: string;
        isTerminal: boolean;
        output: {
          generationId: string | null;
          key: string | null;
          ok: boolean;
          url: string | null;
        } | null;
        status: string;
      };
    }
  | {
      ok: false;
      message: string;
    };

type GeneratedAsset = {
  aspectRatio: AspectRatio;
  id: string;
  prompt: string;
  url: string;
};

const aspectRatios: AspectRatio[] = ["4:5", "1:1", "9:16", "16:9"];
const imageCountOptions: ImageCount[] = [1, 2, 4];
const IMAGE_GENERATION_LOCKED = true;
const instagramImageFormatLabels: Record<AspectRatio, string> = {
  "4:5": "Feed",
  "1:1": "Square",
  "9:16": "Story",
  "16:9": "Landscape",
};

function createMessageId() {
  return crypto.randomUUID();
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function pollImageJob(jobId: string, token: string) {
  for (let attempt = 0; attempt < 72; attempt += 1) {
    await sleep(attempt === 0 ? 900 : 2_500);

    const response = await fetch(
      `/api/image-test/status?jobId=${encodeURIComponent(jobId)}`,
      {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const data = (await response.json()) as StatusResponse;

    if (!response.ok || !data.ok) {
      throw new Error("Generation status unavailable.");
    }

    if (data.job.status === "completed" && data.job.output?.url) {
      return data.job.output.url;
    }

    if (data.job.isTerminal) {
      throw new Error("Generation failed.");
    }
  }

  throw new Error("Generation timed out.");
}

export function UgcChatWorkspace() {
  return (
    <section className="flex min-h-screen flex-1 flex-col overflow-hidden bg-[#1F1F1F] px-4 py-4 text-[#F5F3F0] sm:px-6 lg:h-screen lg:px-10 lg:py-6">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-normal text-[#F5F3F0] sm:text-3xl">
            AI Studio
          </h1>
          <p className="mt-1 text-sm font-medium leading-6 text-[#B9B5AF]">
            Generate images and videos from one focused workspace.
          </p>
        </div>

        <div className="inline-flex h-8 w-fit items-center gap-2 rounded-[var(--radius-control)] border border-[#383838] bg-[#242424] px-3 text-xs font-semibold text-[#B9B5AF]">
          <Lock className="size-3.5" aria-hidden="true" />
          Preview mode
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col pt-5">
        <ImageGenerationStudioPanel />
      </div>
    </section>
  );
}

export function ImageGenerationStudioPanel({
  active = true,
}: {
  active?: boolean;
}) {
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("4:5");
  const [imageCount, setImageCount] = useState<ImageCount>(4);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAssets, setGeneratedAssets] = useState<GeneratedAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [generationFailed, setGenerationFailed] = useState(false);

  async function generateFromPrompt(rawPrompt: string) {
    const trimmedPrompt = rawPrompt.trim();

    if (IMAGE_GENERATION_LOCKED || !trimmedPrompt || isGenerating) {
      return;
    }

    setPrompt("");
    setIsGenerating(true);
    setGenerationFailed(false);

    try {
      const token = await getCurrentUserIdToken();

      if (!token) {
        throw new Error("Sign in before generating images.");
      }

      const response = await fetch("/api/image-test/generate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          aspectRatio,
          imageCount,
          prompt: trimmedPrompt,
        }),
      });
      const data = (await response.json()) as GenerateResponse;

      if (!response.ok || !data.ok) {
        throw new Error("Generation could not start.");
      }

      const imageUrl = await pollImageJob(data.jobId, token);
      const assetId = createMessageId();

      setGeneratedAssets((currentAssets) => [
        {
          aspectRatio,
          id: assetId,
          prompt: trimmedPrompt,
          url: imageUrl,
        },
        ...currentAssets,
      ]);
      setSelectedAssetId(assetId);
    } catch (error) {
      console.error("Image generation failed:", error);
      setGenerationFailed(true);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    void generateFromPrompt(prompt);
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void generateFromPrompt(prompt);
    }
  }

  function handleEnhancePrompt() {
    const trimmedPrompt = prompt.trim();
    const enhancement =
      "Production-ready details: clean premium composition, product-focused framing, natural lighting, polished SaaS ad style, no clutter, no extra text unless requested.";

    if (!trimmedPrompt) {
      setPrompt(
        "A polished SaaS product image asset with a clean premium composition, product-focused framing, natural lighting, and social ad quality.",
      );
      return;
    }

    if (trimmedPrompt.includes("Production-ready details:")) {
      return;
    }

    setPrompt(`${trimmedPrompt}\n\n${enhancement}`);
  }

  return (
    <div
      id="ai-studio-images-panel"
      role="tabpanel"
      aria-labelledby="ai-studio-images-tab"
      hidden={!active}
      className={cn("min-h-0 flex-1 flex-col gap-4", active ? "flex" : "hidden")}
    >
        <ResultsArea
          generatedAssets={generatedAssets}
          generationFailed={generationFailed}
          isGenerating={isGenerating}
          selectedAssetId={selectedAssetId}
          onSelectAsset={setSelectedAssetId}
        />

        <ImageGenerationComposer
          aspectRatio={aspectRatio}
          imageCount={imageCount}
          isGenerating={isGenerating}
          prompt={prompt}
          onAspectRatioChange={setAspectRatio}
          onEnhancePrompt={handleEnhancePrompt}
          onImageCountChange={setImageCount}
          onPromptChange={setPrompt}
          onSubmit={handleSubmit}
          onTextareaKeyDown={handleTextareaKeyDown}
          active={active}
        />
    </div>
  );
}

function ResultsArea({
  generatedAssets,
  generationFailed,
  isGenerating,
  onSelectAsset,
  selectedAssetId,
}: {
  generatedAssets: GeneratedAsset[];
  generationFailed: boolean;
  isGenerating: boolean;
  onSelectAsset: (assetId: string) => void;
  selectedAssetId: string | null;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-1 flex-col overflow-hidden rounded-[var(--radius-card)] border border-border bg-card-muted/35 px-4 sm:px-6",
        generatedAssets.length > 0
          ? "min-h-[360px] py-8 sm:min-h-[430px]"
          : "min-h-[220px] py-6 sm:min-h-[250px]",
      )}
    >
      <h2 className="sr-only">Generated images</h2>

      {generatedAssets.length > 0 ? (
        <span className="absolute right-4 top-4 text-xs font-semibold text-[#B9B5AF] sm:right-6">
          {generatedAssets.length} total
        </span>
      ) : null}

      {generationFailed ? (
        <div
          role="alert"
          className="absolute left-4 top-4 w-fit rounded-full border border-[#E15A5A]/35 bg-[#2A2020] px-3 py-2 text-xs font-semibold text-[#E15A5A] shadow-[0_10px_28px_rgb(0_0_0_/_0.18)] sm:left-6"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="size-3.5" aria-hidden="true" />
            Generation failed. Review the prompt and try again.
          </div>
        </div>
      ) : null}

      {isGenerating ? (
        <div
          role="status"
          className="absolute left-4 top-4 w-fit rounded-full border border-[#383838] bg-[#242424] px-3 py-2 text-xs font-semibold text-[#F5F3F0] shadow-[0_10px_28px_rgb(0_0_0_/_0.18)] sm:left-6"
        >
          <div className="flex items-center gap-2">
            <Loader2 className="size-3.5 animate-spin text-[#E16540] motion-reduce:animate-none" aria-hidden="true" />
            Generating image asset…
          </div>
        </div>
      ) : null}

      {generatedAssets.length > 0 ? (
        <div className="grid flex-1 auto-rows-min grid-cols-1 gap-4 overflow-y-auto pb-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {generatedAssets.map((asset) => (
            <GeneratedAssetCard
              key={asset.id}
              asset={asset}
              selected={selectedAssetId === asset.id}
              onSelect={() => onSelectAsset(asset.id)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center px-4 py-6 text-center">
          <div className="max-w-sm">
            <span className="mx-auto flex size-10 items-center justify-center rounded-[var(--radius-control)] border border-primary/20 bg-brand-soft text-primary">
              <ImageIcon className="size-4.5" aria-hidden="true" />
            </span>
            <h3 className="mt-3 text-sm font-semibold text-foreground">
              Image workspace
            </h3>
            <p className="mt-1 text-sm leading-5 text-muted">
              Generated Instagram images will appear here when generation is enabled.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ImageGenerationComposer({
  active,
  aspectRatio,
  imageCount,
  isGenerating,
  onAspectRatioChange,
  onEnhancePrompt,
  onImageCountChange,
  onPromptChange,
  onSubmit,
  onTextareaKeyDown,
  prompt,
}: {
  active: boolean;
  aspectRatio: AspectRatio;
  imageCount: ImageCount;
  isGenerating: boolean;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  onEnhancePrompt: () => void;
  onImageCountChange: (count: ImageCount) => void;
  onPromptChange: (prompt: string) => void;
  onSubmit: (event?: FormEvent<HTMLFormElement>) => void;
  onTextareaKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  prompt: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    if (!active) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 44), 132)}px`;
  }, [active, prompt]);

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-[1120px] rounded-[var(--radius-card)] border border-border bg-card p-3 shadow-card transition-[border-color,box-shadow] focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/10 sm:p-4"
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2">
        <ReferenceImageAttachment disabled={isGenerating} />

        <textarea
          ref={textareaRef}
          rows={1}
          aria-label="Image prompt"
          autoComplete="off"
          name="imagePrompt"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          onKeyDown={onTextareaKeyDown}
          className="col-start-2 row-start-1 max-h-32 min-h-11 min-w-0 resize-none overflow-y-hidden bg-transparent px-1 py-2.5 text-sm font-medium leading-6 text-foreground outline-none placeholder:text-muted-subtle"
          placeholder="Describe your image…"
        />

        <button
          type="submit"
          disabled={IMAGE_GENERATION_LOCKED || !prompt.trim() || isGenerating}
          aria-label={IMAGE_GENERATION_LOCKED ? "Image generation locked" : "Generate image"}
          title={IMAGE_GENERATION_LOCKED ? "Image generation is locked" : undefined}
          className="col-start-3 row-start-1 inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[118px]"
        >
          {IMAGE_GENERATION_LOCKED ? (
            <>
              <span className="hidden sm:inline">Locked</span>
              <Lock className="size-4" aria-hidden="true" />
            </>
          ) : isGenerating ? (
            <>
              <span className="hidden sm:inline">Generating…</span>
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            </>
          ) : (
            <>
              Generate image
              <Sparkles className="size-4" aria-hidden="true" />
            </>
          )}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <AspectRatioSelector value={aspectRatio} onChange={onAspectRatioChange} />
        <ImageCountSelector value={imageCount} onChange={onImageCountChange} />
        <button
          type="button"
          onClick={onEnhancePrompt}
          disabled={isGenerating}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-border bg-card-muted px-3 text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-selected hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
          Enhance
        </button>
      </div>
    </form>
  );
}

function AspectRatioSelector({
  onChange,
  value,
}: {
  onChange: (ratio: AspectRatio) => void;
  value: AspectRatio;
}) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(() =>
    aspectRatios.indexOf(value),
  );
  const controlId = useId();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function openAndFocus(index = aspectRatios.indexOf(value)) {
    setOpen(true);
    setFocusedIndex(index);
    window.requestAnimationFrame(() => {
      optionRefs.current[index]?.focus();
    });
  }

  function selectRatio(ratio: AspectRatio) {
    onChange(ratio);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      openAndFocus(aspectRatios.indexOf(value));
    }
  }

  function handleOptionKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const direction = event.key === "ArrowUp" ? -1 : 1;
      const nextIndex =
        (index + direction + aspectRatios.length) % aspectRatios.length;
      setFocusedIndex(nextIndex);
      optionRefs.current[nextIndex]?.focus();
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div
        id={controlId}
        role="radiogroup"
        aria-label="Aspect ratio"
        aria-hidden={!open}
        className={cn(
          "absolute bottom-[calc(100%+6px)] left-0 z-30 flex w-[140px] flex-col gap-1 overflow-hidden transition-[max-height,opacity,transform] duration-200 ease-out motion-reduce:transition-none",
          open
            ? "max-h-44 translate-y-0 opacity-100"
            : "pointer-events-none max-h-0 translate-y-2 opacity-0",
        )}
      >
        {aspectRatios.map((ratio, index) => {
          const selected = ratio === value;

          return (
            <button
              key={ratio}
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={open && index === focusedIndex ? 0 : -1}
              onClick={() => selectRatio(ratio)}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
              className={cn(
                "inline-flex h-8 w-full items-center gap-2 rounded-[var(--radius-control)] border px-2.5 text-sm font-medium shadow-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                selected
                  ? "border-primary/40 bg-brand-soft text-primary"
                  : "border-border bg-card text-foreground hover:border-border-strong hover:bg-card-muted",
              )}
            >
              <RatioGlyph active={selected} ratio={ratio} />
              <span>{ratio}</span>
              <span className="text-xs text-muted">{instagramImageFormatLabels[ratio]}</span>
            </button>
          );
        })}
      </div>

      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={controlId}
        aria-haspopup="menu"
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        onKeyDown={handleTriggerKeyDown}
        className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-control)] border border-border bg-card-muted px-3 text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-selected focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <RatioGlyph ratio={value} />
        <span>{value} {instagramImageFormatLabels[value]}</span>
        <ChevronDown
          className={cn(
            "size-4 text-muted-subtle transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}

function RatioGlyph({
  active,
  ratio,
}: {
  active?: boolean;
  ratio: AspectRatio;
}) {
  const shapeClassName: Record<AspectRatio, string> = {
    "4:5": "h-4 w-3.5",
    "1:1": "size-3.5",
    "9:16": "h-5 w-3",
    "16:9": "h-3 w-5",
  };

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block shrink-0 rounded-[4px] border-2",
        shapeClassName[ratio],
        active ? "border-primary" : "border-muted",
      )}
    />
  );
}

function ImageCountSelector({
  onChange,
  value,
}: {
  onChange: (count: ImageCount) => void;
  value: ImageCount;
}) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(() =>
    imageCountOptions.indexOf(value),
  );
  const controlId = useId();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function openAndFocus(index = imageCountOptions.indexOf(value)) {
    setOpen(true);
    setFocusedIndex(index);
    window.requestAnimationFrame(() => {
      optionRefs.current[index]?.focus();
    });
  }

  function selectCount(count: ImageCount) {
    onChange(count);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      openAndFocus(imageCountOptions.indexOf(value));
    }
  }

  function handleOptionKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const direction = event.key === "ArrowUp" ? -1 : 1;
      const nextIndex =
        (index + direction + imageCountOptions.length) % imageCountOptions.length;
      setFocusedIndex(nextIndex);
      optionRefs.current[nextIndex]?.focus();
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div
        id={controlId}
        role="listbox"
        aria-label="Number of images"
        aria-hidden={!open}
        className={cn(
          "absolute bottom-[calc(100%+6px)] left-0 z-30 flex w-[120px] flex-col gap-1 overflow-hidden transition-[max-height,opacity,transform] duration-200 ease-out motion-reduce:transition-none",
          open
            ? "max-h-32 translate-y-0 opacity-100"
            : "pointer-events-none max-h-0 translate-y-2 opacity-0",
        )}
      >
        {imageCountOptions.map((count, index) => {
          const selected = count === value;

          return (
            <button
              key={count}
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              type="button"
              role="option"
              aria-selected={selected}
              tabIndex={open && index === focusedIndex ? 0 : -1}
              onClick={() => selectCount(count)}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
              className={cn(
                "inline-flex h-8 w-full items-center gap-2 rounded-[var(--radius-control)] border px-2.5 text-sm font-medium shadow-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                selected
                  ? "border-primary/40 bg-brand-soft text-primary"
                  : "border-border bg-card text-foreground hover:border-border-strong hover:bg-card-muted",
              )}
            >
              <ImageIcon className="size-3.5" aria-hidden="true" />
              {count} {count === 1 ? "image" : "images"}
            </button>
          );
        })}
      </div>

      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={controlId}
        aria-haspopup="listbox"
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        onKeyDown={handleTriggerKeyDown}
        className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-control)] border border-border bg-card-muted px-3 text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-selected focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <ImageIcon className="size-3.5" aria-hidden="true" />
        <span>
          {value} {value === 1 ? "image" : "images"}
        </span>
        <ChevronDown
          className={cn(
            "size-4 text-muted-subtle transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}

function GeneratedAssetCard({
  asset,
  onSelect,
  selected,
}: {
  asset: GeneratedAsset;
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <article
      className={cn(
        "min-w-0 rounded-[var(--radius-card)] border bg-card p-2 shadow-card transition-colors",
        selected ? "border-success/45" : "border-border",
      )}
    >
      <div
        className="overflow-hidden rounded-[var(--radius-control)] bg-card-muted"
        style={{ aspectRatio: asset.aspectRatio.replace(":", " / ") }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.url}
          alt="Generated UGC image asset"
          width={1200}
          height={getGeneratedImageHeight(asset.aspectRatio)}
          loading="lazy"
          className="size-full object-cover"
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          className="inline-flex min-w-0 items-center gap-1.5 rounded-md text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <CheckCircle2
            className={cn(
              "size-3.5",
              selected ? "text-success" : "text-muted-subtle",
            )}
            aria-hidden="true"
          />
          <span className="truncate">{asset.prompt}</span>
        </button>
        <a
          href={asset.url}
          target="_blank"
          rel="noreferrer"
          download={`ugc-image-${asset.id}`}
          aria-label="Download generated image"
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted-subtle transition-colors hover:bg-card-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <Download className="size-3.5" aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}

function getGeneratedImageHeight(aspectRatio: AspectRatio) {
  const heights: Record<AspectRatio, number> = {
    "4:5": 1500,
    "1:1": 1200,
    "9:16": 2133,
    "16:9": 675,
  };

  return heights[aspectRatio];
}
