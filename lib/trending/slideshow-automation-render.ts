import "server-only";

import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { getCarouselEditBackgrounds, listCarouselProductAssets } from "@/lib/carousel/db";
import { uploadRenderedCarouselSlide } from "@/lib/carousel/storage";
import type { GeneratedCarouselLibraryInput } from "@/lib/library/db";
import type { MediaAsset } from "@/lib/media/types";
import { loadSavedTrendingCreativeEditForDownstream } from "./creative-edit-service";
import { allocateCollectionOnlySlideBackgrounds, type TrendingSlideshowAutomationConfig } from "./slideshow-automation-contract";
import type { CarouselManualSlide } from "@/worker/src/lib/carousel-manual-text";

type Dependencies = {
  backgrounds: typeof getCarouselEditBackgrounds;
  productAssets: typeof listCarouselProductAssets;
  savedEdit: typeof loadSavedTrendingCreativeEditForDownstream;
  render: (input: { assetUrl: string; slide: CarouselManualSlide }) => Promise<{ buffer: Buffer }>;
  upload: typeof uploadRenderedCarouselSlide;
};

const defaults: Dependencies = {
  backgrounds: getCarouselEditBackgrounds,
  productAssets: listCarouselProductAssets,
  savedEdit: loadSavedTrendingCreativeEditForDownstream,
  render: async (input) => {
    const { renderCarouselManualSlide } = await import("@/worker/src/lib/carousel-manual-render");
    return renderCarouselManualSlide(input, { fontDirectory: resolve(process.cwd(), "worker/src/assets/fonts") });
  },
  upload: uploadRenderedCarouselSlide,
};

/** Render derived copies only. Never updates the original creative or its manual edit. */
export async function prepareAutomationLibraryInput(params: {
  source: GeneratedCarouselLibraryInput;
  config: TrendingSlideshowAutomationConfig;
  collectionAssets: readonly MediaAsset[];
  rotationCursor: number;
  idempotencyKey: string;
}, dependencies: Dependencies = defaults) {
  const { source, config } = params;
  const ordered = [...source.slides].sort((a, b) => a.slideNumber - b.slideNumber);
  if (!ordered.length || ordered.length !== source.generation.slideCount ||
      ordered.some((slide) => !slide.renderedUrl)) {
    throw new Error("Automation requires a complete ready slideshow.");
  }
  const sourceId = `automation:${createHash("sha256").update(params.idempotencyKey).digest("hex")}`;
  // Product screenshots belong to the source's business, never to an arbitrary
  // collection image. The existing query excludes archived/unready screenshots.
  const ctaSlide = source.generation.structureId === "structure_2"
    ? [...ordered].reverse().find((slide) => slide.storyRole === "takeaway_cta" || slide.storyRole === "proof_reflection_cta" || slide.slideType === "cta" ||
        (slide.slideNumber === source.generation.slideCount && Boolean(slide.ctaText?.trim())))
    : undefined;
  const screenshots = ctaSlide && source.generation.businessProfileId && source.generation.categorySlug
    ? await dependencies.productAssets({ businessProfileId: source.generation.businessProfileId, categorySlug: source.generation.categorySlug })
    : [];
  const screenshot = screenshots[0];
  const ctaScreenshotAssetId = screenshot?.id ?? null;
  const customized = config.backgrounds.mode === "collection_only" || config.visualStyle.mode === "saved";
  if (!customized && !screenshot) {
    return { input: { ...source, sourceId }, backgroundAssetIds: [] as string[], ctaScreenshotAssetId, nextRotationCursor: params.rotationCursor };
  }

  const allocation = config.backgrounds.mode === "collection_only"
    ? allocateCollectionOnlySlideBackgrounds({
        availableCollectionAssetIds: params.collectionAssets.map((asset) => asset.id),
        collectionName: config.backgrounds.collectionName,
        rotationCursor: params.rotationCursor,
        selectedAssetIds: config.backgrounds.selectedAssetIds,
        selectionMode: config.backgrounds.selectionMode,
        slideCount: ordered.length - (screenshot ? 1 : 0),
      })
    : null;
  if (allocation && !allocation.ok) throw new Error(allocation.holdMessage);
  const allocated = allocation?.ok ? allocation.AssignedAssetIds : [];
  let collectionIndex = 0;
  const assigned = allocation?.ok ? ordered.map((slide) => screenshot && slide === ctaSlide
    ? screenshot.id : allocated[collectionIndex++]!) : [];
  const collectionById = new Map(params.collectionAssets.map((asset) => [asset.id, asset]));
  const edit = source.edit ? await dependencies.savedEdit({
    creativeId: source.generation.id, format: "carousel", userId: source.userId,
  }) : null;
  if (source.edit && (!edit || edit.id !== source.edit.id || edit.revision !== source.edit.revision || edit.renderState !== "ready")) {
    throw new Error("The slideshow edit changed. Retry after its current render is ready.");
  }
  const editSlides = new Map(edit?.content.format === "carousel"
    ? edit.content.slides.map((slide) => [slide.slideNumber, slide]) : []);
  const backgrounds = config.backgrounds.mode === "default"
    ? await dependencies.backgrounds(ordered.flatMap((slide) => slide.categoryImageAssetId ? [slide.categoryImageAssetId] : []))
    : [];
  const backgroundById = new Map(backgrounds.map((asset) => [asset.id, asset.url]));
  // Resolve every raw background before rendering. A flattened slide is never a background fallback.
  const inputs = ordered.map((slide, index) => {
    const edited = editSlides.get(slide.slideNumber);
    if (!customized && slide !== ctaSlide) return null;
    const assetUrl = screenshot && slide === ctaSlide ? screenshot.url : config.backgrounds.mode === "collection_only"
      ? collectionById.get(assigned[index]!)?.url
      : edited?.backgroundUrl ?? backgroundById.get(slide.categoryImageAssetId ?? "");
    if (!assetUrl) throw new Error("An automation slide background is unavailable. No substitute will be used.");
    return { assetUrl, slide: {
      headline: slide.headline, subtext: slide.subtext ?? "", ctaText: slide.ctaText ?? "",
      slideNumber: slide.slideNumber, renderFormat: source.generation.format,
      textPosition: { ...config.visualStyle.textPosition },
      textStyle: { ...config.visualStyle.style },
      storyTextTreatment: slide.storyTextTreatment,
    } satisfies CarouselManualSlide };
  });
  const rendered = [];
  for (const [index, input] of inputs.entries()) {
    if (!input) { rendered.push(ordered[index]!); continue; }
    const result = await dependencies.render(input);
    const uploaded = await dependencies.upload({
      buffer: result.buffer, carouselId: source.generation.id,
      projectId: source.generation.projectId, userId: source.userId,
      format: source.generation.format, slideNumber: input.slide.slideNumber,
      rendererVersion: `automation-v2-${sourceId.slice(-24)}`,
    });
    rendered.push({ ...ordered[index]!, renderedUrl: uploaded.url, renderedS3Key: uploaded.key });
  }
  return {
    input: { ...source, sourceId, slides: rendered },
    backgroundAssetIds: assigned,
    ctaScreenshotAssetId,
    nextRotationCursor: allocation?.ok ? allocation.nextRotationCursor : params.rotationCursor,
  };
}
