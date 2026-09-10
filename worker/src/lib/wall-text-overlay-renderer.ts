import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { packageWallTextOverlay, wallTextOverlayInputHash, wallTextOverlayPngHash, type WallTextOverlayReference } from "./wall-text-overlay-asset.ts";
import { buildWallTextRenderLayout, buildWallTextOverlaySvg, getWallTextOutlineWidth, WALL_TEXT_INLINE_SAFE_PADDING, WALL_TEXT_OUTLINE_WIDTH, WALL_TEXT_RENDER_HEIGHT, WALL_TEXT_RENDER_WIDTH, type WallTextNormalizedBox, type WallTextPlacementZone, type WallTextRenderContent, type WallTextSafeArea } from "./wall-text-render-spec.ts";

export let wallTextFontRegistrationPromise: Promise<void> | null = null;

export type RenderWallTextVideoPayload = {
  overlayAsset?: WallTextOverlayReference;
  assignmentId: string;
  attribution: {
    contentHash: string;
    editClassification: "major" | "minor" | "none";
    formatId: string | null;
    formatLearningEligible: boolean;
    formatVersion: number;
    instagramReelTemplateId: string | null;
    selectionMode: string;
    selectionWeight: number;
    selectorVersion: string;
    sourceKind: "creative_asset" | "instagram_reel" | "ugcpilot";
  };
  audio: {
    assetDurationSeconds: number;
    assetId: string;
    audioUrl: string;
    cueStartSeconds: number;
    fadeOutSeconds: number;
    fitMode: "exact" | "trim" | "loop";
    matchingVersion: string;
    selectionId: string;
  };
  creativeEditId: string | null;
  creativeEditRevision: number | null;
  creativeId: string;
  durationSeconds: number;
  placement: WallTextPlacementZone;
  projectId: string;
  renderId: string;
  safeArea: WallTextSafeArea;
  sourceVideoUrl: string;
  text: WallTextRenderContent;
  textColor: string;
  textBox: WallTextNormalizedBox;
  title: string;
  userId: string;
};

export type WallTextOverlayInput = Pick<RenderWallTextVideoPayload,
  "text" | "textBox" | "placement" | "safeArea" | "textColor">;

export async function getWallTextOverlayIdentity(input: WallTextOverlayInput) {
  const font = await getWallTextFontForContent(input.text);
  // Font files are explicitly included by Next's outputFileTracingIncludes.
  // Do not let this indirect path make Turbopack trace the entire workspace.
  const fontHash = wallTextOverlayPngHash(await readFile(/* turbopackIgnore: true */ font.path));
  return { fontHash, inputHash: wallTextOverlayInputHash({ input, fontHash, runtime: sharp.versions }) };
}

export async function prepareWallTextOverlayAsset(input: WallTextOverlayInput) {
  await ensureWallTextFontsRegistered();
  assertWallTextTextBoxMatchesPayload(input.text, input.textBox);
  const content = await reflowWallTextContentForRenderer({
    content: input.text, textBox: input.textBox,
  });
  await validateWallTextRenderedLineWidths(content, input.textBox);
  const { fontHash, inputHash } = await getWallTextOverlayIdentity(input);
  const overlaySvg = buildWallTextOverlaySvg({
    content, placement: input.placement, safeArea: input.safeArea,
    textColor: input.textColor, textBox: input.textBox,
  });
  const png = await rasterizeWallTextOverlay({ overlaySvg, textBox: input.textBox });
  return { ...packageWallTextOverlay(png, inputHash), content, fontHash };
}

export function ensureWallTextFontsRegistered() {
  wallTextFontRegistrationPromise ??= registerWallTextFonts();
  return wallTextFontRegistrationPromise;
}

export async function registerWallTextFonts() {
  const fonts = await Promise.all([
    getWallTextFont({ family: "Inter" }),
    getWallTextFont({ family: "ArialBold" }),
    getWallTextFont({ family: "ArialRegular" }),
    getWallTextFont({ family: "AvenirNextDemiBold" }),
  ]);

  await Promise.all(
    fonts.map(async (font) => {
      const directText = await sharp({
        text: {
          dpi: 72,
          font: `${getPangoFontName(font)} 46`,
          fontfile: font.path,
          rgba: true,
          text: "Wall text 0123",
          wrap: "none",
        },
      }).metadata();

      if (!directText.width || !directText.height) {
        throw new Error(
          `${font.name} could not be registered for Wall-of-text rendering.`,
        );
      }
    }),
  );
}

export async function validateWallTextRenderedLineWidths(
  content: WallTextRenderContent,
  textBox: WallTextNormalizedBox,
) {
  const maximumWidth =
    Math.round(textBox.width * WALL_TEXT_RENDER_WIDTH) -
    WALL_TEXT_INLINE_SAFE_PADDING * 2;
  const layout = buildWallTextRenderLayout({ content, textBox });
  const font = await getWallTextFontForContent(content);

  for (const segment of layout.segments) {
    for (const line of segment.lines) {
      const metadata = await sharp({
        text: {
          dpi: 72,
          font: `${getPangoFontName(font)} ${segment.fontSize}`,
          fontfile: font.path,
          rgba: true,
          text: escapePangoMarkup(line),
          wrap: "none",
        },
      }).metadata();

      if (
        !metadata.width ||
        metadata.width + getWallTextOutlineWidth(content) * 2 >= maximumWidth
      ) {
        throw new Error(
          `Wall-of-text line exceeds the measured ${font.name} text width: "${line}"`,
        );
      }
    }
  }
}

export async function reflowWallTextContentForRenderer(params: {
  content: WallTextRenderContent;
  textBox: WallTextNormalizedBox;
}): Promise<WallTextRenderContent> {
  const { content, textBox } = params;

  if (
    !content.finalLayout ||
    content.finalLayout.version === "wall-text-final-layout-v9" ||
    content.finalLayout.version === "wall-text-final-layout-v8" ||
    content.finalLayout.version === "wall-text-final-layout-v3" ||
    content.finalLayout.version === "wall-text-final-layout-v4" ||
    content.finalLayout.version === "wall-text-final-layout-v5" ||
    content.finalLayout.version === "wall-text-final-layout-v6" ||
    content.finalLayout.version === "wall-text-final-layout-v7"
  ) {
    return content;
  }

  const maximumWidth =
    Math.round(textBox.width * WALL_TEXT_RENDER_WIDTH) -
    WALL_TEXT_INLINE_SAFE_PADDING * 2;
  const maximumHeight = Math.round(textBox.height * WALL_TEXT_RENDER_HEIGHT);
  const font = await getWallTextFontForContent(content);
  const fontSizes = getWallTextReflowFontSizes(content.finalLayout.fontSizePx);

  for (const fontSizePx of fontSizes) {
    const blocks = await Promise.all(
      content.finalLayout.blocks.map(async (block) => ({
        lines: await reflowWallTextBlockLines({
          font,
          fontSizePx,
          maximumWidth,
          text: block.lines.join(" "),
        }),
        role: block.role,
      })),
    );
    const lineCount = blocks.reduce((total, block) => total + block.lines.length, 0);

    if (
      ["wall-text-final-layout-v2", "wall-text-final-layout-v3", "wall-text-final-layout-v4", "wall-text-final-layout-v5", "wall-text-final-layout-v6", "wall-text-final-layout-v7", "wall-text-final-layout-v8", "wall-text-final-layout-v9"].includes(
        content.finalLayout.version,
      ) &&
      (lineCount < 4 || lineCount > 8)
    ) {
      continue;
    }

    const lineHeightPx = Math.round(fontSizePx * 1.1 * 100) / 100;
    const blockHeight =
      lineCount * lineHeightPx + Math.max(0, blocks.length - 1) * 18;

    if (blockHeight > maximumHeight) {
      continue;
    }

    const finalLayout = {
      ...content.finalLayout,
      blocks,
      fontSizePx,
      fontWeight: 400 as const,
      lineHeightPx,
    };

    return { ...content, finalLayout };
  }

  throw new Error(
    "Wall-of-text copy cannot fit the selected placement zone with the renderer font.",
  );
}

export function getWallTextReflowFontSizes(
  selectedFontSize: NonNullable<WallTextRenderContent["finalLayout"]>["fontSizePx"],
) {
  const supportedFontSizes = [52, 50, 48, 46, 44, 42, 40, 38, 36] as const;

  return supportedFontSizes.filter((fontSize) => fontSize <= selectedFontSize);
}

export async function reflowWallTextBlockLines(params: {
  font: WallTextRenderFont;
  fontSizePx: number;
  maximumWidth: number;
  text: string;
}) {
  const words = params.text.replace(/\s+/gu, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    const candidateWidth = await measureWallTextLineWidth({
      font: params.font,
      fontSizePx: params.fontSizePx,
      text: candidate,
    });

    if (candidateWidth + WALL_TEXT_OUTLINE_WIDTH * 2 < params.maximumWidth) {
      line = candidate;
      continue;
    }

    if (!line) {
      throw new Error(
        `Wall-of-text word exceeds the measured ${params.font.name} text width: "${word}"`,
      );
    }

    lines.push(line);
    line = word;
  }

  if (line) {
    lines.push(line);
  }

  return lines;
}

export async function measureWallTextLineWidth(params: {
  font: WallTextRenderFont;
  fontSizePx: number;
  text: string;
}) {
  const metadata = await sharp({
    text: {
      dpi: 72,
      font: `${getPangoFontName(params.font)} ${params.fontSizePx}`,
      fontfile: params.font.path,
      rgba: true,
      text: escapePangoMarkup(params.text),
      wrap: "none",
    },
  }).metadata();

  if (!metadata.width) {
    throw new Error(
      `${params.font.name} could not measure Wall-of-text copy for rendering.`,
    );
  }

  return metadata.width;
}

export function assertWallTextTextBoxMatchesPayload(
  content: WallTextRenderContent,
  payloadTextBox: WallTextNormalizedBox,
) {
  const savedTextBox = content.finalLayout?.textBox;

  if (!savedTextBox) {
    return;
  }

  const fields = ["height", "width", "x", "y"] as const;
  const matches = fields.every(
    (field) => Math.abs(savedTextBox[field] - payloadTextBox[field]) < 0.000001,
  );

  if (!matches) {
    throw new Error(
      "Wall-of-text final layout text box does not match the render payload.",
    );
  }
}

export type WallTextPixelBounds = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

export function assertWallTextOverlayPixelsInsideTextBox(params: {
  channels: number;
  height: number;
  pixels: Buffer;
  textBox: {
    height: number;
    left: number;
    top: number;
    width: number;
  };
  width: number;
}) {
  const bounds = getWallTextPixelBounds(params);

  if (!bounds) {
    throw new Error("Wall-of-text overlay did not draw any visible pixels.");
  }

  const innerLeft = params.textBox.left + WALL_TEXT_INLINE_SAFE_PADDING;
  const innerRight =
    params.textBox.left + params.textBox.width - WALL_TEXT_INLINE_SAFE_PADDING - 1;
  const innerTop = params.textBox.top;
  const innerBottom = params.textBox.top + params.textBox.height - 1;

  // The inner fence itself is not usable text space. A fully transparent
  // pixel remains between the visible outline/shadow and every fence edge.
  if (
    bounds.left <= innerLeft ||
    bounds.right >= innerRight ||
    bounds.top <= innerTop ||
    bounds.bottom >= innerBottom
  ) {
    throw new Error(
      "Wall-of-text overlay crosses the protected inner text fence.",
    );
  }

  return bounds;
}

export async function rasterizeWallTextOverlay(params: {
  overlaySvg: string;
  textBox: WallTextNormalizedBox;
}) {
  const raster = await sharp(Buffer.from(params.overlaySvg))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  assertWallTextOverlayPixelsInsideTextBox({
    channels: raster.info.channels,
    height: raster.info.height,
    pixels: raster.data,
    textBox: {
      height: Math.round(params.textBox.height * WALL_TEXT_RENDER_HEIGHT),
      left: Math.round(params.textBox.x * WALL_TEXT_RENDER_WIDTH),
      top: Math.round(params.textBox.y * WALL_TEXT_RENDER_HEIGHT),
      width: Math.round(params.textBox.width * WALL_TEXT_RENDER_WIDTH),
    },
    width: raster.info.width,
  });

  return sharp(raster.data, {
    raw: {
      channels: raster.info.channels,
      height: raster.info.height,
      width: raster.info.width,
    },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

export function getWallTextPixelBounds(params: {
  channels: number;
  height: number;
  pixels: Buffer;
  width: number;
}): WallTextPixelBounds | null {
  if (params.channels < 4) {
    throw new Error("Wall-of-text overlay must contain an alpha channel.");
  }

  let left = params.width;
  let right = -1;
  let top = params.height;
  let bottom = -1;

  for (let y = 0; y < params.height; y += 1) {
    for (let x = 0; x < params.width; x += 1) {
      const alphaOffset = (y * params.width + x) * params.channels + 3;
      if (params.pixels[alphaOffset] === 0) {
        continue;
      }

      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }

  return right < left || bottom < top ? null : { bottom, left, right, top };
}

export type WallTextRenderFont = {
  name:
    | "Avenir Next Demi Bold"
    | "Arial Bold"
    | "Arial Regular"
    | "Inter Regular";
  path: string;
};

export function getPangoFontName(font: WallTextRenderFont) {
  return font.name === "Avenir Next Demi Bold" ? "Avenir Next" : font.name;
}

export async function getWallTextFontForContent(content: WallTextRenderContent) {
  return getWallTextFont({
    family:
      content.finalLayout?.version === "wall-text-final-layout-v9" ||
      content.finalLayout?.version === "wall-text-final-layout-v8" ||
      content.finalLayout?.version === "wall-text-final-layout-v7" ||
      content.finalLayout?.version === "wall-text-final-layout-v6" ||
      content.finalLayout?.version === "wall-text-final-layout-v3"
        ? "ArialBold"
        : content.finalLayout?.version === "wall-text-final-layout-v4"
          ? "ArialRegular"
          : content.finalLayout?.version === "wall-text-final-layout-v5"
            ? "AvenirNextDemiBold"
          : "Inter",
  });
}

export async function getWallTextFont(params: {
  family: "AvenirNextDemiBold" | "ArialBold" | "ArialRegular" | "Inter";
}): Promise<WallTextRenderFont> {
  if (params.family !== "Inter") {
    const font = params.family === "AvenirNextDemiBold"
      ? {
          fileName: "avenir-next-demi-bold.ttf",
          name: "Avenir Next Demi Bold" as const,
        }
      : params.family === "ArialBold"
        ? { fileName: "arial-bold.ttf", name: "Arial Bold" as const }
        : { fileName: "arial-regular.ttf", name: "Arial Regular" as const };
    const candidatePaths = [
      join(/* turbopackIgnore: true */ process.cwd(), "assets", "fonts", font.fileName),
      join(/* turbopackIgnore: true */ process.cwd(), "src", "assets", "fonts", font.fileName),
      join(/* turbopackIgnore: true */ process.cwd(), "worker", "src", "assets", "fonts", font.fileName),
    ];

    for (const fontPath of candidatePaths) {
      try {
        await readFile(/* turbopackIgnore: true */ fontPath);
        return { name: font.name, path: fontPath };
      } catch {
        // Try the next packaged font path.
      }
    }

    throw new Error(
      `${font.name} is unavailable; refusing to render Wall-of-text with a fallback font.`,
    );
  }

  const fontParts = [
    "node_modules",
    "@fontsource",
    "inter",
    "files",
    "inter-latin-400-normal.woff2",
  ];
  const candidatePaths = [
    join(/* turbopackIgnore: true */ process.cwd(), "node_modules", "@fontsource", "inter", "files", "inter-latin-400-normal.woff2"),
    join(/* turbopackIgnore: true */ process.cwd(), "..", "node_modules", "@fontsource", "inter", "files", "inter-latin-400-normal.woff2"),
  ];

  for (const fontPath of candidatePaths) {
    try {
      await readFile(/* turbopackIgnore: true */ fontPath);
      return { name: "Inter Regular", path: fontPath };
    } catch {
      // Try the next packaged font path.
    }
  }

  throw new Error(
    "Inter Regular is unavailable; refusing to render with a fallback font.",
  );
}

export function escapePangoMarkup(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

