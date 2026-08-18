import sharp from "sharp";

import type { CarouselFormat } from "../types.js";
import type {
  CarouselStructure2RenderSpec,
  CarouselStructure2TextTreatment,
} from "./carousel-structure-2-render-spec.js";

export const CAROUSEL_STRUCTURE_2_RENDERER_VERSION =
  "story-native-renderer-v1-three-layouts";

const FORMAT_DIMENSIONS: Record<
  CarouselFormat,
  { height: number; width: number }
> = {
  "1:1": { height: 1080, width: 1080 },
  "4:5": { height: 1350, width: 1080 },
};
const FONT_FAMILY = "Geist, Arial, Helvetica, sans-serif";
const SAFE_X = 72;
const SAFE_TOP = 84;
const SAFE_BOTTOM = 92;

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
  const maximumTextWidth = params.width - SAFE_X * 2;
  const isPill = params.spec.textTreatment === "pill";
  const storyHorizontalPadding = isPill ? 54 : 8;
  const storyVerticalPadding = isPill ? 34 : 0;
  const story = fitText({
    initialFontSize:
      params.spec.layoutVariant === "story_pill_overlay" ? 68 : 64,
    maximumFontSize: 72,
    maximumLines: 6,
    maximumWidth: maximumTextWidth - storyHorizontalPadding * 2,
    minimumFontSize: 40,
    value: params.spec.storyText,
  });
  const cta = params.spec.ctaText
    ? fitText({
        initialFontSize: 38,
        maximumFontSize: 40,
        maximumLines: 3,
        maximumWidth: maximumTextWidth - 72,
        minimumFontSize: 30,
        value: params.spec.ctaText,
      })
    : null;
  const storyWidth = Math.min(
    maximumTextWidth,
    story.maximumLineWidth + storyHorizontalPadding * 2,
  );
  const storyHeight = story.blockHeight + storyVerticalPadding * 2;
  const ctaHeight = cta ? cta.blockHeight + 36 : 0;
  const ctaBottom = params.height - SAFE_BOTTOM;
  const ctaTop = cta ? ctaBottom - ctaHeight : null;
  const maximumStoryBottom = ctaTop ? ctaTop - 46 : params.height - SAFE_BOTTOM;
  const storyTop = resolveStoryTop({
    blockHeight: storyHeight,
    height: params.height,
    maximumBottom: maximumStoryBottom,
    position: params.spec.textPosition,
  });
  const storyLeft = Math.round((params.width - storyWidth) / 2);
  const storyBounds: Bounds = {
    height: storyHeight,
    width: storyWidth,
    x: storyLeft,
    y: storyTop,
  };
  const ctaBounds: Bounds | null =
    cta && ctaTop !== null
      ? {
          height: ctaHeight,
          width: maximumTextWidth,
          x: SAFE_X,
          y: ctaTop,
        }
      : null;
  const safeAreaContained = [storyBounds, ctaBounds]
    .filter((bounds): bounds is Bounds => bounds !== null)
    .every(
      (bounds) =>
        bounds.x >= SAFE_X &&
        bounds.x + bounds.width <= params.width - SAFE_X &&
        bounds.y >= SAFE_TOP &&
        bounds.y + bounds.height <= params.height - SAFE_BOTTOM,
    );

  if (!safeAreaContained) {
    throw new Error(
      `Structure 2 slide ${params.spec.slideNumber} text does not fit the safe area.`,
    );
  }

  const diagnostics: CarouselStructure2RenderDiagnostics = {
    ctaBounds,
    ctaFontSize: cta?.fontSize ?? null,
    ctaLineCount: cta?.lines.length ?? 0,
    layoutVariant: params.spec.layoutVariant,
    rendererVersion: CAROUSEL_STRUCTURE_2_RENDERER_VERSION,
    safeAreaContained,
    storyBounds,
    storyFontSize: story.fontSize,
    storyLineCount: story.lines.length,
    textTreatment: params.spec.textTreatment,
    visualRole: params.spec.visualRole,
  };
  const gradient = buildReadabilityGradient({
    height: params.height,
    layoutVariant: params.spec.layoutVariant,
    position: params.spec.textPosition,
    width: params.width,
  });
  const storyMarkup = buildStoryTextMarkup({
    bounds: storyBounds,
    layout: story,
    treatment: params.spec.textTreatment,
  });
  const ctaMarkup =
    cta && ctaBounds ? buildCtaMarkup({ bounds: ctaBounds, layout: cta }) : "";

  return {
    diagnostics,
    svg: Buffer.from(`
      <svg width="${params.width}" height="${params.height}" viewBox="0 0 ${params.width} ${params.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="story-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#000000" flood-opacity="0.58" />
          </filter>
        </defs>
        ${gradient}
        ${storyMarkup}
        ${ctaMarkup}
      </svg>
    `),
  };
}

function buildReadabilityGradient(params: {
  height: number;
  layoutVariant: CarouselStructure2RenderSpec["layoutVariant"];
  position: CarouselStructure2RenderSpec["textPosition"];
  width: number;
}) {
  if (params.layoutVariant === "story_pill_overlay") {
    return `<rect width="${params.width}" height="${params.height}" fill="rgba(0,0,0,0.10)" />`;
  }

  if (params.layoutVariant === "story_product_reveal") {
    return `
      <defs>
        <linearGradient id="product-readability-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#000000" stop-opacity="0.68" />
          <stop offset="0.34" stop-color="#000000" stop-opacity="0.04" />
          <stop offset="0.7" stop-color="#000000" stop-opacity="0.06" />
          <stop offset="1" stop-color="#000000" stop-opacity="0.7" />
        </linearGradient>
      </defs>
      <rect width="${params.width}" height="${params.height}" fill="url(#product-readability-gradient)" />
      <rect x="42" y="54" width="${params.width - 84}" height="${params.height - 108}" rx="32" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="2" />
    `;
  }

  const topOpacity = params.position === "upper" ? 0.66 : 0.2;
  const bottomOpacity = params.position === "lower" ? 0.72 : 0.42;

  return `
    <defs>
      <linearGradient id="readability-gradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000000" stop-opacity="${topOpacity}" />
        <stop offset="0.48" stop-color="#000000" stop-opacity="0.04" />
        <stop offset="1" stop-color="#000000" stop-opacity="${bottomOpacity}" />
      </linearGradient>
    </defs>
    <rect width="${params.width}" height="${params.height}" fill="url(#readability-gradient)" />
  `;
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

function buildStoryTextMarkup(params: {
  bounds: Bounds;
  layout: TextLayout;
  treatment: CarouselStructure2TextTreatment;
}) {
  const isPill = params.treatment === "pill";
  const baselineStart =
    params.bounds.y +
    (isPill ? 34 : 0) +
    params.layout.fontSize * 0.86;
  const textFill = isPill ? "#141518" : "#ffffff";
  const stroke =
    params.treatment === "outlined_overlay"
      ? 'stroke="rgba(0,0,0,0.78)" stroke-width="8" paint-order="stroke fill"'
      : "";
  const filter = params.treatment === "overlay" ? 'filter="url(#story-shadow)"' : "";
  const pill = isPill
    ? `<rect x="${params.bounds.x}" y="${params.bounds.y}" width="${params.bounds.width}" height="${params.bounds.height}" rx="34" fill="rgba(255,255,255,0.94)" />`
    : "";
  const lines = params.layout.lines
    .map(
      (line, index) =>
        `<text x="${params.bounds.x + params.bounds.width / 2}" y="${baselineStart + index * params.layout.lineHeight}" fill="${textFill}" font-family="${FONT_FAMILY}" font-size="${params.layout.fontSize}" font-weight="720" letter-spacing="-1.1" text-anchor="middle" ${stroke} ${filter}>${escapeXml(line)}</text>`,
    )
    .join("");

  return `${pill}${lines}`;
}

function buildCtaMarkup(params: { bounds: Bounds; layout: TextLayout }) {
  const baselineStart = params.bounds.y + 18 + params.layout.fontSize * 0.86;
  const lines = params.layout.lines
    .map(
      (line, index) =>
        `<text x="${params.bounds.x + params.bounds.width / 2}" y="${baselineStart + index * params.layout.lineHeight}" fill="#ffffff" font-family="${FONT_FAMILY}" font-size="${params.layout.fontSize}" font-weight="650" letter-spacing="-0.4" text-anchor="middle">${escapeXml(line)}</text>`,
    )
    .join("");

  return `
    <rect x="${params.bounds.x}" y="${params.bounds.y}" width="${params.bounds.width}" height="${params.bounds.height}" rx="28" fill="rgba(10,11,13,0.72)" />
    ${lines}
  `;
}

function resolveStoryTop(params: {
  blockHeight: number;
  height: number;
  maximumBottom: number;
  position: CarouselStructure2RenderSpec["textPosition"];
}) {
  const availableBottom = Math.max(SAFE_TOP + params.blockHeight, params.maximumBottom);
  const preferred =
    params.position === "upper"
      ? SAFE_TOP + 40
      : params.position === "center"
        ? Math.round((params.height - params.blockHeight) / 2)
        : availableBottom - params.blockHeight;

  return Math.max(
    SAFE_TOP,
    Math.min(preferred, availableBottom - params.blockHeight),
  );
}

function fitText(params: {
  initialFontSize: number;
  maximumFontSize: number;
  maximumLines: number;
  maximumWidth: number;
  minimumFontSize: number;
  value: string;
}): TextLayout {
  const value = params.value.trim().replace(/\s+/g, " ");

  if (!value) {
    throw new Error("Structure 2 renderer cannot render empty story copy.");
  }

  for (
    let fontSize = Math.min(params.initialFontSize, params.maximumFontSize);
    fontSize >= params.minimumFontSize;
    fontSize -= 2
  ) {
    const lines = wrapWords(value, params.maximumWidth, fontSize);

    if (lines.length <= params.maximumLines) {
      const lineHeight = Math.round(fontSize * 1.16);
      return {
        blockHeight: lineHeight * lines.length,
        fontSize,
        lineHeight,
        lines,
        maximumLineWidth: Math.ceil(
          Math.max(...lines.map((line) => estimateTextWidth(line, fontSize))),
        ),
      };
    }
  }

  throw new Error(
    `Structure 2 copy exceeds ${params.maximumLines} lines at the minimum safe font size.`,
  );
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
