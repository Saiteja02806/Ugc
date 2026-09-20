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
import { CAROUSEL_FIXED_FONT_SIZE } from "./carousel-render-slide.js";
import {
  CAROUSEL_STRUCTURE_2_SAFE_BOTTOM,
  CAROUSEL_STRUCTURE_2_SAFE_TOP,
  CAROUSEL_STRUCTURE_2_SAFE_X,
  CAROUSEL_STRUCTURE_2_TEXT_GROUP_GAP,
  getCarouselStructure2StoryFontSize,
  getCarouselStructure2StoryMaxLines,
  getCarouselStructure2TextLineHeight,
} from "./carousel-structure-2-layout.js";

export const CAROUSEL_STRUCTURE_2_RENDERER_VERSION =
  "story-native-centered-inter-tight-no-gradient-v10";

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
  bubbleShapeStrategy: "plain-white-text" | "plain-white-text-with-outline";
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
  const overlay = buildCarouselStructure2Overlay({
    height: dimensions.height,
    spec: params.spec,
    width: dimensions.width,
  });
  const background = await buildStructure2Background({
    assetBuffer: params.assetBuffer,
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

export function inspectCarouselStructure2SlideLayout(params: {
  format: CarouselFormat;
  spec: CarouselStructure2RenderSpec;
}) {
  const dimensions = FORMAT_DIMENSIONS[params.format];
  return buildCarouselStructure2Overlay({
    height: dimensions.height,
    spec: params.spec,
    width: dimensions.width,
  }).diagnostics;
}

function buildCarouselStructure2Overlay(params: {
  height: number;
  spec: CarouselStructure2RenderSpec;
  width: number;
}) {
  const maximumTextWidth = params.width - CAROUSEL_STRUCTURE_2_SAFE_X * 2;
  const maximumRenderableTextWidth =
    maximumTextWidth - DIRECT_TEXT_SIDE_BUFFER * 2;
  const story = fitText({
    fontSize: getCarouselStructure2StoryFontSize(params.spec.slideNumber),
    maximumLines: getCarouselStructure2StoryMaxLines(params.spec.slideNumber),
    maximumWidth: maximumRenderableTextWidth,
    value: params.spec.storyText,
  });
  const storyWidth = story.maximumLineWidth;
  const storyHeight = story.blockHeight;
  const storyTop = resolveStoryTop({
    blockHeight: storyHeight,
    height: params.height,
    maximumBottom: params.height - CAROUSEL_STRUCTURE_2_SAFE_BOTTOM,
    position: params.spec.textPosition,
  });
  const storyLeft = Math.round((params.width - storyWidth) / 2);
  const storyBounds: Bounds = {
    height: storyHeight,
    width: storyWidth,
    x: storyLeft,
    y: storyTop,
  };
  const ctaBounds: Bounds | null = null;
  const safeAreaContained = [storyBounds, ctaBounds]
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
      params.spec.slideNumber === 1
        ? "plain-white-text"
        : "plain-white-text-with-outline",
    ctaBounds,
    ctaFontSize: null,
    ctaLineCount: 0,
    layoutVariant: params.spec.layoutVariant,
    rendererVersion: CAROUSEL_STRUCTURE_2_RENDERER_VERSION,
    safeAreaContained,
    storyBounds,
    storyFontSize: story.fontSize,
    storyLineCount: story.lines.length,
    textTreatment: "overlay",
    visualRole: params.spec.visualRole,
    whiteBackgroundGroupCount: 0,
  };
  const storyMarkup = buildPlainWhiteTextMarkup({
    bounds: storyBounds,
    fontWeight:
      params.spec.slideNumber === 1
        ? CAROUSEL_COVER_FONT_WEIGHT
        : CAROUSEL_BODY_FONT_WEIGHT,
    layout: story,
    outlined: params.spec.slideNumber !== 1,
  });
  return {
    diagnostics,
    svg: Buffer.from(`
      <svg width="${params.width}" height="${params.height}" viewBox="0 0 ${params.width} ${params.height}" xmlns="http://www.w3.org/2000/svg">
        ${storyMarkup}
      </svg>
    `),
  };
}

async function buildStructure2Background(params: {
  assetBuffer: Buffer;
  height: number;
  layoutVariant: CarouselStructure2RenderSpec["layoutVariant"];
  width: number;
}) {
  if (params.layoutVariant !== "story_product_reveal") {
    return sharp(params.assetBuffer)
      .rotate()
      .resize(params.width, params.height, {
        fit: "cover",
        position: "attention",
      })
      .removeAlpha()
      .toBuffer();
  }

  const softenedBackground = await sharp(params.assetBuffer)
    .rotate()
    .resize(params.width, params.height, { fit: "cover", position: "centre" })
    .blur(24)
    .modulate({ brightness: 0.54, saturation: 0.82 })
    .removeAlpha()
    .toBuffer();
  const contained = await sharp(params.assetBuffer)
    .rotate()
    .resize(params.width - 96, params.height - 150, {
      fit: "inside",
      withoutEnlargement: false,
    })
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });

  return sharp(softenedBackground)
    .composite([
      {
        input: contained.data,
        left: Math.round((params.width - contained.info.width) / 2),
        top: Math.round((params.height - contained.info.height) / 2),
      },
    ])
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

function fitText(params: {
  fontSize?: number;
  maximumLines: number;
  maximumWidth: number;
  value: string;
}): TextLayout {
  const value = params.value.trim().replace(/\s+/g, " ");

  if (!value) {
    throw new Error("Structure 2 renderer cannot render empty story copy.");
  }

  const fontSize = params.fontSize ?? CAROUSEL_FIXED_FONT_SIZE;
  const lines = wrapWords(value, params.maximumWidth, fontSize);

  if (lines.length > params.maximumLines) {
    throw new Error(
      `Structure 2 copy exceeds ${params.maximumLines} lines at the fixed ${fontSize}px font size.`,
    );
  }
  const lineHeight = getCarouselStructure2TextLineHeight(fontSize);
  const maximumLineWidth = Math.ceil(
    Math.max(...lines.map((line) => estimateTextWidth(line, fontSize))),
  );

  return {
    blockHeight: lines.length * lineHeight,
    fontSize,
    lineHeight,
    lines,
    maximumLineWidth,
  };
}

function wrapWords(value: string, maximumWidth: number, fontSize: number) {
  const words = value.split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (estimateTextWidth(word, fontSize) > maximumWidth) {
      throw new Error(`Structure 2 copy contains an unrenderable word: ${word}.`);
    }

    const candidate = current ? `${current} ${word}` : word;

    if (estimateTextWidth(candidate, fontSize) <= maximumWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function estimateTextWidth(value: string, fontSize: number) {
  return Array.from(value).reduce((width, character) => {
    if (character === " ") return width + fontSize * 0.29;
    if (/[A-Z0-9]/.test(character)) return width + fontSize * 0.61;
    if (/[il.,'|:;]/.test(character)) return width + fontSize * 0.27;
    if (/[mwMW@%]/.test(character)) return width + fontSize * 0.8;
    return width + fontSize * 0.52;
  }, 0);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
