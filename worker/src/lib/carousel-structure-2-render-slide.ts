import sharp from "sharp";

import type { CarouselFormat } from "../types.js";
import type {
  CarouselStructure2RenderSpec,
} from "./carousel-structure-2-render-spec.js";
import {
  CAROUSEL_BODY_FONT_WEIGHT,
  CAROUSEL_COVER_FONT_WEIGHT,
  CAROUSEL_FONT_FAMILY,
} from "./carousel-cover-typography.js";
import { CAROUSEL_FIXED_FONT_SIZE, fitMeasuredText, measureHeadingSvgBackground, buildHeadingSvgText } from "./carousel-render-slide.js";
import { CAROUSEL_BODY_BLOCK_MAX_LINES, CAROUSEL_HEADING_FONT_SIZE, CAROUSEL_HEADING_MAX_LINES, CAROUSEL_TEXT_BLOCK_GAP, getCarouselBodyBlocks } from "./carousel-text-presentation.js";
import {
  CAROUSEL_STRUCTURE_2_SAFE_BOTTOM,
  CAROUSEL_STRUCTURE_2_SAFE_TOP,
  CAROUSEL_STRUCTURE_2_SAFE_X,
  getCarouselStructure2StoryFontSize,
  getCarouselStructure2StoryMaxLines,
} from "./carousel-structure-2-layout.js";

export const CAROUSEL_STRUCTURE_2_RENDERER_VERSION =
  "story-native-full-frame-product-inter-tight-v13";

const FORMAT_DIMENSIONS: Record<
  CarouselFormat,
  { height: number; width: number }
> = {
  "1:1": { height: 1080, width: 1080 },
  "4:5": { height: 1350, width: 1080 },
};
const FONT_FAMILY = CAROUSEL_FONT_FAMILY;
const DIRECT_TEXT_SIDE_BUFFER = 34;

type TextLayout = {
  blockHeight: number;
  fontSize: number;
  lineHeight: number;
  lines: string[];
  maximumLineWidth: number;
};

type Bounds = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type CarouselStructure2RenderDiagnostics = {
  bubbleShapeStrategy: "heading-white-svg-background" | "plain-white-text" | "plain-white-text-with-outline";
  bodyBlockCount?: number;
  bodyBlockLineCounts?: number[];
  headingBounds?: Bounds | null;
  ctaBounds: Bounds | null;
  ctaFontSize: number | null;
  ctaLineCount: number;
  layoutVariant: CarouselStructure2RenderSpec["layoutVariant"];
  rendererVersion: typeof CAROUSEL_STRUCTURE_2_RENDERER_VERSION;
  safeAreaContained: boolean;
  storyBounds: Bounds;
  storyFontSize: number;
  storyLineCount: number;
  textTreatment: CarouselStructure2RenderSpec["textTreatment"];
  visualRole: CarouselStructure2RenderSpec["visualRole"];
  whiteBackgroundGroupCount: number;
};

export type CarouselStructure2RenderedSlideResult = {
  buffer: Buffer;
  diagnostics: CarouselStructure2RenderDiagnostics;
};

export async function renderCarouselStructure2SlideWithDiagnostics(params: {
  assetUrl: string;
  format: CarouselFormat;
  spec: CarouselStructure2RenderSpec;
}) {
  const response = await fetch(params.assetUrl);

  if (!response.ok) {
    throw new Error(
      `Could not download Structure 2 image (${response.status} ${response.statusText}).`,
    );
  }

  return renderCarouselStructure2SlideFromBuffer({
    assetBuffer: Buffer.from(await response.arrayBuffer()),
    format: params.format,
    spec: params.spec,
  });
}

export async function renderCarouselStructure2SlideFromBuffer(params: {
  assetBuffer: Buffer;
  format: CarouselFormat;
  spec: CarouselStructure2RenderSpec;
}): Promise<CarouselStructure2RenderedSlideResult> {
  const dimensions = FORMAT_DIMENSIONS[params.format];
  const overlay = await buildCarouselStructure2Overlay({
    height: dimensions.height,
    spec: params.spec,
    width: dimensions.width,
  });
  const background = await buildStructure2Background({
    assetBuffer: params.assetBuffer,
    backgroundCrop: params.spec.backgroundCrop,
    height: dimensions.height,
    layoutVariant: params.spec.layoutVariant,
    width: dimensions.width,
  });
  const buffer = await sharp(background)
    .composite([{ input: overlay.svg, left: 0, top: 0 }])
    .webp({ effort: 5, quality: 92 })
    .toBuffer();

  return { buffer, diagnostics: overlay.diagnostics };
}

export async function inspectCarouselStructure2SlideLayout(params: {
  format: CarouselFormat;
  spec: CarouselStructure2RenderSpec;
}) {
  const dimensions = FORMAT_DIMENSIONS[params.format];
  return (await buildCarouselStructure2Overlay({
    height: dimensions.height,
    spec: params.spec,
    width: dimensions.width,
  })).diagnostics;
}

async function buildCarouselStructure2Overlay(params: {
  height: number;
  spec: CarouselStructure2RenderSpec;
  width: number;
}) {
  const maximumTextWidth = params.width - CAROUSEL_STRUCTURE_2_SAFE_X * 2;
  const maximumRenderableTextWidth =
    maximumTextWidth - DIRECT_TEXT_SIDE_BUFFER * 2;
  const isCover = params.spec.slideNumber === 1;
  const fit = async (value: string, fontSize: number, maximumLines: number): Promise<TextLayout & { measuredLineWidths: number[]; measuredLineExtents: { left: number; right: number; width: number }[] }> => {
    const layout = await fitMeasuredText(value, {
      fontSize, fontFamily: FONT_FAMILY, fontWeight: isCover ? CAROUSEL_COVER_FONT_WEIGHT : CAROUSEL_BODY_FONT_WEIGHT,
      getCornerSafety: () => 0, lineHeightRatio: fontSize === CAROUSEL_HEADING_FONT_SIZE ? 1.04 : isCover ? 0.98 : 1.16, maxLines: maximumLines,
      maxWidth: maximumRenderableTextWidth, paddingX: 0,
    });
    return { ...layout, blockHeight: layout.lines.length * layout.lineHeight, maximumLineWidth: Math.max(0, ...layout.measuredLineExtents.map((extent) => Math.max(extent.left, extent.right) * 2)) };
  };
  const values = isCover ? [params.spec.storyText] : getCarouselBodyBlocks(params.spec.storyText);
  if (!isCover && values.length > 2) throw new Error("Structure 2 body copy requires at most two text blocks.");
  const storyFontSize = isCover
    ? params.spec.coverFontSize ?? getCarouselStructure2StoryFontSize(1)
    : getCarouselStructure2StoryFontSize(params.spec.slideNumber);
  const stories = await Promise.all(values.map((value) => fit(value, storyFontSize, isCover || params.spec.headline === undefined ? getCarouselStructure2StoryMaxLines(params.spec.slideNumber) : CAROUSEL_BODY_BLOCK_MAX_LINES)));
  if (!stories.length) throw new Error("Structure 2 renderer cannot render empty story copy.");
  const story = stories[0]!;
  const heading = await fit(isCover ? "" : params.spec.headline ?? "", CAROUSEL_HEADING_FONT_SIZE, CAROUSEL_HEADING_MAX_LINES);
  const headingMetrics = measureHeadingSvgBackground(heading);
  const cta = await fit(isCover ? "" : params.spec.ctaText ?? "", CAROUSEL_FIXED_FONT_SIZE, CAROUSEL_BODY_BLOCK_MAX_LINES);
  const storyWidth = Math.max(...stories.map((block) => block.maximumLineWidth));
  const storyHeight = stories.reduce((height, block) => height + block.blockHeight, 0) + Math.max(0, stories.length - 1) * CAROUSEL_TEXT_BLOCK_GAP;
  const groupHeight = headingMetrics.groupHeight + (heading.lines.length ? CAROUSEL_TEXT_BLOCK_GAP : 0) + storyHeight + (cta.lines.length ? CAROUSEL_TEXT_BLOCK_GAP + cta.blockHeight : 0);
  if (groupHeight > params.height - CAROUSEL_STRUCTURE_2_SAFE_TOP - CAROUSEL_STRUCTURE_2_SAFE_BOTTOM) throw new Error("Structure 2 text groups do not fit the slide safe area.");
  const storyTop = resolveStoryTop({
    blockHeight: groupHeight,
    height: params.height,
    maximumBottom: params.height - CAROUSEL_STRUCTURE_2_SAFE_BOTTOM,
    position: params.spec.textPosition,
  });
  const storyLeft = Math.round((params.width - storyWidth) / 2);
  const storyBounds: Bounds = {
    height: storyHeight,
    width: storyWidth,
    x: storyLeft,
    y: storyTop + headingMetrics.groupHeight + (heading.lines.length ? CAROUSEL_TEXT_BLOCK_GAP : 0),
  };
  const headingBounds: Bounds | null = heading.lines.length ? { x: (params.width - headingMetrics.backgroundWidth) / 2, y: storyTop, width: headingMetrics.backgroundWidth, height: headingMetrics.groupHeight } : null;
  const ctaBounds: Bounds | null = cta.lines.length ? { x: (params.width - cta.maximumLineWidth) / 2, y: storyBounds.y + storyHeight + CAROUSEL_TEXT_BLOCK_GAP, width: cta.maximumLineWidth, height: cta.blockHeight } : null;
  const safeAreaContained = [headingBounds, storyBounds, ctaBounds]
    .filter((bounds): bounds is Bounds => bounds !== null)
    .every(
      (bounds) =>
        bounds.x >= CAROUSEL_STRUCTURE_2_SAFE_X &&
        bounds.x + bounds.width <= params.width - CAROUSEL_STRUCTURE_2_SAFE_X &&
        bounds.y >= CAROUSEL_STRUCTURE_2_SAFE_TOP &&
        bounds.y + bounds.height <=
          params.height - CAROUSEL_STRUCTURE_2_SAFE_BOTTOM,
    );

  if (!safeAreaContained) {
    throw new Error(
      `Structure 2 slide ${params.spec.slideNumber} text does not fit the safe area.`,
    );
  }

  const diagnostics: CarouselStructure2RenderDiagnostics = {
    bubbleShapeStrategy:
      heading.lines.length ? "heading-white-svg-background" : params.spec.slideNumber === 1
        ? "plain-white-text"
        : "plain-white-text-with-outline",
    ctaBounds,
    headingBounds,
    bodyBlockCount: stories.length,
    bodyBlockLineCounts: stories.map((block) => block.lines.length),
    ctaFontSize: cta.lines.length ? cta.fontSize : null,
    ctaLineCount: cta.lines.length,
    layoutVariant: params.spec.layoutVariant,
    rendererVersion: CAROUSEL_STRUCTURE_2_RENDERER_VERSION,
    safeAreaContained,
    storyBounds,
    storyFontSize: story.fontSize,
    storyLineCount: stories.reduce((count, block) => count + block.lines.length, 0),
    textTreatment: "overlay",
    visualRole: params.spec.visualRole,
    whiteBackgroundGroupCount: heading.lines.length ? 1 : 0,
  };
  let blockY = storyBounds.y;
  const storyMarkup = stories.map((block) => {
    const markup = buildPlainWhiteTextMarkup({
    bounds: { ...storyBounds, y: blockY, height: block.blockHeight },
    fontWeight:
      params.spec.slideNumber === 1
        ? CAROUSEL_COVER_FONT_WEIGHT
        : CAROUSEL_BODY_FONT_WEIGHT,
    layout: block,
    outlined: params.spec.slideNumber !== 1,
    });
    blockY += block.blockHeight + CAROUSEL_TEXT_BLOCK_GAP;
    return markup;
  }).join("");
  const headingMarkup = buildHeadingSvgText({ fontSize: heading.fontSize, lineHeight: heading.lineHeight, lines: heading.lines, metrics: headingMetrics, x: params.width / 2, y: storyTop });
  const ctaMarkup = ctaBounds ? buildPlainWhiteTextMarkup({ bounds: ctaBounds, layout: cta, fontWeight: CAROUSEL_BODY_FONT_WEIGHT, outlined: true }) : "";
  return {
    diagnostics,
    svg: Buffer.from(`
      <svg width="${params.width}" height="${params.height}" viewBox="0 0 ${params.width} ${params.height}" xmlns="http://www.w3.org/2000/svg">
        <style>.headline { fill: #111316; font-family: ${FONT_FAMILY}; font-weight: ${CAROUSEL_BODY_FONT_WEIGHT}; }</style>
        ${headingMarkup}${storyMarkup}${ctaMarkup}
      </svg>
    `),
  };
}

async function buildStructure2Background(params: {
  assetBuffer: Buffer;
  backgroundCrop?: "centre";
  height: number;
  layoutVariant: CarouselStructure2RenderSpec["layoutVariant"];
  width: number;
}) {
  // App screenshots fill the slide with a proportional centre crop. Keep the
  // attention crop for the existing normalized library backgrounds.
  return sharp(params.assetBuffer)
    .rotate()
    .resize(params.width, params.height, {
      fit: "cover",
      position: params.backgroundCrop === "centre" || params.layoutVariant === "story_product_reveal" ? "centre" : "attention",
    })
    .removeAlpha()
    .toBuffer();
}

function buildPlainWhiteTextMarkup(params: {
  bounds: Bounds;
  fontWeight: number;
  layout: TextLayout;
  outlined: boolean;
}) {
  const centerX = params.bounds.x + params.bounds.width / 2;
  const baselineStart =
    params.bounds.y + params.layout.fontSize * 0.78;
  const lines = params.layout.lines
    .map(
      (line, index) =>
        `<text x="${centerX}" y="${baselineStart + index * params.layout.lineHeight}" fill="#ffffff" font-family="${FONT_FAMILY}" font-size="${params.layout.fontSize}" font-weight="${params.fontWeight}" letter-spacing="-0.015em" ${params.outlined ? 'paint-order="stroke fill" stroke="#000000" stroke-linejoin="round" stroke-opacity="0.72" stroke-width="4"' : ""} text-anchor="middle">${escapeXml(line)}</text>`,
    )
    .join("");

  return lines;
}

function resolveStoryTop(params: {
  blockHeight: number;
  height: number;
  maximumBottom: number;
  position: CarouselStructure2RenderSpec["textPosition"];
}) {
  const availableBottom = Math.max(
    CAROUSEL_STRUCTURE_2_SAFE_TOP + params.blockHeight,
    params.maximumBottom,
  );
  const preferred =
    params.position === "upper"
      ? CAROUSEL_STRUCTURE_2_SAFE_TOP + 40
      : params.position === "center"
        ? Math.round((params.height - params.blockHeight) / 2)
        : availableBottom - params.blockHeight;

  return Math.max(
    CAROUSEL_STRUCTURE_2_SAFE_TOP,
    Math.min(preferred, availableBottom - params.blockHeight),
  );
}


function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
