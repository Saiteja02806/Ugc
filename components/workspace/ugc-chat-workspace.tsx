"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Download,
  ImageIcon,
  Lock,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react";
import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";

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
    <section className="flex min-h-screen flex-1 flex-col overflow-hidden bg-background px-4 py-4 text-foreground sm:px-6 lg:h-screen lg:px-10 lg:py-6">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-normal text-foreground sm:text-3xl">
            Image generation
          </h1>
          <p className="mt-1 text-sm font-medium leading-6 text-[#405977]">
            Describe the image you want to create.
          </p>
        </div>

        <div className="inline-flex h-8 w-fit items-center gap-2 rounded-full border border-border/80 bg-white/70 px-3 text-xs font-semibold text-[#405977] shadow-sm">
          <span className="size-2 rounded-full bg-success" />
          Ready
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-4 pt-5">
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
        />
      </div>
    </section>
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
    <div className="relative flex min-h-[300px] flex-1 flex-col overflow-hidden rounded-[28px] border border-border/70 bg-white/35 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-foreground">Generated images</h2>
        {generatedAssets.length > 0 ? (
          <span className="text-xs font-semibold text-muted">
            {generatedAssets.length} total
          </span>
        ) : null}
      </div>

      {generationFailed ? (
        <div
          role="alert"
          className="mt-3 w-fit rounded-full border border-error/20 bg-error/5 px-3 py-2 text-xs font-semibold text-error"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="size-3.5" />
            Generation failed. Please try again.
          </div>
        </div>
      ) : null}

      {isGenerating ? (
        <div
          role="status"
          className="mt-3 w-fit rounded-full border border-border bg-white/85 px-3 py-2 text-xs font-semibold text-foreground shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Loader2 className="size-3.5 animate-spin text-primary" />
            Generating image asset...
          </div>
        </div>
      ) : null}

      {generatedAssets.length > 0 ? (
        <div className="mt-4 grid flex-1 auto-rows-min grid-cols-1 gap-4 overflow-y-auto pb-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
        <div className="flex flex-1 items-center justify-center px-4 py-10 text-center">
          <div>
            <ImageIcon className="mx-auto size-7 text-[#9aa7b8]" />
            <p className="mt-3 text-sm font-semibold text-[#405977]">
              Generated images will appear here.
            </p>
            <p className="mt-1 text-sm font-medium text-muted">
              Start by describing the asset you want to create.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ImageGenerationComposer({
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

    textarea.style.height = "44px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 132)}px`;
  }, [prompt]);

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="rounded-[24px] border border-border/80 bg-white/95 p-3 shadow-[0_16px_50px_rgb(16_32_51_/_0.10)] backdrop-blur sm:p-4"
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-label="Attach reference image"
          title="Attach reference image"
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-white text-[#173454] transition hover:bg-[#fff8f4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>

        <textarea
          ref={textareaRef}
          rows={1}
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          onKeyDown={onTextareaKeyDown}
          className="max-h-32 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-1 py-2.5 text-sm font-medium leading-6 text-foreground outline-none placeholder:text-[#8c9aab]"
          placeholder="Describe the image asset you want to create..."
        />

        <button
          type="submit"
          disabled={IMAGE_GENERATION_LOCKED || !prompt.trim() || isGenerating}
          title={IMAGE_GENERATION_LOCKED ? "Image generation is locked" : undefined}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-white shadow-[0_10px_24px_rgb(255_107_74_/_0.22)] transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[118px]"
        >
          {IMAGE_GENERATION_LOCKED ? (
            <>
              <span className="hidden sm:inline">Locked</span>
              <Lock className="size-4" aria-hidden="true" />
            </>
          ) : isGenerating ? (
            <>
              <span className="hidden sm:inline">Generating</span>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            </>
          ) : (
            <>
              Generate
              <Sparkles className="size-4" aria-hidden="true" />
            </>
          )}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
        <AspectRatioSelector value={aspectRatio} onChange={onAspectRatioChange} />
        <ImageCountSelector value={imageCount} onChange={onImageCountChange} />
        <button
          type="button"
          onClick={onEnhancePrompt}
          disabled={isGenerating}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-border bg-white px-3 text-sm font-semibold text-[#173454] transition hover:bg-[#fff8f4] disabled:cursor-not-allowed disabled:opacity-50"
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
        className={cn(
          "absolute bottom-[calc(100%+6px)] left-0 z-30 flex w-[96px] flex-col gap-1 overflow-hidden transition-[max-height,opacity,transform] duration-200 ease-out",
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
                "inline-flex h-8 w-fit min-w-[68px] items-center gap-2 rounded-xl border px-2.5 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                selected
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border bg-white text-[#173454] hover:bg-[#faf7f2]",
              )}
            >
              <RatioGlyph active={selected} ratio={ratio} />
              {ratio}
            </button>
          );
        })}
      </div>

      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={controlId}
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        onKeyDown={handleTriggerKeyDown}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-white px-3 text-sm font-semibold text-[#173454] transition hover:bg-[#fff8f4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <RatioGlyph ratio={value} />
        <span>{value}</span>
        <ChevronDown
          className={cn(
            "size-4 text-[#405977] transition-transform duration-200",
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
        active ? "border-primary" : "border-[#173454]",
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
        className={cn(
          "absolute bottom-[calc(100%+6px)] left-0 z-30 flex w-[120px] flex-col gap-1 overflow-hidden transition-[max-height,opacity,transform] duration-200 ease-out",
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
                "inline-flex h-8 w-fit min-w-[92px] items-center gap-2 rounded-xl border px-2.5 text-sm font-semibold shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                selected
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border bg-white text-[#173454] hover:bg-[#faf7f2]",
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
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        onKeyDown={handleTriggerKeyDown}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-white px-3 text-sm font-semibold text-[#173454] transition hover:bg-[#fff8f4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <ImageIcon className="size-3.5" aria-hidden="true" />
        <span>
          {value} {value === 1 ? "image" : "images"}
        </span>
        <ChevronDown
          className={cn(
            "size-4 text-[#405977] transition-transform duration-200",
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
        "min-w-0 rounded-2xl border bg-white p-2 shadow-sm transition",
        selected ? "border-success/40" : "border-border",
      )}
    >
      <div
        className="overflow-hidden rounded-xl bg-card-muted"
        style={{ aspectRatio: asset.aspectRatio.replace(":", " / ") }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset.url}
          alt="Generated UGC image asset"
          className="size-full object-cover"
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onSelect}
          className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-[#173454]"
        >
          <CheckCircle2
            className={cn("size-3.5", selected ? "text-success" : "text-muted")}
          />
          <span className="truncate">{asset.prompt}</span>
        </button>
        <a
          href={asset.url}
          target="_blank"
          rel="noreferrer"
          aria-label="Download generated image"
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-card-muted hover:text-foreground"
        >
          <Download className="size-3.5" />
        </a>
      </div>
    </article>
  );
}
