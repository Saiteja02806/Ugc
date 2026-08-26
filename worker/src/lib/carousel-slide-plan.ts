export type CarouselTextMode =
  | "body_only"
  | "checklist"
  | "cta_takeaway"
  | "headline_body"
  | "question_list"
  | "single_statement";

export type PlannedCarouselSlide = {
  body: string | null;
  ctaText: string | null;
  formatRole?: string | null;
  headline: string | null;
  imageDirection: string;
  layoutPreset:
    | "bottom-message"
    | "caption-cluster"
    | "interactive-list"
    | "middle-statement"
    | "top-hook";
  listItems: string[];
  slideNumber: number;
  slideType: "benefit" | "cta" | "differentiator" | "hook" | "problem" | "solution";
  subtext: string | null;
  textMode: CarouselTextMode;
  textPosition: "bottom" | "center" | "top";
};

export const CAROUSEL_FIXED_FONT_SIZE = 44;
export const CAROUSEL_STRUCTURE_1_FIXED_TEXT_WIDTH = 786;
export const CAROUSEL_STRUCTURE_2_FIXED_TEXT_WIDTH = 868;
export const CAROUSEL_STRUCTURE_1_HEADLINE_MAX_LINES = 4;
export const CAROUSEL_STRUCTURE_1_BODY_MAX_LINES = 8;
export const CAROUSEL_STRUCTURE_1_FOLLOWUP_BODY_MAX_LINES = 10;
export const CAROUSEL_STRUCTURE_1_LIST_ITEM_MAX_LINES = 2;
export const CAROUSEL_STRUCTURE_1_LIST_TOTAL_MAX_LINES = 8;

export function getCarouselStructure1BodyMaxLines(slideNumber: number) {
  return slideNumber === 1
    ? CAROUSEL_STRUCTURE_1_BODY_MAX_LINES
    : CAROUSEL_STRUCTURE_1_FOLLOWUP_BODY_MAX_LINES;
}

export type CarouselFixedTextFit = {
  fits: boolean;
  lines: string[];
  maximumLineWidth: number;
  reason: string | null;
};

export function inspectCarouselFixedTextFit(params: {
  maximumLines: number;
  maximumWidth: number;
  value: string;
}): CarouselFixedTextFit {
  const value = params.value.trim().replace(/\s+/gu, " ");

  if (!value) {
    return {
      fits: true,
      lines: [],
      maximumLineWidth: 0,
      reason: null,
    };
  }

  const words = value.split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const wordWidth = estimateCarouselFixedTextWidth(word);

    if (wordWidth > params.maximumWidth) {
      return {
        fits: false,
        lines,
        maximumLineWidth: wordWidth,
        reason: `The word "${word}" is wider than the fixed text area.`,
      };
    }

    const candidate = current ? `${current} ${word}` : word;

    if (estimateCarouselFixedTextWidth(candidate) <= params.maximumWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);

  const maximumLineWidth = Math.ceil(
    Math.max(0, ...lines.map(estimateCarouselFixedTextWidth)),
  );
  const fits = lines.length <= params.maximumLines;

  return {
    fits,
    lines,
    maximumLineWidth,
    reason: fits
      ? null
      : `Copy needs ${lines.length} lines but the fixed layout allows ${params.maximumLines}.`,
  };
}

export function estimateCarouselFixedTextWidth(value: string) {
  return Array.from(value).reduce((width, character) => {
    if (character === " ") return width + CAROUSEL_FIXED_FONT_SIZE * 0.29;
    if (/[A-Z0-9]/u.test(character)) {
      return width + CAROUSEL_FIXED_FONT_SIZE * 0.61;
    }
    if (/[il.,'|:;]/u.test(character)) {
      return width + CAROUSEL_FIXED_FONT_SIZE * 0.27;
    }
    if (/[mwMW@%]/u.test(character)) {
      return width + CAROUSEL_FIXED_FONT_SIZE * 0.8;
    }
    return width + CAROUSEL_FIXED_FONT_SIZE * 0.52;
  }, 0);
}
