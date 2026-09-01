import { createHash } from "node:crypto";

import OpenAI from "openai";

import type { CarouselContentPlanItemRow, Json } from "../types.js";
import { getContentPlanItemConceptLanes } from "./content-plan-concept-lanes.js";
import { CAROUSEL_TEXT_MODEL } from "./carousel-text-model.js";

export const CAROUSEL_CONTENT_PLAN_PROMPT_VERSION =
  "carousel-content-plan-creative-briefs-v6-item-context-concept-lanes";
export const CAROUSEL_CONTENT_PLAN_CHUNK_SIZE = 25;
export const CAROUSEL_CONTENT_PLAN_BRIEF_COUNT = 30;
export const CAROUSEL_CONTENT_PLAN_ITEMS_PER_BRIEF = 5;

const MAX_CREATIVE_SEED_LENGTH = 400;
const MAX_EMOTION_LENGTH = 120;
const MAX_GENERATION_ATTEMPTS = 2;
const MAX_SINGLE_IDEA_REPAIR_ATTEMPTS = 3;
const PREFERRED_FORMAT_FAMILIES = [
  "common_problem",
  "contrast",
  "emotional_observation",
  "practical_reframe",
  "relatable_situation",
  "small_story",
] as const;
let openaiClient: OpenAI | null = null;

export type CarouselPlanningBrief = {
  audienceContext: string;
  conceptLane?: string;
  creativeSeed: string;
  emotionalTension: string;
  humanMoment: string;
  preferredFormatFamily: string;
  supportedAngle: string;
};

type GeneratedCarouselContentPlanBrief = CarouselPlanningBrief & {
  briefSlotIndex: number;
};

export type GeneratedCarouselContentPlanItem = {
  briefSlotIndex: number;
  creativeSeed: string;
  emotion: string;
  itemSlotIndex: number;
  planningBrief: CarouselPlanningBrief;
};

export type GeneratedCarouselContentPlanChunk = {
  briefs: GeneratedCarouselContentPlanBrief[];
  items: GeneratedCarouselContentPlanItem[];
};

export type CarouselCreativeBrief = {
  businessDescription: string;
  contentPlanId: string;
  contentPlanItemId: string;
  creativeSeed: string;
  emotion: string;
  planningBrief: CarouselPlanningBrief | null;
};

export type CarouselRecentAcceptedCopy = {
  contentPlanItemId: string | null;
  formatId: string | null;
  generationId: string;
  slides: Array<{
    ctaText: string | null;
    headline: string;
    slideNumber: number;
    subtext: string | null;
  }>;
  structureId: "structure_1" | "structure_2";
};

export async function generateCarouselContentPlanChunk(params: {
  briefIndexStart?: number;
  businessDescription: string;
  count: number;
  existingItems: Array<Pick<CarouselContentPlanItemRow, "creative_seed" | "emotion">>;
  planningContext: Json;
}) {
  const count = Math.trunc(params.count);

  if (count < 5 || count > CAROUSEL_CONTENT_PLAN_CHUNK_SIZE || count % 5 !== 0) {
    throw new Error("Carousel content-plan chunks must contain 5 to 25 items in groups of five.");
  }

  const briefCount = count / CAROUSEL_CONTENT_PLAN_ITEMS_PER_BRIEF;
  const briefIndexStart = params.briefIndexStart ?? 1;
  if (!Number.isInteger(briefIndexStart) || briefIndexStart < 1) {
    throw new Error("Carousel content-plan brief index must be positive.");
  }
  let lastIssues: string[] = [];

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const completion = await getOpenAIClient().chat.completions.create({
      max_completion_tokens: 6_000,
      messages: buildMessages({
        ...params,
        briefIndexStart,
        briefCount,
        count,
        issues: attempt === 0 ? [] : lastIssues,
      }),
      model: CAROUSEL_TEXT_MODEL,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "carousel_content_plan_creative_brief_chunk",
          schema: buildSchema(briefCount),
          strict: true,
        },
      },
      temperature: 0.75,
    });
    const content = completion.choices[0]?.message.content;

    if (!content) {
      lastIssues = ["The model returned no content."];
      continue;
    }

    try {
      const parsed = parseCarouselContentPlanChunk(
        JSON.parse(content),
        briefCount,
        briefIndexStart,
      );
      const issues = validateCarouselContentPlanChunk({
        existingItems: params.existingItems,
        items: parsed.items,
      });

      if (issues.length === 0) return parsed;

      // A literal copied idea is a local shortfall. Keep the other 24 ideas
      // and ask for a replacement for that exact item.
      if (issues.every(isRepairableCarouselIdeaIssue)) {
        const repaired = await regenerateDuplicateCarouselItems({
          ...params,
          briefIndexStart,
          parsed,
          issues,
        });
        if (repaired) return repaired;

        // Do not discard a valid chunk and make the model recreate all five
        // ideas. A job retry can safely repeat the targeted repair instead.
        throw new SingleCarouselIdeaRepairExhaustedError(
          `Carousel content-plan could not replace only the rejected idea: ${issues.join(" ")}`,
        );
      }

      lastIssues = issues;
    } catch (error) {
      if (error instanceof SingleCarouselIdeaRepairExhaustedError) throw error;
      lastIssues = [getErrorMessage(error)];
    }
  }

  throw new Error(
    `Carousel content-plan chunk failed validation: ${lastIssues.join(" ")}`,
  );
}

class SingleCarouselIdeaRepairExhaustedError extends Error {}

function isRepairableCarouselIdeaIssue(issue: string) {
  return issue.includes("repeats an existing creative seed");
}

export function isExactCarouselReplacementDuplicate(params: {
  candidate: string;
  existingItems: readonly Pick<CarouselContentPlanItemRow, "creative_seed">[];
  siblingItems: readonly Pick<GeneratedCarouselContentPlanItem, "creativeSeed">[];
}) {
  const candidateFingerprint = createCarouselContentPlanSeedFingerprint(
    params.candidate,
  );
  return [
    ...params.existingItems.map((item) => item.creative_seed),
    ...params.siblingItems.map((item) => item.creativeSeed),
  ].some(
    (seed) =>
      createCarouselContentPlanSeedFingerprint(seed) === candidateFingerprint,
  );
}

async function regenerateDuplicateCarouselItems(params: {
  briefIndexStart: number;
  businessDescription: string;
  count: number;
  existingItems: Array<Pick<CarouselContentPlanItemRow, "creative_seed" | "emotion">>;
  issues: string[];
  parsed: GeneratedCarouselContentPlanChunk;
  planningContext: Json;
}) {
  const affectedItems = new Map<number, Set<number>>();
  for (const issue of params.issues) {
    const match = issue.match(/^Brief (\d+) idea (\d+)/);
    if (!match) continue;
    const briefSlotIndex = Number.parseInt(match[1], 10);
    const itemSlotIndex = Number.parseInt(match[2], 10);
    const targets = affectedItems.get(briefSlotIndex) ?? new Set<number>();
    targets.add(itemSlotIndex);
    affectedItems.set(briefSlotIndex, targets);
  }
  if (affectedItems.size === 0) return null;

  const items = [...params.parsed.items];
  const lanes = getCarouselItemConceptLanes(
    params.briefIndexStart,
    params.parsed.briefs.length,
  );

  for (const [briefSlotIndex, itemSlots] of affectedItems) {
    for (const itemSlotIndex of itemSlots) {
      const itemIndex = items.findIndex(
        (item) =>
          item.briefSlotIndex === briefSlotIndex &&
          item.itemSlotIndex === itemSlotIndex,
      );
      const currentItem = items[itemIndex];
      const lane = lanes.find(
        (value) =>
          value.briefSlotIndex === briefSlotIndex &&
          value.itemSlotIndex === itemSlotIndex,
      );
      if (itemIndex < 0 || !currentItem || !lane) return null;

      let replaced = false;
      for (
        let repairAttempt = 0;
        repairAttempt < MAX_SINGLE_IDEA_REPAIR_ATTEMPTS;
        repairAttempt += 1
      ) {
        const completion = await getOpenAIClient().chat.completions.create({
          max_completion_tokens: 1_000,
          messages: buildSingleIdeaReplacementMessages({
            businessDescription: params.businessDescription,
            currentItem,
            existingItems: [
              ...params.existingItems,
              ...items
                .filter((_, index) => index !== itemIndex)
                .map((item) => ({
                  creative_seed: item.creativeSeed,
                  emotion: item.emotion,
                })),
            ],
            issues: params.issues.filter((issue) =>
              issue.startsWith(`Brief ${briefSlotIndex} idea ${itemSlotIndex}`),
            ),
            lane,
            planningContext: params.planningContext,
          }),
          model: CAROUSEL_TEXT_MODEL,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "carousel_content_plan_single_idea_replacement",
              schema: buildSingleIdeaReplacementSchema(),
              strict: true,
            },
          },
          temperature: 0.8,
        });
        const content = completion.choices[0]?.message.content;
        if (!content) continue;

        try {
          items[itemIndex] = parseCarouselReplacementItem(
            JSON.parse(content),
            currentItem,
            lane.key,
          );
          const replacementIsExactDuplicate = isExactCarouselReplacementDuplicate({
            candidate: items[itemIndex]!.creativeSeed,
            existingItems: params.existingItems,
            siblingItems: items.filter((_, index) => index !== itemIndex),
          });
          if (replacementIsExactDuplicate) continue;
          const remainingIssues = validateCarouselContentPlanChunk({
            existingItems: params.existingItems,
            items,
          });
          if (
            !remainingIssues.some((issue) =>
              issue.startsWith(`Brief ${briefSlotIndex} idea ${itemSlotIndex}`),
            )
          ) {
            replaced = true;
            break;
          }
        } catch {
          // A malformed single replacement is retried without touching any
          // already-valid idea in this chunk.
        }
      }
      if (!replaced) return null;
    }
  }

  if (
    validateCarouselContentPlanChunk({
      existingItems: params.existingItems,
      items,
    }).length > 0
  ) {
    return null;
  }

  return {
    briefs: params.parsed.briefs,
    items: items.sort(
      (left, right) =>
        left.briefSlotIndex - right.briefSlotIndex ||
        left.itemSlotIndex - right.itemSlotIndex,
    ),
  } satisfies GeneratedCarouselContentPlanChunk;
}

export function parseCarouselContentPlanChunk(
  value: unknown,
  briefCount: number,
  briefIndexStart = 1,
) {
  const envelope = asRecord(value, "content-plan response");

  if (!Array.isArray(envelope.briefs) || envelope.briefs.length !== briefCount) {
    throw new Error(`Content-plan response must contain exactly ${briefCount} briefs.`);
  }

  const seenBriefSlots = new Set<number>();
  const briefs: GeneratedCarouselContentPlanBrief[] = [];
  const items: GeneratedCarouselContentPlanItem[] = [];

  for (const [index, value] of envelope.briefs.entries()) {
    const brief = asRecord(value, `creative brief ${index + 1}`);
    const briefSlotIndex = getInteger(
      brief.briefSlotIndex,
      `creative brief ${index + 1} briefSlotIndex`,
    );

    if (
      briefSlotIndex < 0 ||
      briefSlotIndex >= briefCount ||
      seenBriefSlots.has(briefSlotIndex)
    ) {
      throw new Error("Creative brief slot indexes must be unique and contiguous.");
    }
    seenBriefSlots.add(briefSlotIndex);

    const parsedBrief = {
      audienceContext: getString(brief.audienceContext, 240, `creative brief ${index + 1} audienceContext`),
      briefSlotIndex,
      creativeSeed: getString(brief.creativeSeed, MAX_CREATIVE_SEED_LENGTH, `creative brief ${index + 1} creativeSeed`),
      emotionalTension: getString(brief.emotionalTension, 160, `creative brief ${index + 1} emotionalTension`),
      humanMoment: getString(brief.humanMoment, 400, `creative brief ${index + 1} humanMoment`),
      preferredFormatFamily: getPreferredFormatFamily(brief.preferredFormatFamily, `creative brief ${index + 1} preferredFormatFamily`),
      supportedAngle: getString(brief.supportedAngle, 400, `creative brief ${index + 1} supportedAngle`),
    } satisfies GeneratedCarouselContentPlanBrief;
    briefs.push(parsedBrief);

    if (!Array.isArray(brief.items) || brief.items.length !== CAROUSEL_CONTENT_PLAN_ITEMS_PER_BRIEF) {
      throw new Error(`Creative brief ${index + 1} must contain exactly five ideas.`);
    }

    const seenItemSlots = new Set<number>();
    for (const [itemIndex, itemValue] of brief.items.entries()) {
      const item = asRecord(itemValue, `creative brief ${index + 1} idea ${itemIndex + 1}`);
      const itemSlotIndex = getInteger(
        item.itemSlotIndex,
        `creative brief ${index + 1} idea ${itemIndex + 1} itemSlotIndex`,
      );

      if (itemSlotIndex < 0 || itemSlotIndex >= 5 || seenItemSlots.has(itemSlotIndex)) {
        throw new Error("Creative brief idea slots must be unique and contiguous.");
      }
      seenItemSlots.add(itemSlotIndex);

      const lane = getCarouselItemConceptLanes(
        briefIndexStart,
        briefCount,
      ).find(
        (value) =>
          value.briefSlotIndex === briefSlotIndex &&
          value.itemSlotIndex === itemSlotIndex,
      );
      if (!lane) throw new Error("Creative brief idea is missing its concept lane.");

      items.push({
        briefSlotIndex,
        creativeSeed: getString(item.creativeSeed, MAX_CREATIVE_SEED_LENGTH, `creative brief ${index + 1} idea ${itemIndex + 1} creativeSeed`),
        emotion: getString(item.emotion, MAX_EMOTION_LENGTH, `creative brief ${index + 1} idea ${itemIndex + 1} emotion`),
        itemSlotIndex,
        planningBrief: {
          audienceContext: getString(item.audienceContext, 240, `creative brief ${index + 1} idea ${itemIndex + 1} audienceContext`),
          conceptLane: lane.key,
          creativeSeed: getString(item.privateCreativeSeed, MAX_CREATIVE_SEED_LENGTH, `creative brief ${index + 1} idea ${itemIndex + 1} privateCreativeSeed`),
          emotionalTension: getString(item.emotionalTension, 160, `creative brief ${index + 1} idea ${itemIndex + 1} emotionalTension`),
          humanMoment: getString(item.humanMoment, 400, `creative brief ${index + 1} idea ${itemIndex + 1} humanMoment`),
          preferredFormatFamily: getPreferredFormatFamily(item.preferredFormatFamily, `creative brief ${index + 1} idea ${itemIndex + 1} preferredFormatFamily`),
          supportedAngle: getString(item.supportedAngle, 400, `creative brief ${index + 1} idea ${itemIndex + 1} supportedAngle`),
        },
      });
    }
  }

  return {
    briefs: briefs.sort((left, right) => left.briefSlotIndex - right.briefSlotIndex),
    items: items.sort(
      (left, right) =>
        left.briefSlotIndex - right.briefSlotIndex ||
        left.itemSlotIndex - right.itemSlotIndex,
    ),
  } satisfies GeneratedCarouselContentPlanChunk;
}

export function validateCarouselContentPlanChunk(params: {
  existingItems: Array<{ creative_seed: string; emotion: string }>;
  items: GeneratedCarouselContentPlanItem[];
}) {
  const issues: string[] = [];
  const acceptedSeeds = params.existingItems.map((item) => item.creative_seed);

  for (const item of params.items) {
    if (item.creativeSeed.length < 12) {
      issues.push(`Brief ${item.briefSlotIndex} idea ${item.itemSlotIndex} is too vague.`);
    }
    if (item.emotion.length < 2) {
      issues.push(`Brief ${item.briefSlotIndex} idea ${item.itemSlotIndex} has a vague emotion.`);
    }
    if (/\b(?:slide\s*\d+|call[ -]?to[ -]?action|cta)\b/i.test(item.creativeSeed)) {
      issues.push(`Brief ${item.briefSlotIndex} idea ${item.itemSlotIndex} prewrites slideshow structure instead of a broad seed.`);
    }

    // Word overlap and near-verbatim variations are allowed. The planner
    // prompt and concept lanes encourage breadth; this hard gate stops only
    // identical text after normalizing case, punctuation, and spacing.
    const duplicate = acceptedSeeds.find(
      (seed) =>
        createCarouselContentPlanSeedFingerprint(seed) ===
          createCarouselContentPlanSeedFingerprint(item.creativeSeed),
    );

    if (duplicate) {
      issues.push(
        `Brief ${item.briefSlotIndex} idea ${item.itemSlotIndex} repeats an existing creative seed: ${JSON.stringify(duplicate)}.`,
      );
    } else {
      acceptedSeeds.push(item.creativeSeed);
    }

  }

  return issues;
}

export function createCarouselContentPlanSeedFingerprint(seed: string) {
  return createHash("sha256").update(normalize(seed)).digest("hex");
}

export function createCarouselCreativeBriefFingerprint(brief: CarouselPlanningBrief) {
  return createHash("sha256")
    .update(
      normalize(
        [
          brief.creativeSeed,
          brief.audienceContext,
          brief.humanMoment,
          brief.emotionalTension,
          brief.supportedAngle,
          brief.preferredFormatFamily,
        ].join(" "),
      ),
    )
    .digest("hex");
}

export function getCarouselContentPlanDayPosition(sequenceIndex: number) {
  if (!Number.isInteger(sequenceIndex) || sequenceIndex < 1) {
    throw new Error("Carousel content-plan sequence index must be positive.");
  }

  const zeroBased = sequenceIndex - 1;
  const cycle = Math.floor(zeroBased / 150);
  const withinCycle = zeroBased % 150;

  return {
    dayNumber: Math.floor(withinCycle / 5) + 1,
    daySlotIndex: cycle * 5 + (withinCycle % 5) + 1,
  };
}

export function getCarouselItemConceptLanes(
  briefIndexStart: number,
  briefCount: number,
) {
  return getContentPlanItemConceptLanes({ briefCount, briefIndexStart });
}

// Retained as a public alias while callers migrate to the clearer item-level
// name. A lane is assigned to every child idea, not only to a five-item group.
export function getCarouselConceptLanes(
  briefIndexStart: number,
  briefCount: number,
) {
  return getCarouselItemConceptLanes(briefIndexStart, briefCount);
}

function buildMessages(params: {
  briefIndexStart: number;
  briefCount: number;
  businessDescription: string;
  count: number;
  existingItems: Array<Pick<CarouselContentPlanItemRow, "creative_seed" | "emotion">>;
  issues: string[];
  planningContext: Json;
}) {
  const previousItems = params.existingItems.map((item) => ({
    creativeSeed: item.creative_seed,
    emotion: item.emotion,
  }));

  return [
    {
      role: "system" as const,
      content: [
        "You create private creative-brief context and broad starting points for Instagram carousels.",
        "The supplied businessDescription and approvedPlanningContext are the only factual source. Do not invent audiences, capabilities, workflows, proof, metrics, guarantees, or outcomes.",
        "Each five-idea group has a private parent brief, and every child idea has its own six-field private writing context. The child context—not only the parent—is stored and used later. Neither is visible slide copy, headings, labels, or an imposed plot.",
        "creativeSeed: The central human observation or tension. It is not final copy.",
        "audienceContext: The supported audience segment experiencing that situation. It must not mean everyone.",
        "humanMoment: One concrete, recognisable everyday event or situation. For example, an unexpected meeting moving the afternoon's work.",
        "emotionalTension: The inner feeling or conflict created by that moment. For example, frustration mixed with self-blame.",
        "supportedAngle: The factual connection to the business, based only on approved facts. It is not a sales claim or a promise.",
        "preferredFormatFamily: A soft storytelling direction, such as relatable situation or contrast. It gives variety, but never overrides the backend-selected Carousel format.",
        "For every child return creativeSeed, emotion, audienceContext, privateCreativeSeed, emotionalTension, humanMoment, preferredFormatFamily, and supportedAngle. A child creativeSeed is a broad starting thought, tension, observation, ritual, contradiction, or real-life possibility—not a hook, slide outline, CTA, product mechanism, complete story, or finished copy. The children are not generated from the parent creativeSeed alone.",
        "Every group of five must use five clearly different concrete human situations. Each child has an assigned concept lane; use its lane as broad guidance, then create a genuinely different audience, situation, tension, supported angle, or story. Previous items are guidance, not a ban on a broad topic: related themes are allowed when those real-life details differ. Avoid copying a previous child idea word-for-word.",
      ].join(" "),
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        approvedPlanningContext: params.planningContext,
        businessDescription: params.businessDescription,
        conceptLanes: getCarouselItemConceptLanes(
          params.briefIndexStart,
          params.briefCount,
        ),
        instruction: `Generate exactly ${params.briefCount} creative briefs, each with exactly 5 ideas, for ${params.count} new ideas total. briefSlotIndex values must be 0 through ${params.briefCount - 1}; every itemSlotIndex must be 0 through 4.`,
        preferredFormatFamilyOptions: PREFERRED_FORMAT_FAMILIES,
        previousItems,
        ...(params.issues.length > 0
          ? {
              rejectedAttemptIssues: params.issues,
              retryInstruction: "Regenerate the entire chunk and remove every listed issue.",
            }
          : {}),
      }),
    },
  ];
}

function buildSingleIdeaReplacementMessages(params: {
  businessDescription: string;
  currentItem: GeneratedCarouselContentPlanItem;
  existingItems: Array<Pick<CarouselContentPlanItemRow, "creative_seed" | "emotion">>;
  issues: string[];
  lane: { direction: string; key: string };
  planningContext: Json;
}) {
  return [
    {
      role: "system" as const,
      content: [
        "You repair exactly one private Carousel plan idea without changing any other plan item.",
        "Use only the supplied business facts. Return a genuinely new individual writing context with a different concrete human situation if the old one was repeated.",
        "A related topic is allowed only when the audience, real-life situation, tension, supported angle, or story is meaningfully different.",
        "Do not write visible slide copy, a hook, a CTA, a slide outline, or an unsupported claim.",
      ].join(" "),
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        approvedPlanningContext: params.planningContext,
        assignedConceptLane: params.lane,
        businessDescription: params.businessDescription,
        currentRejectedItem: params.currentItem,
        existingIdeasToAvoid: params.existingItems.map((item) => ({
          creativeSeed: item.creative_seed,
          emotion: item.emotion,
        })),
        rejectedAttemptIssues: params.issues,
        instruction: "Return only the replacement idea and its six private context fields.",
        preferredFormatFamilyOptions: PREFERRED_FORMAT_FAMILIES,
      }),
    },
  ];
}

function buildSingleIdeaReplacementSchema() {
  return {
    additionalProperties: false,
    properties: {
      audienceContext: { maxLength: 240, minLength: 1, type: "string" },
      creativeSeed: { maxLength: MAX_CREATIVE_SEED_LENGTH, minLength: 1, type: "string" },
      emotionalTension: { maxLength: 160, minLength: 1, type: "string" },
      emotion: { maxLength: MAX_EMOTION_LENGTH, minLength: 1, type: "string" },
      humanMoment: { maxLength: 400, minLength: 1, type: "string" },
      preferredFormatFamily: { enum: [...PREFERRED_FORMAT_FAMILIES], type: "string" },
      privateCreativeSeed: { maxLength: MAX_CREATIVE_SEED_LENGTH, minLength: 1, type: "string" },
      supportedAngle: { maxLength: 400, minLength: 1, type: "string" },
    },
    required: [
      "audienceContext",
      "creativeSeed",
      "emotionalTension",
      "emotion",
      "humanMoment",
      "preferredFormatFamily",
      "privateCreativeSeed",
      "supportedAngle",
    ],
    type: "object",
  } as const;
}

function parseCarouselReplacementItem(
  value: unknown,
  currentItem: GeneratedCarouselContentPlanItem,
  conceptLane: string,
): GeneratedCarouselContentPlanItem {
  const item = asRecord(value, "single Carousel idea replacement");
  return {
    briefSlotIndex: currentItem.briefSlotIndex,
    creativeSeed: getString(item.creativeSeed, MAX_CREATIVE_SEED_LENGTH, "single Carousel idea replacement creativeSeed"),
    emotion: getString(item.emotion, MAX_EMOTION_LENGTH, "single Carousel idea replacement emotion"),
    itemSlotIndex: currentItem.itemSlotIndex,
    planningBrief: {
      audienceContext: getString(item.audienceContext, 240, "single Carousel idea replacement audienceContext"),
      conceptLane,
      creativeSeed: getString(item.privateCreativeSeed, MAX_CREATIVE_SEED_LENGTH, "single Carousel idea replacement privateCreativeSeed"),
      emotionalTension: getString(item.emotionalTension, 160, "single Carousel idea replacement emotionalTension"),
      humanMoment: getString(item.humanMoment, 400, "single Carousel idea replacement humanMoment"),
      preferredFormatFamily: getPreferredFormatFamily(item.preferredFormatFamily, "single Carousel idea replacement preferredFormatFamily"),
      supportedAngle: getString(item.supportedAngle, 400, "single Carousel idea replacement supportedAngle"),
    },
  };
}

function buildSchema(briefCount: number) {
  return {
    additionalProperties: false,
    properties: {
      briefs: {
        items: {
          additionalProperties: false,
          properties: {
            audienceContext: { maxLength: 240, minLength: 1, type: "string" },
            briefSlotIndex: { maximum: briefCount - 1, minimum: 0, type: "integer" },
            creativeSeed: { maxLength: MAX_CREATIVE_SEED_LENGTH, minLength: 1, type: "string" },
            emotionalTension: { maxLength: 160, minLength: 1, type: "string" },
            humanMoment: { maxLength: 400, minLength: 1, type: "string" },
            items: {
              items: {
                additionalProperties: false,
                properties: {
                  audienceContext: { maxLength: 240, minLength: 1, type: "string" },
                  creativeSeed: { maxLength: MAX_CREATIVE_SEED_LENGTH, minLength: 1, type: "string" },
                  emotionalTension: { maxLength: 160, minLength: 1, type: "string" },
                  emotion: { maxLength: MAX_EMOTION_LENGTH, minLength: 1, type: "string" },
                  humanMoment: { maxLength: 400, minLength: 1, type: "string" },
                  itemSlotIndex: { maximum: 4, minimum: 0, type: "integer" },
                  preferredFormatFamily: { enum: [...PREFERRED_FORMAT_FAMILIES], type: "string" },
                  privateCreativeSeed: { maxLength: MAX_CREATIVE_SEED_LENGTH, minLength: 1, type: "string" },
                  supportedAngle: { maxLength: 400, minLength: 1, type: "string" },
                },
                required: [
                  "audienceContext",
                  "creativeSeed",
                  "emotionalTension",
                  "emotion",
                  "humanMoment",
                  "itemSlotIndex",
                  "preferredFormatFamily",
                  "privateCreativeSeed",
                  "supportedAngle",
                ],
                type: "object",
              },
              maxItems: 5,
              minItems: 5,
              type: "array",
            },
            preferredFormatFamily: { enum: [...PREFERRED_FORMAT_FAMILIES], type: "string" },
            supportedAngle: { maxLength: 400, minLength: 1, type: "string" },
          },
          required: [
            "audienceContext",
            "briefSlotIndex",
            "creativeSeed",
            "emotionalTension",
            "humanMoment",
            "items",
            "preferredFormatFamily",
            "supportedAngle",
          ],
          type: "object",
        },
        maxItems: briefCount,
        minItems: briefCount,
        type: "array",
      },
    },
    required: ["briefs"],
    type: "object",
  } as const;
}

function normalize(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for Carousel content planning.");
  if (!openaiClient) openaiClient = new OpenAI({ apiKey, maxRetries: 2, timeout: 60_000 });
  return openaiClient;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function getInteger(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${label} must be an integer.`);
  }
  return value;
}

function getString(value: unknown, maxLength: number, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters.`);
  return normalized;
}

function getPreferredFormatFamily(value: unknown, label: string) {
  const family = getString(value, 80, label);
  if (!PREFERRED_FORMAT_FAMILIES.includes(family as (typeof PREFERRED_FORMAT_FAMILIES)[number])) {
    throw new Error(`${label} is invalid.`);
  }
  return family;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown validation error.";
}
