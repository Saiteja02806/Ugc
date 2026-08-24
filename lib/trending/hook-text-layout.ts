export const HOOK_TEXT_MINIMUM_CHARACTERS = 8;
export const HOOK_TEXT_MAXIMUM_CHARACTERS = 78;
export const HOOK_TEXT_MINIMUM_WORDS = 2;
export const HOOK_TEXT_MAXIMUM_WORDS = 12;
export const HOOK_TEXT_MAXIMUM_LINES = 3;
export const HOOK_TEXT_MAXIMUM_WORDS_PER_LINE = 7;
export const HOOK_TEXT_MAXIMUM_FONT_SIZE = 60;
export const HOOK_TEXT_MINIMUM_FONT_SIZE = 34;
export const HOOK_TEXT_FIXED_FONT_SIZE = 52;
export const LEGACY_HOOK_TEXT_LAYOUT_VERSION =
  "hook-overlay-layout-v1" as const;
export const HOOK_TEXT_LAYOUT_VERSION =
  "hook-overlay-layout-v2-fixed" as const;
export type HookTextLayoutVersion =
  | typeof HOOK_TEXT_LAYOUT_VERSION
  | typeof LEGACY_HOOK_TEXT_LAYOUT_VERSION;
export const HOOK_TEXT_FONT_WEIGHT = 600;
export const HOOK_TEXT_OUTLINE_WIDTH = 5;
export const HOOK_TEXT_OUTLINE_COLOR = "rgba(0, 0, 0, 0.82)";
export const HOOK_TEXT_BROWSER_FONT_FAMILY =
  'var(--font-edit-overlay), Geist, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "Noto Sans CJK SC", "Noto Sans CJK JP", sans-serif';
export const HOOK_TEXT_CANVAS_WIDTH = 1080;
export const HOOK_TEXT_CANVAS_HEIGHT = 1920;
export const HOOK_TEXT_MAXIMUM_WIDTH = Math.round(
  HOOK_TEXT_CANVAS_WIDTH * 0.84,
);

const HOOK_TEXT_BASE_LINE_SPACING = 14;
const HOOK_TEXT_HORIZONTAL_INSET = Math.round(HOOK_TEXT_CANVAS_WIDTH * 0.04);
const HOOK_TEXT_VERTICAL_INSET = Math.round(HOOK_TEXT_CANVAS_HEIGHT * 0.12);
const HOOK_TEXT_WIDTH_SAFETY_FACTOR = 1.1;

export type HookTextPositionBounds = {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
};

export type HookTextLayout = {
  characterCount: number;
  containerHeight: number;
  containerWidth: number;
  fontSize: number;
  hookText: string;
  lineHeight: number;
  lines: string[];
  lineSpacing: number;
  lineWidths: number[];
  positionBounds: HookTextPositionBounds;
  wordCount: number;
  version: HookTextLayoutVersion;
};

export class HookTextLayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HookTextLayoutError";
  }
}

export function createHookTextLayout(
  value: string,
  options: {
    enforceMaximum?: boolean;
    enforceMinimum?: boolean;
    fontSize?: number;
    layoutVersion?: HookTextLayoutVersion;
    lines?: readonly string[];
  } = {},
): HookTextLayout {
  const sourceLines = normalizeHookLines(options.lines ?? splitManualLines(value));
  const hookText = sourceLines.join(" ").replace(/\s+/gu, " ").trim();
  const normalizedValue = value.replace(/\s+/gu, " ").trim();
  const words = hookText.split(/\s+/u).filter(Boolean);
  const characterCount = Array.from(hookText).length;
  const enforceMinimum = options.enforceMinimum !== false;
  const enforceMaximum = options.enforceMaximum !== false;

  if (!hookText) {
    throw new HookTextLayoutError("Enter Hook text before saving.");
  }

  if (options.lines !== undefined && hookText !== normalizedValue) {
    throw new HookTextLayoutError(
      "The saved Hook lines do not match the Hook text.",
    );
  }

  if (
    enforceMinimum &&
    (characterCount < HOOK_TEXT_MINIMUM_CHARACTERS ||
      words.length < HOOK_TEXT_MINIMUM_WORDS)
  ) {
    throw new HookTextLayoutError(
      `Hook text must contain at least ${HOOK_TEXT_MINIMUM_WORDS} words and ${HOOK_TEXT_MINIMUM_CHARACTERS} characters.`,
    );
  }

  if (enforceMaximum && characterCount > HOOK_TEXT_MAXIMUM_CHARACTERS) {
    throw new HookTextLayoutError(
      `Hook text cannot exceed ${HOOK_TEXT_MAXIMUM_CHARACTERS} characters.`,
    );
  }

  if (enforceMaximum && words.length > HOOK_TEXT_MAXIMUM_WORDS) {
    throw new HookTextLayoutError(
      `Hook text cannot exceed ${HOOK_TEXT_MAXIMUM_WORDS} words.`,
    );
  }

  if (sourceLines.length > HOOK_TEXT_MAXIMUM_LINES) {
    throw new HookTextLayoutError(
      `Hook text must fit within ${HOOK_TEXT_MAXIMUM_LINES} lines.`,
    );
  }

  const explicitLines = options.lines !== undefined || hasManualLineBreak(value);
  const candidates = explicitLines
    ? [sourceLines]
    : createAutomaticLineCandidates(words);
  const layoutVersion = options.layoutVersion ?? HOOK_TEXT_LAYOUT_VERSION;
  const fixedFontSize = normalizeRequestedFontSize(
    options.fontSize,
    layoutVersion,
  );
  if (options.fontSize !== undefined && fixedFontSize === null) {
    throw new HookTextLayoutError(
      layoutVersion === HOOK_TEXT_LAYOUT_VERSION
        ? `Current Hook text must use the fixed ${HOOK_TEXT_FIXED_FONT_SIZE}px font size.`
        : `Legacy Hook font size must be an even number from ${HOOK_TEXT_MINIMUM_FONT_SIZE} to ${HOOK_TEXT_MAXIMUM_FONT_SIZE}.`,
    );
  }
  const fontSizes = fixedFontSize
    ? [fixedFontSize]
    : createFontSizeCandidates(layoutVersion);

  for (const fontSize of fontSizes) {
    const validCandidates = candidates
      .filter((lines) => lines.length <= HOOK_TEXT_MAXIMUM_LINES)
      .map((lines) => ({
        lines,
        widths: lines.map((line) =>
          Math.ceil(estimateHookTextLineWidth(line, fontSize)),
        ),
      }))
      .filter(
        (candidate) =>
          candidate.widths.every((width) => width <= HOOK_TEXT_MAXIMUM_WIDTH) &&
          candidate.lines.every(
            (line) =>
              line.split(/\s+/u).filter(Boolean).length <=
              HOOK_TEXT_MAXIMUM_WORDS_PER_LINE,
          ),
      )
      .sort((left, right) => scoreCandidate(left) - scoreCandidate(right));
    const selected = validCandidates[0];

    if (selected) {
      return buildResolvedHookTextLayout({
        characterCount,
        fontSize,
        hookText,
        lines: selected.lines,
        lineWidths: selected.widths,
        version: layoutVersion,
        wordCount: words.length,
      });
    }
  }

  throw new HookTextLayoutError(
    "Hook text cannot fit in three readable lines. Shorten the wording.",
  );
}

export function clampHookTextPosition(
  position: { x: number; y: number },
  bounds: HookTextPositionBounds,
) {
  return {
    x: clamp(position.x, bounds.minX, bounds.maxX),
    y: clamp(position.y, bounds.minY, bounds.maxY),
  };
}

export function getDefaultHookTextPosition(
  bounds: HookTextPositionBounds,
) {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: bounds.minY,
  };
}

export function estimateHookTextLineWidth(text: string, fontSize: number) {
  let emWidth = 0;

  for (const character of Array.from(text)) {
    emWidth += getCharacterWidthInEm(character);
  }

  return emWidth * fontSize * HOOK_TEXT_WIDTH_SAFETY_FACTOR;
}

function splitManualLines(value: string) {
  return value
    .replace(/\r\n?/gu, "\n")
    .trim()
    .split("\n");
}

function hasManualLineBreak(value: string) {
  return /[\r\n]/u.test(value.trim());
}

function normalizeHookLines(lines: readonly string[]) {
  return lines
    .map((line) => line.replace(/\s+/gu, " ").trim())
    .filter(Boolean);
}

function createAutomaticLineCandidates(words: string[]) {
  const candidates: string[][] = [[words.join(" ")]];

  for (let splitIndex = 1; splitIndex < words.length; splitIndex += 1) {
    candidates.push([
      words.slice(0, splitIndex).join(" "),
      words.slice(splitIndex).join(" "),
    ]);

    for (
      let secondSplitIndex = splitIndex + 1;
      secondSplitIndex < words.length;
      secondSplitIndex += 1
    ) {
      candidates.push([
        words.slice(0, splitIndex).join(" "),
        words.slice(splitIndex, secondSplitIndex).join(" "),
        words.slice(secondSplitIndex).join(" "),
      ]);
    }
  }

  return candidates;
}

function createFontSizeCandidates(layoutVersion: HookTextLayoutVersion) {
  if (layoutVersion === HOOK_TEXT_LAYOUT_VERSION) {
    return [HOOK_TEXT_FIXED_FONT_SIZE];
  }

  const fontSizes: number[] = [];

  for (
    let fontSize = HOOK_TEXT_MAXIMUM_FONT_SIZE;
    fontSize >= HOOK_TEXT_MINIMUM_FONT_SIZE;
    fontSize -= 2
  ) {
    fontSizes.push(fontSize);
  }

  return fontSizes;
}

function normalizeRequestedFontSize(
  value: number | undefined,
  layoutVersion: HookTextLayoutVersion,
) {
  if (value === undefined) return null;

  if (layoutVersion === HOOK_TEXT_LAYOUT_VERSION) {
    return value === HOOK_TEXT_FIXED_FONT_SIZE ? value : null;
  }

  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= HOOK_TEXT_MINIMUM_FONT_SIZE &&
    value <= HOOK_TEXT_MAXIMUM_FONT_SIZE &&
    value % 2 === 0
    ? value
    : null;
}

function scoreCandidate(candidate: { lines: string[]; widths: number[] }) {
  const widest = Math.max(...candidate.widths);
  const narrowest = Math.min(...candidate.widths);

  return candidate.lines.length * 10_000 + widest + (widest - narrowest) * 0.35;
}

function buildResolvedHookTextLayout(params: {
  characterCount: number;
  fontSize: number;
  hookText: string;
  lines: string[];
  lineWidths: number[];
  version: HookTextLayoutVersion;
  wordCount: number;
}): HookTextLayout {
  const lineSpacing = Math.max(
    1,
    Math.round(
      HOOK_TEXT_BASE_LINE_SPACING *
        (params.fontSize / HOOK_TEXT_MAXIMUM_FONT_SIZE),
    ),
  );
  const lineHeight = params.fontSize + lineSpacing;
  const containerWidth = Math.max(...params.lineWidths);
  const containerHeight =
    params.lines.length * params.fontSize +
    Math.max(0, params.lines.length - 1) * lineSpacing;
  const minX =
    (HOOK_TEXT_HORIZONTAL_INSET + containerWidth / 2) /
    HOOK_TEXT_CANVAS_WIDTH;
  const maxX =
    (HOOK_TEXT_CANVAS_WIDTH -
      HOOK_TEXT_HORIZONTAL_INSET -
      containerWidth / 2) /
    HOOK_TEXT_CANVAS_WIDTH;
  const minY =
    (HOOK_TEXT_VERTICAL_INSET + containerHeight / 2) /
    HOOK_TEXT_CANVAS_HEIGHT;
  const maxY =
    (HOOK_TEXT_CANVAS_HEIGHT -
      HOOK_TEXT_VERTICAL_INSET -
      containerHeight / 2) /
    HOOK_TEXT_CANVAS_HEIGHT;

  return {
    characterCount: params.characterCount,
    containerHeight,
    containerWidth,
    fontSize: params.fontSize,
    hookText: params.hookText,
    lineHeight,
    lines: params.lines,
    lineSpacing,
    lineWidths: params.lineWidths,
    positionBounds: {
      maxX: Math.max(minX, maxX),
      maxY: Math.max(minY, maxY),
      minX: Math.min(minX, maxX),
      minY: Math.min(minY, maxY),
    },
    wordCount: params.wordCount,
    version: params.version,
  };
}

function getCharacterWidthInEm(character: string) {
  if (character === " ") return 0.26;
  if (
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(
      character,
    ) ||
    /\p{Extended_Pictographic}/u.test(character)
  ) {
    return 1;
  }
  if (/^[ilI1|]$/u.test(character)) return 0.27;
  if (/^[.,'`:;!]$/u.test(character)) return 0.25;
  if (/^[fjrt()\[\]{}]$/u.test(character)) return 0.38;
  if (/^[mw]$/u.test(character)) return 0.76;
  if (/^[MW@%&]$/u.test(character)) return 0.82;
  if (/^[A-Z]$/u.test(character)) return 0.62;
  if (/^[0-9]$/u.test(character)) return 0.56;
  if (/^[\-\u2013\u2014_+<>=/?\\]$/u.test(character)) return 0.46;
  if (/^[a-z]$/u.test(character)) return 0.52;
  return character.length > 1 ? 1 : 0.62;
}

function clamp(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}
