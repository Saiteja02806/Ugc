import type { ReactNode } from "react";
import type { AIStudioImageResult, AIStudioVideoResult } from "@/lib/ai-studio/media-results";

/** Optional presentation for the existing generators inside Recreate. */
export type RecreateGenerationView = {
  emptyContent: ReactNode;
  contextBanner?: ReactNode;
  preview: boolean;
  referenceImageUrl?: string;
  referenceTitle?: string;
  styleVideo?: { url: string; name: string; duration: number | null };
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
    onSelectImage?: (result: AIStudioImageResult) => void;
  };
};
