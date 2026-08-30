import { createHash } from "node:crypto";

import OpenAI from "openai";

import type { CarouselContentPlanItemRow, Json } from "../types.js";
import { CAROUSEL_TEXT_MODEL } from "./carousel-text-model.js";

export const CAROUSEL_CONTENT_PLAN_PROMPT_VERSION =
  "carousel-content-plan-creative-briefs-v3-explicit-definitions";
export const CAROUSEL_CONTENT_PLAN_CHUNK_SIZE = 25;
export const CAROUSEL_CONTENT_PLAN_BRIEF_COUNT = 30;
export const CAROUSEL_CONTENT_PLAN_ITEMS_PER_BRIEF = 5;

const MAX_CREATIVE_SEED_LENGTH = 400;
const MAX_EMOTION_LENGTH = 120;
const MAX_GENERATION_ATTEMPTS = 2;
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
  let lastIssues: string[] = [];

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const completion = await getOpenAIClient().chat.completions.create({
      max_completion_tokens: 6_000,
      messages: buildMessages({
        ...params,
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
      const parsed = parseCarouselContentPlanChunk(JSON.parse(content), briefCount);
      const issues = validateCarouselContentPlanChunk({
        existingItems: params.existingItems,
        items: parsed.items,
      });

      if (issues.length === 0) return parsed;

      // Duplicate seeds are a local shortfall, not a reason to throw away a
      // whole 25-item chunk. Regenerate only the affected five-item briefs so
      // valid work can still be persisted and the plan can keep progressing.
      if (issues.every((issue) => issue.includes("repeats an existing creative seed"))) {
        const repaired = await regenerateDuplicateCarouselBriefs({
          ...params,
          parsed,
          issues,
        });
        if (repaired) {
          const repairedIssues = validateCarouselContentPlanChunk({
            existingItems: params.existingItems,
            items: repaired.items,
          });
          if (repairedIssues.length === 0) return repaired;
          lastIssues = repairedIssues;
          continue;
        }
      }

      lastIssues = issues;
    } catch (error) {
      lastIssues = [getErrorMessage(error)];
    }
  }

  throw new Error(
    `Carousel content-plan chunk failed validation: ${lastIssues.join(" ")}`,
  );
}

async function regenerateDuplicateCarouselBriefs(params: {
  businessDescription: string;
  count: number;
  existingItems: Array<Pick<CarouselContentPlanItemRow, "creative_seed" | "emotion">>;
  issues: string[];
  parsed: GeneratedCarouselContentPlanChunk;
  planningContext: Json;
}) {
  const affectedBriefs = new Set<number>();
  for (const issue of params.issues) {
    const match = issue.match(/^Brief (\d+) idea /);
    if (match) affectedBriefs.add(Number.parseInt(match[1], 10));
  }
  if (affectedBriefs.size === 0) return null;

  const unaffectedBriefs = params.parsed.briefs.filter(
    (brief) => !affectedBriefs.has(brief.briefSlotIndex),
  );
  const unaffectedItems = params.parsed.items.filter(
    (item) => !affectedBriefs.has(item.briefSlotIndex),
  );
  const replacementBriefs: GeneratedCarouselContentPlanBrief[] = [];
  const replacementItems: GeneratedCarouselContentPlanItem[] = [];

  for (const briefSlotIndex of affectedBriefs) {
    const completion = await getOpenAIClient().chat.completions.create({
      max_completion_tokens: 2_000,
      messages: buildMessages({
        businessDescription: params.businessDescription,
        briefCount: 1,
        count: CAROUSEL_CONTENT_PLAN_ITEMS_PER_BRIEF,
        existingItems: [
          ...params.existingItems,
          ...unaffectedItems.map((item) => ({
            creative_seed: item.creativeSeed,
            emotion: item.emotion,
          })),
          ...replacementItems.map((item) => ({
            creative_seed: item.creativeSeed,
            emotion: item.emotion,
          })),
        ],
        issues: ["Regenerate this five-item brief with five new, distinct creative seeds."],
        planningContext: params.planningContext,
      }),
      model: CAROUSEL_TEXT_MODEL,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "carousel_content_plan_creative_brief_shortfall",
          schema: buildSchema(1),
          strict: true,
        },
      },
      temperature: 0.75,
    });
    const content = completion.choices[0]?.message.content;
    if (!content) return null;

    try {
      const replacement = parseCarouselContentPlanChunk(JSON.parse(content), 1);
      const brief = replacement.briefs[0];
      if (!brief) return null;
      replacementBriefs.push({ ...brief, briefSlotIndex });
      replacementItems.push(
        ...replacement.items.map((item) => ({ ...item, briefSlotIndex })),
      );
    } catch {
      return null;
    }
  }

  return {
    briefs: [...unaffectedBriefs, ...replacementBriefs].sort(
      (left, right) => left.briefSlotIndex - right.briefSlotIndex,
    ),
    items: [...unaffectedItems, ...replacementItems].sort(
      (left, right) =>
        left.briefSlotIndex - right.briefSlotIndex ||
        left.itemSlotIndex - right.itemSlotIndex,
    ),
  } satisfies GeneratedCarouselContentPlanChunk;
}

export function parseCarouselContentPlanChunk(value: unknown, briefCount: number) {
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

      items.push({
        briefSlotIndex,
        creativeSeed: getString(item.creativeSeed, MAX_CREATIVE_SEED_LENGTH, `creative brief ${index + 1} idea ${itemIndex + 1} creativeSeed`),
        emotion: getString(item.emotion, MAX_EMOTION_LENGTH, `creative brief ${index + 1} idea ${itemIndex + 1} emotion`),
        itemSlotIndex,
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

    const duplicate = acceptedSeeds.find(
      (seed) =>
        createCarouselContentPlanSeedFingerprint(seed) ===
          createCarouselContentPlanSeedFingerprint(item.creativeSeed) ||
        seedSimilarity(seed, item.creativeSeed) >= 0.82,
    );

    if (duplicate) {
      issues.push(`Brief ${item.briefSlotIndex} idea ${item.itemSlotIndex} repeats an existing creative seed.`);
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

function buildMessages(params: {
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
        "Each private creative brief has six fields. They guide later writing but are never visible slide copy, headings, labels, or an imposed plot.",
        "creativeSeed: The central human observation or tension. It is not final copy.",
        "audienceContext: The supported audience segment experiencing that situation. It must not mean everyone.",
        "humanMoment: One concrete, recognisable everyday event or situation. For example, an unexpected meeting moving the afternoon's work.",
        "emotionalTension: The inner feeling or conflict created by that moment. For example, frustration mixed with self-blame.",
        "supportedAngle: The factual connection to the business, based only on approved facts. It is not a sales claim or a promise.",
        "preferredFormatFamily: A soft storytelling direction, such as relatable situation or contrast. It gives variety, but never overrides the backend-selected Carousel format.",
        "Use all six fields together to create exactly five different child ideas. Every child contains exactly creativeSeed and emotion. A child creativeSeed is a broad starting thought, tension, observation, ritual, contradiction, or real-life possibility—not a hook, slide outline, CTA, product mechanism, complete story, or finished copy. The children are not generated from the parent creativeSeed alone.",
        "Create meaningfully different briefs and ideas, not paraphrases or the same emotional arc with different wording.",
      ].join(" "),
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        approvedPlanningContext: params.planningContext,
        businessDescription: params.businessDescription,
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
                  creativeSeed: { maxLength: MAX_CREATIVE_SEED_LENGTH, minLength: 1, type: "string" },
                  emotion: { maxLength: MAX_EMOTION_LENGTH, minLength: 1, type: "string" },
                  itemSlotIndex: { maximum: 4, minimum: 0, type: "integer" },
                },
                required: ["creativeSeed", "emotion", "itemSlotIndex"],
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

function seedSimilarity(left: string, right: string) {
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
  return normalize(value).split(" ").filter((token) => token.length > 2);
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
