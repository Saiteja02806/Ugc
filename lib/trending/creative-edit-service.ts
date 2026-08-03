import "server-only";

import {
  getCarouselEditBackgrounds,
  getCarouselGenerationStatus,
} from "@/lib/carousel/db";
import { listCreativeAssetGroupAssets } from "@/lib/media/creative-asset-groups";
import {
  getMediaAssetForOwner,
  serializeMediaAsset,
} from "@/lib/media/media-storage";
import type { MediaAsset } from "@/lib/media/types";
import {
  clampNormalizedTextPosition,
  TRENDING_CREATIVE_EDIT_VERSION,
  type NormalizedTextPosition,
  type TrendingCreativeEditContent,
  type TrendingCreativeEditFormat,
  type TrendingCreativeEditRecord,
  type TrendingCreativeEditSaveInput,
  type TrendingCreativeEditSource,
  type TrendingHookEditContent,
  type TrendingWallTextEditContent,
} from "@/lib/trending/creative-edit-contract";
import { chooseLibraryAsset } from "@/lib/trending/creative-edit-source-selection";
import {
  assertEditableTrendingCreative,
  getTrendingCreativeEdit,
  TrendingCreativeEditAccessError,
  upsertTrendingCreativeEdit,
  type TrendingCreativeEditRow,
} from "@/lib/trending/creative-edits";
import { getEditableTrendingHookIdea } from "@/lib/trending/hook-video-db";
import {
  clampHookTextPosition,
  createHookTextLayout,
  HookTextLayoutError,
} from "@/lib/trending/hook-text-layout";
import {
  DEFAULT_TRENDING_TEXT_COLOR,
  resolveTrendingTextColor,
} from "@/lib/trending/text-color";
import { isTrendingSourceVideoAsset } from "@/lib/trending/video-source-selection";
import { getEditableWallTextDraft } from "@/lib/trending/wall-text-db";
import {
  WALL_TEXT_RENDER_HEIGHT,
  WALL_TEXT_RENDER_WIDTH,
  validateWallTextRenderFit,
} from "@/lib/trending/wall-text-render-validation";
import { validateWallTextContent } from "@/lib/trending/wall-text-text-logic";

export async function loadTrendingCreativeEditor(params: {
  assignmentId: string;
  creativeId: string;
  format: TrendingCreativeEditFormat;
  userId: string;
}): Promise<TrendingCreativeEditRecord> {
  await assertEditableTrendingCreative(params);

  const [defaultContent, row] = await Promise.all([
    buildDefaultContent(params),
    getTrendingCreativeEdit(params),
  ]);
  const content = row
    ? mergeStoredContentWithOwnerDefaults(defaultContent, row)
    : defaultContent;
  const source = row
    ? await resolveStoredSourceForEditor(row, params.userId)
    : null;

  return serializeRecord({
    assignmentId: params.assignmentId,
    content,
    creativeId: params.creativeId,
    format: params.format,
    row,
    source,
  });
}

export async function loadSavedTrendingCreativeEditForDownstream(params: {
  creativeId: string;
  format: TrendingCreativeEditFormat;
  userId: string;
}): Promise<TrendingCreativeEditRecord | null> {
  const row = await getTrendingCreativeEdit(params);

  if (!row) {
    return null;
  }

  const defaultContent = await buildDefaultContent({
    assignmentId: row.assignment_id,
    creativeId: params.creativeId,
    format: params.format,
    userId: params.userId,
  });
  const content = mergeStoredContentWithOwnerDefaults(defaultContent, row);
  const source = await resolveStoredSource(row, params.userId);

  return serializeRecord({
    assignmentId: row.assignment_id,
    content,
    creativeId: params.creativeId,
    format: params.format,
    row,
    source,
  });
}

export async function saveTrendingCreativeEditor(params: {
  creativeId: string;
  format: TrendingCreativeEditFormat;
  input: TrendingCreativeEditSaveInput;
  userId: string;
}) {
  await assertEditableTrendingCreative({
    assignmentId: params.input.assignmentId,
    creativeId: params.creativeId,
    format: params.format,
    userId: params.userId,
  });

  if (params.input.content.format !== params.format) {
    throw new TrendingCreativeEditAccessError(
      "This edit does not match the selected creative format.",
      400,
    );
  }

  const [defaultContent, existing] = await Promise.all([
    buildDefaultContent({
      assignmentId: params.input.assignmentId,
      creativeId: params.creativeId,
      format: params.format,
      userId: params.userId,
    }),
    getTrendingCreativeEdit({
      creativeId: params.creativeId,
      format: params.format,
      userId: params.userId,
    }),
  ]);

  if ((existing?.revision ?? 0) !== params.input.expectedRevision) {
    throw new TrendingCreativeEditAccessError(
      "This Trending edit changed in another tab. Reload it and try again.",
      409,
    );
  }

  const submittedContent = mergeSubmittedContent(
    defaultContent,
    params.input.content,
  );
  const source = await resolveSubmittedSource({
    creativeId: params.creativeId,
    existing,
    source: params.input.source,
    userId: params.userId,
  });
  const content = await validateAndNormalizeSubmittedContent({
    assignmentId: params.input.assignmentId,
    content: submittedContent,
    creativeId: params.creativeId,
    source,
    userId: params.userId,
  });

  const row = await upsertTrendingCreativeEdit({
    assignmentId: params.input.assignmentId,
    content,
    creativeId: params.creativeId,
    format: params.format,
    positions: getPositionPayload(content),
    resolvedMediaAssetId: source?.resolvedAssetId ?? null,
    sourceGroupId: source?.groupId ?? null,
    sourceMediaAssetId: source?.mediaAssetId ?? null,
    sourceSelectionKind: source?.selectionKind ?? null,
    userId: params.userId,
  });

  return serializeRecord({
    assignmentId: params.input.assignmentId,
    content,
    creativeId: params.creativeId,
    format: params.format,
    row,
    source,
  });
}

async function buildDefaultContent(params: {
  assignmentId: string;
  creativeId: string;
  format: TrendingCreativeEditFormat;
  userId: string;
}): Promise<TrendingCreativeEditContent> {
  if (params.format === "carousel") {
    const status = await getCarouselGenerationStatus(params.creativeId);

    if (
      !status ||
      status.generation.userId !== params.userId ||
      status.generation.status !== "completed"
    ) {
      throw new TrendingCreativeEditAccessError(
        "This Carousel is not available to edit.",
        404,
      );
    }

    const backgrounds = await getCarouselEditBackgrounds(
      status.slides.flatMap((slide) =>
        slide.categoryImageAssetId ? [slide.categoryImageAssetId] : [],
      ),
    );
    const backgroundById = new Map(
      backgrounds.map((background) => [background.id, background.url]),
    );

    return {
      format: "carousel",
      slides: status.slides.map((slide) => ({
        backgroundUrl:
          (slide.categoryImageAssetId
            ? backgroundById.get(slide.categoryImageAssetId)
            : null) ??
          slide.renderedUrl ??
          "",
        ctaText: slide.ctaText ?? "",
        headline: slide.headline,
        renderedUrl: slide.renderedUrl ?? "",
        slideId: slide.id,
        slideNumber: slide.slideNumber,
        subtext: slide.subtext ?? "",
        textPosition: getDefaultCarouselTextPosition(slide.textPosition),
      })),
      version: TRENDING_CREATIVE_EDIT_VERSION,
    };
  }

  if (params.format === "hook_video") {
    const idea = await getEditableTrendingHookIdea({
      assignmentId: params.assignmentId,
      suggestionId: params.creativeId,
      userId: params.userId,
    });

    if (!idea) {
      throw new TrendingCreativeEditAccessError(
        "This Hook video is not available to edit.",
        404,
      );
    }

    return {
      fontSize: idea.overlayFontSize,
      format: "hook_video",
      hookText: idea.hookText,
      lines: idea.openingLines,
      position: { x: 0.5, y: 0.5 },
      textColor: DEFAULT_TRENDING_TEXT_COLOR,
      version: TRENDING_CREATIVE_EDIT_VERSION,
    };
  }

  const draft = await getEditableWallTextDraft({
    assignmentId: params.assignmentId,
    creativeId: params.creativeId,
    userId: params.userId,
  });

  if (!draft) {
    throw new TrendingCreativeEditAccessError(
      "This Wall-of-text video is not available to edit.",
      404,
    );
  }

  return {
    content: draft.text,
    format: "wall_text",
    layout: draft.layout,
    textColor: DEFAULT_TRENDING_TEXT_COLOR,
    version: TRENDING_CREATIVE_EDIT_VERSION,
  };
}

function mergeSubmittedContent(
  defaults: TrendingCreativeEditContent,
  submitted: TrendingCreativeEditSaveInput["content"],
): TrendingCreativeEditContent {
  if (defaults.format === "carousel" && submitted.format === "carousel") {
    const submittedById = new Map(
      submitted.slides.map((slide) => [slide.slideId, slide]),
    );

    if (
      submitted.slides.length !== defaults.slides.length ||
      defaults.slides.some((slide) => {
        const edited = submittedById.get(slide.slideId);
        return !edited || edited.slideNumber !== slide.slideNumber;
      })
    ) {
      throw new TrendingCreativeEditAccessError(
        "Reload this Carousel before saving the edit.",
        409,
      );
    }

    return {
      ...defaults,
      slides: defaults.slides.map((slide) => {
        const edited = submittedById.get(slide.slideId)!;

        return {
          ...slide,
          ctaText: edited.ctaText.trim(),
          headline: edited.headline.trim(),
          subtext: edited.subtext.trim(),
          textPosition: clampNormalizedTextPosition(edited.textPosition),
        };
      }),
    };
  }

  if (defaults.format === "hook_video" && submitted.format === "hook_video") {
    return {
      ...submitted,
      hookText: submitted.hookText.trim(),
      lines: submitted.lines.map((line) => line.trim()).filter(Boolean),
      position: clampNormalizedTextPosition(submitted.position),
      textColor: resolveTrendingTextColor(submitted.textColor),
      version: TRENDING_CREATIVE_EDIT_VERSION,
    };
  }

  if (defaults.format === "wall_text" && submitted.format === "wall_text") {
    return {
      ...submitted,
      layout: {
        ...submitted.layout,
        textBox: clampWallTextBox(submitted.layout.textBox),
      },
      textColor: resolveTrendingTextColor(submitted.textColor),
      version: TRENDING_CREATIVE_EDIT_VERSION,
    };
  }

  throw new TrendingCreativeEditAccessError(
    "This edit does not match the selected creative format.",
    400,
  );
}

async function validateAndNormalizeSubmittedContent(params: {
  assignmentId: string;
  content: TrendingCreativeEditContent;
  creativeId: string;
  source: TrendingCreativeEditSource | null;
  userId: string;
}): Promise<TrendingCreativeEditContent> {
  if (params.content.format === "carousel") {
    return params.content;
  }

  if (params.content.format === "hook_video") {
    try {
      const layout = createHookTextLayout(params.content.hookText);

      return {
        ...params.content,
        fontSize: layout.fontSize,
        hookText: layout.hookText,
        lines: layout.lines,
        position: clampHookTextPosition(
          params.content.position,
          layout.positionBounds,
        ),
      };
    } catch (error) {
      throw new TrendingCreativeEditAccessError(
        error instanceof HookTextLayoutError
          ? error.message
          : "Hook text could not be prepared for export.",
        400,
      );
    }
  }

  const draft = await getEditableWallTextDraft({
    assignmentId: params.assignmentId,
    creativeId: params.creativeId,
    userId: params.userId,
  });

  if (!draft) {
    throw new TrendingCreativeEditAccessError(
      "This Wall-of-text video is no longer available to edit.",
      404,
    );
  }

  try {
    const durationSeconds =
      params.source?.resolvedAssetDurationSeconds ?? draft.durationSeconds;
    const contentWithoutFont = {
      ...params.content.content,
      renderFontSize: undefined,
    };
    validateWallTextContent(contentWithoutFont, durationSeconds);
    const render = await validateWallTextRenderFit(contentWithoutFont);
    validateWallTextPlacement({
      height: render.height,
      layout: params.content.layout,
    });

    return {
      ...params.content,
      content: {
        ...contentWithoutFont,
        renderFontSize: render.fontSize as 44 | 46 | 48 | 52,
      },
    };
  } catch (error) {
    throw new TrendingCreativeEditAccessError(
      error instanceof Error
        ? error.message
        : "Wall-of-text copy could not be prepared for export.",
      400,
    );
  }
}

function validateWallTextPlacement(params: {
  height: number;
  layout: TrendingWallTextEditContent["layout"];
}) {
  const { safeArea, textBox } = params.layout;
  const validNumbers = [
    safeArea.bottom,
    safeArea.left,
    safeArea.right,
    safeArea.top,
    textBox.height,
    textBox.width,
    textBox.x,
    textBox.y,
  ];
  const minimumWidth = 620 / WALL_TEXT_RENDER_WIDTH;
  const maximumWidth = 660 / WALL_TEXT_RENDER_WIDTH;

  if (
    validNumbers.some(
      (value) => !Number.isFinite(value) || value < 0 || value > 1,
    ) ||
    safeArea.left + safeArea.right >= 0.7 ||
    safeArea.top + safeArea.bottom >= 0.7 ||
    textBox.width < minimumWidth ||
    textBox.width > maximumWidth ||
    textBox.x < safeArea.left ||
    textBox.y < safeArea.top ||
    textBox.x + textBox.width > 1 - safeArea.right + 0.001 ||
    textBox.y + textBox.height > 1 - safeArea.bottom + 0.001 ||
    params.height > textBox.height * WALL_TEXT_RENDER_HEIGHT
  ) {
    throw new Error(
      "Wall-of-text placement is outside the publishing safe zone.",
    );
  }
}

function mergeStoredContentWithOwnerDefaults(
  defaults: TrendingCreativeEditContent,
  row: TrendingCreativeEditRow,
): TrendingCreativeEditContent {
  const stored = row.content_json as unknown as TrendingCreativeEditContent;

  if (defaults.format === "carousel" && stored?.format === "carousel") {
    const storedById = new Map(stored.slides.map((slide) => [slide.slideId, slide]));

    return {
      ...defaults,
      slides: defaults.slides.map((slide) => {
        const edited = storedById.get(slide.slideId);

        return edited
          ? {
              ...slide,
              ctaText: edited.ctaText,
              headline: edited.headline,
              subtext: edited.subtext,
              textPosition: clampNormalizedTextPosition(edited.textPosition),
            }
          : slide;
      }),
    };
  }

  if (defaults.format === "hook_video" && stored?.format === "hook_video") {
    return {
      ...stored,
      position: clampNormalizedTextPosition(stored.position),
      textColor: resolveTrendingTextColor(stored.textColor),
    } satisfies TrendingHookEditContent;
  }

  if (defaults.format === "wall_text" && stored?.format === "wall_text") {
    return {
      ...stored,
      layout: {
        ...stored.layout,
        textBox: clampWallTextBox(stored.layout.textBox),
      },
      textColor: resolveTrendingTextColor(stored.textColor),
    } satisfies TrendingWallTextEditContent;
  }

  return defaults;
}

async function resolveSubmittedSource(params: {
  allowGroupFallback?: boolean;
  creativeId: string;
  existing: TrendingCreativeEditRow | null;
  source: TrendingCreativeEditSaveInput["source"] | undefined;
  userId: string;
}) {
  if (params.source === undefined) {
    return params.existing
      ? resolveStoredSource(params.existing, params.userId)
      : null;
  }

  if (params.source === null) {
    return null;
  }

  if (params.source.selectionKind === "asset") {
    const assetId = params.source.mediaAssetId?.trim();

    if (!assetId) {
      throw new TrendingCreativeEditAccessError("Choose a video to use.", 400);
    }

    const row = await getMediaAssetForOwner({ assetId, userId: params.userId });
    const asset = row ? serializeMediaAsset(row) : null;
    assertReadyVideo(asset);

    return toEditSource(asset, {
      groupId: null,
      mediaAssetId: asset.id,
      selectionKind: "asset",
    });
  }

  const groupId = params.source.groupId?.trim();
  const resolvedAssetId = params.source.resolvedAssetId?.trim();

  if (!groupId) {
    throw new TrendingCreativeEditAccessError(
      "Choose a video library to use.",
      400,
    );
  }

  const groupResult = await listCreativeAssetGroupAssets({
    groupId,
    userId: params.userId,
  });
  if (!groupResult || groupResult.group.mediaType !== "video") {
    throw new TrendingCreativeEditAccessError(
      "This video library is no longer available.",
      409,
    );
  }

  const requestedAsset = resolvedAssetId
    ? groupResult.assets.find((item) => item.asset.id === resolvedAssetId)?.asset
    : null;

  if (resolvedAssetId && !requestedAsset && !params.allowGroupFallback) {
    throw new TrendingCreativeEditAccessError(
      "This video is no longer in the selected library.",
      409,
    );
  }

  const asset =
    requestedAsset ??
    chooseLibraryAsset(
      groupResult.assets.map((item) => item.asset),
      params.creativeId,
    );

  if (!asset) {
    throw new TrendingCreativeEditAccessError(
      "This video library has no ready videos.",
      409,
    );
  }

  assertReadyVideo(asset);
  return toEditSource(asset, {
    groupId,
    mediaAssetId: null,
    selectionKind: "group",
  });
}

async function resolveStoredSource(
  row: TrendingCreativeEditRow,
  userId: string,
): Promise<TrendingCreativeEditSource | null> {
  if (!row.source_selection_kind || !row.resolved_media_asset_id) {
    return null;
  }

  return resolveSubmittedSource({
    allowGroupFallback: row.source_selection_kind === "group",
    creativeId: row.creative_id,
    existing: null,
    source:
      row.source_selection_kind === "asset"
        ? {
            mediaAssetId:
              row.source_media_asset_id ?? row.resolved_media_asset_id,
            selectionKind: "asset",
          }
        : {
            groupId: row.source_group_id,
            resolvedAssetId: row.resolved_media_asset_id,
            selectionKind: "group",
          },
    userId,
  });
}

async function resolveStoredSourceForEditor(
  row: TrendingCreativeEditRow,
  userId: string,
) {
  try {
    return await resolveStoredSource(row, userId);
  } catch (error) {
    if (
      error instanceof TrendingCreativeEditAccessError &&
      error.status === 409
    ) {
      return null;
    }

    throw error;
  }
}

function assertReadyVideo(asset: MediaAsset | null | undefined): asserts asset is MediaAsset {
  if (!asset || !isTrendingSourceVideoAsset(asset)) {
    throw new TrendingCreativeEditAccessError(
      "This Creative Assets video is not available.",
      409,
    );
  }
}

function toEditSource(
  asset: MediaAsset,
  selection: Pick<
    TrendingCreativeEditSource,
    "groupId" | "mediaAssetId" | "selectionKind"
  >,
): TrendingCreativeEditSource {
  return {
    ...selection,
    resolvedAssetId: asset.id,
    resolvedAssetDurationSeconds: asset.durationSeconds,
    resolvedAssetTitle: asset.title,
    resolvedAssetUrl: asset.url,
    resolvedThumbnailUrl: asset.thumbnailUrl,
  };
}

function serializeRecord(params: {
  assignmentId: string;
  content: TrendingCreativeEditContent;
  creativeId: string;
  format: TrendingCreativeEditFormat;
  row: TrendingCreativeEditRow | null;
  source: TrendingCreativeEditSource | null;
}): TrendingCreativeEditRecord {
  return {
    assignmentId: params.assignmentId,
    content: params.content,
    creativeId: params.creativeId,
    format: params.format,
    id: params.row?.id ?? null,
    renderError: params.row?.render_error ?? null,
    renderJobId: params.row?.render_job_id ?? null,
    renderOutput: parseRenderOutput(params.row?.render_output_json ?? null),
    renderState: params.row?.render_status ?? "draft",
    revision: params.row?.revision ?? 0,
    source: params.source,
    updatedAt: params.row?.updated_at ?? null,
  };
}

function parseRenderOutput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const slides = "slides" in value ? value.slides : null;

  if (
    !Array.isArray(slides) ||
    slides.some(
      (slide) =>
        !slide ||
        typeof slide !== "object" ||
        !("renderedUrl" in slide) ||
        typeof slide.renderedUrl !== "string" ||
        !("slideNumber" in slide) ||
        typeof slide.slideNumber !== "number" ||
        ("renderedS3Key" in slide &&
          slide.renderedS3Key !== null &&
          (typeof slide.renderedS3Key !== "string" ||
            !slide.renderedS3Key
              .trim()
              .startsWith("carousels/rendered/"))),
    )
  ) {
    return null;
  }

  return {
    slides: slides.map((slide) => ({
      renderedS3Key:
        "renderedS3Key" in slide && typeof slide.renderedS3Key === "string"
          ? slide.renderedS3Key.trim()
          : null,
      renderedUrl: String(slide.renderedUrl),
      slideNumber: Number(slide.slideNumber),
    })),
  };
}

function getPositionPayload(content: TrendingCreativeEditContent) {
  if (content.format === "carousel") {
    return {
      slides: content.slides.map((slide) => ({
        slideId: slide.slideId,
        slideNumber: slide.slideNumber,
        textPosition: slide.textPosition,
      })),
    };
  }

  if (content.format === "hook_video") {
    return { position: content.position };
  }

  return { textBox: content.layout.textBox };
}

function getDefaultCarouselTextPosition(value: string | null): NormalizedTextPosition {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (normalized.includes("top") || normalized.includes("upper")) {
    return { x: 0.5, y: 0.3 };
  }

  if (normalized.includes("bottom") || normalized.includes("lower")) {
    return { x: 0.5, y: 0.7 };
  }

  return { x: 0.5, y: 0.5 };
}

function clampWallTextBox<T extends { height: number; width: number; x: number; y: number }>(
  box: T,
): T {
  const width = clamp(box.width, 0.15, 0.94);
  const height = clamp(box.height, 0.08, 0.82);

  return {
    ...box,
    height,
    width,
    x: clamp(box.x, 0.03, 0.97 - width),
    y: clamp(box.y, 0.03, 0.97 - height),
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.min(maximum, Math.max(minimum, value));
}
