import { createHash } from "node:crypto";

import OpenAI from "openai";

import type { Json, WallTextContentPlanItemRow } from "../types.js";

export const WALL_TEXT_CONTENT_PLAN_PROMPT_VERSION =
  "wall-text-content-plan-five-context-v3-freeform";
export const WALL_TEXT_CONTENT_PLAN_CHUNK_SIZE = 25;
export const WALL_TEXT_CONTENT_PLAN_BRIEF_COUNT = 40;
export const WALL_TEXT_CONTENT_PLAN_ITEMS_PER_BRIEF = 5;

const DEFAULT_MODEL = "gpt-5-mini";
const MAX_CONTENT_IDEA_LENGTH = 400;
const MAX_FEELING_LENGTH = 120;
const MAX_GENERATION_ATTEMPTS = 2;
let openaiClient: OpenAI | null = null;

export type WallTextPlanningBrief = {
  audienceContext: string;
  creativeSeed: string;
  emotionalTension: string;
  humanMoment: string;
  supportedAngle: string;
};

type GeneratedWallTextPlanningBrief = WallTextPlanningBrief & {
  briefSlotIndex: number;
};

export type GeneratedWallTextContentPlanItem = {
  briefSlotIndex: number;
  contentIdea: string;
  feeling: string;
  itemSlotIndex: number;
};

export type GeneratedWallTextContentPlanChunk = {
  briefs: GeneratedWallTextPlanningBrief[];
  items: GeneratedWallTextContentPlanItem[];
};

export function getWallTextContentPlanModel() {
  return process.env.OPENAI_WALL_TEXT_PLAN_MODEL?.trim() || DEFAULT_MODEL;
}

export async function generateWallTextContentPlanChunk(params: {
  businessDescription: string;
  count: number;
  existingItems: Array<Pick<WallTextContentPlanItemRow, "content_idea" | "feeling">>;
  planningContext: Json;
}) {
  const count = Math.trunc(params.count);
  if (
    count < WALL_TEXT_CONTENT_PLAN_ITEMS_PER_BRIEF ||
    count > WALL_TEXT_CONTENT_PLAN_CHUNK_SIZE ||
    count % WALL_TEXT_CONTENT_PLAN_ITEMS_PER_BRIEF !== 0
  ) {
    throw new Error(
      "Wall-of-Text content-plan chunks must contain 5 to 25 ideas in groups of five.",
    );
  }

  const briefCount = count / WALL_TEXT_CONTENT_PLAN_ITEMS_PER_BRIEF;
  let lastIssues: string[] = [];

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const completion = await getOpenAIClient().chat.completions.create({
      max_completion_tokens: 6_000,
      messages: buildMessages({
        ...params,
        briefCount,
        issues: attempt === 0 ? [] : lastIssues,
      }),
      model: getWallTextContentPlanModel(),
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "wall_text_content_plan_five_context_chunk",
          schema: buildSchema(briefCount),
          strict: true,
        },
      },
    });
    const content = completion.choices[0]?.message.content;
    if (!content) {
      lastIssues = ["The model returned no content."];
      continue;
    }

    try {
      const parsed = parseWallTextContentPlanChunk(JSON.parse(content), briefCount);
      const issues = validateWallTextContentPlanChunk({
        existingItems: params.existingItems,
        items: parsed.items,
      });
      if (issues.length === 0) return parsed;
      lastIssues = issues;
    } catch (error) {
      lastIssues = [getErrorMessage(error)];
    }
  }

  throw new Error(
    `Wall-of-Text content-plan chunk failed validation: ${lastIssues.join(" ")}`,
  );
}

export function parseWallTextContentPlanChunk(value: unknown, briefCount: number) {
  const envelope = asRecord(value, "content-plan response");
  if (!Array.isArray(envelope.briefs) || envelope.briefs.length !== briefCount) {
    throw new Error(`Content-plan response must contain exactly ${briefCount} briefs.`);
  }

  const seenBriefSlots = new Set<number>();
  const briefs: GeneratedWallTextPlanningBrief[] = [];
  const items: GeneratedWallTextContentPlanItem[] = [];

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

    briefs.push({
      audienceContext: getString(brief.audienceContext, 240, `creative brief ${index + 1} audienceContext`),
      briefSlotIndex,
      creativeSeed: getString(brief.creativeSeed, 400, `creative brief ${index + 1} creativeSeed`),
      emotionalTension: getString(brief.emotionalTension, 160, `creative brief ${index + 1} emotionalTension`),
      humanMoment: getString(brief.humanMoment, 400, `creative brief ${index + 1} humanMoment`),
      supportedAngle: getString(brief.supportedAngle, 400, `creative brief ${index + 1} supportedAngle`),
    });

    if (
      !Array.isArray(brief.items) ||
      brief.items.length !== WALL_TEXT_CONTENT_PLAN_ITEMS_PER_BRIEF
    ) {
      throw new Error(`Creative brief ${index + 1} must contain exactly five ideas.`);
    }

    const seenItemSlots = new Set<number>();
    for (const [itemIndex, itemValue] of brief.items.entries()) {
      const item = asRecord(itemValue, `creative brief ${index + 1} idea ${itemIndex + 1}`);
      const itemSlotIndex = getInteger(
        item.itemSlotIndex,
        `creative brief ${index + 1} idea ${itemIndex + 1} itemSlotIndex`,
      );
      if (
        itemSlotIndex < 0 ||
        itemSlotIndex >= WALL_TEXT_CONTENT_PLAN_ITEMS_PER_BRIEF ||
        seenItemSlots.has(itemSlotIndex)
      ) {
        throw new Error("Creative brief idea slots must be unique and contiguous.");
      }
      seenItemSlots.add(itemSlotIndex);
      items.push({
        briefSlotIndex,
        contentIdea: getString(item.contentIdea, MAX_CONTENT_IDEA_LENGTH, `creative brief ${index + 1} idea ${itemIndex + 1} contentIdea`),
        feeling: getString(item.feeling, MAX_FEELING_LENGTH, `creative brief ${index + 1} idea ${itemIndex + 1} feeling`),
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
  } satisfies GeneratedWallTextContentPlanChunk;
}

export function validateWallTextContentPlanChunk(params: {
  existingItems: Array<{ content_idea: string; feeling: string }>;
  items: GeneratedWallTextContentPlanItem[];
}) {
  const issues: string[] = [];
  const acceptedIdeas = params.existingItems.map((item) => item.content_idea);

  for (const item of params.items) {
    if (item.contentIdea.length < 12) {
      issues.push(`Brief ${item.briefSlotIndex} idea ${item.itemSlotIndex} is too vague.`);
    }
    if (item.feeling.length < 2) {
      issues.push(`Brief ${item.briefSlotIndex} idea ${item.itemSlotIndex} has a vague feeling.`);
    }
    if (/\b(?:slide\s*\d+|call[ -]?to[ -]?action|cta|line\s*\d+)\b/i.test(item.contentIdea)) {
      issues.push(`Brief ${item.briefSlotIndex} idea ${item.itemSlotIndex} prewrites final video structure instead of an idea.`);
    }

    const duplicate = acceptedIdeas.find(
      (existing) =>
        createWallTextContentIdeaFingerprint(existing) ===
          createWallTextContentIdeaFingerprint(item.contentIdea) ||
        ideaSimilarity(existing, item.contentIdea) >= 0.82,
    );
    if (duplicate) {
      issues.push(`Brief ${item.briefSlotIndex} idea ${item.itemSlotIndex} repeats an existing content idea.`);
    } else {
      acceptedIdeas.push(item.contentIdea);
    }
  }

  return issues;
}

export function createWallTextContentIdeaFingerprint(value: string) {
  return createHash("sha256").update(normalize(value)).digest("hex");
}

export function createWallTextCreativeBriefFingerprint(brief: WallTextPlanningBrief) {
  return createHash("sha256")
    .update(
      normalize(
        [
          brief.creativeSeed,
          brief.audienceContext,
          brief.humanMoment,
          brief.emotionalTension,
          brief.supportedAngle,
        ].join(" "),
      ),
    )
    .digest("hex");
}

function buildMessages(params: {
  briefCount: number;
  businessDescription: string;
  existingItems: Array<Pick<WallTextContentPlanItemRow, "content_idea" | "feeling">>;
  issues: string[];
  planningContext: Json;
}) {
  return [
    {
      role: "system" as const,
      content: [
        "You create private creative-brief context and content ideas for Wall-of-Text short videos.",
        "The supplied businessDescription and approvedPlanningContext are the only factual source. Do not invent audiences, capabilities, workflows, proof, metrics, guarantees, outcomes, or claims.",
        "Every private brief has five fields. They guide later writing but are never visible overlay copy, labels, or a fixed script.",
        "creativeSeed: The central human observation or tension. It is not final copy.",
        "audienceContext: The supported audience segment experiencing that situation. It must not mean everyone.",
        "humanMoment: One concrete, recognisable everyday event or situation. For example, an unexpected meeting moving the afternoon's work.",
        "emotionalTension: The inner feeling or conflict created by that moment. For example, frustration mixed with self-blame.",
        "supportedAngle: The factual connection to the business, based only on approved facts. It is not a sales claim or a promise.",
        "Use all five fields together to create exactly five different child ideas. Each child has contentIdea and feeling. contentIdea is a specific angle that a later Wall writer may turn into one complete post; feeling is that child idea's emotional direction. The children are not generated from creativeSeed alone.",
        "Do not write final overlay copy, line breaks, a slide layout, a CTA, a product pitch, or a finished script. Create grounded, recognisable situations with natural human tension. Make every brief and child idea meaningfully distinct.",
      ].join(" "),
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        approvedPlanningContext: params.planningContext,
        businessDescription: params.businessDescription,
        instruction: `Generate exactly ${params.briefCount} private creative briefs. Every brief must contain exactly five child ideas. briefSlotIndex values must be 0 through ${params.briefCount - 1}; itemSlotIndex values must be 0 through 4 for each brief.`,
        previousItems: params.existingItems.map((item) => ({
          contentIdea: item.content_idea,
          feeling: item.feeling,
        })),
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
            creativeSeed: { maxLength: 400, minLength: 1, type: "string" },
            emotionalTension: { maxLength: 160, minLength: 1, type: "string" },
            humanMoment: { maxLength: 400, minLength: 1, type: "string" },
            items: {
              items: {
                additionalProperties: false,
                properties: {
                  contentIdea: { maxLength: MAX_CONTENT_IDEA_LENGTH, minLength: 1, type: "string" },
                  feeling: { maxLength: MAX_FEELING_LENGTH, minLength: 1, type: "string" },
                  itemSlotIndex: { maximum: 4, minimum: 0, type: "integer" },
                },
                required: ["contentIdea", "feeling", "itemSlotIndex"],
                type: "object",
              },
              maxItems: 5,
              minItems: 5,
              type: "array",
            },
            supportedAngle: { maxLength: 400, minLength: 1, type: "string" },
          },
          required: [
            "audienceContext",
            "briefSlotIndex",
            "creativeSeed",
            "emotionalTension",
            "humanMoment",
            "items",
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

function ideaSimilarity(left: string, right: string) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  const union = new Set([...leftTokens, ...rightTokens]);
  if (union.size === 0) return 0;
  let intersection = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) intersection += 1;
  return Math.max(
    intersection / union.size,
    intersection / Math.max(1, Math.min(leftTokens.size, rightTokens.size)),
  );
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
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for Wall-of-Text content planning.");
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
  if (normalized.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters.`);
  return normalized;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown validation error.";
}
