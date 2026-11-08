import type { ReactNode } from "react";
import type { AIStudioImageResult, AIStudioVideoResult } from "@/lib/ai-studio/media-results";
import type { HookStartingFrameSelection } from "@/lib/explore/hook-keyframe-client";
import type { StartingFrameSelection } from "@/lib/explore/uploaded-starting-frame";

/** Optional presentation for the existing generators inside Recreate. */
export type RecreateGenerationView = {
  referenceImageAssetId?: string;
  emptyContent: ReactNode;
  contextBanner?: ReactNode;
  preview: boolean;
  referenceImageUrl?: string;
  referenceImageUrls?: string[];
  slideshowSources?: import("@/lib/explore/slideshow-image-names").SlideshowSourceIdentity[];
  slideshowSlideCount?: number;
  slideshowFaceSwap?: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    slideIds: string[];
    onSlideIdsChange: (ids: string[]) => void;
    influencer: import("./slideshow-face-choice").SlideshowFaceChoiceValue | null;
    onInfluencerChange: (influencer: import("./slideshow-face-choice").SlideshowFaceChoiceValue | null) => void;
    slides?: { id: string; url: string; number: number; eligible: boolean }[];
    eligibleCount: number;
    /** The kept face no longer has slide marks for the current reference. */
    stale?: boolean;
  };
  referenceTitle?: string;
  styleVideo?: { id?: string; selectionRevision?: number; url: string; name: string; duration: number | null; generationPrompt?: string };
  startingFrame?: StartingFrameSelection;
  startingFramePreparation?: { referenceId: string; instructions?: string; onOpen: () => void; onUseInstructionsAlone?: () => boolean };
  onClearStartingFrame?: () => void;
  onSelectStartingFrame?: (frame: StartingFrameSelection) => boolean | void;
  previewStartingFrames?: HookStartingFrameSelection[];
  previewFaceReferenceImages?: import("@/lib/media/types").MediaAsset[];
  onClearReference?: () => void;
  workflow?: {
    format: "hook" | "wall_text" | "slideshow";
    controlsTarget: HTMLElement | null;
    controlsActive?: boolean;
    actionsTarget?: HTMLElement | null;
    resultsTarget: HTMLElement | null;
    onGenerationStart: () => void;
    onGenerationRestore?: () => void;
    onIdleEmpty?: () => void;
    onBusyChange?: (busy: boolean) => void;
    onSelectVideo?: (result: AIStudioVideoResult) => void;
    onGeneratedVideo?: (result: AIStudioVideoResult) => void;
    onSelectImage?: (result: AIStudioImageResult) => void;
    imageSelectionLabel?: "Add to slideshow" | "Replace selected slide";
    onSelectSlideshow?: (results: AIStudioImageResult[]) => boolean;
    onGeneratedSlideshow?: (results: AIStudioImageResult[]) => boolean;
  };
};
