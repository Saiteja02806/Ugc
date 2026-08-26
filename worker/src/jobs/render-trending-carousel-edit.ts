import { getErrorMessage, logger } from "../logger.js";
import {
  CAROUSEL_RENDERER_VERSION,
  renderCarouselSlideWithDiagnostics as defaultRenderCarouselSlide,
  type CarouselNormalizedTextPosition,
} from "../lib/carousel-render-slide.js";
import { getCarouselRenderStyle } from "../lib/carousel-render-style.js";
import {
  CAROUSEL_STRUCTURE_2_RENDERER_VERSION,
  renderCarouselStructure2SlideWithDiagnostics as defaultRenderCarouselStructure2Slide,
} from "../lib/carousel-structure-2-render-slide.js";
import type { CarouselStructure2RenderSpec } from "../lib/carousel-structure-2-render-spec.js";
import { isCarouselStructure2FormatId } from "../lib/carousel-structure-2-formats.js";
import { uploadRenderedCarouselSlide as defaultUploadRenderedCarouselSlide } from "../lib/carousel-storage.js";
import type { PlannedCarouselSlide } from "../lib/carousel-slide-plan.js";
import type { SupabaseJobStore } from "../lib/supabase.js";
import type {
  BackgroundJobRow,
  CarouselSlideRow,
  Json,
  TrendingCreativeEditRow,
} from "../types.js";
import type { WorkerJobOutput } from "./index.js";

const TRENDING_CAROUSEL_EDIT_RENDERER_VERSION =
  `${CAROUSEL_RENDERER_VERSION}-normalized-edit-v1`;
const TRENDING_CAROUSEL_STRUCTURE_2_EDIT_RENDERER_VERSION =
  `${CAROUSEL_STRUCTURE_2_RENDERER_VERSION}-normalized-edit-v1`;

type TrendingCarouselEditJobInput = {
  carouselId: string;
  editId: string;
  revision: number;
  userId: string;
};

type EditableCarouselSlide = {
  backgroundAssetId: string | null;
  backgroundUrl: string;
  ctaText: string;
  headline: string;
  slideId: string;
  slideNumber: number;
  subtext: string;
  textPosition: CarouselNormalizedTextPosition;
  visualRole: "hook" | "human" | "product_asset" | "static" | null;
};

type RenderTrendingCarouselEditDependencies = {
  renderCarouselSlide: typeof defaultRenderCarouselSlide;
  renderCarouselStructure2Slide: typeof defaultRenderCarouselStructure2Slide;
  uploadRenderedCarouselSlide: typeof defaultUploadRenderedCarouselSlide;
};

const defaultDependencies: RenderTrendingCarouselEditDependencies = {
  renderCarouselSlide: defaultRenderCarouselSlide,
  renderCarouselStructure2Slide: defaultRenderCarouselStructure2Slide,
  uploadRenderedCarouselSlide: defaultUploadRenderedCarouselSlide,
};

export async function runRenderTrendingCarouselEditJob(
  job: BackgroundJobRow,
  context: {
    checkpoint: (params: {
      progress?: number | null;
      stage: string;
      status: "processing" | "rendering" | "uploading_output" | "waiting_external_service";
    }) => Promise<void>;
    dependencies?: Partial<RenderTrendingCarouselEditDependencies>;
    store: SupabaseJobStore;
  },
): Promise<WorkerJobOutput> {
  const input = parseInput(job.input_json);
  const dependencies = { ...defaultDependencies, ...context.dependencies };

  try {
    const [edit, generation, originalSlides] = await Promise.all([
      context.store.getTrendingCarouselEdit({
        editId: input.editId,
        revision: input.revision,
        userId: input.userId,
      }),
      context.store.getCarouselGeneration(input.carouselId),
      context.store.listCarouselSlides(input.carouselId),
    ]);

    if (!edit || edit.creative_id !== input.carouselId) {
      throw new Error("Trending Carousel edit is no longer current.");
    }

    if (edit.render_job_id !== job.id) {
      throw new Error("Trending Carousel edit render job is stale.");
    }

    const completedOutput = getCompletedOutput(edit);

    if (completedOutput) {
      return completedOutput;
    }

    if (
      !generation ||
      generation.user_id !== input.userId ||
      generation.status !== "completed"
    ) {
      throw new Error("The source Carousel is not available for this edit.");
    }

    const originalGenerationJob = generation.trigger_run_id
      ? await context.store.getJobById(generation.trigger_run_id)
      : null;
    const originalTextStyle = getCarouselRenderStyle(
      getOriginalCarouselTextStyle(originalGenerationJob),
    );

    const editedSlides = parseEditedSlides(edit);
    const orderedOriginalSlides = [...originalSlides].sort(
      (first, second) => first.slide_number - second.slide_number,
    );

    if (
      editedSlides.length !== generation.slide_count ||
      orderedOriginalSlides.length !== generation.slide_count
    ) {
      throw new Error("The Carousel edit does not contain every source slide.");
    }

    await context.store.markTrendingCarouselEditRendering({
      editId: input.editId,
      jobId: job.id,
      revision: input.revision,
      userId: input.userId,
    });
    await context.checkpoint({
      progress: 5,
      stage: "loading_carousel_edit",
      status: "rendering",
    });

    const plannedSlides = parseNormalizedPlanSlides(
      generation.content_plan_normalized,
    );
    const plannedSlideByNumber = new Map(
      plannedSlides.map((slide) => [slide.slideNumber, slide]),
    );
    const originalSlideByNumber = new Map(
      orderedOriginalSlides.map((slide) => [slide.slide_number, slide]),
    );
    const renderedSlides: Array<{
      renderedS3Key: string;
      renderedUrl: string;
      slideNumber: number;
    }> = [];

    for (const [index, editedSlide] of editedSlides.entries()) {
      const originalSlide = originalSlideByNumber.get(editedSlide.slideNumber);

      if (!originalSlide || originalSlide.id !== editedSlide.slideId) {
        throw new Error(
          `Carousel slide ${editedSlide.slideNumber} changed before rendering.`,
        );
      }

      if (!originalSlide.category_image_asset_id) {
        throw new Error(
          `Carousel slide ${editedSlide.slideNumber} has no editable source background.`,
        );
      }

      const rendered =
        generation.structure_id === "structure_2"
          ? await dependencies.renderCarouselStructure2Slide({
              assetUrl: editedSlide.backgroundUrl,
              format: generation.format,
              spec: createStructure2EditRenderSpec(originalSlide, editedSlide),
            })
          : await dependencies.renderCarouselSlide({
              assetUrl: editedSlide.backgroundUrl,
              format: generation.format,
              normalizedTextPosition: editedSlide.textPosition,
              slide: applyEditToPlannedSlide(
                plannedSlideByNumber.get(editedSlide.slideNumber) ??
                  createFallbackPlannedSlide(originalSlide),
                editedSlide,
              ),
              textStyle: originalTextStyle,
            });
      const progressAfterRender = 10 + Math.round(((index + 1) / editedSlides.length) * 70);

      await context.checkpoint({
        progress: progressAfterRender,
        stage: `rendered_slide_${editedSlide.slideNumber}`,
        status: "rendering",
      });

      const uploaded = await dependencies.uploadRenderedCarouselSlide({
        buffer: rendered.buffer,
        carouselId: `${input.editId}-revision-${input.revision}`,
        format: generation.format,
        projectId: "trending-carousel-edit",
        rendererVersion:
          generation.structure_id === "structure_2"
            ? TRENDING_CAROUSEL_STRUCTURE_2_EDIT_RENDERER_VERSION
            : TRENDING_CAROUSEL_EDIT_RENDERER_VERSION,
        slideNumber: editedSlide.slideNumber,
        userId: input.userId,
      });

      renderedSlides.push({
        renderedS3Key: uploaded.key,
        renderedUrl: uploaded.url,
        slideNumber: editedSlide.slideNumber,
      });
      logger.info("Trending Carousel edit slide rendered", {
        diagnostics: rendered.diagnostics,
        editId: input.editId,
        jobId: job.id,
        revision: input.revision,
        slideNumber: editedSlide.slideNumber,
      });
    }

    await context.checkpoint({
      progress: 95,
      stage: "persisting_carousel_edit",
      status: "uploading_output",
    });

    const renderOutput = {
      rendererVersion:
        generation.structure_id === "structure_2"
          ? TRENDING_CAROUSEL_STRUCTURE_2_EDIT_RENDERER_VERSION
          : TRENDING_CAROUSEL_EDIT_RENDERER_VERSION,
      slides: renderedSlides,
    } satisfies Record<string, Json>;

    await context.store.markTrendingCarouselEditReady({
      editId: input.editId,
      jobId: job.id,
      output: renderOutput,
      revision: input.revision,
      userId: input.userId,
    });

    return {
      carouselId: input.carouselId,
      editId: input.editId,
      ok: true,
      renderedSlideCount: renderedSlides.length,
      revision: input.revision,
      slideUrls: renderedSlides.map((slide) => slide.renderedUrl),
    };
  } catch (error) {
    await reconcileTrendingCarouselEditJobFailure(
      job,
      context.store,
      getErrorMessage(error),
    );
    throw error;
  }
}

export async function reconcileTrendingCarouselEditJobFailure(
  job: BackgroundJobRow,
  store: SupabaseJobStore,
  errorMessage: string,
) {
  if (job.job_type !== "render_trending_carousel_edit") {
    return;
  }

  const input = tryParseInput(job.input_json);

  if (!input) {
    logger.error("Could not identify Trending Carousel edit for reconciliation", {
      jobId: job.id,
    });
    return;
  }

  try {
    await store.markTrendingCarouselEditFailed({
      editId: input.editId,
      errorMessage,
      jobId: job.id,
      revision: input.revision,
      userId: input.userId,
    });
  } catch (persistenceError) {
    logger.error("Could not persist Trending Carousel edit render failure", {
      editId: input.editId,
      error: getErrorMessage(persistenceError),
      jobId: job.id,
      revision: input.revision,
    });
  }
}

function parseInput(value: Json): TrendingCarouselEditJobInput {
  const input = getRecord(value, "input_json");
  const revision = input.revision;

  if (
    typeof revision !== "number" ||
    !Number.isInteger(revision) ||
    revision < 1
  ) {
    throw new Error("render_trending_carousel_edit requires a positive revision.");
  }

  return {
    carouselId: getRequiredString(input.carouselId, "carouselId"),
    editId: getRequiredString(input.editId, "editId"),
    revision,
    userId: getRequiredString(input.userId, "userId"),
  };
}

function tryParseInput(value: Json) {
  try {
    return parseInput(value);
  } catch {
    return null;
  }
}

function parseEditedSlides(edit: TrendingCreativeEditRow): EditableCarouselSlide[] {
  const content = getRecord(edit.content_json, "content_json");

  if (content.format !== "carousel" || !Array.isArray(content.slides)) {
    throw new Error("Trending Carousel edit content is invalid.");
  }

  return content.slides
    .map((value, index) => {
      const slide = getRecord(value, `content_json.slides[${index}]`);
      const textPosition = getRecord(
        slide.textPosition,
        `content_json.slides[${index}].textPosition`,
      );

      return {
        backgroundAssetId:
          typeof slide.backgroundAssetId === "string" &&
          slide.backgroundAssetId.trim()
            ? slide.backgroundAssetId.trim()
            : null,
        backgroundUrl: getHttpUrl(slide.backgroundUrl, "backgroundUrl"),
        ctaText: getOptionalString(slide.ctaText, 120),
        headline: getRequiredString(slide.headline, "headline").slice(0, 180),
        slideId: getRequiredString(slide.slideId, "slideId"),
        slideNumber: getPositiveInteger(slide.slideNumber, "slideNumber", 20),
        subtext: getOptionalString(slide.subtext, 360),
        textPosition: {
          x: getUnitNumber(textPosition.x, "textPosition.x"),
          y: getUnitNumber(textPosition.y, "textPosition.y"),
        },
        visualRole: getNullableChoice(
          slide.visualRole,
          ["hook", "human", "product_asset", "static"] as const,
        ),
      };
    })
    .sort((first, second) => first.slideNumber - second.slideNumber);
}

function parseNormalizedPlanSlides(value: Json | null): PlannedCarouselSlide[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  const slides = value.slides;

  if (!Array.isArray(slides)) {
    return [];
  }

  return slides.flatMap((entry) => {
    try {
      return [parsePlannedSlide(entry)];
    } catch {
      return [];
    }
  });
}

function parsePlannedSlide(value: Json): PlannedCarouselSlide {
  const slide = getRecord(value, "planned slide");
  const layoutPreset = getChoice(
    slide.layoutPreset,
    [
      "bottom-message",
      "caption-cluster",
      "interactive-list",
      "middle-statement",
      "top-hook",
    ] as const,
    "middle-statement",
  );
  const slideType = getChoice(
    slide.slideType,
    ["benefit", "cta", "differentiator", "hook", "problem", "solution"] as const,
    "solution",
  );
  const textMode = getChoice(
    slide.textMode,
    [
      "body_only",
      "checklist",
      "cta_takeaway",
      "headline_body",
      "question_list",
      "single_statement",
    ] as const,
    "headline_body",
  );
  const textPosition = getChoice(
    slide.textPosition,
    ["bottom", "center", "top"] as const,
    "center",
  );

  return {
    body: getNullableString(slide.body, 360),
    ctaText: getNullableString(slide.ctaText, 120),
    headline: getNullableString(slide.headline, 180),
    imageDirection: getOptionalString(slide.imageDirection, 500),
    layoutPreset,
    listItems: Array.isArray(slide.listItems)
      ? slide.listItems.flatMap((item) =>
          typeof item === "string" && item.trim() ? [item.trim().slice(0, 180)] : [],
        )
      : [],
    slideNumber: getPositiveInteger(slide.slideNumber, "slideNumber", 20),
    slideType,
    subtext: getNullableString(slide.subtext, 360),
    textMode,
    textPosition,
  };
}

function createFallbackPlannedSlide(slide: CarouselSlideRow): PlannedCarouselSlide {
  const hasSupport = Boolean(slide.subtext?.trim());

  return {
    body: slide.subtext,
    ctaText: slide.cta_text,
    headline: slide.headline,
    imageDirection: slide.image_direction ?? "",
    layoutPreset: getChoice(
      slide.layout_preset,
      [
        "bottom-message",
        "caption-cluster",
        "interactive-list",
        "middle-statement",
        "top-hook",
      ] as const,
      "middle-statement",
    ),
    listItems: [],
    slideNumber: slide.slide_number,
    slideType: getChoice(
      slide.slide_type,
      ["benefit", "cta", "differentiator", "hook", "problem", "solution"] as const,
      "solution",
    ),
    subtext: slide.subtext,
    textMode: slide.cta_text
      ? "cta_takeaway"
      : hasSupport
        ? "headline_body"
        : "single_statement",
    textPosition: getChoice(
      slide.text_position,
      ["bottom", "center", "top"] as const,
      "center",
    ),
  };
}

function applyEditToPlannedSlide(
  original: PlannedCarouselSlide,
  edited: EditableCarouselSlide,
): PlannedCarouselSlide {
  const isBodyOnly =
    original.textMode === "body_only" || original.textMode === "single_statement";

  return {
    ...original,
    body: isBodyOnly ? edited.headline : edited.subtext || null,
    ctaText: edited.ctaText || null,
    headline: isBodyOnly ? null : edited.headline,
    listItems:
      original.textMode === "checklist" || original.textMode === "question_list"
        ? original.listItems
        : [],
    slideNumber: edited.slideNumber,
    subtext: edited.subtext || null,
    textPosition:
      edited.textPosition.y < 0.42
        ? "top"
        : edited.textPosition.y > 0.58
          ? "bottom"
          : "center",
  };
}

function createStructure2EditRenderSpec(
  original: CarouselSlideRow,
  edited: EditableCarouselSlide,
): CarouselStructure2RenderSpec {
  if (!isCarouselStructure2FormatId(original.story_format_id)) {
    throw new Error(
      `Structure 2 slide ${original.slide_number} has no canonical story format id.`,
    );
  }

  const storyRole = getChoice(
    original.story_role,
    [
      "failure_scene",
      "product_turning_point",
      "proof_reflection_cta",
      "recognition",
      "reframe",
    ] as const,
    "recognition",
  );
  const visualRole =
    edited.visualRole ??
    getChoice(
      original.visual_role,
      ["hook", "human", "product_asset", "static"] as const,
      "static",
    );
  const isProduct = visualRole === "product_asset";

  return {
    assetId:
      edited.backgroundAssetId ??
      getRequiredString(original.category_image_asset_id, "category_image_asset_id"),
    assetUrl: edited.backgroundUrl,
    ctaText: edited.ctaText || null,
    layoutVariant: isProduct
      ? "story_product_reveal"
      : getChoice(
          original.story_layout_variant,
          [
            "story_overlay_only",
            "story_pill_overlay",
            "story_product_reveal",
          ] as const,
          "story_overlay_only",
        ),
    productVisualEligibility: getChoice(
      original.product_visual_eligibility,
      ["allowed", "forbidden", "preferred"] as const,
      "forbidden",
    ),
    slideNumber: edited.slideNumber,
    storyFormatId: original.story_format_id,
    storyRole,
    storyText: edited.subtext
      ? `${edited.headline} ${edited.subtext}`
      : edited.headline,
    textPosition:
      edited.textPosition.y < 0.42
        ? "upper"
        : edited.textPosition.y > 0.58
          ? "lower"
          : "center",
    textTreatment: "overlay",
    visualContext: original.image_direction ?? "",
    visualRole,
  };
}

function getCompletedOutput(edit: TrendingCreativeEditRow): WorkerJobOutput | null {
  if (edit.render_status !== "ready") {
    return null;
  }

  const output = getRecord(edit.render_output_json, "render_output_json");

  if (!Array.isArray(output.slides)) {
    throw new Error("Completed Trending Carousel edit output is invalid.");
  }

  const slideUrls = output.slides.map((entry, index) => {
    const slide = getRecord(entry, `render_output_json.slides[${index}]`);
    return getHttpUrl(slide.renderedUrl, "renderedUrl");
  });

  return {
    carouselId: edit.creative_id,
    editId: edit.id,
    ok: true,
    renderedSlideCount: slideUrls.length,
    revision: edit.revision,
    slideUrls,
  };
}

function getOriginalCarouselTextStyle(job: BackgroundJobRow | null) {
  if (
    !job ||
    job.job_type !== "generate_carousel" ||
    !job.input_json ||
    typeof job.input_json !== "object" ||
    Array.isArray(job.input_json)
  ) {
    return undefined;
  }

  return job.input_json.textStyle;
}

function getRecord(
  value: Json | undefined,
  fieldName: string,
): Record<string, Json | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object.`);
  }

  return value;
}

function getRequiredString(value: Json | undefined, fieldName: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

function getOptionalString(value: Json | undefined, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function getNullableString(value: Json | undefined, maximum: number) {
  const normalized = getOptionalString(value, maximum);
  return normalized || null;
}

function getPositiveInteger(value: Json | undefined, fieldName: string, maximum: number) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > maximum
  ) {
    throw new Error(`${fieldName} must be an integer between 1 and ${maximum}.`);
  }

  return value;
}

function getUnitNumber(value: Json | undefined, fieldName: string) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) {
    throw new Error(`${fieldName} must be between 0 and 1.`);
  }

  return value;
}

function getHttpUrl(value: Json | undefined, fieldName: string) {
  const rawValue = getRequiredString(value, fieldName);

  try {
    const url = new URL(rawValue);

    if (!url.protocol.match(/^https?:$/u)) {
      throw new Error();
    }

    return url.toString();
  } catch {
    throw new Error(`${fieldName} must be a valid HTTP URL.`);
  }
}

function getChoice<const TValue extends readonly string[]>(
  value: Json | undefined,
  choices: TValue,
  fallback: TValue[number],
): TValue[number] {
  return typeof value === "string" && choices.includes(value)
    ? (value as TValue[number])
    : fallback;
}

function getNullableChoice<const TValue extends readonly string[]>(
  value: Json | undefined,
  choices: TValue,
): TValue[number] | null {
  return typeof value === "string" && choices.includes(value)
    ? (value as TValue[number])
    : null;
}
