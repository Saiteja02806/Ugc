import { resolveTextColor } from "./edit-overlay-render-spec.js";

export type WallTextSafeArea = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

export type WallTextNormalizedBox = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type WallTextSegmentRole = "lead" | "support" | "closing";
export type WallTextPlacementZone =
  | "upper-middle"
  | "middle"
  | "lower-middle";

export type WallTextSegment = {
  lines: string[];
  role: WallTextSegmentRole;
};

export type WallTextRenderContent = {
  finalLayout?: {
    blocks: Array<{
      lines: string[];
      role: "prose" | "text" | "title" | "item";
    }>;
    fontFamily: "Inter";
    fontSizePx: 44 | 46 | 48 | 50 | 52;
    fontWeight: 700;
    lineHeightPx: number;
    textBox: WallTextNormalizedBox;
    version: "wall-text-final-layout-v1" | "wall-text-final-layout-v2";
  };
  fullText: string;
  renderFontSize?: 44 | 46 | 48 | 50 | 52;
  segments: WallTextSegment[];
};

export type WallTextRenderLayout = {
  blockHeight: number;
  canvasHeight: number;
  canvasWidth: number;
  segments: Array<{
    centerX: number;
    fontSize: number;
    fontWeight: 700;
    lineHeight: number;
    lines: string[];
    top: number;
  }>;
  textBox: {
    height: number;
    left: number;
    top: number;
    width: number;
  };
};

export const WALL_TEXT_RENDER_WIDTH = 1080;
export const WALL_TEXT_RENDER_HEIGHT = 1920;
export const WALL_TEXT_RENDER_MAX_CHARACTERS = 600;
export const WALL_TEXT_RENDER_MIN_LINES = 4;
export const WALL_TEXT_RENDER_MAX_LINES = 7;
export const WALL_TEXT_DEFAULT_FONT_SIZE = 48;
export const WALL_TEXT_MINIMUM_FONT_SIZE = 44;
export const WALL_TEXT_MAXIMUM_FONT_SIZE = 52;
export const WALL_TEXT_LINE_HEIGHT_FACTOR = 52 / 48;
export const WALL_TEXT_SECTION_GAP = 18;
export const WALL_TEXT_OUTLINE_WIDTH = 4;
export const WALL_TEXT_DEFAULT_SAFE_AREA: WallTextSafeArea = {
  bottom: 460 / 1920,
  left: 120 / 1080,
  right: 200 / 1080,
  top: 280 / 1920,
};
export const WALL_TEXT_DEFAULT_TEXT_BOX: WallTextNormalizedBox = {
  height: 480 / 1920,
  width: 660 / 1080,
  x: 210 / 1080,
  y: 660 / 1920,
};

export function buildWallTextRenderLayout(params: {
  content: WallTextRenderContent;
  safeArea?: WallTextSafeArea;
  textBox?: WallTextNormalizedBox;
}): WallTextRenderLayout {
  const content = normalizeWallTextContent(params.content);
  const safeArea = normalizeSafeArea(params.safeArea);
  const textBox = normalizeTextBox(
    content.finalLayout?.textBox ?? params.textBox ?? WALL_TEXT_DEFAULT_TEXT_BOX,
    safeArea,
  );
  const pixelTextBox = {
    height: Math.round(textBox.height * WALL_TEXT_RENDER_HEIGHT),
    left: Math.round(textBox.x * WALL_TEXT_RENDER_WIDTH),
    top: Math.round(textBox.y * WALL_TEXT_RENDER_HEIGHT),
    width: Math.round(textBox.width * WALL_TEXT_RENDER_WIDTH),
  };
  const renderBlocks = content.finalLayout?.blocks ?? content.segments;
  const totalLineCount = renderBlocks.reduce(
    (total, segment) => total + segment.lines.length,
    0,
  );

  if (
    !content.finalLayout &&
    (totalLineCount < WALL_TEXT_RENDER_MIN_LINES ||
      totalLineCount > WALL_TEXT_RENDER_MAX_LINES)
  ) {
    throw new Error("Wall-of-text must contain 4–7 rendered lines.");
  }

  const fontSize = content.finalLayout?.fontSizePx ??
    getWallTextFontSize(content, totalLineCount);
  const segmentMetrics = renderBlocks.map((segment) => {
    return {
      fontSize,
      fontWeight: 700 as const,
      lineHeight:
        content.finalLayout?.lineHeightPx ??
        fontSize * WALL_TEXT_LINE_HEIGHT_FACTOR,
      lines: segment.lines,
    };
  });
  const blockHeight = segmentMetrics.reduce(
    (height, segment, index) =>
      height +
      segment.lines.length * segment.lineHeight +
      (index < segmentMetrics.length - 1 ? WALL_TEXT_SECTION_GAP : 0),
    0,
  );

  if (blockHeight > pixelTextBox.height) {
    throw new Error(
      "Wall-of-text semantic lines do not fit the selected placement zone.",
    );
  }

  let segmentTop =
    pixelTextBox.top + Math.max(0, (pixelTextBox.height - blockHeight) / 2);
  const segments = segmentMetrics.map((segment, index) => {
    const layoutSegment = {
      ...segment,
      centerX: pixelTextBox.left + pixelTextBox.width / 2,
      top: segmentTop,
    };
    segmentTop += segment.lines.length * segment.lineHeight;

    if (index < segmentMetrics.length - 1) {
      segmentTop += WALL_TEXT_SECTION_GAP;
    }

    return layoutSegment;
  });

  return {
    blockHeight,
    canvasHeight: WALL_TEXT_RENDER_HEIGHT,
    canvasWidth: WALL_TEXT_RENDER_WIDTH,
    segments,
    textBox: pixelTextBox,
  };
}

export function buildWallTextOverlaySvg(params: {
  content: WallTextRenderContent;
  placement: WallTextPlacementZone;
  safeArea?: WallTextSafeArea;
  textColor?: unknown;
  textBox?: WallTextNormalizedBox;
}) {
  const layout = buildWallTextRenderLayout(params);
  const textColor = resolveTextColor(params.textColor);
  const fontFamily =
    "Inter, Arial, Helvetica Neue, Noto Sans CJK SC, Noto Sans CJK JP, sans-serif";
  const shadowFilter = [
    '<filter id="wallTextShadow" x="-20%" y="-20%" width="140%" height="150%">',
    '<feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.55"/>',
    "</filter>",
  ].join("");
  const lines = layout.segments.flatMap((segment) =>
    segment.lines.map((line, index) => {
      const baseline =
        segment.top +
        segment.fontSize * 0.84 +
        index * segment.lineHeight;
      const escaped = escapeXml(line);
      const attributes = [
        `font-family="${fontFamily}"`,
        `font-size="${segment.fontSize}"`,
        `font-weight="${segment.fontWeight}"`,
        'letter-spacing="-0.2"',
        'text-anchor="middle"',
        'xml:space="preserve"',
      ].join(" ");

      return `<text x="${segment.centerX}" y="${baseline.toFixed(2)}" ${attributes} fill="${textColor}" stroke="#000000" stroke-width="${WALL_TEXT_OUTLINE_WIDTH}" stroke-linejoin="round" paint-order="stroke fill" filter="url(#wallTextShadow)">${escaped}</text>`;
    }),
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.canvasWidth}" height="${layout.canvasHeight}" viewBox="0 0 ${layout.canvasWidth} ${layout.canvasHeight}" text-rendering="geometricPrecision">`,
    `<defs>${shadowFilter}</defs>`,
    ...lines,
    "</svg>",
  ].join("");
}

export function normalizeSafeArea(
  safeArea: WallTextSafeArea | undefined,
): WallTextSafeArea {
  const value = safeArea ?? WALL_TEXT_DEFAULT_SAFE_AREA;
  const normalized = {
    bottom: normalizeInset(value.bottom, WALL_TEXT_DEFAULT_SAFE_AREA.bottom),
    left: normalizeInset(value.left, WALL_TEXT_DEFAULT_SAFE_AREA.left),
    right: normalizeInset(value.right, WALL_TEXT_DEFAULT_SAFE_AREA.right),
    top: normalizeInset(value.top, WALL_TEXT_DEFAULT_SAFE_AREA.top),
  };

  if (
    normalized.left + normalized.right >= 0.7 ||
    normalized.top + normalized.bottom >= 0.7
  ) {
    throw new Error("Wall-of-text safe area leaves too little render space.");
  }

  return normalized;
}

function normalizeWallTextContent(
  content: WallTextRenderContent,
): WallTextRenderContent {
  const fullText = content.fullText.replace(/\s+/gu, " ").trim();

  if (
    !fullText ||
    fullText.length > WALL_TEXT_RENDER_MAX_CHARACTERS ||
    (!content.finalLayout &&
      (content.segments.length < 2 || content.segments.length > 3))
  ) {
    throw new Error("Wall-of-text content is outside the supported limits.");
  }

  const expectedRoles =
    content.segments.length === 2
      ? (["lead", "closing"] as const)
      : (["lead", "support", "closing"] as const);
  const segments = content.segments.map((segment, index) => {
    const lines = segment.lines.map((line) =>
      line.replace(/\s+/gu, " ").trim(),
    );

    if (
      segment.role !== expectedRoles[index] ||
      lines.length < 1 ||
      lines.length > 4 ||
      lines.some((line) => !line)
    ) {
      throw new Error("Wall-of-text contains an invalid semantic segment.");
    }

    return { lines, role: segment.role };
  });
  const reconstructed = (content.finalLayout?.blocks ?? segments)
    .map((segment) => segment.lines.join(" "))
    .join(" ");

  if (toComparisonKey(reconstructed) !== toComparisonKey(fullText)) {
    throw new Error("Wall-of-text lines do not match fullText.");
  }

  if (content.finalLayout) {
    const finalLayout = normalizeFinalLayout(content.finalLayout);
    return { fullText, finalLayout, segments };
  }

  return { fullText, segments };
}

function normalizeFinalLayout(
  value: NonNullable<WallTextRenderContent["finalLayout"]>,
) {
  if (
    !["wall-text-final-layout-v1", "wall-text-final-layout-v2"].includes(
      value.version,
    ) ||
    value.fontFamily !== "Inter" ||
    value.fontWeight !== 700 ||
    ![44, 46, 48, 50, 52].includes(value.fontSizePx) ||
    !Number.isFinite(value.lineHeightPx) ||
    value.lineHeightPx <= 0 ||
    value.blocks.length < 1 ||
    value.blocks.length > 6
  ) {
    throw new Error("Wall-of-text final layout is invalid.");
  }

  const normalized = {
    ...value,
    blocks: value.blocks.map((block) => {
      if (
        !["prose", "text", "title", "item"].includes(block.role) ||
        block.lines.length < 1 ||
        block.lines.some((line) => !line.trim())
      ) {
        throw new Error("Wall-of-text final layout contains an invalid block.");
      }
      return {
        lines: block.lines.map((line) => line.replace(/\s+/gu, " ").trim()),
        role: block.role,
      };
    }),
  };
  const lineCount = normalized.blocks.reduce(
    (total, block) => total + block.lines.length,
    0,
  );
  if (
    normalized.version === "wall-text-final-layout-v2" &&
    (normalized.blocks.length !== 1 ||
      normalized.blocks[0]?.role !== "text" ||
      lineCount < WALL_TEXT_RENDER_MIN_LINES ||
      lineCount > WALL_TEXT_RENDER_MAX_LINES)
  ) {
    throw new Error("Wall-of-text V2 must contain one 4-7 line text block.");
  }
  return normalized;
}

function normalizeTextBox(
  value: WallTextNormalizedBox,
  safeArea: WallTextSafeArea,
) {
  const entries = [value.height, value.width, value.x, value.y];

  if (
    entries.some((entry) => !Number.isFinite(entry) || entry < 0 || entry > 1) ||
    value.width < 620 / WALL_TEXT_RENDER_WIDTH ||
    value.width > 660 / WALL_TEXT_RENDER_WIDTH ||
    value.x < safeArea.left ||
    value.y < safeArea.top ||
    value.x + value.width > 1 - safeArea.right + 0.001 ||
    value.y + value.height > 1 - safeArea.bottom + 0.001
  ) {
    throw new Error(
      "Wall-of-text placement is outside the publishing safe zone.",
    );
  }

  return value;
}

function normalizeInset(value: number, fallback: number) {
  const normalized = Number.isFinite(value) ? value : fallback;

  if (normalized < 0 || normalized > 0.3) {
    throw new Error("Wall-of-text safe area is outside the supported range.");
  }

  return normalized;
}

function getWallTextFontSize(
  content: WallTextRenderContent,
  lineCount: number,
) {
  if (
    content.renderFontSize === 44 ||
    content.renderFontSize === 46 ||
    content.renderFontSize === 48 ||
    content.renderFontSize === 50 ||
    content.renderFontSize === 52
  ) {
    return content.renderFontSize;
  }

  const wordCount = content.fullText.split(/\s+/u).filter(Boolean).length;

  if (wordCount <= 18 && lineCount <= 5) {
    return 52;
  }

  if (wordCount <= 21 && lineCount <= 6) {
    return WALL_TEXT_DEFAULT_FONT_SIZE;
  }

  if (wordCount <= 23) {
    return 46;
  }

  return WALL_TEXT_MINIMUM_FONT_SIZE;
}

function toComparisonKey(value: string) {
  return value
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
