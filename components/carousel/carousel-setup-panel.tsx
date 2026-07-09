"use client";

import {
  Check,
  CircleAlert,
  Globe2,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import type { FormEvent } from "react";

import type { CarouselRenderStyle } from "@/lib/carousel/render-style";
import { cn } from "@/lib/utils";

export type CarouselFormat = "1:1" | "4:5";
export type CarouselTextStyle = CarouselRenderStyle;
export type WebsiteAnalysisState = "idle" | "loading" | "ready" | "failed";

type CarouselSetupPanelProps = {
  analyzedDomain: string | null;
  analysisState: WebsiteAnalysisState;
  analysisError: string | null;
  canGenerate: boolean;
  candidateCount: number;
  categoryLabel: string;
  format: CarouselFormat;
  generationStatus: "empty" | "loading" | "completed" | "failed";
  goal: string;
  slideCount: number;
  textStyle: CarouselTextStyle;
  websiteUrl: string;
  onAnalyze: () => void;
  onCandidateCountChange: (count: number) => void;
  onFormatChange: (format: CarouselFormat) => void;
  onGenerate: () => void;
  onGoalChange: (goal: string) => void;
  onSlideCountChange: (count: number) => void;
  onTextStyleChange: (style: CarouselTextStyle) => void;
  onWebsiteUrlChange: (url: string) => void;
};

const goals = ["Drive signups", "Book demos", "Build awareness", "Educate buyers"];
const textStyleOptions: Array<{ label: string; value: CarouselTextStyle }> = [
  { label: "Plain text", value: "plain" },
  { label: "Auto mix", value: "highlight" },
  { label: "Soft gradient", value: "soft-gradient" },
];

export function CarouselSetupPanel({
  analyzedDomain,
  analysisState,
  analysisError,
  canGenerate,
  candidateCount,
  categoryLabel,
  format,
  generationStatus,
  goal,
  slideCount,
  textStyle,
  websiteUrl,
  onAnalyze,
  onCandidateCountChange,
  onFormatChange,
  onGenerate,
  onGoalChange,
  onSlideCountChange,
  onTextStyleChange,
  onWebsiteUrlChange,
}: CarouselSetupPanelProps) {
  const isAnalyzing = analysisState === "loading";
  const isGenerating = generationStatus === "loading";
  const isCompleted = generationStatus === "completed";

  function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onAnalyze();
  }

  return (
    <aside className="border-b border-[#e8e1d9] bg-white xl:w-[348px] xl:shrink-0 xl:border-b-0 xl:border-r">
      <div className="px-5 py-6 sm:px-7 sm:py-7 xl:sticky xl:top-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase text-primary">Create</p>
            <h2 className="mt-2 text-xl font-bold text-foreground">Carousel setup</h2>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#eee5dc] bg-[#fffaf7] px-3 py-1.5 text-xs font-semibold text-[#445a72]">
            <span className="size-1.5 rounded-full bg-primary" />
            New
          </span>
        </div>

        <div className="mt-7 grid grid-cols-2 rounded-lg bg-[#f3f0ec] p-1" aria-label="Carousel mode">
          <button
            type="button"
            className="h-9 rounded-md bg-white text-sm font-semibold text-foreground shadow-sm"
          >
            Create new
          </button>
          <button
            type="button"
            disabled
            className="h-9 rounded-md text-sm font-semibold text-[#8793a0] disabled:cursor-not-allowed"
            title="Remix will be available in a later version"
          >
            Remix
          </button>
        </div>

        <div className="mt-7 space-y-6">
          <div>
            <label htmlFor="carousel-website" className="text-sm font-bold text-foreground">
              Website
            </label>
            <form onSubmit={handleAnalyze} className="mt-2 flex gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#dfd7cf] bg-white px-3 focus-within:border-[#f3a18d] focus-within:ring-2 focus-within:ring-[#ff6b4a]/10">
                <Globe2 className="size-4 shrink-0 text-[#65788d]" />
                <input
                  id="carousel-website"
                  type="url"
                  inputMode="url"
                  value={websiteUrl}
                  onChange={(event) => onWebsiteUrlChange(event.target.value)}
                  disabled={isAnalyzing}
                  placeholder={
                    analysisState === "ready"
                      ? analyzedDomain ?? "Linked website analysis"
                      : "https://yourwebsite.com"
                  }
                  className="h-11 min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-[#98a2af]"
                />
              </div>
              <button
                type="submit"
                disabled={!websiteUrl.trim() || isAnalyzing}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-[#173454] text-white transition hover:bg-[#102033] disabled:cursor-not-allowed disabled:opacity-45"
                aria-label="Analyze website"
                title="Analyze website"
              >
                {isAnalyzing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              </button>
            </form>
            {analysisState === "ready" ? (
              <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-[#16764a]">
                <span className="flex size-4 items-center justify-center rounded-full bg-[#e8f7ef]">
                  <Check className="size-3" />
                </span>
                {analyzedDomain ?? "Website analyzed"}
              </div>
            ) : null}
            {analysisState === "failed" ? (
              <div className="mt-2 flex items-start gap-2 text-xs font-semibold leading-5 text-error" role="alert">
                <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                <span>{analysisError ?? "Website analysis failed."}</span>
              </div>
            ) : null}
          </div>

          <SetupField label="Category" value={categoryLabel} muted={categoryLabel === "Analyze a website first"} />

          <div>
            <label htmlFor="carousel-goal" className="text-sm font-bold text-foreground">
              Goal
            </label>
            <select
              id="carousel-goal"
              value={goal}
              onChange={(event) => onGoalChange(event.target.value)}
              className="mt-2 h-11 w-full rounded-lg border border-[#dfd7cf] bg-white px-3 text-sm font-semibold text-[#304963] outline-none transition focus:border-[#f3a18d] focus:ring-2 focus:ring-[#ff6b4a]/10"
            >
              {goals.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-sm font-bold text-foreground">Versions</span>
              <div className="mt-2 flex h-11 items-center justify-between rounded-lg border border-[#dfd7cf] bg-white px-1">
                <button
                  type="button"
                  onClick={() => onCandidateCountChange(Math.max(1, candidateCount - 1))}
                  disabled={candidateCount <= 1 || isGenerating}
                  className="flex size-8 items-center justify-center rounded-md text-[#405977] hover:bg-[#f5f1ed] disabled:opacity-35"
                  aria-label="Decrease version count"
                >
                  <Minus className="size-4" />
                </button>
                <span className="text-sm font-bold text-foreground">{candidateCount}</span>
                <button
                  type="button"
                  onClick={() => onCandidateCountChange(Math.min(10, candidateCount + 1))}
                  disabled={candidateCount >= 10 || isGenerating}
                  className="flex size-8 items-center justify-center rounded-md text-[#405977] hover:bg-[#f5f1ed] disabled:opacity-35"
                  aria-label="Increase version count"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>

            <div>
              <span className="text-sm font-bold text-foreground">Slides</span>
              <div className="mt-2 flex h-11 items-center justify-between rounded-lg border border-[#dfd7cf] bg-white px-1">
                <button
                  type="button"
                  onClick={() => onSlideCountChange(Math.max(3, slideCount - 1))}
                  disabled={slideCount <= 3 || isGenerating}
                  className="flex size-8 items-center justify-center rounded-md text-[#405977] hover:bg-[#f5f1ed] disabled:opacity-35"
                  aria-label="Decrease slide count"
                >
                  <Minus className="size-4" />
                </button>
                <span className="text-sm font-bold text-foreground">{slideCount}</span>
                <button
                  type="button"
                  onClick={() => onSlideCountChange(Math.min(10, slideCount + 1))}
                  disabled={slideCount >= 10 || isGenerating}
                  className="flex size-8 items-center justify-center rounded-md text-[#405977] hover:bg-[#f5f1ed] disabled:opacity-35"
                  aria-label="Increase slide count"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>

          </div>

          <div>
            <span className="text-sm font-bold text-foreground">Text presentation</span>
            <div className="mt-2 grid h-11 grid-cols-3 rounded-lg border border-[#dfd7cf] bg-white p-1">
              {textStyleOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onTextStyleChange(option.value)}
                  disabled={isGenerating}
                  className={cn(
                    "rounded-md px-1 text-[11px] font-bold transition",
                    textStyle === option.value
                      ? "bg-[#fff0e9] text-primary"
                      : "text-[#66788c] hover:bg-[#f6f3ef]",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-sm font-bold text-foreground">Format</span>
            <div className="mt-2 grid h-11 grid-cols-2 rounded-lg border border-[#dfd7cf] bg-white p-1">
              {(["4:5", "1:1"] as CarouselFormat[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onFormatChange(option)}
                  disabled={isGenerating}
                  className={cn(
                    "rounded-md text-xs font-bold transition",
                    format === option
                      ? "bg-[#fff0e9] text-primary"
                      : "text-[#66788c] hover:bg-[#f6f3ef]",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-[#eee7df] pt-6">
          <button
            type="button"
            onClick={onGenerate}
            disabled={!canGenerate || isGenerating}
            className={cn(
              "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-white shadow-[0_12px_28px_rgb(255_107_74_/_0.22)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-45",
              isCompleted ? "bg-[#173454] hover:bg-[#102033]" : "bg-primary hover:bg-primary-hover",
            )}
          >
            {isGenerating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Generating {candidateCount} versions
              </>
            ) : isCompleted ? (
              <>
                <RefreshCw className="size-4" />
                Regenerate versions
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Generate versions
              </>
            )}
          </button>
          <p className="mt-3 text-center text-xs font-medium leading-5 text-[#7a8795]">
            Each version is a complete carousel with its own angle and slides.
          </p>
        </div>
      </div>
    </aside>
  );
}

function SetupField({ label, muted, value }: { label: string; muted?: boolean; value: string }) {
  return (
    <div>
      <span className="text-sm font-bold text-foreground">{label}</span>
      <div
        className={cn(
          "mt-2 flex min-h-11 items-center rounded-lg border border-[#dfd7cf] bg-[#fcfbf9] px-3 text-sm font-semibold",
          muted ? "text-[#909ba7]" : "text-[#304963]",
        )}
      >
        {value}
      </div>
    </div>
  );
}
