import type { ReactNode } from "react";
import type { AIStudioImageResult, AIStudioVideoResult } from "@/lib/ai-studio/media-results";
import type { HookStartingFrameSelection } from "@/lib/explore/hook-keyframe-client";

/** Optional presentation for the existing generators inside Recreate. */
export type RecreateGenerationView = {
  referenceImageAssetId?: string;
  emptyContent: ReactNode;
  contextBanner?: ReactNode;
  preview: boolean;
  referenceImageUrl?: string;
  referenceImageUrls?: string[];
  slideshowSlideCount?: number;
  referenceTitle?: string;
  styleVideo?: { id?: string; selectionRevision?: number; url: string; name: string; duration: number | null; generationPrompt?: string };
  startingFrame?: HookStartingFrameSelection;
  onClearStartingFrame?: () => void;
  onClearReference?: () => void;
  workflow?: {
    format: "hook" | "wall_text" | "slideshow";
    controlsTarget: HTMLElement | null;
    controlsActive?: boolean;
    actionsTarget?: HTMLElement | null;
    resultsTarget: HTMLElement | null;
    onGenerationStart: () => void;
    onBusyChange?: (busy: boolean) => void;
    onSelectVideo?: (result: AIStudioVideoResult) => void;
    onGeneratedVideo?: (result: AIStudioVideoResult) => void;
    onSelectImage?: (result: AIStudioImageResult) => void;
    imageSelectionLabel?: "Add to slideshow" | "Replace selected slide";
    onSelectSlideshow?: (results: AIStudioImageResult[]) => boolean;
    onGeneratedSlideshow?: (results: AIStudioImageResult[]) => boolean;
  };
};
