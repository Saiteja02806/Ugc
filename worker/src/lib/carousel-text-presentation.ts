// Text-only presentation shared by the two existing slideshow structures.
// Canvas ratios, slide roles and asset selection are deliberately not owned here.
export const CAROUSEL_HOOK_FONT_SIZE = 72;
export const CAROUSEL_HEADING_FONT_SIZE = 50;
export const CAROUSEL_BODY_FONT_SIZE = 48;
export const CAROUSEL_HOOK_MAX_LINES = 4;
export const CAROUSEL_HEADING_MAX_LINES = 2;
export const CAROUSEL_BODY_BLOCK_MAX_LINES = 3;
export const CAROUSEL_BODY_MAX_BLOCKS = 2;
export const CAROUSEL_TEXT_BLOCK_GAP = 32;

export const CAROUSEL_TEXT_PRESENTATION_GUIDANCE =
  "Keep the assigned structure, format, six-slide roles and image instructions. This is text presentation only. Slide 1 is one 6-13-word hook, preferably 2-4 semantic lines, with no pill or support layer. On other slides a heading is optional: only add one when it names a distinct idea, use 4-10 words and at most two lines; it receives black text on a fitted white SVG pill. Write body copy as one or two separate thoughts, normally two blocks of 7-16 words each, separated by a blank line (\\n\\n), never one long paragraph. Each body block fits at most three lines at fixed 48px; use single newlines for intentional semantic line breaks. Body and CTA text are ordinary white text with no background. Default to lowercase conversational copy, preserving proper product names and factual meaning. Never leave a standalone line containing only for, and, to, the, of or but. Rewrite overflowing copy; never shrink, truncate or add ellipses. Preserve configured list item counts and give each list item its own text group. CTA is optional on Slide 6 only, never a replacement for promised value, and must stay on its assigned slide.";

export function normalizeCarouselText(value: string | null | undefined) {
  return typeof value === "string"
    ? value.replace(/\r\n?/gu, "\n").split("\n")
        .map((line) => line.replace(/[^\S\n]+/gu, " ").trim())
        .join("\n").replace(/\n{3,}/gu, "\n\n").trim()
    : "";
}

export function getCarouselBodyBlocks(value: string | null | undefined) {
  return normalizeCarouselText(value).split(/\n\s*\n/gu).filter(Boolean);
}

export function isCarouselOrphanLine(value: string) {
  return /^(?:for|and|to|the|of|but)[.!?,]*$/iu.test(value.trim());
}

// The headline database column is a legacy transport field, not proof that
// the author supplied a heading. Never invent a pill from the column name.
export function hasCarouselSemanticHeading(plan: unknown, slideNumber: number, structureId: "structure_1" | "structure_2", legacyHasSupport: boolean) {
  if (slideNumber === 1) return false;
  const record = plan && typeof plan === "object" && !Array.isArray(plan) ? plan as Record<string, unknown> : null;
  const slides = Array.isArray(record?.slides) ? record.slides : [];
  const slide = slides.find((value): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && (value as Record<string, unknown>).slideNumber === slideNumber));
  if (!slide) return legacyHasSupport;
  if (structureId === "structure_1" && ["body_only", "single_statement"].includes(String(slide.textMode))) return false;
  return typeof slide.headline === "string" && Boolean(slide.headline.trim());
}
