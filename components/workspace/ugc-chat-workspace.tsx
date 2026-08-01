"use client";

import {
  AlertCircle,
  CheckCircle2,
  Download,
  ImageIcon,
  Lock,
  Loader2,
  Sparkles,
} from "lucide-react";
import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";

import type { AIStudioAccessState } from "@/lib/ai-studio/access-policy";
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
      `/api/ai-studio/images/status?jobId=${encodeURIComponent(jobId)}`,
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
  accessState = "locked",
  active = true,
}: {
  accessState?: AIStudioAccessState;
  active?: boolean;
}) {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAssets, setGeneratedAssets] = useState<GeneratedAsset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [generationFailed, setGenerationFailed] = useState(false);
  const aspectRatio: AspectRatio = "4:5";
  const imageCount: ImageCount = 1;
  const generationLocked = accessState !== "pro";

  async function generateFromPrompt(rawPrompt: string) {
    const trimmedPrompt = rawPrompt.trim();

    if (generationLocked || !trimmedPrompt || isGenerating) {
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

      const response = await fetch("/api/ai-studio/images/generate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
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
      "Production notes: preserve the subject and intent, improve composition, lighting, clarity, and platform-ready framing without adding unrequested text or objects.";

    if (generationLocked || !trimmedPrompt) {
      return;
    }

    if (trimmedPrompt.includes("Production notes:")) {
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
      className={cn(
        "min-h-0 flex-1 flex-col gap-4",
        active ? "flex flex-col" : "hidden",
      )}
    >
      <ResultsArea
        aspectRatio={aspectRatio}
        generatedAssets={generatedAssets}
        generationFailed={generationFailed}
        imageCount={imageCount}
        isGenerating={isGenerating}
        selectedAssetId={selectedAssetId}
        onSelectAsset={setSelectedAssetId}
      />

      <ImageGenerationComposer
        generationLocked={generationLocked}
        isGenerating={isGenerating}
        prompt={prompt}
        onEnhancePrompt={handleEnhancePrompt}
        onPromptChange={setPrompt}
        onSubmit={handleSubmit}
        onTextareaKeyDown={handleTextareaKeyDown}
        active={active}
      />
    </div>
  );
}

function ResultsArea({
  aspectRatio,
  generatedAssets,
  generationFailed,
  imageCount,
  isGenerating,
  onSelectAsset,
  selectedAssetId,
}: {
  aspectRatio: AspectRatio;
  generatedAssets: GeneratedAsset[];
  generationFailed: boolean;
  imageCount: ImageCount;
  isGenerating: boolean;
  onSelectAsset: (assetId: string) => void;
  selectedAssetId: string | null;
}) {
  return (
    <section className="relative flex min-h-[360px] min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-panel)] border border-border bg-[#191919] shadow-[0_20px_55px_rgb(0_0_0_/_0.22)] md:min-h-0">
      <header className="relative z-10 flex min-h-12 items-center justify-between gap-3 border-b border-border/70 bg-card-muted/35 px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <ImageIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">Images</h2>
          <span className="text-xs text-muted">
            {aspectRatio} {instagramImageFormatLabels[aspectRatio]}
          </span>
        </div>
        <span className="text-xs font-medium text-muted">
          {generatedAssets.length > 0
            ? `${generatedAssets.length} generated`
            : `${imageCount} ${imageCount === 1 ? "output" : "outputs"}`}
        </span>
      </header>

      {generationFailed ? (
        <div
          role="alert"
          className="absolute left-4 top-16 z-20 w-fit rounded-full border border-error/35 bg-[#2A2020] px-3 py-2 text-xs font-semibold text-error shadow-[0_10px_28px_rgb(0_0_0_/_0.18)] sm:left-5"
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
          className="absolute left-4 top-16 z-20 w-fit rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-[0_10px_28px_rgb(0_0_0_/_0.18)] sm:left-5"
        >
          <div className="flex items-center gap-2">
            <Loader2 className="size-3.5 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
            Generating image asset…
          </div>
        </div>
      ) : null}

      {generatedAssets.length > 0 ? (
        <div className="grid flex-1 auto-rows-min grid-cols-1 gap-4 overflow-y-auto p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
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
        <div className="relative flex flex-1 items-center justify-center overflow-hidden px-5 py-8 text-center">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,color-mix(in_srgb,var(--instagram-rose)_12%,transparent),transparent_30%),radial-gradient(circle_at_62%_55%,color-mix(in_srgb,var(--instagram-violet)_10%,transparent),transparent_36%)]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.13] [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:32px_32px]"
          />

          <div className="relative max-w-sm">
            <span className="mx-auto flex size-12 items-center justify-center rounded-[14px] border border-primary/25 bg-brand-soft text-primary shadow-sm">
              <ImageIcon className="size-5" aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-sm font-semibold text-foreground">
              No images yet
            </h3>
            <p className="mt-1.5 text-sm leading-6 text-muted">
              Describe what you want to create below. Your generated images
              will appear here.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function ImageGenerationComposer({
  active,
  generationLocked,
  isGenerating,
  onEnhancePrompt,
  onPromptChange,
  onSubmit,
  onTextareaKeyDown,
  prompt,
}: {
  active: boolean;
  generationLocked: boolean;
  isGenerating: boolean;
  onEnhancePrompt: () => void;
  onPromptChange: (prompt: string) => void;
  onSubmit: (event?: FormEvent<HTMLFormElement>) => void;
  onTextareaKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  prompt: string;
}) {
  const promptId = useId();
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
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 56), 112)}px`;
  }, [active, prompt]);

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-[1120px] shrink-0 rounded-[var(--radius-panel)] border border-border bg-card p-3 shadow-[0_18px_48px_rgb(0_0_0_/_0.24)]"
    >
      <div className="rounded-[var(--radius-card)] border border-border bg-card-muted/65 px-3 py-2 transition-[border-color,box-shadow] focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10">
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor={promptId}
            className="text-xs font-semibold text-foreground"
          >
            Describe the visual
          </label>
          <span className="rounded-full border border-border bg-background/35 px-2.5 py-1 text-[11px] font-semibold text-muted">
            Pro image
          </span>
        </div>

        <textarea
          id={promptId}
          ref={textareaRef}
          rows={1}
          aria-label="Image prompt"
          autoComplete="off"
          name="imagePrompt"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          onKeyDown={onTextareaKeyDown}
          className="mt-1 max-h-28 min-h-14 w-full resize-none overflow-y-auto bg-transparent text-sm font-medium leading-6 text-foreground outline-none placeholder:text-muted-subtle"
          placeholder="Describe the subject, setting, composition, lighting, and mood…"
        />
      </div>

      <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div
            aria-label="Image format: 4:5 portrait"
            className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-control)] border border-border bg-card-muted px-3 text-sm font-medium text-foreground"
          >
            <span
              aria-hidden="true"
              className="inline-block h-4 w-3.5 shrink-0 rounded-[4px] border-2 border-muted"
            />
            4:5 portrait
          </div>
          <div
            aria-label="Output count: 1 image"
            className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-control)] border border-border bg-card-muted px-3 text-sm font-medium text-foreground"
          >
            <ImageIcon className="size-3.5" aria-hidden="true" />
            1 image
          </div>

          <button
            type="button"
            onClick={onEnhancePrompt}
            disabled={generationLocked || !prompt.trim() || isGenerating}
            aria-label={
              generationLocked
                ? "Image prompt enhancement locked"
                : "Enhance image prompt"
            }
            title={
              generationLocked ? "Prompt enhancement is locked" : undefined
            }
            className="inline-flex h-9 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-border bg-card-muted px-3 text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-selected hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
            Enhance
          </button>
        </div>
        <button
          type="submit"
          disabled={generationLocked || !prompt.trim() || isGenerating}
          aria-label={
            generationLocked
              ? "Image generation locked"
              : "Generate image"
          }
          title={
            generationLocked ? "Image generation is locked" : undefined
          }
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border border-primary/35 bg-brand-soft px-4 text-sm font-semibold text-primary transition-colors hover:border-primary/55 hover:bg-selected focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-80 xl:w-auto xl:min-w-[236px]"
        >
          {generationLocked ? (
            <>
              <Lock className="size-4" aria-hidden="true" />
              Generation unavailable in preview
            </>
          ) : isGenerating ? (
            <>
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Generating…
            </>
          ) : (
            <>
              Generate image
              <Sparkles className="size-4" aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </form>
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
