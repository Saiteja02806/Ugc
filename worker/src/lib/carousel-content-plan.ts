import { createHash } from "node:crypto";

import OpenAI from "openai";

import type { CarouselContentPlanItemRow } from "../types.js";
import { CAROUSEL_TEXT_MODEL } from "./carousel-text-model.js";

export const CAROUSEL_CONTENT_PLAN_PROMPT_VERSION =
  "carousel-content-plan-seed-emotion-v1";
export const CAROUSEL_CONTENT_PLAN_CHUNK_SIZE = 25;

const MAX_CREATIVE_SEED_LENGTH = 400;
const MAX_EMOTION_LENGTH = 120;
const MAX_GENERATION_ATTEMPTS = 2;

let openaiClient: OpenAI | null = null;

export type GeneratedCarouselContentPlanItem = {
  creativeSeed: string;
  emotion: string;
  slotIndex: number;
};

export type CarouselCreativeBrief = {
  businessDescription: string;
  contentPlanId: string;
  contentPlanItemId: string;
  creativeSeed: string;
  emotion: string;
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
}) {
  const count = Math.trunc(params.count);

  if (count < 1 || count > CAROUSEL_CONTENT_PLAN_CHUNK_SIZE) {
    throw new Error("Carousel content-plan chunk count must be between 1 and 25.");
  }

  let lastIssues: string[] = [];

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const completion = await getOpenAIClient().chat.completions.create({
      max_completion_tokens: 6_000,
      messages: buildMessages({
        ...params,
        count,
        issues: attempt === 0 ? [] : lastIssues,
      }),
      model: CAROUSEL_TEXT_MODEL,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "carousel_content_plan_chunk",
          schema: buildSchema(count),
          strict: true,
        },
      },
      temperature: 0.85,
    });
    const content = completion.choices[0]?.message.content;

    if (!content) {
      lastIssues = ["The model returned no content."];
      continue;
    }

    try {
      const parsed = parseCarouselContentPlanChunk(JSON.parse(content), count);
      const issues = validateCarouselContentPlanChunk({
        existingItems: params.existingItems,
        items: parsed,
      });

      if (issues.length === 0) {
        return parsed;
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

export function parseCarouselContentPlanChunk(value: unknown, count: number) {
  const envelope = asRecord(value, "content-plan response");

  if (!Array.isArray(envelope.items) || envelope.items.length !== count) {
    throw new Error(`Content-plan response must contain exactly ${count} items.`);
  }

  const seenSlots = new Set<number>();
  const items = envelope.items.map((value, index) => {
    const item = asRecord(value, `content-plan item ${index + 1}`);
    const slotIndex = getInteger(item.slotIndex, `item ${index + 1} slotIndex`);

    if (slotIndex < 0 || slotIndex >= count || seenSlots.has(slotIndex)) {
      throw new Error("Content-plan slot indexes must be unique and contiguous.");
    }

    seenSlots.add(slotIndex);

    return {
      creativeSeed: getString(
        item.creativeSeed,
        MAX_CREATIVE_SEED_LENGTH,
        `item ${index + 1} creativeSeed`,
      ),
      emotion: getString(
        item.emotion,
        MAX_EMOTION_LENGTH,
        `item ${index + 1} emotion`,
      ),
      slotIndex,
    } satisfies GeneratedCarouselContentPlanItem;
  });

  return items.sort((left, right) => left.slotIndex - right.slotIndex);
}

export function validateCarouselContentPlanChunk(params: {
  existingItems: Array<{ creative_seed: string; emotion: string }>;
  items: GeneratedCarouselContentPlanItem[];
}) {
  const issues: string[] = [];
  const acceptedSeeds = params.existingItems.map((item) => item.creative_seed);

  for (const item of params.items) {
    if (item.creativeSeed.length < 12) {
      issues.push(`Slot ${item.slotIndex} creativeSeed is too vague.`);
    }

    if (item.emotion.length < 2) {
      issues.push(`Slot ${item.slotIndex} emotion is too vague.`);
    }

    if (/\b(?:slide\s*\d+|call[ -]?to[ -]?action|cta)\b/i.test(item.creativeSeed)) {
      issues.push(
        `Slot ${item.slotIndex} prewrites slideshow structure instead of a broad seed.`,
      );
    }

    const duplicate = acceptedSeeds.find(
      (seed) =>
        createCarouselContentPlanSeedFingerprint(seed) ===
          createCarouselContentPlanSeedFingerprint(item.creativeSeed) ||
        seedSimilarity(seed, item.creativeSeed) >= 0.82,
    );

    if (duplicate) {
      issues.push(`Slot ${item.slotIndex} repeats an existing creative seed.`);
    } else {
      acceptedSeeds.push(item.creativeSeed);
    }
  }

  return issues;
}

export function createCarouselContentPlanSeedFingerprint(seed: string) {
  return createHash("sha256").update(normalize(seed)).digest("hex");
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
  businessDescription: string;
  count: number;
  existingItems: Array<Pick<CarouselContentPlanItemRow, "creative_seed" | "emotion">>;
  issues: string[];
}): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const previousItems = params.existingItems.map((item) => ({
    creativeSeed: item.creative_seed,
    emotion: item.emotion,
  }));

  return [
    {
      role: "system",
      content: [
        "You create broad, open-ended creative starting points for social-media slideshows.",
        "The only factual business context is businessDescription. Do not assume additional features, audiences, workflows, proof, metrics, or guarantees.",
        "Each item has exactly creativeSeed and emotion. A creativeSeed is a starting thought, tension, observation, ritual, contradiction, or real-life possibility—not a hook, slide outline, CTA, product mechanism, complete story, or finished copy.",
        "Emotion is the underlying feeling the later writer can use. It must not force a fixed plot and does not have to appear literally in the copy.",
        "Create meaningfully different ideas, not paraphrases or the same emotional arc with different wording.",
      ].join(" "),
    },
    {
      role: "user",
      content: JSON.stringify({
        businessDescription: params.businessDescription,
        instruction: `Generate exactly ${params.count} new items with slotIndex values 0 through ${params.count - 1}.`,
        previousItems,
        ...(params.issues.length > 0
          ? {
              rejectedAttemptIssues: params.issues,
              retryInstruction:
                "Regenerate the entire chunk and remove every listed issue.",
            }
          : {}),
      }),
    },
  ];
}

function buildSchema(count: number) {
  return {
    additionalProperties: false,
    properties: {
      items: {
        items: {
          additionalProperties: false,
          properties: {
            creativeSeed: {
              maxLength: MAX_CREATIVE_SEED_LENGTH,
              minLength: 1,
              type: "string",
            },
            emotion: {
              maxLength: MAX_EMOTION_LENGTH,
              minLength: 1,
              type: "string",
            },
            slotIndex: {
              maximum: count - 1,
              minimum: 0,
              type: "integer",
            },
          },
          required: ["creativeSeed", "emotion", "slotIndex"],
          type: "object",
        },
        maxItems: count,
        minItems: count,
        type: "array",
      },
    },
    required: ["items"],
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
  return normalize(value)
    .split(" ")
    .filter((token) => token.length > 2);
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

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for Carousel content planning.");
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey, maxRetries: 2, timeout: 60_000 });
  }

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

  if (normalized.length > maxLength) {
    throw new Error(`${label} exceeds ${maxLength} characters.`);
  }

  return normalized;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown validation error.";
}
