import type {
  TrendingWallTextContent,
  TrendingWallTextLayout,
} from "@/lib/trending/wall-text-types";
import {
  clampHookTextPosition,
  createHookTextLayout,
  HOOK_TEXT_LAYOUT_VERSION,
  type HookTextLayoutVersion,
} from "./hook-text-layout.ts";
import type { TrendingTextColor } from "./text-color.ts";
import { getWallTextManualBlocks, normalizeWallTextManualCopy } from "./wall-text-manual-copy.ts";
import { getWallTextEditSafeArea } from "./wall-text-editor-layout.ts";
import type { WallTextNormalizedBox } from "./wall-text-types.ts";

export const TRENDING_CREATIVE_EDIT_VERSION = "trending-creative-edit-v1" as const;

export type TrendingCreativeEditFormat =
  | "carousel"
  | "hook_video"
  | "wall_text";

export type NormalizedTextPosition = {
  x: number;
  y: number;
};

export type TrendingCreativeEditSource = {
  groupId: string | null;
  mediaAssetId: string | null;
  resolvedAssetId: string;
  resolvedAssetDurationSeconds: number | null;
  resolvedAssetTitle: string;
  resolvedAssetUrl: string;
  resolvedThumbnailUrl: string | null;
  selectionKind: "asset" | "group";
};

export type TrendingCarouselEditSlide = {
  backgroundAssetId: string | null;
  // Derived by the server for manual image replacements; never accepted from PATCH.
  backgroundCrop?: "centre";
  backgroundUrl: string;
  ctaText: string;
  headline: string;
  hasHeading?: boolean;
  originalBackgroundAssetId: string | null;
  originalBackgroundUrl: string;
  originalHeadline?: string;
  originalSubtext?: string;
  sourceRendererVersion?: string | null;
  originalVisualRole: "hook" | "human" | "product_asset" | "static" | null;
  productVisualEligibility: "allowed" | "forbidden" | "preferred" | null;
  renderFormat: "1:1" | "4:5";
  renderedUrl: string;
  slideId: string;
  slideNumber: number;
  storyLayoutVariant:
    | "story_overlay_only"
    | "story_pill_overlay"
    | "story_product_reveal"
    | null;
  storyTextTreatment: "outlined_overlay" | "overlay" | "pill" | null;
  structureId: "structure_1" | "structure_2";
  subtext: string;
  textPosition: NormalizedTextPosition;
  visualRole: "hook" | "human" | "product_asset" | "static" | null;
};

export type TrendingCarouselEditContent = {
  format: "carousel";
  slides: TrendingCarouselEditSlide[];
  version: typeof TRENDING_CREATIVE_EDIT_VERSION;
};

export type TrendingHookEditContent = {
  fontSize: number;
  format: "hook_video";
  hookText: string;
  layoutVersion?: HookTextLayoutVersion;
  lines: string[];
  position: NormalizedTextPosition;
  textColor: TrendingTextColor;
  version: typeof TRENDING_CREATIVE_EDIT_VERSION;
};

export type TrendingWallTextEditContent = {
  content: TrendingWallTextContent;
  format: "wall_text";
  layout: TrendingWallTextLayout;
  textColor: TrendingTextColor;
  version: typeof TRENDING_CREATIVE_EDIT_VERSION;
};

export type TrendingCreativeEditContent =
  | TrendingCarouselEditContent
  | TrendingHookEditContent
  | TrendingWallTextEditContent;

export type TrendingCreativeEditRenderState =
  | "draft"
  | "failed"
  | "queued"
  | "ready"
  | "rendering";

export type TrendingCreativeEditRecord = {
  // Client-only refresh failure; distinct from the backend render result.
  refreshError?: string | null;
  assignmentId: string;
  content: TrendingCreativeEditContent;
  creativeId: string;
  format: TrendingCreativeEditFormat;
  id: string | null;
  renderError: string | null;
  renderJobId: string | null;
  renderOutput: {
    slides: Array<{
      renderedS3Key: string | null;
      renderedUrl: string;
      slideNumber: number;
    }>;
  } | null;
  renderState: TrendingCreativeEditRenderState;
  revision: number;
  source: TrendingCreativeEditSource | null;
  updatedAt: string | null;
};

export type TrendingCreativeEditSaveInput = {
  assignmentId: string;
  expectedRevision: number;
  content:
    | {
        format: "carousel";
        slides: Array<
          Pick<
            TrendingCarouselEditSlide,
            | "backgroundAssetId"
            | "ctaText"
            | "headline"
            | "slideId"
            | "slideNumber"
            | "subtext"
            | "textPosition"
          >
        >;
        version: typeof TRENDING_CREATIVE_EDIT_VERSION;
      }
    | TrendingHookEditContent
    | TrendingWallTextEditContent;
  source?: {
    groupId?: string | null;
    mediaAssetId?: string | null;
    resolvedAssetId?: string | null;
    selectionKind: "asset" | "group";
  } | null;
};

export function clampNormalizedTextPosition(
  value: NormalizedTextPosition,
  bounds = { maxX: 0.9, maxY: 0.9, minX: 0.1, minY: 0.1 },
): NormalizedTextPosition {
  return {
    x: clamp(value.x, bounds.minX, bounds.maxX),
    y: clamp(value.y, bounds.minY, bounds.maxY),
  };
}

export function createHookEditLines(value: string) {
  const normalized = value.replace(/\r\n?/gu, "\n").trim();

  if (!normalized) {
    return [];
  }

  try {
    return createHookTextLayout(normalized, {
      enforceMaximum: false,
      enforceMinimum: false,
    }).lines;
  } catch {
    return normalized
      .split("\n")
      .map((line) => line.replace(/\s+/gu, " ").trim())
      .filter(Boolean);
  }
}

export function createHookEditContent(
  value: string,
  current: TrendingHookEditContent,
): TrendingHookEditContent {
  try {
    const layout = createHookTextLayout(value, {
      enforceMaximum: false,
      enforceMinimum: false,
    });

    return {
      ...current,
      fontSize: layout.fontSize,
      hookText: value,
      layoutVersion: HOOK_TEXT_LAYOUT_VERSION,
      lines: layout.lines,
      position: clampHookTextPosition(current.position, layout.positionBounds),
    };
  } catch {
    return {
      ...current,
      hookText: value,
      layoutVersion: HOOK_TEXT_LAYOUT_VERSION,
      lines: createHookEditLines(value),
    };
  }
}

export function createWallTextEditContent(
  fullText: string,
  current: TrendingWallTextContent,
): TrendingWallTextContent {
  const normalized = normalizeWallTextManualCopy(fullText);
  const draft = { ...current };
  delete draft.finalLayout;
  delete draft.renderFontSize;
  delete draft.sourceContent;
  const lines = getWallTextManualBlocks(normalized).flatMap((block) => block.lines);
  return {
    ...draft,
    fullText: normalized,
    segments: lines.length ? [{ lines, role: "lead" }] : [],
  };
}

export function updateWallTextEditBox(
  current: TrendingWallTextEditContent,
  textBox: WallTextNormalizedBox,
): TrendingWallTextEditContent {
  const widthChanged = Math.abs(textBox.width - current.layout.textBox.width) > 0.000001;
  return {
    ...current,
    content: widthChanged ? {
      ...createWallTextEditContent(current.content.fullText, current.content),
      fullText: current.content.fullText,
    } : current.content,
    layout: {
      ...current.layout,
      safeArea: widthChanged ? getWallTextEditSafeArea(current.layout.safeArea) : current.layout.safeArea,
      textBox,
    },
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, value));
}
