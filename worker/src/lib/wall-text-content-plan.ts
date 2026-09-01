import { createHash } from "node:crypto";

import OpenAI from "openai";

import type { Json, WallTextContentPlanItemRow } from "../types.js";
import { getContentPlanItemConceptLanes } from "./content-plan-concept-lanes.js";

export const WALL_TEXT_CONTENT_PLAN_PROMPT_VERSION =
  "wall-text-content-plan-five-context-v5-item-context-concept-lanes";
export const WALL_TEXT_CONTENT_PLAN_CHUNK_SIZE = 25;
export const WALL_TEXT_CONTENT_PLAN_BRIEF_COUNT = 40;
export const WALL_TEXT_CONTENT_PLAN_ITEMS_PER_BRIEF = 5;

const DEFAULT_MODEL = "gpt-5-mini";
const MAX_CONTENT_IDEA_LENGTH = 400;
const MAX_FEELING_LENGTH = 120;
const MAX_GENERATION_ATTEMPTS = 2;
const MAX_SINGLE_IDEA_REPAIR_ATTEMPTS = 3;
let openaiClient: OpenAI | null = null;

export type WallTextPlanningBrief = {
  audienceContext: string;
  conceptLane?: string;
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
  planningBrief: WallTextPlanningBrief;
};

export type GeneratedWallTextContentPlanChunk = {
  briefs: GeneratedWallTextPlanningBrief[];
  items: GeneratedWallTextContentPlanItem[];
};

export function getWallTextContentPlanModel() {
  return process.env.OPENAI_WALL_TEXT_PLAN_MODEL?.trim() || DEFAULT_MODEL;
}

export async function generateWallTextContentPlanChunk(params: {
  briefIndexStart?: number;
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
  const briefIndexStart = params.briefIndexStart ?? 1;
  if (!Number.isInteger(briefIndexStart) || briefIndexStart < 1) {
    throw new Error("Wall-of-Text content-plan brief index must be positive.");
  }
  let lastIssues: string[] = [];

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const completion = await getOpenAIClient().chat.completions.create({
      max_completion_tokens: 6_000,
      messages: buildMessages({
        ...params,
        briefIndexStart,
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
      const parsed = parseWallTextContentPlanChunk(
        JSON.parse(content),
        briefCount,
        briefIndexStart,
      );
      const issues = validateWallTextContentPlanChunk({
        existingItems: params.existingItems,
        items: parsed.items,
      });
      if (issues.length === 0) return parsed;

      if (issues.every(isRepairableWallTextIdeaIssue)) {
        const repaired = await regenerateDuplicateWallTextItems({
          ...params,
          briefIndexStart,
          issues,
          parsed,
        });
        if (repaired) return repaired;
        throw new SingleWallTextIdeaRepairExhaustedError(
          `Wall-of-Text content-plan could not replace only the rejected idea: ${issues.join(" ")}`,
        );
      }

      lastIssues = issues;
    } catch (error) {
      if (error instanceof SingleWallTextIdeaRepairExhaustedError) throw error;
      lastIssues = [getErrorMessage(error)];
    }
  }

  throw new Error(
    `Wall-of-Text content-plan chunk failed validation: ${lastIssues.join(" ")}`,
  );
}

class SingleWallTextIdeaRepairExhaustedError extends Error {}

function isRepairableWallTextIdeaIssue(issue: string) {
  return issue.includes("repeats an existing content idea");
}

export function isExactWallTextReplacementDuplicate(params: {
  candidate: string;
  existingItems: readonly Pick<WallTextContentPlanItemRow, "content_idea">[];
  siblingItems: readonly Pick<GeneratedWallTextContentPlanItem, "contentIdea">[];
}) {
  const candidateFingerprint = createWallTextContentIdeaFingerprint(
    params.candidate,
  );
  return [
    ...params.existingItems.map((item) => item.content_idea),
    ...params.siblingItems.map((item) => item.contentIdea),
  ].some(
    (contentIdea) =>
      createWallTextContentIdeaFingerprint(contentIdea) === candidateFingerprint,
  );
}

async function regenerateDuplicateWallTextItems(params: {
  briefIndexStart: number;
  businessDescription: string;
  count: number;
  existingItems: Array<Pick<WallTextContentPlanItemRow, "content_idea" | "feeling">>;
  issues: string[];
  parsed: GeneratedWallTextContentPlanChunk;
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
  const lanes = getWallTextItemConceptLanes(
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
                  content_idea: item.contentIdea,
                  feeling: item.feeling,
                })),
            ],
            issues: params.issues.filter((issue) =>
              issue.startsWith(`Brief ${briefSlotIndex} idea ${itemSlotIndex}`),
            ),
            lane,
            planningContext: params.planningContext,
          }),
          model: getWallTextContentPlanModel(),
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "wall_text_content_plan_single_idea_replacement",
              schema: buildSingleIdeaReplacementSchema(),
              strict: true,
            },
          },
          temperature: 0.8,
        });
        const content = completion.choices[0]?.message.content;
        if (!content) continue;

        try {
          items[itemIndex] = parseWallTextReplacementItem(
            JSON.parse(content),
            currentItem,
            lane.key,
          );
          const replacementIsExactDuplicate = isExactWallTextReplacementDuplicate({
            candidate: items[itemIndex]!.contentIdea,
            existingItems: params.existingItems,
            siblingItems: items.filter((_, index) => index !== itemIndex),
          });
          if (replacementIsExactDuplicate) continue;
          const remainingIssues = validateWallTextContentPlanChunk({
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
          // A malformed replacement never changes the other plan items.
        }
      }
      if (!replaced) return null;
    }
  }

  if (
    validateWallTextContentPlanChunk({
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
  } satisfies GeneratedWallTextContentPlanChunk;
}

export function parseWallTextContentPlanChunk(
  value: unknown,
  briefCount: number,
  briefIndexStart = 1,
) {
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
      const lane = getWallTextItemConceptLanes(
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
        contentIdea: getString(item.contentIdea, MAX_CONTENT_IDEA_LENGTH, `creative brief ${index + 1} idea ${itemIndex + 1} contentIdea`),
        feeling: getString(item.feeling, MAX_FEELING_LENGTH, `creative brief ${index + 1} idea ${itemIndex + 1} feeling`),
        itemSlotIndex,
        planningBrief: {
          audienceContext: getString(item.audienceContext, 240, `creative brief ${index + 1} idea ${itemIndex + 1} audienceContext`),
          conceptLane: lane.key,
          creativeSeed: getString(item.privateCreativeSeed, 400, `creative brief ${index + 1} idea ${itemIndex + 1} privateCreativeSeed`),
          emotionalTension: getString(item.emotionalTension, 160, `creative brief ${index + 1} idea ${itemIndex + 1} emotionalTension`),
          humanMoment: getString(item.humanMoment, 400, `creative brief ${index + 1} idea ${itemIndex + 1} humanMoment`),
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

    // Similar wording and near-verbatim variations are allowed. The plan can
    // revisit a broad subject; only identical normalized text is a hard stop.
    const duplicate = acceptedIdeas.find(
      (existing) =>
        createWallTextContentIdeaFingerprint(existing) ===
          createWallTextContentIdeaFingerprint(item.contentIdea),
    );
    if (duplicate) {
      issues.push(
        `Brief ${item.briefSlotIndex} idea ${item.itemSlotIndex} repeats an existing content idea: ${JSON.stringify(duplicate)}.`,
      );
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

export function getWallTextItemConceptLanes(
  briefIndexStart: number,
  briefCount: number,
) {
  return getContentPlanItemConceptLanes({ briefCount, briefIndexStart });
}

function buildMessages(params: {
  briefIndexStart: number;
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
        "Every five-idea group has a private parent brief, and every child idea has its own five-field private writing context. The child context—not only the parent—is stored and used later. Neither is visible overlay copy, labels, or a fixed script.",
        "creativeSeed: The central human observation or tension. It is not final copy.",
        "audienceContext: The supported audience segment experiencing that situation. It must not mean everyone.",
        "humanMoment: One concrete, recognisable everyday event or situation. For example, an unexpected meeting moving the afternoon's work.",
        "emotionalTension: The inner feeling or conflict created by that moment. For example, frustration mixed with self-blame.",
        "supportedAngle: The factual connection to the business, based only on approved facts. It is not a sales claim or a promise.",
        "For every child return contentIdea, feeling, audienceContext, privateCreativeSeed, emotionalTension, humanMoment, and supportedAngle. contentIdea is a specific angle that a later Wall writer may turn into one complete post; feeling is that child idea's emotional direction. The children are not generated from creativeSeed alone.",
        "Every group of five must use five clearly different concrete human situations. Each child has an assigned concept lane; use its lane as broad guidance, then create a genuinely different audience, situation, tension, supported angle, or story. Do not write final overlay copy, line breaks, a slide layout, a CTA, a product pitch, or a finished script. Previous items are guidance, not a ban on a broad topic: related themes are allowed when those real-life details differ. Avoid copying a previous child idea word-for-word.",
      ].join(" "),
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        approvedPlanningContext: params.planningContext,
        businessDescription: params.businessDescription,
        conceptLanes: getWallTextItemConceptLanes(
          params.briefIndexStart,
          params.briefCount,
        ),
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

function buildSingleIdeaReplacementMessages(params: {
  businessDescription: string;
  currentItem: GeneratedWallTextContentPlanItem;
  existingItems: Array<Pick<WallTextContentPlanItemRow, "content_idea" | "feeling">>;
  issues: string[];
  lane: { direction: string; key: string };
  planningContext: Json;
}) {
  return [
    {
      role: "system" as const,
      content: [
        "You repair exactly one private Wall-of-Text plan idea without changing any other plan item.",
        "Use only the supplied business facts. Return a genuinely new individual writing context with a different concrete human situation if the old one was repeated.",
        "A related topic is allowed only when the audience, real-life situation, tension, supported angle, or story is meaningfully different.",
        "Do not write final overlay copy, visual line breaks, a CTA, a product pitch, or an unsupported claim.",
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
          contentIdea: item.content_idea,
          feeling: item.feeling,
        })),
        rejectedAttemptIssues: params.issues,
        instruction: "Return only the replacement idea and its five private context fields.",
      }),
    },
  ];
}

function buildSingleIdeaReplacementSchema() {
  return {
    additionalProperties: false,
    properties: {
      audienceContext: { maxLength: 240, minLength: 1, type: "string" },
      contentIdea: { maxLength: MAX_CONTENT_IDEA_LENGTH, minLength: 1, type: "string" },
      emotionalTension: { maxLength: 160, minLength: 1, type: "string" },
      feeling: { maxLength: MAX_FEELING_LENGTH, minLength: 1, type: "string" },
      humanMoment: { maxLength: 400, minLength: 1, type: "string" },
      privateCreativeSeed: { maxLength: 400, minLength: 1, type: "string" },
      supportedAngle: { maxLength: 400, minLength: 1, type: "string" },
    },
    required: [
      "audienceContext",
      "contentIdea",
      "emotionalTension",
      "feeling",
      "humanMoment",
      "privateCreativeSeed",
      "supportedAngle",
    ],
    type: "object",
  } as const;
}

function parseWallTextReplacementItem(
  value: unknown,
  currentItem: GeneratedWallTextContentPlanItem,
  conceptLane: string,
): GeneratedWallTextContentPlanItem {
  const item = asRecord(value, "single Wall-of-Text idea replacement");
  return {
    briefSlotIndex: currentItem.briefSlotIndex,
    contentIdea: getString(item.contentIdea, MAX_CONTENT_IDEA_LENGTH, "single Wall-of-Text idea replacement contentIdea"),
    feeling: getString(item.feeling, MAX_FEELING_LENGTH, "single Wall-of-Text idea replacement feeling"),
    itemSlotIndex: currentItem.itemSlotIndex,
    planningBrief: {
      audienceContext: getString(item.audienceContext, 240, "single Wall-of-Text idea replacement audienceContext"),
      conceptLane,
      creativeSeed: getString(item.privateCreativeSeed, 400, "single Wall-of-Text idea replacement privateCreativeSeed"),
      emotionalTension: getString(item.emotionalTension, 160, "single Wall-of-Text idea replacement emotionalTension"),
      humanMoment: getString(item.humanMoment, 400, "single Wall-of-Text idea replacement humanMoment"),
      supportedAngle: getString(item.supportedAngle, 400, "single Wall-of-Text idea replacement supportedAngle"),
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
            creativeSeed: { maxLength: 400, minLength: 1, type: "string" },
            emotionalTension: { maxLength: 160, minLength: 1, type: "string" },
            humanMoment: { maxLength: 400, minLength: 1, type: "string" },
            items: {
              items: {
                additionalProperties: false,
                properties: {
                  audienceContext: { maxLength: 240, minLength: 1, type: "string" },
                  contentIdea: { maxLength: MAX_CONTENT_IDEA_LENGTH, minLength: 1, type: "string" },
                  emotionalTension: { maxLength: 160, minLength: 1, type: "string" },
                  feeling: { maxLength: MAX_FEELING_LENGTH, minLength: 1, type: "string" },
                  humanMoment: { maxLength: 400, minLength: 1, type: "string" },
                  itemSlotIndex: { maximum: 4, minimum: 0, type: "integer" },
                  privateCreativeSeed: { maxLength: 400, minLength: 1, type: "string" },
                  supportedAngle: { maxLength: 400, minLength: 1, type: "string" },
                },
                required: [
                  "audienceContext",
                  "contentIdea",
                  "emotionalTension",
                  "feeling",
                  "humanMoment",
                  "itemSlotIndex",
                  "privateCreativeSeed",
                  "supportedAngle",
                ],
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
