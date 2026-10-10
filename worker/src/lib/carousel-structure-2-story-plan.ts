import { structure2HookGuidance } from "./carousel-structure-2-hook-templates.js";
import { CAROUSEL_TEXT_PRESENTATION_GUIDANCE, CAROUSEL_HOOK_COPY_GUIDANCE, CAROUSEL_HOOK_MIN_WORDS, CAROUSEL_HOOK_MAX_WORDS, CAROUSEL_BODY_BLOCK_MAX_LINES, CAROUSEL_HEADING_FONT_SIZE, CAROUSEL_HEADING_MAX_LINES, getCarouselBodyBlocks, getCarouselHookStatementIssue, isCarouselOrphanLine, normalizeCarouselText } from "./carousel-text-presentation.js";
import type {
  CarouselPlanningBrief,
  CarouselRecentAcceptedCopy,
} from "./carousel-content-plan.js";
import {
  CAROUSEL_FIXED_FONT_SIZE,
  CAROUSEL_STRUCTURE_2_FIXED_TEXT_WIDTH,
  inspectCarouselFixedTextFit,
} from "./carousel-slide-plan.js";
import {
  CAROUSEL_STRUCTURE_2_STORY_MAX_WORDS,
  doesCarouselStructure2TextFitSafeArea,
  getCarouselStructure2StoryFontSize,
  getCarouselStructure2StoryMaxLines,
} from "./carousel-structure-2-layout.js";
import {
  CAROUSEL_STRUCTURE_2_STORY_ROLES,
  getCarouselStructure2Format,
  isCarouselStructure2FormatId,
  type CarouselStructure2FormatId,
  type CarouselStructure2StoryRole,
} from "./carousel-structure-2-formats.js";

const STRUCTURE_2_COVER_HOOK_COPY_GUIDANCE =
  `${CAROUSEL_HOOK_COPY_GUIDANCE} Use short, natural wording so it stays within four centred display lines at ${getCarouselStructure2StoryFontSize(1)}px. Never use ALL CAPS. The hook sits in the image centre, so visualContext must leave a clear, calm central text zone rather than reserving empty space only at the bottom.`;

const STRUCTURE_2_OUTPUT_COPY_CONTRACT =
  `Apply these rules separately to each slide, not one common paragraph style. Slide 1/first/slide1: exactly ONE complete statement, ${CAROUSEL_HOOK_MIN_WORDS}-${CAROUSEL_HOOK_MAX_WORDS} words, aim for 6-10 short words. No second sentence, explanation, subtitle, or blank line; body-block instructions NEVER apply to the cover. Example of the shape only: "i kept making content without a clear plan". Slides 2-6/second through sixth: count only storyText, excluding headline and ctaText, and return 14-30 whitespace-delimited words total; aim for 18-22. Normally use two short blocks of 7-12 words separated by a blank line; each block fits at most three lines at 48px. Count their combined words, not each block separately. Preserve first-person I/me/my on Slides 2-5. Slide 6 still needs at least 14 words of useful takeaway; a short slogan or product invitation does not satisfy that requirement. Check each field against its own rule before returning.`;

export const CAROUSEL_STRUCTURE_2_STORY_SCHEMA_VERSION =
  "carousel-structure-2-strict-six-slide-text-blocks-v10";
export const CAROUSEL_STRUCTURE_2_STORY_HISTORY_LIMIT = 10;
/** Names the six rendered slides inside one Structure 2 carousel. */
export const CAROUSEL_STRUCTURE_2_SLIDE_POSITION_KEYS = [
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
] as const;

/** Names the five independently planned carousels in one worker batch. */
export const CAROUSEL_STRUCTURE_2_BATCH_POSITION_KEYS = [
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
] as const;

const MAX_ANGLE_LENGTH = 180;
const MAX_CTA_TEXT_LENGTH = 360;
const MAX_STORY_TEXT_LENGTH = 720;
const MAX_VISUAL_CONTEXT_LENGTH = 220;
const STRUCTURE_2_COVER_HOOK_MIN_WORDS = CAROUSEL_HOOK_MIN_WORDS;
const STRUCTURE_2_COVER_HOOK_MAX_WORDS = CAROUSEL_HOOK_MAX_WORDS;
// Forty-two characters is a useful writing target, not the publishing gate.
// The renderer measures the actual fixed-size, four-line cover treatment below.
// A raw character cap rejects naturally short covers that render cleanly and,
// when used in Structured Outputs, can cut a model off mid-thought.
export const CAROUSEL_STRUCTURE_2_COVER_HOOK_PREFERRED_MAX_CHARACTERS = 42;
// Keep strict Structured Outputs broad. The publishing validator owns the
// meaningful constraints: a compact word range, a complete thought, and the
// measured four-line render fit.
export const CAROUSEL_STRUCTURE_2_COVER_HOOK_SCHEMA_MAX_CHARACTERS =
  MAX_STORY_TEXT_LENGTH;
const GENERIC_COPY_PATTERN =
  /\b(boost productivity|streamline your workflow|unlock efficiency|work smarter|next level|seamless|one platform|one workspace for everything)\b/i;
const STRUCTURE_2_COPY_QUALITY_GUIDANCE =
  'Avoid these blocked phrases in every visible field: "boost productivity", "streamline your workflow", "unlock efficiency", "work smarter", "next level", "seamless", "one platform", and "one workspace for everything". Replace them with the concrete action, obstacle, or change supported by the business context. A synonym for success or confidence is not a specific story beat.';
const STRUCTURE_2_JSON_OUTPUT_GUIDANCE =
  "Return compact, complete JSON with every required closing brace. Do not add indentation, trailing whitespace, markdown, or an explanation. visualContext describes a real scene and composition; never return a placeholder file path or URL.";
// Covers do not require terminal punctuation: short social hooks often read
// naturally without it. This deliberately catches only unmistakable hanging
// endings, rather than turning every unpunctuated hook into a failure.
const INCOMPLETE_HOOK_ENDING_PATTERN =
  /\b(?:and|or|but|because|if|when|while|with|for|from|into|about|than|that|which|who|whose|where|why|how|to\s+(?:always|constantly|still|ever|never|really|just))\s*$/i;

export type CarouselStructure2ProductVisualEligibility =
  | "allowed"
  | "forbidden"
  | "preferred";

export type CarouselStructure2StorySlide = {
  headline?: string | null;
  ctaText: string | null;
  productVisualEligibility: CarouselStructure2ProductVisualEligibility;
  slideNumber: number;
  storyRole: CarouselStructure2StoryRole;
  storyText: string;
  visualContext: string;
};

export type CarouselStructure2StoryStrategy = {
  angle: string;
  storyFormatId: CarouselStructure2FormatId;
};

export type CarouselStructure2StoryPlan = {
  schemaVersion: typeof CAROUSEL_STRUCTURE_2_STORY_SCHEMA_VERSION;
  slides: CarouselStructure2StorySlide[];
  strategy: CarouselStructure2StoryStrategy;
};

export type CarouselStructure2StoryAssignment = {
  hookTemplateId?: string | null;
  hookTemplateVersion?: number | null;
  candidateIndex: number;
  creativeSeed: string;
  emotion: string;
  planningBrief?: CarouselPlanningBrief | null;
  slotIndex: number;
  storyFormatId: CarouselStructure2FormatId;
};

export type CarouselStructure2RecentHistoryInput = CarouselRecentAcceptedCopy;

export type CarouselStructure2StoryValidationIssue = {
  code:
    | "cta_mismatch"
    | "generic_copy"
    | "hook_incomplete"
    | "hook_length"
    | "hook_structure"
    | "hook_template_placeholder"
    | "invalid_plan"
    | "perspective"
    | "product_timing"
    | "recent_exact_duplicate"
    | "render_fit"
    | "recent_repetition"
    | "story_repetition"
    | "story_structure"
    | "unsupported_claim"
    | "word_count";
  message: string;
  slideNumber: number | null;
};

export function parseCarouselStructure2StoryPlan(
  value: unknown,
  params: {
    businessDescription?: string;
    storyFormatId: CarouselStructure2FormatId;
  },
): CarouselStructure2StoryPlan {
  const record = asRecord(value, "Structure 2 story plan");
  assertExactObjectKeys(record, ["slides", "strategy"], "Structure 2 story plan");
  const strategyRecord = asRecord(record.strategy, "Structure 2 strategy");
  assertExactObjectKeys(strategyRecord, ["angle"], "Structure 2 strategy");
  const slidesRecord = asRecord(record.slides, "Structure 2 slides");
  assertExactObjectKeys(
    slidesRecord,
    CAROUSEL_STRUCTURE_2_SLIDE_POSITION_KEYS,
    "Structure 2 slides",
  );
  const format = getCarouselStructure2Format(params.storyFormatId);
  const slides = CAROUSEL_STRUCTURE_2_SLIDE_POSITION_KEYS.map((positionKey, index) =>
    parseStorySlide(slidesRecord[positionKey], index),
  );

  for (const slide of slides) {
    const reference = format.slides[slide.slideNumber - 1];

    if (!reference || reference.storyRole !== slide.storyRole) {
      throw new Error(
        `Structure 2 slide ${slide.slideNumber} must use the ${reference?.storyRole ?? "configured"} role.`,
      );
    }
    if (slide.ctaText && slide.slideNumber !== 6) {
      throw new Error(
        `Structure 2 slide ${slide.slideNumber} cannot include a CTA before Slide 6.`,
      );
    }
  }

  return {
    schemaVersion: CAROUSEL_STRUCTURE_2_STORY_SCHEMA_VERSION,
    slides,
    strategy: {
      angle: getRequiredString(
        strategyRecord.angle,
        "Structure 2 angle",
        MAX_ANGLE_LENGTH,
      ),
      storyFormatId: params.storyFormatId,
    },
  };
}

function parseStorySlide(value: unknown, index: number) {
  const label = `Structure 2 slide ${index + 1}`;
  const record = asRecord(value, label);
  assertExactObjectKeys(
    record,
    ["ctaText", ...(Object.hasOwn(record, "headline") ? ["headline"] : []), "storyRole", "storyText", "visualContext"],
    label,
  );
  const storyRole = getRequiredString(record.storyRole, `${label} role`, 80);

  if (
    !CAROUSEL_STRUCTURE_2_STORY_ROLES.includes(
      storyRole as CarouselStructure2StoryRole,
    )
  ) {
    throw new Error(`${label} has an invalid story role.`);
  }

  const resolvedRole = storyRole as CarouselStructure2StoryRole;
  return {
    ...(Object.hasOwn(record, "headline") ? { headline: getOptionalString(record.headline, `${label} heading`, 100) } : {}),
    ctaText: getOptionalString(record.ctaText, `${label} CTA`, MAX_CTA_TEXT_LENGTH),
    productVisualEligibility: getProductVisualEligibility(resolvedRole),
    slideNumber: index + 1,
    storyRole: resolvedRole,
    storyText: getRequiredString(
      record.storyText,
      `${label} story text`,
      // Keep parsing broad enough for repair to handle older or mocked output.
      // New model output receives the tighter first-slide schema constraint.
      MAX_STORY_TEXT_LENGTH,
    ),
    visualContext: getRequiredString(
      record.visualContext,
      `${label} visual context`,
      MAX_VISUAL_CONTEXT_LENGTH,
    ),
  } satisfies CarouselStructure2StorySlide;
}

export function validateCarouselStructure2StoryPlan(
  plan: CarouselStructure2StoryPlan,
  params: {
    businessDescription?: string;
    recentHistory?: readonly CarouselStructure2RecentHistoryInput[];
  } = {},
) {
  const issues: CarouselStructure2StoryValidationIssue[] = [];
  const format = getCarouselStructure2Format(plan.strategy.storyFormatId);
  const seenRoles = new Set<CarouselStructure2StoryRole>();
  const seenCopy: string[] = [];

  for (const slide of plan.slides) {
    const copy = [slide.headline, slide.storyText, slide.ctaText].filter(Boolean).join(" ");
    const reference = format.slides[slide.slideNumber - 1];
    const wordCount = countWords(slide.storyText);
    const storyWordCount = countWords(slide.storyText);
    const storyFontSize = getCarouselStructure2StoryFontSize(slide.slideNumber);
    const storyMaximumLines = getCarouselStructure2StoryMaxLines(
      slide.slideNumber,
    );
    const storyFit = inspectCarouselFixedTextFit({
      fontSize: storyFontSize,
      maximumLines: storyMaximumLines,
      maximumWidth: CAROUSEL_STRUCTURE_2_FIXED_TEXT_WIDTH,
      value: slide.storyText,
    });
    if (slide.headline) {
      const headingFit = inspectCarouselFixedTextFit({ fontSize: CAROUSEL_HEADING_FONT_SIZE, maximumLines: CAROUSEL_HEADING_MAX_LINES, maximumWidth: 786, value: slide.headline });
      if (slide.slideNumber === 1 || countWords(slide.headline) > 10 || !headingFit.fits || slide.headline.split("\n").some(isCarouselOrphanLine)) {
        issues.push({ code: "story_structure", message: "Use an optional heading of at most 10 words and two fitted lines on content slides only.", slideNumber: slide.slideNumber });
      }
    }
    if (slide.ctaText && !inspectCarouselFixedTextFit({ fontSize: CAROUSEL_FIXED_FONT_SIZE, maximumLines: CAROUSEL_BODY_BLOCK_MAX_LINES, maximumWidth: 786, value: slide.ctaText }).fits) {
      issues.push({ code: "cta_mismatch", message: "Keep the optional CTA within three plain-text lines at 48px.", slideNumber: slide.slideNumber });
    }
    if (slide.slideNumber !== 1 && slide.headline !== undefined) {
      const blocks = getCarouselBodyBlocks(slide.storyText);
      if (blocks.length > 2 || blocks.some((block) => !inspectCarouselFixedTextFit({ fontSize: CAROUSEL_FIXED_FONT_SIZE, maximumLines: CAROUSEL_BODY_BLOCK_MAX_LINES, maximumWidth: 786, value: block }).fits || block.split("\n").some(isCarouselOrphanLine))) {
        issues.push({ code: "render_fit", message: "Write at most two separate body blocks, each fitting three lines at 48px; preserve semantic line breaks.", slideNumber: slide.slideNumber });
      }
    }

    if (
      slide.slideNumber === 1 &&
      (wordCount < STRUCTURE_2_COVER_HOOK_MIN_WORDS ||
        wordCount > STRUCTURE_2_COVER_HOOK_MAX_WORDS)
    ) {
      issues.push({
        code: "hook_length",
        message: `Slide 1 must be one ${STRUCTURE_2_COVER_HOOK_MIN_WORDS}-${STRUCTURE_2_COVER_HOOK_MAX_WORDS}-word hook, with no subtitle or supporting copy.`,
        slideNumber: slide.slideNumber,
      });
    }

    if (slide.slideNumber === 1 && /\[[^\]]+\]|\{\{[^}]+\}\}/.test(copy)) {
      issues.push({ code: "hook_template_placeholder", message: "Replace every hook placeholder with grounded, complete reader-facing copy.", slideNumber: 1 });
    }
    if (slide.slideNumber === 1 && isClearlyIncompleteCoverHook(copy)) {
      issues.push({
        code: "hook_incomplete",
        message:
          "Slide 1 ends as an incomplete hook. Return a shorter, self-contained hook instead of a partial final word or hanging phrase.",
        slideNumber: slide.slideNumber,
      });
    }
    if (slide.slideNumber === 1) {
      const message = getCarouselHookStatementIssue(slide.storyText);
      if (message) issues.push({ code: "hook_structure", message, slideNumber: 1 });
    }

    if (!storyFit.fits) {
      issues.push({
        code: "render_fit",
        message: `Story copy must fit within ${storyMaximumLines} lines at the ${storyFontSize}px font size. ${storyFit.reason ?? ""}`.trim(),
        slideNumber: slide.slideNumber,
      });
    }

    if (storyWordCount > CAROUSEL_STRUCTURE_2_STORY_MAX_WORDS) {
      issues.push({
        code: "render_fit",
        message: `Story copy must contain no more than ${CAROUSEL_STRUCTURE_2_STORY_MAX_WORDS} words so it can remain readable at the fixed ${storyFontSize}px font size.`,
        slideNumber: slide.slideNumber,
      });
    }

    if (
      !doesCarouselStructure2TextFitSafeArea({
        ctaLineCount: 0,
        height: 1080,
        storyLineCount: storyFit.lines.length,
        storyFontSize,
      })
    ) {
      issues.push({
        code: "render_fit",
        message:
          "Story copy does not fit inside the fixed 1:1 safe area at the fixed font size.",
        slideNumber: slide.slideNumber,
      });
    }

    if (
      reference &&
      (wordCount < reference.minimumWords || wordCount > reference.maximumWords)
    ) {
      issues.push({
        code: "word_count",
        message: `Slide copy has ${wordCount} words, outside the required ${reference.minimumWords}-${reference.maximumWords} word range.`,
        slideNumber: slide.slideNumber,
      });
    }
    if (!reference || reference.storyRole !== slide.storyRole) {
      issues.push({
        code: "story_structure",
        message: "The slide role does not match the required six-slide story sequence.",
        slideNumber: slide.slideNumber,
      });
    }
    if (slide.ctaText && slide.slideNumber !== 6) {
      issues.push({
        code: "cta_mismatch",
        message: "Optional CTA text belongs on Slide 6 only.",
        slideNumber: slide.slideNumber,
      });
    }
    if (
      reference?.perspective === "first_person" &&
      /\b(you|your)\b/i.test(copy)
    ) {
      issues.push({
        code: "perspective",
        message: "This slide must stay in the first-person story perspective.",
        slideNumber: slide.slideNumber,
      });
    }
    if (
      reference?.productMention === "forbidden" &&
      params.businessDescription &&
      includesBusinessName(copy, params.businessDescription)
    ) {
      issues.push({
        code: "product_timing",
        message: "The product must not appear before the product-mechanism slide.",
        slideNumber: slide.slideNumber,
      });
    }
    const genericCopyMatch = copy.match(GENERIC_COPY_PATTERN);
    if (genericCopyMatch) {
      issues.push({
        code: "generic_copy",
        message: `Slide copy uses the blocked phrase ${JSON.stringify(genericCopyMatch[0])}. Replace that exact phrase with a concrete, grounded action or observation.`,
        slideNumber: slide.slideNumber,
      });
    }
    if (/\b\d+(?:[.,]\d+)?\s*(?:%(?!\w)|(?:x|times|percent|users?|customers?|hours?|days?)\b)/i.test(copy)) {
      issues.push({
        code: "unsupported_claim",
        message: "The copy contains a precise claim that is not present in the minimal business description.",
        slideNumber: slide.slideNumber,
      });
    }
    if (seenRoles.has(slide.storyRole)) {
      issues.push({
        code: "story_structure",
        message: "A story role repeats; a more varied progression may read better.",
        slideNumber: slide.slideNumber,
      });
    }
    seenRoles.add(slide.storyRole);

    if (seenCopy.some((previous) => tokenOverlap(previous, copy) >= 0.78)) {
      issues.push({
        code: "story_repetition",
        message: "This slide closely repeats another slide in the same story.",
        slideNumber: slide.slideNumber,
      });
    }
    seenCopy.push(copy);
  }

  const currentHook = plan.slides[0]?.storyText ?? "";
  const currentFullCopy = plan.slides
    .flatMap((slide) => [slide.headline, slide.storyText, slide.ctaText])
    .filter((value): value is string => Boolean(value))
    .join(" ");

  for (const prior of normalizeRecentHistory(params.recentHistory)) {
    const priorHook = prior.slides[0]
      ? [prior.slides[0].headline, prior.slides[0].subtext, prior.slides[0].ctaText]
          .filter((value): value is string => Boolean(value))
          .join(" ")
      : "";
    const priorFullCopy = prior.slides
      .flatMap((slide) => [slide.headline, slide.subtext, slide.ctaText])
      .filter((value): value is string => Boolean(value))
      .join(" ");

    if (
      (currentHook && priorHook && hasExactVisibleCopyMatch(currentHook, priorHook)) ||
      (currentFullCopy &&
        priorFullCopy &&
        hasExactVisibleCopyMatch(currentFullCopy, priorFullCopy))
    ) {
      issues.push({
        code: "recent_exact_duplicate",
        message: "The hook or visible story copy exactly repeats a recent accepted Carousel.",
        slideNumber: null,
      });
      break;
    }

    if (
      (currentHook && priorHook && tokenOverlap(currentHook, priorHook) >= 0.75) ||
      (currentFullCopy &&
        priorFullCopy &&
        tokenOverlap(currentFullCopy, priorFullCopy) >= 0.72)
    ) {
      issues.push({
        code: "recent_repetition",
        message:
          "The hook or visible story copy is close to a recent accepted Carousel; keep it as a freshness signal, not a publication block.",
        slideNumber: null,
      });
      break;
    }
  }

  return dedupeCarouselStructure2ValidationIssues(issues);
}

export function partitionCarouselStructure2ValidationIssues(
  issues: readonly CarouselStructure2StoryValidationIssue[],
) {
  const blockingIssues: CarouselStructure2StoryValidationIssue[] = [];
  const advisoryIssues: CarouselStructure2StoryValidationIssue[] = [];

  for (const issue of dedupeCarouselStructure2ValidationIssues(issues)) {
    if (issue.code === "recent_repetition") {
      advisoryIssues.push(issue);
    } else {
      blockingIssues.push(issue);
    }
  }

  return { advisoryIssues, blockingIssues };
}

export function buildCarouselStructure2StoryPlanSchema() {
  const slides = Object.fromEntries(
    CAROUSEL_STRUCTURE_2_SLIDE_POSITION_KEYS.map((positionKey, index) => {
      const isCover = index === 0;
      return [
        positionKey,
        {
        additionalProperties: false,
        properties: {
          headline: isCover ? { type: "null" } : { anyOf: [{ type: "string", minLength: 1, maxLength: 100 }, { type: "null" }] },
          ctaText: {
            anyOf: [
              { maxLength: MAX_CTA_TEXT_LENGTH, minLength: 1, type: "string" },
              { type: "null" },
            ],
          },
          storyRole: {
            enum: [...CAROUSEL_STRUCTURE_2_STORY_ROLES],
            type: "string",
          },
          storyText: {
            description: isCover
              ? `One complete ${CAROUSEL_HOOK_MIN_WORDS}-${CAROUSEL_HOOK_MAX_WORDS}-word hook. No second sentence or blank line. Aim for 6-10 short words; body paragraph rules do not apply here.`
              : "14-30 body words total excluding headline and ctaText. Aim for 18-22 words across one or two short blocks. Slides 2-5 use I/me/my; Slide 6 is a useful takeaway, not a short slogan.",
            maxLength:
              isCover
                ? CAROUSEL_STRUCTURE_2_COVER_HOOK_SCHEMA_MAX_CHARACTERS
                : MAX_STORY_TEXT_LENGTH,
            minLength: 1,
            type: "string",
          },
          visualContext: {
            description: "Describe the scene, subject and clear text area in plain language. Do not return a file path, URL or placeholder.",
            maxLength: MAX_VISUAL_CONTEXT_LENGTH,
            minLength: 1,
            type: "string",
          },
        },
        required: ["ctaText", "headline", "storyRole", "storyText", "visualContext"],
        type: "object",
        },
      ];
    }),
  );

  return {
    additionalProperties: false,
    properties: {
      slides: {
        additionalProperties: false,
        properties: slides,
        required: [...CAROUSEL_STRUCTURE_2_SLIDE_POSITION_KEYS],
        type: "object",
      },
      strategy: {
        additionalProperties: false,
        properties: {
          angle: { maxLength: MAX_ANGLE_LENGTH, minLength: 1, type: "string" },
        },
        required: ["angle"],
        type: "object",
      },
    },
    required: ["slides", "strategy"],
    type: "object",
  } as const;
}

/**
 * A narrow repair schema contains only the visible fields that need
 * replacement. The full-plan schema remains necessary for structural
 * failures, but using it for a small copy correction gives the model needless
 * opportunities to disturb valid slides.
 */
export function buildCarouselStructure2StoryTextRepairSchema(
  slideNumbers: readonly number[],
) {
  const keys = getTargetedStoryTextKeys(slideNumbers);
  return {
    additionalProperties: false,
    properties: {
      storyTextBySlide: {
        additionalProperties: false,
        properties: Object.fromEntries(
          keys.map((key) => [
            key,
            {
              // A word-count regex causes empty strict-output responses from
              // the production model, but a plain character ceiling is safe.
              // Do not bind a repair to the 42-character writing target:
              // gpt-4o-mini can end an otherwise complete hook at that
              // boundary. Measured render fit remains the hard safeguard.
              maxLength:
                key === getTargetedStoryTextKey(1)
                  ? CAROUSEL_STRUCTURE_2_COVER_HOOK_SCHEMA_MAX_CHARACTERS
                  : MAX_STORY_TEXT_LENGTH,
              description: key === getTargetedStoryTextKey(1)
                ? `Replace with ONE complete ${CAROUSEL_HOOK_MIN_WORDS}-${CAROUSEL_HOOK_MAX_WORDS}-word hook, normally 6-10 short words. No second sentence, explanation or blank line.`
                : "Replace with 14-30 storyText words total, aiming for 18-22. Count across both blocks, excluding the separate heading/CTA. Preserve first-person voice on Slides 2-5.",
              minLength: 1,
              type: "string",
            },
          ]),
        ),
        required: keys,
        type: "object",
      },
    },
    required: ["storyTextBySlide"],
    type: "object",
  } as const;
}

export function buildCarouselStructure2StoryBatchSchema(params: {
  assignments: readonly CarouselStructure2StoryAssignment[];
}) {
  assertCarouselStructure2StoryAssignments(params.assignments);
  const plans = Object.fromEntries(
    CAROUSEL_STRUCTURE_2_BATCH_POSITION_KEYS.map((positionKey) => [
      positionKey,
      buildCarouselStructure2StoryPlanSchema(),
    ]),
  );

  return {
    additionalProperties: false,
    properties: {
      plans: {
        additionalProperties: false,
        properties: plans,
        required: [...CAROUSEL_STRUCTURE_2_BATCH_POSITION_KEYS],
        type: "object",
      },
    },
    required: ["plans"],
    type: "object",
  } as const;
}

export function parseCarouselStructure2StoryBatch(
  value: unknown,
  assignments: readonly CarouselStructure2StoryAssignment[],
) {
  assertCarouselStructure2StoryAssignments(assignments);
  const record = asRecord(value, "Structure 2 story batch");
  assertExactObjectKeys(record, ["plans"], "Structure 2 story batch");
  const plansRecord = asRecord(record.plans, "Structure 2 story batch plans");
  assertExactObjectKeys(
    plansRecord,
    CAROUSEL_STRUCTURE_2_BATCH_POSITION_KEYS,
    "Structure 2 story batch plans",
  );
  const sortedAssignments = [...assignments].sort(
    (left, right) => left.slotIndex - right.slotIndex,
  );

  return new Map(
    CAROUSEL_STRUCTURE_2_BATCH_POSITION_KEYS.map((positionKey, index) => [
      sortedAssignments[index]!.slotIndex,
      plansRecord[positionKey],
    ]),
  );
}

/** Recover only missing outer object terminators, never missing copy or fields. */
export function parseCarouselStructure2StoryBatchResponse(
  response: string,
  assignments: readonly CarouselStructure2StoryAssignment[],
) {
  let value: unknown;
  try {
    value = JSON.parse(response);
  } catch (error) {
    // A production completion supplied all five complete plans, then emitted
    // whitespace until its token limit without closing the batch envelope.
    // At most two braces can close { plans: { ... } }; the exact batch keys
    // and every candidate's normal parsing/validation still remain mandatory.
    for (let closingBraces = 1; closingBraces <= 2; closingBraces += 1) {
      try {
        const recovered = JSON.parse(response.trimEnd() + "}".repeat(closingBraces));
        return {
          plans: parseCarouselStructure2StoryBatch(recovered, assignments),
          envelopeClosingBraces: closingBraces,
        };
      } catch {
        // Incomplete strings, fields, candidates and other malformed JSON
        // retain the existing isolated LLM repair path.
      }
    }
    throw error;
  }
  return {
    plans: parseCarouselStructure2StoryBatch(value, assignments),
    envelopeClosingBraces: 0,
  };
}

export function buildCarouselStructure2BatchMessages(params: {
  assignments: readonly CarouselStructure2StoryAssignment[];
  businessDescription: string;
  recentHistory?: readonly CarouselStructure2RecentHistoryInput[];
}) {
  assertCarouselStructure2StoryAssignments(params.assignments);
  const assignments = [...params.assignments]
    .sort((left, right) => left.slotIndex - right.slotIndex)
    .map((assignment, index) => ({
      creativeSeed: assignment.creativeSeed,
      emotion: assignment.emotion,
      formatReference: getFormatReference(assignment.storyFormatId),
      hookGuidance: structure2HookGuidance(assignment),
      outputKey: CAROUSEL_STRUCTURE_2_BATCH_POSITION_KEYS[index],
      privateCreativeBrief: assignment.planningBrief,
    }));

  return [
    {
      role: "system" as const,
      content:
        `You write native Instagram product-story carousels for Structure 2. Create exactly five independent carousels with exactly six slides each. Every carousel follows this strict sequence: reader-first cover, problem, realization, product mechanism, modest proof or result, useful takeaway. Private creative briefs add context but are not visible labels or compulsory plots. ${STRUCTURE_2_OUTPUT_COPY_CONTRACT} ${STRUCTURE_2_COPY_QUALITY_GUIDANCE} ${STRUCTURE_2_JSON_OUTPUT_GUIDANCE}`,
    },
    {
      role: "user" as const,
      content: [
        "Use each creativeSeed as a broad starting point and its emotion as the emotional current. Do not treat either as finished copy or a complete plot.",
        "Use privateCreativeBrief only as flexible human and factual context; its preferredFormatFamily must never override the backend-selected format reference.",
        `Follow each role's word range as a publishing contract. Slide 1 must be one ${CAROUSEL_HOOK_MIN_WORDS}-${CAROUSEL_HOOK_MAX_WORDS} word hook only, with no subtitle or supporting copy. Every prose slide from Slide 2 through Slide 6 must contain 14-30 words. Develop the story beat clearly and prioritize readable copy that fits the stated display area.`,
        CAROUSEL_TEXT_PRESENTATION_GUIDANCE,
        "For Slides 2-6, aim for 16-22 body words total (accepted 14-30). Use headline for a real optional heading, otherwise null. Put one or two short body thoughts in storyText, separated by \\n\\n, each at most three lines at 48px; do not put the heading into storyText.",
        "Return each plan under its assigned outputKey. Do not return slideNumber, slotIndex, candidateIndex, or storyFormatId; the worker owns those structural values.",
        "Develop genuinely different stories inside the required six-slide sequence. Do not force every item through the same overwhelmed-to-easier arc.",
        `Slide 1 may use first-person or direct reader wording such as 'you' or 'your'. ${STRUCTURE_2_COVER_HOOK_COPY_GUIDANCE} Give a specific benefit, tension, mistake, contrast, or curiosity gap.`,
        "Perspective boundary: only Slide 1 may lead with direct reader wording. Slides 2-5 must stay in the first-person story voice (I, me, or my). Slide 6 may turn the lesson toward the reader after its takeaway.",
        "Slides 1-5 return ctaText: null. Slide 6 may include a short natural CTA, otherwise null, alongside its useful final value. The renderer displays it on that same slide as plain text, not a button or pill.",
        `Optional content headings use black text on a fitted white SVG pill, at most two lines at 50px. Body blocks and optional CTA are white text without background. Slide 1 uses centered Inter Tight Bold at 700 weight, ${getCarouselStructure2StoryFontSize(1)}px type within ${getCarouselStructure2StoryMaxLines(1)} visual lines. Each body block fits three lines at ${CAROUSEL_FIXED_FONT_SIZE}px. No gradient, tint or CTA button is added. All text groups must fit inside the square safe area; never shrink or truncate.`,
        "Follow roleGuidance in its given order. Do not reorder, repeat, or omit story roles.",
        "Slide 4 must explain a real product capability that directly addresses the Slide 2 problem. Keep product connections natural and grounded only in businessDescription; never invent a capability.",
        "Do not invent precise features, proof, metrics, customers, guarantees, health outcomes, financial outcomes, or performance claims.",
        "Avoid close wording and close paraphrases from recentAcceptedCopy, including hooks, emotional turns, and final takeaways.",
        "Minimal business context:",
        JSON.stringify({ businessDescription: params.businessDescription }),
        "Assigned creative briefs and format references:",
        JSON.stringify(assignments),
        "Last accepted Carousel copies (exact visible text):",
        JSON.stringify(normalizeRecentHistory(params.recentHistory)),
        STRUCTURE_2_OUTPUT_COPY_CONTRACT,
      ].join("\n"),
    },
  ];
}

export function buildCarouselStructure2RepairMessages(params: {
  assignment: CarouselStructure2StoryAssignment;
  businessDescription: string;
  issues: readonly CarouselStructure2StoryValidationIssue[];
  rawPlan: unknown;
  recentHistory?: readonly CarouselStructure2RecentHistoryInput[];
  repairAttempt?: number;
  repairAttemptLimit?: number;
}) {
  const hasSlideOneCoverFitFailure = params.issues.some(
    (issue) =>
      issue.slideNumber === 1 &&
      (issue.code === "hook_incomplete" ||
        issue.code === "render_fit" ||
        issue.code === "hook_length"),
  );
  const hasSlideOneCutoff = params.issues.some(
    (issue) => issue.slideNumber === 1 && issue.code === "hook_incomplete",
  );

  return [
    {
      role: "system" as const,
      content:
        `Repair one Structure 2 JSON plan. Preserve valid AI copy unless a structural or renderability issue requires changing it. Keep the selected format reference, creative seed, emotion, and six-slide sequence: reader-first cover, problem, realization, product mechanism, modest proof or result, then useful final value with an optional CTA on Slide 6 only. Do not return slideNumber, slotIndex, candidateIndex, or storyFormatId; the worker owns those structural values. ${STRUCTURE_2_OUTPUT_COPY_CONTRACT} ${STRUCTURE_2_COPY_QUALITY_GUIDANCE} ${STRUCTURE_2_JSON_OUTPUT_GUIDANCE}`,
    },
    {
      role: "user" as const,
      content: [
        "Creative brief:",
        JSON.stringify({
          creativeSeed: params.assignment.creativeSeed,
          emotion: params.assignment.emotion,
          privateCreativeBrief: params.assignment.planningBrief,
        }),
        "Minimal business context:",
        JSON.stringify({ businessDescription: params.businessDescription }),
        "Format reference:",
        structure2HookGuidance(params.assignment),
        JSON.stringify(getFormatReference(params.assignment.storyFormatId)),
        `Slide 1 is reader-first, so direct reader wording such as 'you' or 'your' is allowed. ${STRUCTURE_2_COVER_HOOK_COPY_GUIDANCE} It is rendered in centered Inter Tight Bold at 700 weight and must create a specific reason to swipe within ${getCarouselStructure2StoryMaxLines(1)} visual lines at ${getCarouselStructure2StoryFontSize(1)}px type.`,
        "Only Slide 1 may lead with direct reader wording. Keep Slides 2-5 in the first-person story voice (I, me, or my); Slide 6 may turn the lesson toward the reader after its takeaway.",
        CAROUSEL_TEXT_PRESENTATION_GUIDANCE,
        "Keep Slides 2-6 readable: aim for 16-22 body words total (accepted 14-30). Preserve distinct optional headline and storyText body blocks separated by \\n\\n; each block fits three lines at 48px.",
        `Slide 1's ${CAROUSEL_HOOK_MIN_WORDS}-${CAROUSEL_HOOK_MAX_WORDS} word single-hook limit and every Slide 2-6 14-30 word range are publishing requirements. Repair the listed blocking issues and preserve slides that already passed validation.`,
        params.repairAttempt === params.repairAttemptLimit
          ? "This is the final bounded copy repair. Before returning, count whitespace-delimited body words in every changed Slide 2-6. Keep any optional CTA on Slide 6 only. Return only a plan that satisfies every listed publishing requirement."
          : null,
        hasSlideOneCoverFitFailure
          ? hasSlideOneCutoff
            ? `Slide 1 ends without a complete thought. Replace it with a shorter, self-contained hook; never leave a partial final word or phrase, and do not add support copy.`
            : `Slide 1 does not fit its fixed visual treatment. Replace it with a shorter, simpler single hook that fits the real four-line display area at ${getCarouselStructure2StoryFontSize(1)}px. Do not add support copy.`
          : null,
        "Validation issues:",
        JSON.stringify(params.issues),
        "Last accepted Carousel copies (exact visible text):",
        JSON.stringify(normalizeRecentHistory(params.recentHistory)),
        "Invalid original plan:",
        JSON.stringify(params.rawPlan),
      ].filter((line): line is string => line !== null).join("\n"),
    },
  ];
}

export function buildCarouselStructure2StoryTextRepairMessages(params: {
  assignment: CarouselStructure2StoryAssignment;
  businessDescription: string;
  issues: readonly CarouselStructure2StoryValidationIssue[];
  plan: CarouselStructure2StoryPlan;
  recentHistory?: readonly CarouselStructure2RecentHistoryInput[];
  repairAttempt: number;
  repairAttemptLimit: number;
}) {
  const slideNumbers = getTargetedSlideNumbers(params.issues);
  const slides = slideNumbers.map((slideNumber) => {
    const slide = params.plan.slides[slideNumber - 1];
    if (!slide) {
      throw new Error("A targeted Structure 2 copy repair requires valid slides.");
    }
    const isCover = slide.slideNumber === 1;
    const wordRange = isCover ? `${CAROUSEL_HOOK_MIN_WORDS}-${CAROUSEL_HOOK_MAX_WORDS}` : "14-30";
    const targetRange = isCover ? "6-10" : "18-22";
    const lineLimit = getCarouselStructure2StoryMaxLines(slide.slideNumber);
    const fontSize = getCarouselStructure2StoryFontSize(slide.slideNumber);
    return {
      currentStoryText: slide.storyText,
      hookGuidance: isCover ? structure2HookGuidance(params.assignment) : undefined,
      replacementKey: getTargetedStoryTextKey(slide.slideNumber),
      requirement: isCover
        ? `${STRUCTURE_2_COVER_HOOK_COPY_GUIDANCE} Return one statement in one block, normally ${targetRange} words. It must stay within ${wordRange} words and fit within ${lineLimit} visual lines at centered ${fontSize}px type. Never leave a hanging phrase.`
        : `Return one or two short ${slide.storyRole} body blocks separated by \\n\\n, totaling ${wordRange} words; aim for ${targetRange} words. Each block must fit three visual lines at ${fontSize}px. Preserve the separate heading and existing CTA.`,
      roleGuidance: getFormatReference(params.assignment.storyFormatId).roleGuidance[
        slide.slideNumber - 1
      ],
      slideNumber: slide.slideNumber,
      storyRole: slide.storyRole,
      voiceRequirement:
        slide.slideNumber >= 2 && slide.slideNumber <= 5
          ? "Keep the replacement in first-person story voice (I, me, or my)."
          : slide.slideNumber === 6
            ? "Preserve the useful final value; any existing CTA remains in its separate field on this same slide."
            : null,
    };
  });
  if (slides.length === 0) {
    throw new Error("A targeted Structure 2 copy repair requires at least one slide.");
  }

  return [
    {
      role: "system" as const,
      content:
        `Repair only the listed visible Structure 2 storyText values. Return only JSON with one storyTextBySlide object containing exactly the requested replacement keys. Do not return a plan, slide metadata, heading, labels, a CTA, or an explanation. Each replacement must resolve its stated failure while preserving the original slide role and natural story flow. ${STRUCTURE_2_OUTPUT_COPY_CONTRACT} ${STRUCTURE_2_COPY_QUALITY_GUIDANCE} ${STRUCTURE_2_JSON_OUTPUT_GUIDANCE} Body blocks may use a blank line; slide1 NEVER uses a blank line. Do not carry the failed cover's two-sentence pattern into its replacement.`,
    },
    {
      role: "user" as const,
      content: [
        "Minimal business context:",
        JSON.stringify({ businessDescription: params.businessDescription }),
        "Creative brief:",
        JSON.stringify({
          creativeSeed: params.assignment.creativeSeed,
          emotion: params.assignment.emotion,
          privateCreativeBrief: params.assignment.planningBrief,
        }),
        "Slides to replace:",
        JSON.stringify(slides),
        "Never invent precise features, metrics, guarantees, or outcomes. Do not closely paraphrase recent accepted copy.",
        params.repairAttempt === params.repairAttemptLimit
          ? "This is the final bounded repair. Check the exact count and completeness before returning."
          : null,
        "Validation issue to correct:",
        JSON.stringify(params.issues),
        "Last accepted Carousel copies (exact visible text):",
        JSON.stringify(normalizeRecentHistory(params.recentHistory)),
      ]
        .filter((line): line is string => line !== null)
        .join("\n"),
    },
  ];
}

export function parseCarouselStructure2StoryTextRepair(
  value: unknown,
  slideNumbers: readonly number[],
) {
  const record = asRecord(value, "Structure 2 targeted story-text repair");
  assertExactObjectKeys(
    record,
    ["storyTextBySlide"],
    "Structure 2 targeted story-text repair",
  );
  const values = asRecord(
    record.storyTextBySlide,
    "Structure 2 targeted story-text replacement values",
  );
  const keys = getTargetedStoryTextKeys(slideNumbers);
  assertExactObjectKeys(
    values,
    keys,
    "Structure 2 targeted story-text replacement values",
  );
  return new Map(
    slideNumbers.map((slideNumber) => [
      slideNumber,
      getRequiredString(
        values[getTargetedStoryTextKey(slideNumber)],
        `Structure 2 targeted story text for Slide ${slideNumber}`,
        MAX_STORY_TEXT_LENGTH,
      ),
    ]),
  );
}

export function normalizeCarouselStructure2RecentHistory(
  history: readonly CarouselStructure2RecentHistoryInput[] | undefined,
) {
  return normalizeRecentHistory(history);
}

export function assertCarouselStructure2StoryAssignments(
  assignments: readonly CarouselStructure2StoryAssignment[],
) {
  if (
    assignments.length !== 5 ||
    new Set(assignments.map((assignment) => assignment.slotIndex)).size !== 5 ||
    assignments.some(
      (assignment) =>
        assignment.slotIndex < 0 ||
        assignment.slotIndex > 4 ||
        !isCarouselStructure2FormatId(assignment.storyFormatId) ||
        !assignment.creativeSeed.trim() ||
        !assignment.emotion.trim(),
    )
  ) {
    throw new Error(
      "A Structure 2 story batch requires five unique slots with a format, creativeSeed, and emotion.",
    );
  }
}

export function createCarouselStructure2InvalidPlanIssue(
  error: unknown,
): CarouselStructure2StoryValidationIssue {
  return {
    code: "invalid_plan",
    message: getErrorMessage(error).slice(0, 500),
    slideNumber: null,
  };
}

export function dedupeCarouselStructure2ValidationIssues(
  issues: readonly CarouselStructure2StoryValidationIssue[],
) {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.code}:${issue.slideNumber ?? 0}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function formatCarouselStructure2ValidationIssues(
  issues: readonly CarouselStructure2StoryValidationIssue[],
) {
  return dedupeCarouselStructure2ValidationIssues(issues)
    .map((issue) =>
      issue.slideNumber
        ? `Slide ${issue.slideNumber}: ${issue.message}`
        : issue.message,
    )
    .join(" ");
}

function getFormatReference(storyFormatId: CarouselStructure2FormatId) {
  const format = getCarouselStructure2Format(storyFormatId);
  return {
    exampleFlows: format.exampleFlows,
    generationRules: format.generationRules,
    id: format.id,
    name: format.name,
    purpose: format.purpose,
    roleGuidance: format.slides.map((slide) => ({
      instruction: slide.instruction,
      maximumWords: slide.maximumWords,
      minimumWords: slide.minimumWords,
      storyRole: slide.storyRole,
    })),
  };
}

function normalizeRecentHistory(
  history: readonly CarouselStructure2RecentHistoryInput[] | undefined,
) {
  return (history ?? []).slice(0, CAROUSEL_STRUCTURE_2_STORY_HISTORY_LIMIT).map(
    (item) => ({
      contentPlanItemId: item.contentPlanItemId,
      formatId: item.formatId,
      generationId: item.generationId,
      slides: item.slides.map((slide) => ({
        ctaText: slide.ctaText,
        headline: slide.headline,
        slideNumber: slide.slideNumber,
        subtext: slide.subtext,
      })),
      structureId: item.structureId,
    }),
  );
}

function getProductVisualEligibility(
  role: CarouselStructure2StoryRole,
): CarouselStructure2ProductVisualEligibility {
  if (role === "product_turning_point" || role === "takeaway_cta") {
    return "preferred";
  }
  return "allowed";
}

function includesBusinessName(value: string, businessDescription: string) {
  const firstPhrase = businessDescription
    .trim()
    .split(/[.!?\n]/)[0]
    ?.trim()
    .split(/\s+/)
    .slice(0, 4)
    .join(" ");

  return Boolean(
    firstPhrase &&
      firstPhrase.length >= 3 &&
      value.toLocaleLowerCase().includes(firstPhrase.toLocaleLowerCase()),
  );
}

function getTargetedSlideNumbers(
  issues: readonly CarouselStructure2StoryValidationIssue[],
) {
  const slideNumbers = [
    ...new Set(issues.map((issue) => issue.slideNumber)),
  ].sort((left, right) => (left ?? 0) - (right ?? 0));
  if (
    slideNumbers.length === 0 ||
    slideNumbers.some(
      (slideNumber) =>
        slideNumber === null ||
        !Number.isInteger(slideNumber) ||
        slideNumber < 1 ||
        slideNumber > CAROUSEL_STRUCTURE_2_SLIDE_POSITION_KEYS.length,
    )
  ) {
    throw new Error("Targeted Structure 2 copy repair requires numbered slides.");
  }
  return slideNumbers as number[];
}

function getTargetedStoryTextKeys(slideNumbers: readonly number[]) {
  return getTargetedSlideNumbers(
    slideNumbers.map((slideNumber) => ({
      code: "word_count" as const,
      message: "",
      slideNumber,
    })),
  ).map(getTargetedStoryTextKey);
}

function getTargetedStoryTextKey(slideNumber: number) {
  return `slide${slideNumber}`;
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function isClearlyIncompleteCoverHook(value: string) {
  if (/[.!?…]$/.test(value)) return false;
  const finalToken = value.trim().split(/\s+/).at(-1) ?? "";
  return (
    INCOMPLETE_HOOK_ENDING_PATTERN.test(value) ||
    // A lone final letter at the preferred 42-character boundary is a strong
    // truncation signal. A normal unpunctuated social hook at that length is
    // not; its measured render fit decides publication.
    (value.length === CAROUSEL_STRUCTURE_2_COVER_HOOK_PREFERRED_MAX_CHARACTERS &&
      /^[a-z]$/i.test(finalToken))
  );
}

function hasExactVisibleCopyMatch(left: string, right: string) {
  return normalizeVisibleCopy(left) === normalizeVisibleCopy(right);
}

function normalizeVisibleCopy(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokenOverlap(left: string, right: string) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  const union = new Set([...leftTokens, ...rightTokens]);
  if (union.size === 0) return 0;

  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }

  const containment =
    intersection / Math.max(1, Math.min(leftTokens.size, rightTokens.size));
  return Math.max(intersection / union.size, containment);
}

function tokenize(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function assertExactObjectKeys(
  record: Record<string, unknown>,
  expectedKeys: readonly string[],
  label: string,
) {
  const actualKeys = Object.keys(record).sort();
  const normalizedExpectedKeys = [...expectedKeys].sort();

  if (
    actualKeys.length !== normalizedExpectedKeys.length ||
    actualKeys.some((key, index) => key !== normalizedExpectedKeys[index])
  ) {
    throw new Error(`${label} does not match the required structural fields.`);
  }
}

function getRequiredString(value: unknown, label: string, maximum: number) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  const normalized = normalizeCarouselText(value);
  if (normalized.length > maximum) {
    throw new Error(`${label} exceeds ${maximum} characters.`);
  }
  return normalized;
}

function getOptionalString(value: unknown, label: string, maximum: number) {
  if (value === null || value === undefined) return null;
  return getRequiredString(value, label, maximum);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown Structure 2 error.";
}
