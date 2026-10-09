import { createHash } from "node:crypto";

import OpenAI from "openai";

import type { Json, WallTextContentPlanItemRow } from "../types.js";
import {
  CONTENT_PLAN_OPENAI_MAX_RETRIES,
  CONTENT_PLAN_OPENAI_TIMEOUT_MS,
} from "./content-plan-provider-retry.js";
import { getContentPlanItemConceptLanes } from "./content-plan-concept-lanes.js";
import { getWallTextBriefSituationFocuses } from "./wall-text-situation-focuses.js";

export const WALL_TEXT_CONTENT_PLAN_PROMPT_VERSION =
  "wall-text-content-plan-reader-profiles-v19-four-copy-fixes";
// Each item carries seven structured fields in addition to its parent brief.
// Ten ideas keep a response comfortably below the model's structured-output
// budget while preserving the five-idea creative-brief grouping.
export const WALL_TEXT_CONTENT_PLAN_CHUNK_SIZE = 10;
export const WALL_TEXT_CONTENT_PLAN_BRIEF_COUNT = 40;
export const WALL_TEXT_CONTENT_PLAN_ITEMS_PER_BRIEF = 5;

const DEFAULT_MODEL = "gpt-5.6-luna";
const DEFAULT_REASONING_EFFORT = "low";
const MAX_CONTENT_IDEA_LENGTH = 400;
const MAX_FEELING_LENGTH = 120;
const MAX_GENERATION_ATTEMPTS = 2;
const MAX_SINGLE_IDEA_REPAIR_ATTEMPTS = 3;
let openaiClient: OpenAI | null = null;

export class EmptyWallTextContentPlanResponseError extends Error {
  readonly finishReason: string | null;

  constructor(finishReason: string | null) {
    super(
      `Wall-of-Text content-plan model returned no content${
        finishReason ? ` (finish reason: ${finishReason})` : ""
      }.`,
    );
    this.name = "EmptyWallTextContentPlanResponseError";
    this.finishReason = finishReason;
  }
}

export type WallTextPlanningBrief = {
  audienceContext: string;
  conceptLane?: string;
  creativeSeed: string;
  emotionalTension: string;
  humanMoment: string;
  selectedFactId?: string;
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

type ExistingWallTextContentPlanItem = Pick<
  WallTextContentPlanItemRow,
  "content_idea" | "feeling"
> & {
  private_context?: Json | null;
};

export function getWallTextContentPlanModel() {
  return process.env.OPENAI_WALL_TEXT_PLAN_MODEL?.trim() || DEFAULT_MODEL;
}

export function getWallTextContentPlanReasoningEffort() {
  return getReasoningEffort(
    process.env.OPENAI_WALL_TEXT_PLAN_REASONING_EFFORT,
    DEFAULT_REASONING_EFFORT,
    "OPENAI_WALL_TEXT_PLAN_REASONING_EFFORT",
  );
}

export async function generateWallTextContentPlanChunk(params: {
  briefIndexStart?: number;
  businessDescription: string;
  count: number;
  existingItems: ExistingWallTextContentPlanItem[];
  planningContext: Json;
}) {
  const count = Math.trunc(params.count);
  if (
    count < WALL_TEXT_CONTENT_PLAN_ITEMS_PER_BRIEF ||
    count > WALL_TEXT_CONTENT_PLAN_CHUNK_SIZE ||
    count % WALL_TEXT_CONTENT_PLAN_ITEMS_PER_BRIEF !== 0
  ) {
    throw new Error(
      "Wall-of-Text content-plan chunks must contain 5 to 10 ideas in groups of five.",
    );
  }

  const briefCount = count / WALL_TEXT_CONTENT_PLAN_ITEMS_PER_BRIEF;
  const briefIndexStart = params.briefIndexStart ?? 1;
  if (!Number.isInteger(briefIndexStart) || briefIndexStart < 1) {
    throw new Error("Wall-of-Text content-plan brief index must be positive.");
  }
  const approvedFactIds = getApprovedPlanningFactIds(params.planningContext);
  let lastIssues: string[] = [];

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const completion = await getOpenAIClient().chat.completions.create({
      max_completion_tokens: 8_000,
      messages: buildMessages({
        businessDescription: params.businessDescription,
        briefIndexStart,
        briefCount,
        issues: attempt === 0 ? [] : lastIssues,
        planningContext: params.planningContext,
        factSelectionRequired: approvedFactIds !== null,
      }),
      model: getWallTextContentPlanModel(),
      reasoning_effort: getWallTextContentPlanReasoningEffort(),
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "wall_text_content_plan_five_context_chunk",
          schema: buildSchema(briefCount, approvedFactIds !== null),
          strict: true,
        },
      },
    });
    const choice = completion.choices[0];
    const content = choice?.message.content;
    if (!content) {
      const refusal = choice?.message.refusal?.trim();
      if (refusal) {
        throw new Error(
          `Wall-of-Text content-plan model refused the request: ${refusal}`,
        );
      }
      // An empty response has no validation feedback to repair. Let the
      // durable job own the retry instead of hiding another full model wait.
      throw new EmptyWallTextContentPlanResponseError(choice?.finish_reason ?? null);
    }

    try {
      const parsed = parseWallTextContentPlanChunk(
        JSON.parse(content),
        briefCount,
        briefIndexStart,
        approvedFactIds,
      );
      const issues = validateWallTextContentPlanChunk({
        existingItems: params.existingItems,
        items: parsed.items,
      });
      if (issues.length === 0) return parsed;

      if (issues.every(isRepairableWallTextIdeaIssue)) {
        const repaired = await regenerateDuplicateWallTextItems({
          ...params,
          approvedFactIds,
          briefIndexStart,
          issues,
          parsed,
        });
        if (repaired) return repaired;
        // Keep the successfully saved earlier chunks intact. If a narrowly
        // scoped replacement cannot satisfy validation, use the remaining
        // compact-chunk attempt with the rejection feedback instead of
        // failing the entire 200-item plan. This does not add prior-plan
        // history to the prompt: the model receives only this chunk's
        // rejected issue(s).
        lastIssues = issues;
        continue;
      }

      lastIssues = issues;
    } catch (error) {
      lastIssues = [getErrorMessage(error)];
    }
  }

  throw new Error(
    `Wall-of-Text content-plan chunk failed validation: ${lastIssues.join(" ")}`,
  );
}

function isRepairableWallTextIdeaIssue(issue: string) {
  return (
    issue.includes("repeats an existing content idea") ||
    issue.includes("repeats an existing human moment") ||
    issue.includes("contentIdea must contain at most 60 words") ||
    issue.includes("contentIdea must contain at most two sentences") ||
    issue.includes("production direction instead of a human observation")
  );
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
  approvedFactIds: ReadonlySet<string> | null;
  briefIndexStart: number;
  businessDescription: string;
  count: number;
  existingItems: ExistingWallTextContentPlanItem[];
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
            issues: params.issues.filter((issue) =>
              issue.startsWith(`Brief ${briefSlotIndex} idea ${itemSlotIndex}`),
            ),
            lane,
            planningContext: params.planningContext,
            factSelectionRequired: params.approvedFactIds !== null,
          }),
          model: getWallTextContentPlanModel(),
          reasoning_effort: getWallTextContentPlanReasoningEffort(),
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "wall_text_content_plan_single_idea_replacement",
              schema: buildSingleIdeaReplacementSchema(
                params.approvedFactIds !== null,
              ),
              strict: true,
            },
          },
        });
        const content = completion.choices[0]?.message.content;
        if (!content) continue;

        try {
          items[itemIndex] = parseWallTextReplacementItem(
            JSON.parse(content),
            currentItem,
            lane.key,
            params.approvedFactIds,
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
  approvedFactIds: ReadonlySet<string> | null = null,
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
          ...(approvedFactIds
            ? {
                selectedFactId: getApprovedPlanningFactId(
                  item.selectedFactId,
                  approvedFactIds,
                  `creative brief ${index + 1} idea ${itemIndex + 1} selectedFactId`,
                ),
              }
            : {}),
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
  existingItems: ExistingWallTextContentPlanItem[];
  items: GeneratedWallTextContentPlanItem[];
}) {
  const issues: string[] = [];
  const acceptedIdeas = params.existingItems.map((item) => item.content_idea);
  const acceptedHumanMoments = params.existingItems
    .map((item) => getPrivateHumanMoment(item.private_context))
    .filter((humanMoment): humanMoment is string => humanMoment !== null);

  for (const item of params.items) {
    if (item.contentIdea.length < 12) {
      issues.push(`Brief ${item.briefSlotIndex} idea ${item.itemSlotIndex} is too vague.`);
    }
    const contentIdeaWordCount = countWords(item.contentIdea);
    if (contentIdeaWordCount > 60) {
      issues.push(
        `Brief ${item.briefSlotIndex} idea ${item.itemSlotIndex} contentIdea must contain at most 60 words.`,
      );
    }
    const sentences = [...new Intl.Segmenter("en", { granularity: "sentence" }).segment(item.contentIdea)];
    if (sentences.length > 2) {
      issues.push(`Brief ${item.briefSlotIndex} idea ${item.itemSlotIndex} contentIdea must contain at most two sentences.`);
    }
    if (item.feeling.length < 2) {
      issues.push(`Brief ${item.briefSlotIndex} idea ${item.itemSlotIndex} has a vague feeling.`);
    }
    if (/\b(?:slide\s*\d+|call[ -]?to[ -]?action|cta|line\s*\d+)\b/i.test(item.contentIdea)) {
      issues.push(`Brief ${item.briefSlotIndex} idea ${item.itemSlotIndex} prewrites final video structure instead of an idea.`);
    }
    if (/^(?:show|depict|portray|capture|highlight|explore|imagine|picture|present|describe)\b/i.test(item.contentIdea)) {
      issues.push(`Brief ${item.briefSlotIndex} idea ${item.itemSlotIndex} is a production direction instead of a human observation.`);
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

    // This deliberately rejects only an exact normalized private moment. It
    // protects against the same recognisable situation being recycled with a
    // one-word copy variation, while allowing natural related observations
    // and avoiding broad semantic-similarity policing.
    const duplicateHumanMoment = acceptedHumanMoments.find(
      (existing) =>
        createWallTextContentIdeaFingerprint(existing) ===
        createWallTextContentIdeaFingerprint(item.planningBrief.humanMoment),
    );
    if (duplicateHumanMoment) {
      issues.push(
        `Brief ${item.briefSlotIndex} idea ${item.itemSlotIndex} repeats an existing human moment: ${JSON.stringify(duplicateHumanMoment)}.`,
      );
    } else {
      acceptedHumanMoments.push(item.planningBrief.humanMoment);
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

const WALL_TEXT_PLANNING_CLARITY_RULES = [
  "Within the required JSON shape and word limits, prioritize supported meaning, then first-read clarity, then variety. Use an assigned theme or concept lane only when it fits naturally; it never justifies an invented fact, forced emotion, or vague wording.",
  "Write contentIdea and all private writing fields in everyday language a non-marketer understands. Name the person, action, or decision when supported. Describe something the reader can recognize; avoid abstract phrases such as 'a business-specific direction' or 'optimizing the workflow'. Use necessary audience terms only when their meaning is clear.",
  "Approved facts control what you may claim, not the wording you must use. Translate source jargon into its supported everyday meaning in contentIdea and every private field. Do not turn a stated problem into an explanation of its cause: irregular posting does not establish a broken process, a lack of inspiration, or a particular emotional reaction.",
  "Use 'struggle to post regularly' or 'posts do not follow a regular schedule' for 'inconsistent posting cadence', retaining the problem rather than making it a positive claim. Do not write 'cadence' in contentIdea or any private writing field, and do not append the source label after explaining it.",
  "When selectedFactId is required, that one selected fact controls contentIdea, humanMoment, privateCreativeSeed, and supportedAngle. Other approved facts may only supply the supported reader or restrict that same claim with an applicable condition; they cannot add a solution, benefit, or another capability. A problem such as irregular posting does not authorize adding daily content as its solution. If the selected fact is only 'takes long time', it does not identify which task takes time or authorize a comparison; choose a clearer approved fact instead of guessing.",
  "Describe the supported person, action, and point directly in the private writing fields. Keep instructions about tone, claims, or writing out of contentIdea, humanMoment, privateCreativeSeed, and supportedAngle: 'without promising performance' is editorial guidance, not a customer-facing point. Preserve real source conditions such as 'may need editing' or 'requires approval'. Do not use a metaphor or invented psychology to make a plain fact sound insightful.",
  "Prefer the exact supported input or action over vague words such as direction, process, or tailored. An observation must say something useful beyond 'this feature is relevant when you need it'. Do not disguise the same point by adding 'before', 'from the start', or a different emotional label.",
  "A plain practical observation is valid. Set feeling to 'neutral' and emotionalTension to 'No particular emotional conflict' when no conflict follows naturally. Never manufacture self-blame, anxiety, relief, or a transformation just to fill these fields.",
  "Ordinary illustrations must stay directly within the selected fact's meaning. They are possible situations, not reports of actual customers or evidence of a typical behavior, cause, or result. Do not invent named people, quotes, numbers, product steps, or consequences. If a concrete scene needs unsupported details, use a direct practical observation about the fact instead.",
  "Preserve who acts and every material condition in the selected fact, including may, can, up to, frequency, and human approval. Keep each action's qualification separate: drafts that 'may need editing' might need editing, while required approval remains mandatory. When a draft fact contains both, explicitly state BOTH possible editing AND required approval before publication in contentIdea and supportedAngle, even when the idea focuses on just one. Never fix optional editing by omitting required approval. For that conditional editing, do not write 'edit and approve every post' or make editing required just because approval is required. If the fact explicitly requires both editing and approval, keep both mandatory instead. Multiple accounts do not establish simultaneous, bulk, single-click, or shared-post publishing; do not contrast the capability with 'one account at a time' unless the selected fact explicitly supports that timing. Apply this to contentIdea and every private field. Private context cannot authorize a claim beyond that fact.",
  "An idea may use one or two complete sentences, up to 60 words and 400 characters total. Use ONE sentence for a simple fact with one problem or capability, such as irregular posting, support for multiple accounts, or required human approval. Use two sentences only for different supported details or necessary conditions, such as a draft limit plus possible editing, or an order deadline plus pickup hours. Never describe a scene and then restate the same fact in a second sentence. Apply the deletion test to EVERY sentence, including the opening: remove it if the remaining text already gives the reader the same information. Do not start with generalities about recurring content needs or keeping several accounts in view. Do not append an empty conclusion, comment on what the fact means, or invent a benefit or unrelated capability. Do not stretch a complete one-sentence point. These are planning sentences, not literal display lines or finished overlay copy.",
  "Before writing an idea about a capability, check the approved context for conditions that limit that same capability. Preserve those conditions in the idea and supportedAngle; do not rely on a separate planning field to carry them. Other facts may restrict the selected claim, but may not be used to add unrelated claims. If conditions conflict or remain unclear, select a different supported fact rather than guessing.",
  "Before returning JSON, silently edit each idea and its private context inside this same request: replace 'cadence' with its plain meaning, delete sentences that add no useful information, keep possible editing separate from mandatory approval, and remove unsupported simultaneous or batch publishing. Retain every applicable factual condition and remove invented causes. Can a normal reader explain the point without the planning labels? Make related ideas different in substance when the evidence supports that difference. Return only the required fields.",
] as const;

const WALL_TEXT_PLANNING_EXAMPLES = [
  "The following examples demonstrate wording only. Their businesses, audiences, facts, and conditions are not evidence for this plan. Never copy their details unless the supplied approved context supports them. Use the required JSON schema, not the example labels, and do not repeat one sentence template.",
  "Approved fact: 'SaaS founders struggle with inconsistent posting cadence.' Avoid contentIdea: 'The broken rhythm reveals a process that is hard to repeat.' Prefer contentIdea: 'A SaaS founder may look back at recent posts and notice they appeared on scattered days rather than following a regular schedule.' Prefer humanMoment: 'A founder looks back at when recent posts were shared.' Prefer privateCreativeSeed: 'Posts appear irregularly.' Prefer supportedAngle: 'SaaS founders struggle to post regularly.' feeling: 'neutral'. emotionalTension: 'No particular emotional conflict'. Explain the irregular posting without inventing a broken process or a lack of inspiration.",
  "Selected fact: 'Inconsistent posting cadence'. Approved reader: SaaS founders. Another unselected fact: 'Daily ready-to-post content'. Avoid contentIdea: 'Busy founders lose posting days, so daily prepared content restores their rhythm.' Prefer contentIdea: 'A SaaS founder notices that recent posts appeared on scattered days rather than following a regular schedule.' Prefer humanMoment: 'A founder looks back at when recent posts were shared.' Prefer privateCreativeSeed: 'Recent posts did not follow a regular schedule.' Prefer supportedAngle: 'Posting is irregular.' feeling: 'neutral'. emotionalTension: 'No particular emotional conflict'. Neither a guessed cause nor a solution from the unselected fact belongs in this idea.",
  "Approved fact: 'Every ReviewPost post requires human approval before publication.' Avoid contentIdea: 'Keep judgment in the publishing process.' Prefer contentIdea: 'A person must approve each ReviewPost post before it is published.' Prefer humanMoment: 'A person reviews a prepared post and decides whether to approve it.' Prefer privateCreativeSeed: 'A prepared post still needs a person to approve it.' Prefer supportedAngle: 'Human approval is required for every post before publication.' The actor, action, and required approval are explicit.",
  "Approved fact: 'PaperNote lets freelance writers create up to three draft posts per month on the free plan; drafts may need editing.' Avoid contentIdea: 'Unlock a steady content rhythm with three ready-to-publish posts.' Prefer contentIdea: 'Freelance writers can create up to three draft posts per month on PaperNote's free plan. Those drafts may still need editing before publication.' Prefer humanMoment: 'A freelance writer considers the free plan for creating draft posts.' Prefer privateCreativeSeed: 'The free plan allows a limited number of drafts, not necessarily finished posts.' Prefer supportedAngle: 'Up to three draft posts per month on the free plan; drafts may need editing.' Keep the limit, frequency, plan restriction, and uncertainty about readiness.",
  "Approved fact: 'PaperNote's free plan lets freelance writers create up to three draft posts per month from their notes. Drafts may need editing. Each post requires approval before publication.' Avoid contentIdea: 'Writers create three drafts each month, then edit and approve every post.' Prefer contentIdea: 'Freelance writers can create up to three draft posts per month from notes on PaperNote's free plan. Drafts may need editing, and each post requires approval before publication.' Prefer humanMoment: 'A writer checks a draft and decides whether it needs editing before approving publication.' Prefer privateCreativeSeed: 'Editing may be needed, but approval is required for each post.' Prefer supportedAngle: 'Up to three drafts per month from notes on the free plan; drafts may need editing; approval is required before publication.' Do not make optional editing mandatory.",
  "Approved fact: 'AccountNote supports publishing to multiple Instagram accounts.' Approved reader: marketing managers. Avoid contentIdea: 'A manager publishes to every account at once instead of one account at a time.' Prefer contentIdea: 'A marketing manager can use AccountNote to publish content for more than one Instagram account.' Prefer humanMoment: 'A manager considers publishing content for the Instagram accounts they handle.' Prefer privateCreativeSeed: 'Publishing support covers more than one Instagram account.' Prefer supportedAngle: 'AccountNote supports publishing to multiple Instagram accounts.' Neither simultaneous publishing nor a shared post is established.",
  "Approved fact: 'AccountNote supports multiple Instagram accounts.' Approved reader: marketing managers. Avoid contentIdea: 'Managing several accounts means keeping each account in view as work moves forward. AccountNote supports multiple Instagram accounts.' Prefer contentIdea: 'A marketing manager can use AccountNote with more than one Instagram account.' The opening adds no supported information and should be deleted, not rewritten as another general observation.",
  "Approved fact: 'Morning Loaf accepts online sourdough orders by 4 pm for next-day pickup, Tuesday through Saturday from 8 am to noon.' Avoid contentIdea: 'A local resident can plan sourdough pickup. This gives collection a clear place in the daily routine.' Prefer contentIdea: 'A local resident can order sourdough online by 4 pm for next-day pickup. Pickup is available Tuesday through Saturday, from 8 am to noon.' The second sentence supplies useful days and hours rather than an empty conclusion; keep those conditions in supportedAngle as well.",
] as const;

function buildMessages(params: {
  briefIndexStart: number;
  briefCount: number;
  businessDescription: string;
  factSelectionRequired: boolean;
  issues: string[];
  planningContext: Json;
}) {
  return [
    {
      role: "system" as const,
      content: [
        "You create private creative-brief context and content ideas for Wall-of-Text short videos.",
        "The supplied businessDescription and approvedPlanningContext are the only factual source. Do not invent audiences, capabilities, workflows, proof, metrics, guarantees, outcomes, or claims.",
        ...WALL_TEXT_PLANNING_CLARITY_RULES,
        ...WALL_TEXT_PLANNING_EXAMPLES,
        "approvedPlanningContext.wallTextReaders identifies the intended Wall-of-Text reader categories. Treat its primary reader as the default; use its secondary reader only when it is present and the idea genuinely suits that category. Every audienceContext must name a supported reader category rather than a generic everyone. Do not invent a reader persona because a category is missing.",
        "Every five-idea group has a private parent brief, and every child idea has its own five-field private writing context. The child context—not only the parent—is stored and used later. Neither is visible overlay copy, labels, or a fixed script.",
        "creativeSeed: The central human observation or tension. It is not final copy.",
        "audienceContext: The supported audience segment experiencing that situation. It must not mean everyone.",
        "humanMoment: One concrete, recognisable everyday event or situation directly illustrating the selected fact, or a clear practical observation when a scene would require guessing.",
        "emotionalTension: The inner feeling or conflict only when it follows naturally from that moment. Otherwise use 'No particular emotional conflict'.",
        "supportedAngle: The factual connection to the business, based only on approved facts. It is not a sales claim or a promise.",
        ...(params.factSelectionRequired
          ? [
              "approvedPlanningContext.approvedFactSnapshot is the complete approved fact list for this plan. For every child, first choose exactly one selectedFactId from that list. Then create its humanMoment and contentIdea from what that exact fact supports. A clear paraphrase or ordinary daily illustration is allowed, but the moment and idea must not introduce a separate event, cause, workflow, problem, or outcome that the fact does not support. Never invent a human moment first and search for a fact to attach later. Do not choose a fact by its list position or by repeated words. If no fact produces a natural, supported moment, select a different fact or create a different child idea.",
            ]
          : []),
        "Each parent brief has an assigned current-plan situation focus. It is optional editorial guidance, not a fact, phrase to copy, required visible scene, or final-copy formula. Explore the focus when supported and natural. If it requires an invented event or forced emotion, use a clear observation directly supported by the selected fact instead. Vary the actual observation instead of copying the focus's abstract wording.",
        `For every child return ${params.factSelectionRequired ? "selectedFactId first, then " : ""}contentIdea, feeling, audienceContext, privateCreativeSeed, emotionalTension, humanMoment, and supportedAngle. contentIdea must be a complete one- or two-sentence human observation that a later Wall writer can develop. It must never begin with Show, Depict, Portray, Capture, Highlight, Explore, Imagine, Picture, Present, or Describe. feeling guides tone and is not a phrase the writer must append. The children are not generated from creativeSeed alone.`,
        "Situation coverage is an editorial goal within the available evidence, not permission to invent detail. Aim for five distinct supported situations or practical observations per group. For scenes, vary at least two supported details such as the trigger, main action, setting, point in the routine, people involved, or practical constraint when possible. For observations, change the actual question or point rather than its wording. Rewording the same core decision is not a distinct idea. Spread each ten-idea request across supported situations; consider preparation, use, or reflection when the fact supports them. Never force a scene or outcome to meet a variety quota. The assigned concept lane and parent focus are suggestions subordinate to supported meaning and clarity. Product mentions are optional; the selected fact remains the basis of the idea. Do not write final overlay copy, line breaks, a slide layout, a CTA, a product pitch, or a finished script.",
        "Return the complete JSON object required by the schema. Include every brief, every child idea, and every required field. Do not return commentary, a partial result, or an empty response.",
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
        assignedBriefSituationFocuses: getWallTextBriefSituationFocuses(
          params.briefIndexStart,
          params.briefCount,
        ),
        instruction: `Generate exactly ${params.briefCount} private creative briefs. Every brief must contain exactly five child ideas. briefSlotIndex values must be 0 through ${params.briefCount - 1}; itemSlotIndex values must be 0 through 4 for each brief.`,
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
  factSelectionRequired: boolean;
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
        ...WALL_TEXT_PLANNING_CLARITY_RULES,
        ...WALL_TEXT_PLANNING_EXAMPLES,
        "Keep contentIdea a complete one- or two-sentence human observation within 60 words and 400 characters. audienceContext must name a supported reader category. Use humanMoment for a recognizable supported situation or practical observation, privateCreativeSeed for its central point, and supportedAngle for its connection to the selected fact. Do not begin contentIdea with a production direction such as Show or Depict.",
        ...(params.factSelectionRequired
          ? [
              "For the replacement, first select exactly one valid selectedFactId from approvedPlanningContext.approvedFactSnapshot. Then create the new human situation and idea from that fact. Do not introduce a separate event, cause, workflow, problem, or outcome that the fact does not support, and never invent the situation first and attach a fact later.",
            ]
          : []),
        "Never repeat an exact contentIdea named in rejectedAttemptIssues; choose a genuinely distinct observation instead.",
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
        rejectedAttemptIssues: params.issues,
        instruction: `Return only ${params.factSelectionRequired ? "selectedFactId first, then " : ""}the replacement idea and its five private context fields.`,
      }),
    },
  ];
}

function buildSingleIdeaReplacementSchema(factSelectionRequired: boolean) {
  return {
    additionalProperties: false,
    properties: {
      ...(factSelectionRequired
        ? { selectedFactId: { maxLength: 120, minLength: 1, type: "string" } }
        : {}),
      audienceContext: { maxLength: 240, minLength: 1, type: "string" },
      contentIdea: { maxLength: MAX_CONTENT_IDEA_LENGTH, minLength: 1, type: "string" },
      emotionalTension: { maxLength: 160, minLength: 1, type: "string" },
      feeling: { maxLength: MAX_FEELING_LENGTH, minLength: 1, type: "string" },
      humanMoment: { maxLength: 400, minLength: 1, type: "string" },
      privateCreativeSeed: { maxLength: 400, minLength: 1, type: "string" },
      supportedAngle: { maxLength: 400, minLength: 1, type: "string" },
    },
    required: [
      ...(factSelectionRequired ? ["selectedFactId"] : []),
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
  approvedFactIds: ReadonlySet<string> | null,
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
      ...(approvedFactIds
        ? {
            selectedFactId: getApprovedPlanningFactId(
              item.selectedFactId,
              approvedFactIds,
              "single Wall-of-Text idea replacement selectedFactId",
            ),
          }
        : {}),
      supportedAngle: getString(item.supportedAngle, 400, "single Wall-of-Text idea replacement supportedAngle"),
    },
  };
}

function buildSchema(briefCount: number, factSelectionRequired: boolean) {
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
                  ...(factSelectionRequired
                    ? { selectedFactId: { maxLength: 120, minLength: 1, type: "string" } }
                    : {}),
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
                  ...(factSelectionRequired ? ["selectedFactId"] : []),
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

function getApprovedPlanningFactIds(
  planningContext: Json,
): ReadonlySet<string> | null {
  if (!planningContext || typeof planningContext !== "object" || Array.isArray(planningContext)) {
    return null;
  }
  const snapshotValue = (planningContext as Record<string, Json>).approvedFactSnapshot;
  if (snapshotValue === undefined) return null;
  const snapshot = asRecord(snapshotValue, "approved fact snapshot");
  if (snapshot.version !== "business-facts-v1" || !Array.isArray(snapshot.facts)) {
    throw new Error("Approved fact snapshot is invalid.");
  }
  const ids = new Set<string>();
  for (const [index, value] of snapshot.facts.entries()) {
    const fact = asRecord(value, `approved fact ${index + 1}`);
    const id = getString(fact.id, 120, `approved fact ${index + 1} ID`);
    if (ids.has(id)) throw new Error("Approved fact snapshot contains duplicate IDs.");
    ids.add(id);
  }
  if (ids.size === 0) {
    throw new Error("Approved fact snapshot must contain at least one fact.");
  }
  return ids;
}

function getApprovedPlanningFactId(
  value: unknown,
  approvedFactIds: ReadonlySet<string>,
  label: string,
) {
  const id = getString(value, 120, label);
  if (!approvedFactIds.has(id)) {
    throw new Error(`${label} is not present in the approved fact snapshot.`);
  }
  return id;
}

function normalize(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function getPrivateHumanMoment(value: Json | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const humanMoment = (value as Record<string, Json>).humanMoment;
  return typeof humanMoment === "string" && humanMoment.trim()
    ? humanMoment.trim()
    : null;
}

function countWords(value: string) {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

function getReasoningEffort(
  value: string | undefined,
  fallback: "low" | "medium",
  variableName: string,
) {
  const normalized = value?.trim().toLocaleLowerCase("en-US") || fallback;
  if (normalized === "none" || normalized === "low" || normalized === "medium") {
    return normalized;
  }
  throw new Error(`${variableName} must be none, low, or medium.`);
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for Wall-of-Text content planning.");
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey,
      maxRetries: CONTENT_PLAN_OPENAI_MAX_RETRIES,
      timeout: CONTENT_PLAN_OPENAI_TIMEOUT_MS,
    });
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
