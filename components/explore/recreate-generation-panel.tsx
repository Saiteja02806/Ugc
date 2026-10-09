"use client";

/* eslint-disable @next/next/no-img-element */
import { ImageIcon, MessageSquare, Video, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

import { useBillingSubscription } from "@/components/billing/use-billing-subscription";
import { useAIStudioAccess } from "@/components/generation/use-ai-studio-access";
import { getAIStudioAccessMessage } from "@/lib/ai-studio/access-policy";
import type { RecreateReference } from "@/lib/explore/recreate-types";
import studio from "@/components/explore/workflow-studio.module.css";
import layout from "@/components/explore/recreate-layout.module.css";
import { cn } from "@/lib/utils";

const ImagePanel = dynamic(() => import("@/components/workspace/ugc-chat-workspace").then((module) => module.ImageGenerationStudioPanel));
const VideoPanel = dynamic(() => import("@/components/video/video-generation-workspace").then((module) => module.VideoGenerationStudioPanel));

export function RecreateGenerationPanel({ localPreview, mode, onModeChange, onPreview, onRemove, reference }: {
  localPreview: boolean;
  mode: "images" | "videos";
  onModeChange: (value: "images" | "videos") => void;
  onPreview: () => void;
  onRemove: () => void;
  reference: RecreateReference | null;
}) {
  const accountAccessState = useAIStudioAccess();
  const accessState = localPreview ? "locked" : accountAccessState;
  const subscription = useBillingSubscription().data;
  const [slideSelection, setSlideSelection] = useState<{ referenceId: string; index: number } | null>(null);
  const slideIndex = slideSelection && slideSelection.referenceId === reference?.id ? slideSelection.index : 0;
  const sourceImage = reference?.format === "slideshow" ? reference.slides[slideIndex]?.url : reference?.posterUrl;
  const accessMessage = localPreview ? "Local preview · generation disabled" : getAIStudioAccessMessage(accessState);
  const emptyContent = <div className={cn(layout.emptyState, "max-w-80 px-2 py-3 text-left")}>
    <span className="mb-5 inline-flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><MessageSquare className="size-4" strokeWidth={1.6} aria-hidden="true" /></span>
    <h2 className="text-base font-semibold leading-6 tracking-tight text-foreground-strong">{reference ? "Make it your own" : "Start with a reference"}</h2>
    <p className="mt-2 text-pretty text-sm leading-6 text-muted">{reference ? "Tell us what to change and what to keep." : "Explore the gallery, choose a creative, then describe your changes below."}</p>
  </div>;
  const contextBanner = reference ? <div key={reference.id} className={studio.selection}>
    <div className="flex items-center gap-3 pb-3">
      <button type="button" onClick={onPreview} aria-label={`View selected ${reference.title}`} className="shrink-0 overflow-hidden rounded-xl bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
        <img src={sourceImage} alt="" width={36} height={48} className="h-12 w-9 object-contain" />
      </button>
      <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-foreground">{reference.format === "slideshow" ? "Slideshow reference" : reference.format === "wall_text" ? "Wall of Text reference" : "Hook reference"}</p><p aria-live="polite" className="mt-0.5 text-[11px] text-primary">Selected for recreation</p></div>
      <button type="button" onClick={onRemove} aria-label="Remove reference" className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"><X className="size-3.5" aria-hidden="true" /></button>
    </div>
    {reference.format === "slideshow" ? <div className="mb-2 flex gap-2 overflow-x-auto py-1">{reference.slides.map((slide, index) => <button key={slide.id} type="button" aria-label={`Use slide ${index + 1}`} aria-pressed={index === slideIndex} onClick={() => setSlideSelection({ referenceId: reference.id, index })} className={cn("w-8 shrink-0 overflow-hidden rounded-lg bg-card-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus", index === slideIndex ? "ring-2 ring-primary" : "opacity-65 hover:opacity-100")}><img src={slide.url} alt="" width={slide.width} height={slide.height} loading="lazy" className="aspect-[4/5] w-full object-contain" /></button>)}</div> : null}
  </div> : undefined;
  const recreateView = { contextBanner, emptyContent, preview: localPreview, referenceImageUrl: sourceImage };

  return <aside aria-label="Creation chat" className={cn(studio.chat, "flex h-[620px] min-h-0 min-w-0 shrink-0 flex-col bg-card-muted/25 lg:h-auto lg:flex-1 lg:w-full")}>
    <div className={cn(layout.panelHeader, "flex h-16 shrink-0 items-center px-5")}>
      <div role="tablist" aria-label="Generation type" className="flex w-full rounded-full bg-card-muted/55 p-1">
        {(["images", "videos"] as const).map((value) => <button key={value} id={`ai-studio-${value}-tab`} role="tab" type="button" aria-selected={mode === value} tabIndex={mode === value ? 0 : -1} aria-controls={`ai-studio-${value}-panel`} onClick={() => onModeChange(value)} onKeyDown={(event) => {
          const next = event.key === "Home" ? "images" : event.key === "End" ? "videos" : event.key === "ArrowRight" || event.key === "ArrowLeft" ? value === "images" ? "videos" : "images" : null;
          if (!next) return;
          event.preventDefault();
          onModeChange(next);
          document.getElementById(`ai-studio-${next}-tab`)?.focus();
        }} className={cn(studio.tab, "inline-flex h-8 flex-1 items-center justify-center gap-2 rounded-full text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus", mode === value ? "bg-card text-foreground-strong shadow-sm" : "text-muted hover:text-foreground")}>{value === "images" ? <ImageIcon className="size-3.5" aria-hidden="true" /> : <Video className="size-3.5" aria-hidden="true" />}{value === "images" ? "Image" : "Video"}</button>)}
      </div>
    </div>
    <div className={cn(layout.panelBody, "flex min-h-0 flex-1 flex-col px-3")}>
      <ImagePanel active={mode === "images"} accessState={accessState} accessMessage={accessMessage} creditCost={subscription?.imageGenerationCreditCost ?? 1} creditsRemaining={subscription?.creditsRemaining ?? null} recreateView={recreateView} />
      <VideoPanel active={mode === "videos"} accessState={accessState} accessMessage={accessMessage} creditsPerSecond={subscription?.videoGenerationCreditsPerSecond} creditsRemaining={subscription?.creditsRemaining ?? null} recreateView={recreateView} />
    </div>
  </aside>;
}
