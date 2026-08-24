import type { CarouselRecentAcceptedCopy } from "./carousel-content-plan.js";
import {
  CAROUSEL_STRUCTURE_2_STORY_ROLES,
  getCarouselStructure2Format,
  isCarouselStructure2FormatId,
  type CarouselStructure2FormatId,
  type CarouselStructure2StoryRole,
} from "./carousel-structure-2-formats.js";

export const CAROUSEL_STRUCTURE_2_STORY_SCHEMA_VERSION =
  "carousel-structure-2-flexible-story-v2";
export const CAROUSEL_STRUCTURE_2_STORY_HISTORY_LIMIT = 10;

const MAX_ANGLE_LENGTH = 180;
const MAX_CTA_TEXT_LENGTH = 180;
const MAX_STORY_TEXT_LENGTH = 360;
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
  const strategyRecord = asRecord(record.strategy, "Structure 2 strategy");
  const storyFormatId = getRequiredString(
    strategyRecord.storyFormatId,
    "Structure 2 storyFormatId",
    80,
  );

  if (storyFormatId !== params.storyFormatId) {
    throw new Error(
      `Structure 2 storyFormatId must remain ${params.storyFormatId}.`,
    );
  }
  if (!Array.isArray(record.slides) || record.slides.length !== 5) {
    throw new Error("Structure 2 story plan must contain exactly five slides.");
  }

  const slides = record.slides.map((value, index) =>
    parseStorySlide(value, index),
  );
  const ctaSlides = slides.filter((slide) => slide.ctaText !== null);
  const format = getCarouselStructure2Format(params.storyFormatId);

  if (ctaSlides.length !== 1) {
    throw new Error("Structure 2 requires exactly one CTA across its five slides.");
  }
  if (!format.allowedCtaPositions.includes(ctaSlides[0]!.slideNumber)) {
    throw new Error(
      `Structure 2 format ${format.id} allows its CTA only on slide ${format.allowedCtaPositions.join(" or ")}.`,
    );
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
  const slideNumber = getInteger(record.slideNumber, `${label} number`, 1, 5);
  const storyRole = getRequiredString(record.storyRole, `${label} role`, 80);

  if (slideNumber !== index + 1) {
    throw new Error(`${label} has an invalid slide number.`);
  }
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
    slideNumber,
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
    const reference = format.slides.find(
      (definition) => definition.storyRole === slide.storyRole,
    );
    const wordCount = countWords(copy);

    if (
      reference &&
      (wordCount < reference.minimumWords || wordCount > reference.maximumWords)
    ) {
      issues.push({
        code: "word_count",
        message: `Slide copy is outside the reference ${reference.minimumWords}-${reference.maximumWords} word range.`,
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
    if (/\b\d+(?:[.,]\d+)?\s*(?:%|percent|users?|customers?|hours?|days?)\b/i.test(copy)) {
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
    if (issue.code === "invalid_plan") blockingIssues.push(issue);
    else advisoryIssues.push(issue);
  }

  return { advisoryIssues, blockingIssues };
}

export function buildCarouselStructure2StoryPlanSchema(params: {
  storyFormatId: CarouselStructure2FormatId;
}) {
  const format = getCarouselStructure2Format(params.storyFormatId);

  return {
    additionalProperties: false,
    properties: {
      slides: {
        items: {
          anyOf: [0, 1, 2, 3, 4].map((index) => ({
            additionalProperties: false,
            properties: {
              ctaText: format.allowedCtaPositions.includes(index + 1)
                ? {
                    anyOf: [
                      { maxLength: MAX_CTA_TEXT_LENGTH, minLength: 1, type: "string" },
                      { type: "null" },
                    ],
                  }
                : { type: "null" },
              slideNumber: { enum: [index + 1], type: "integer" },
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
            required: [
              "ctaText",
              "slideNumber",
              "storyRole",
              "storyText",
              "visualContext",
            ],
            type: "object",
          })),
        },
        maxItems: 5,
        minItems: 5,
        type: "array",
      },
      strategy: {
        additionalProperties: false,
        properties: {
          angle: { maxLength: MAX_ANGLE_LENGTH, minLength: 1, type: "string" },
          storyFormatId: { enum: [format.id], type: "string" },
        },
        required: ["angle", "storyFormatId"],
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

  return {
    additionalProperties: false,
    properties: {
      items: {
        items: {
          anyOf: params.assignments.map((assignment) => ({
            additionalProperties: false,
            properties: {
              plan: buildCarouselStructure2StoryPlanSchema({
                storyFormatId: assignment.storyFormatId,
              }),
              slotIndex: { enum: [assignment.slotIndex], type: "integer" },
            },
            required: ["plan", "slotIndex"],
            type: "object",
          })),
        },
        maxItems: 5,
        minItems: 5,
        type: "array",
      },
    },
    required: ["items"],
    type: "object",
  } as const;
}

export function buildCarouselStructure2BatchMessages(params: {
  assignments: readonly CarouselStructure2StoryAssignment[];
  businessDescription: string;
  recentHistory?: readonly CarouselStructure2RecentHistoryInput[];
}) {
  assertCarouselStructure2StoryAssignments(params.assignments);
  const assignments = [...params.assignments]
    .sort((left, right) => left.slotIndex - right.slotIndex)
    .map((assignment) => ({
      candidateIndex: assignment.candidateIndex,
      creativeSeed: assignment.creativeSeed,
      emotion: assignment.emotion,
      formatReference: getFormatReference(assignment.storyFormatId),
      slotIndex: assignment.slotIndex,
    }));

  return [
    {
      role: "system" as const,
      content:
        "You write native Instagram story carousels for Structure 2. Create exactly five independent carousels with exactly five slides each. The format is a controlled creative reference, not a compulsory sentence-by-sentence backbone. The CTA position is format-specific and structurally required. Return only the requested JSON.",
    },
    {
      role: "user" as const,
      content: [
        "Use each creativeSeed as a broad starting point and its emotion as the emotional current. Do not treat either as finished copy or a complete plot.",
        "Develop genuinely different stories. Do not force every item through the same overwhelmed-to-easier arc.",
        "Each story must contain exactly one CTA, and it must appear only at a position listed in that format's allowedCtaPositions.",
        "Use exampleFlows and roleGuidance as inspiration. You may choose another ordering of the known story roles when it better serves the seed, except for the locked CTA position.",
        "Keep product connections natural and grounded only in businessDescription. Do not force a product sentence onto Slide 4.",
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
  return [
    {
      role: "system" as const,
      content:
        "Repair one Structure 2 JSON plan. Preserve valid AI copy unless a structural or renderability issue requires changing it. Keep the selected format ID, creative seed, emotion, five-slide count, and format-specific CTA position. Return only repaired JSON.",
    },
    {
      role: "user" as const,
      content: [
        `Repair slot ${params.assignment.slotIndex}.`,
        "Creative brief:",
        JSON.stringify(params.assignment),
        "Minimal business context:",
        JSON.stringify({ businessDescription: params.businessDescription }),
        "Format reference:",
        JSON.stringify(getFormatReference(params.assignment.storyFormatId)),
        "Validation issues:",
        JSON.stringify(params.issues),
        "Last accepted Carousel copies (exact visible text):",
        JSON.stringify(normalizeRecentHistory(params.recentHistory)),
        "Invalid original plan:",
        JSON.stringify(params.rawPlan),
      ].join("\n"),
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
    allowedCtaPositions: format.allowedCtaPositions,
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
  if (role === "product_turning_point") return "preferred";
  return "allowed";
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

function getInteger(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(`${label} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value;
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
