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
  CAROUSEL_STRUCTURE_2_CTA_MAX_LINES,
  CAROUSEL_STRUCTURE_2_STORY_MAX_LINES,
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

export const CAROUSEL_STRUCTURE_2_STORY_SCHEMA_VERSION =
  "carousel-structure-2-strict-six-slide-story-v6";
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
const GENERIC_COPY_PATTERN =
  /\b(boost productivity|streamline your workflow|unlock efficiency|work smarter|next level|seamless|one platform|one workspace for everything)\b/i;

export type CarouselStructure2ProductVisualEligibility =
  | "allowed"
  | "forbidden"
  | "preferred";

export type CarouselStructure2StorySlide = {
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
    | "invalid_plan"
    | "perspective"
    | "product_timing"
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
    if (reference.ctaPolicy === "none" && slide.ctaText) {
      throw new Error(
        `Structure 2 slide ${slide.slideNumber} cannot include a CTA.`,
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
    ["ctaText", "storyRole", "storyText", "visualContext"],
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
    ctaText: getOptionalString(record.ctaText, `${label} CTA`, MAX_CTA_TEXT_LENGTH),
    productVisualEligibility: getProductVisualEligibility(resolvedRole),
    slideNumber: index + 1,
    storyRole: resolvedRole,
    storyText: getRequiredString(
      record.storyText,
      `${label} story text`,
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
    const copy = [slide.storyText, slide.ctaText]
      .filter((value): value is string => Boolean(value))
      .join(" ");
    const reference = format.slides[slide.slideNumber - 1];
    const wordCount = countWords(copy);
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

    if (!storyFit.fits) {
      issues.push({
        code: "render_fit",
        message: `Story copy must fit within ${storyMaximumLines} lines at the ${storyFontSize}px font size. ${storyFit.reason ?? ""}`.trim(),
        slideNumber: slide.slideNumber,
      });
    }

    const ctaFit = slide.ctaText
      ? inspectCarouselFixedTextFit({
        maximumLines: CAROUSEL_STRUCTURE_2_CTA_MAX_LINES,
        maximumWidth: CAROUSEL_STRUCTURE_2_FIXED_TEXT_WIDTH,
        value: slide.ctaText,
      })
      : null;

    if (ctaFit) {
      if (!ctaFit.fits) {
        issues.push({
          code: "render_fit",
          message: `CTA copy must fit within ${CAROUSEL_STRUCTURE_2_CTA_MAX_LINES} lines at the fixed ${CAROUSEL_FIXED_FONT_SIZE}px font size. ${ctaFit.reason ?? ""}`.trim(),
          slideNumber: slide.slideNumber,
        });
      }
    }

    if (
      !doesCarouselStructure2TextFitSafeArea({
        ctaLineCount: ctaFit?.lines.length ?? 0,
        ctaFontSize: CAROUSEL_FIXED_FONT_SIZE,
        height: 1080,
        storyLineCount: storyFit.lines.length,
        storyFontSize,
      })
    ) {
      issues.push({
        code: "render_fit",
        message:
          "Story and CTA copy do not fit together inside the fixed 1:1 safe area at the fixed font size.",
        slideNumber: slide.slideNumber,
      });
    }

    if (
      reference &&
      (wordCount < reference.minimumWords || wordCount > reference.maximumWords)
    ) {
      issues.push({
        code: "word_count",
        message: `Slide copy has ${wordCount} words, outside the advisory reference ${reference.minimumWords}-${reference.maximumWords} word range.`,
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
    if (reference?.ctaPolicy === "none" && slide.ctaText) {
      issues.push({
        code: "cta_mismatch",
        message: "Only the sixth slide may include a CTA.",
        slideNumber: slide.slideNumber,
      });
    }
    if (
      reference?.perspective === "first_person" &&
      /\b(you|your)\b/i.test(slide.storyText)
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
      includesBusinessName(slide.storyText, params.businessDescription)
    ) {
      issues.push({
        code: "product_timing",
        message: "The product must not appear before the product-mechanism slide.",
        slideNumber: slide.slideNumber,
      });
    }
    if (GENERIC_COPY_PATTERN.test(copy)) {
      issues.push({
        code: "generic_copy",
        message: "Slide copy uses stale or generic marketing language.",
        slideNumber: slide.slideNumber,
      });
    }
    if (slide.ctaText && /\b(download now|buy now|unlock efficiency)\b/i.test(slide.ctaText)) {
      issues.push({
        code: "cta_mismatch",
        message: "The CTA is generic instead of connected to this story.",
        slideNumber: slide.slideNumber,
      });
    }
    if (/\b\d+(?:[.,]\d+)?\s*(?:%(?!\w)|(?:percent|users?|customers?|hours?|days?)\b)/i.test(copy)) {
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
    .flatMap((slide) => [slide.storyText, slide.ctaText])
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
      (currentHook && priorHook && tokenOverlap(currentHook, priorHook) >= 0.75) ||
      (currentFullCopy &&
        priorFullCopy &&
        tokenOverlap(currentFullCopy, priorFullCopy) >= 0.72)
    ) {
      issues.push({
        code: "recent_repetition",
        message: "The hook or visible story copy closely repeats a recent accepted Carousel.",
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
    // Reference word ranges are writing guidance. Measured render fit and
    // structural/claim validation remain the publishing boundary.
    (issue.code === "word_count" ? advisoryIssues : blockingIssues).push(issue);
  }

  return { advisoryIssues, blockingIssues };
}

export function buildCarouselStructure2StoryPlanSchema() {
  const slides = Object.fromEntries(
    CAROUSEL_STRUCTURE_2_SLIDE_POSITION_KEYS.map((positionKey) => [
      positionKey,
      {
        additionalProperties: false,
        properties: {
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
            maxLength: MAX_STORY_TEXT_LENGTH,
            minLength: 1,
            type: "string",
          },
          visualContext: {
            maxLength: MAX_VISUAL_CONTEXT_LENGTH,
            minLength: 1,
            type: "string",
          },
        },
        required: ["ctaText", "storyRole", "storyText", "visualContext"],
        type: "object",
      },
    ]),
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
      outputKey: CAROUSEL_STRUCTURE_2_BATCH_POSITION_KEYS[index],
      privateCreativeBrief: assignment.planningBrief,
    }));

  return [
    {
      role: "system" as const,
      content:
        "You write native Instagram product-story carousels for Structure 2. Create exactly five independent carousels with exactly six slides each. Every carousel follows this strict sequence: reader-first cover, problem, realization, product mechanism, modest proof or result, useful takeaway or CTA. Private creative briefs add context but are not visible labels or compulsory plots. Return only the requested JSON.",
    },
    {
      role: "user" as const,
      content: [
        "Use each creativeSeed as a broad starting point and its emotion as the emotional current. Do not treat either as finished copy or a complete plot.",
        "Use privateCreativeBrief only as flexible human and factual context; its preferredFormatFamily must never override the backend-selected format reference.",
        "Use each role's word range as writing guidance. Develop the story beat clearly, keep the cover concise, and prioritize readable copy that fits the stated display area.",
        "Return each plan under its assigned outputKey. Do not return slideNumber, slotIndex, candidateIndex, or storyFormatId; the worker owns those structural values.",
        "Develop genuinely different stories inside the required six-slide sequence. Do not force every item through the same overwhelmed-to-easier arc.",
        "Slide 1 is reader-first: direct reader wording such as 'you' or 'your' is allowed. Give a specific benefit, tension, mistake, contrast, or curiosity gap; do not force it into a first-person personal-story opener.",
        "Perspective boundary: only Slide 1 may lead with direct reader wording. Slides 2-5 must stay in the first-person story voice (I, me, or my). Slide 6 may turn the lesson toward the reader after its takeaway.",
        "Slides 1-5 must return ctaText: null. Slide 6 may use a natural, low-pressure CTA or return null when a useful takeaway stands on its own.",
        `Every story uses white text directly on the image; do not expect a white SVG background for storyText or ctaText. Slide 1 uses ${getCarouselStructure2StoryFontSize(1)}px type within ${getCarouselStructure2StoryMaxLines(1)} visual lines; Slides 2-6 use ${CAROUSEL_FIXED_FONT_SIZE}px type within ${CAROUSEL_STRUCTURE_2_STORY_MAX_LINES} visual lines. CTA text stays within ${CAROUSEL_STRUCTURE_2_CTA_MAX_LINES} lines, and all text must fit inside the square safe area. The renderer will not shrink or truncate copy.`,
        "Follow roleGuidance in its given order. Do not reorder, repeat, or omit story roles.",
        "Slide 4 must explain a real product capability that directly addresses the Slide 2 problem. Keep product connections natural and grounded only in businessDescription; never invent a capability.",
        "Do not invent precise features, proof, metrics, customers, guarantees, health outcomes, financial outcomes, or performance claims.",
        "Avoid close wording and close paraphrases from recentAcceptedCopy, including hooks, emotional turns, and CTA wording.",
        "Minimal business context:",
        JSON.stringify({ businessDescription: params.businessDescription }),
        "Assigned creative briefs and format references:",
        JSON.stringify(assignments),
        "Last accepted Carousel copies (exact visible text):",
        JSON.stringify(normalizeRecentHistory(params.recentHistory)),
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
}) {
  const hasSlideOneRenderFitFailure = params.issues.some(
    (issue) => issue.code === "render_fit" && issue.slideNumber === 1,
  );

  return [
    {
      role: "system" as const,
      content:
        "Repair one Structure 2 JSON plan. Preserve valid AI copy unless a structural or renderability issue requires changing it. Keep the selected format reference, creative seed, emotion, and six-slide sequence: reader-first cover, problem, realization, product mechanism, modest proof or result, takeaway or CTA. Slides 1-5 must return ctaText: null; only Slide 6 may use a low-pressure CTA. Do not return slideNumber, slotIndex, candidateIndex, or storyFormatId; the worker owns those structural values. Return only repaired JSON.",
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
        JSON.stringify(getFormatReference(params.assignment.storyFormatId)),
        "Slide 1 is reader-first, so direct reader wording such as 'you' or 'your' is allowed. It must create a specific reason to swipe and fit within three visual lines at 60px type.",
        "Only Slide 1 may lead with direct reader wording. Keep Slides 2-5 in the first-person story voice (I, me, or my); Slide 6 may turn the lesson toward the reader after its takeaway.",
        "Word ranges are advisory writing targets. Repair the listed blocking issues and preserve slides that already passed validation.",
        hasSlideOneRenderFitFailure
          ? "Slide 1 overflowed its real three-line display area. Replace it with a shorter, simpler cover rather than merely trimming words."
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

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
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
  const normalized = value.trim().replace(/\s+/g, " ");
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
