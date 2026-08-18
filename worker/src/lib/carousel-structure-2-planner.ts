import OpenAI from "openai";

import type { WebsiteBusinessAnalysis } from "../types.js";
import {
  assertCarouselStructure2StoryAssignments,
  buildCarouselStructure2BatchMessages,
  buildCarouselStructure2RepairMessages,
  buildCarouselStructure2StoryBatchSchema,
  buildCarouselStructure2StoryPlanSchema,
  buildDeterministicCarouselStructure2StoryPlan,
  createCarouselStructure2InvalidPlanIssue,
  dedupeCarouselStructure2ValidationIssues,
  formatCarouselStructure2ValidationIssues,
  parseCarouselStructure2StoryPlan,
  validateCarouselStructure2StoryPlan,
  type CarouselStructure2RecentHistoryInput,
  type CarouselStructure2StoryAssignment,
  type CarouselStructure2StoryHistorySummary,
  type CarouselStructure2StoryPlan,
  type CarouselStructure2StoryValidationIssue,
} from "./carousel-structure-2-story-plan.js";
import type { CarouselStructure2FormatId } from "./carousel-structure-2-formats.js";

export const CAROUSEL_STRUCTURE_2_PLANNER_VERSION =
  "llm-carousel-structure-2-story-planner-v1-isolated-repair";

const DEFAULT_MODEL = "gpt-4.1-mini";
let openaiClient: OpenAI | null = null;

export type CarouselStructure2StoryPlanResult = {
  assignedStoryFormatId: CarouselStructure2FormatId;
  fallbackReason: string | null;
  model: string | null;
  plan: CarouselStructure2StoryPlan;
  plannerVersion: string;
  rawLlmResponse: {
    initialBatch: string | null;
    repair: string | null;
  };
  slotIndex: number;
  source: "deterministic-fallback" | "llm";
  validationResult: {
    fallbackUsed: boolean;
    finalIssues: CarouselStructure2StoryValidationIssue[];
    initialIssues: CarouselStructure2StoryValidationIssue[];
    ok: boolean;
    repairAttempted: boolean;
    repaired: boolean;
  };
};

export type CarouselStructure2StoryBatchInput = {
  allowDeterministicFallback?: boolean;
  analysis: WebsiteBusinessAnalysis;
  assignments: CarouselStructure2StoryAssignment[];
  recentHistory?: CarouselStructure2RecentHistoryInput[];
};

export async function buildCarouselStructure2StoryPlanBatch(
  input: CarouselStructure2StoryBatchInput,
): Promise<CarouselStructure2StoryPlanResult[]> {
  assertCarouselStructure2StoryAssignments(input.assignments);
  const assignments = [...input.assignments].sort(
    (left, right) => left.slotIndex - right.slotIndex,
  );
  const model =
    process.env.OPENAI_CAROUSEL_STRUCTURE_2_MODEL?.trim() ||
    process.env.OPENAI_CAROUSEL_PLANNER_MODEL?.trim() ||
    DEFAULT_MODEL;

  if (
    process.env.CAROUSEL_STRUCTURE_2_PLANNER_MODE?.trim() === "deterministic" ||
    process.env.CAROUSEL_CONTENT_PLANNER_MODE?.trim() === "deterministic"
  ) {
    if (input.allowDeterministicFallback === false) {
      throw new Error(
        "Carousel Structure 2 LLM planning is disabled; runtime fallback copy is not permitted.",
      );
    }
    return buildDeterministicBatch(
      input,
      assignments,
      "Structure 2 LLM planning is disabled by planner mode.",
      null,
    );
  }

  let initialBatchResponse: string | null = null;
  let rawPlans = new Map<number, unknown>();
  let batchFailure: CarouselStructure2StoryValidationIssue | null = null;

  try {
    const completion = await getOpenAIClient().chat.completions.create({
      max_completion_tokens: 8_000,
      messages: buildCarouselStructure2BatchMessages(input),
      model,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "carousel_structure_2_story_batch",
          schema: buildCarouselStructure2StoryBatchSchema(input),
          strict: true,
        },
      },
      temperature: 0.45,
    });
    initialBatchResponse = completion.choices[0]?.message.content ?? null;

    if (!initialBatchResponse) {
      throw new Error("OpenAI returned no Structure 2 story batch content.");
    }

    rawPlans = parseBatchEnvelope(JSON.parse(initialBatchResponse));
  } catch (error) {
    batchFailure = createCarouselStructure2InvalidPlanIssue(error);
  }

  const results: CarouselStructure2StoryPlanResult[] = [];
  const acceptedHistory: CarouselStructure2RecentHistoryInput[] = [
    ...(input.recentHistory ?? []),
  ];

  for (const assignment of assignments) {
    const rawPlan = rawPlans.get(assignment.slotIndex) ?? null;
    let initialIssues: CarouselStructure2StoryValidationIssue[] = batchFailure
      ? [batchFailure]
      : [];
    let parsedPlan: CarouselStructure2StoryPlan | null = null;

    if (!batchFailure) {
      try {
        parsedPlan = parseCarouselStructure2StoryPlan(rawPlan, {
          analysis: input.analysis,
          storyFormatId: assignment.storyFormatId,
        });
        initialIssues = validateCarouselStructure2StoryPlan(parsedPlan, {
          analysis: input.analysis,
          recentHistory: acceptedHistory,
        });
      } catch (error) {
        initialIssues = [createCarouselStructure2InvalidPlanIssue(error)];
      }
    }

    if (parsedPlan && initialIssues.length === 0) {
      const result = createLlmResult({
        assignment,
        initialBatchResponse,
        initialIssues: [],
        model,
        plan: parsedPlan,
        repairResponse: null,
        repaired: false,
      });
      results.push(result);
      acceptedHistory.push(toRecentHistory(parsedPlan.historySummary));
      continue;
    }

    const repaired = await attemptIsolatedRepair({
      analysis: input.analysis,
      assignment,
      initialBatchResponse,
      initialIssues,
      model,
      rawPlan,
      recentHistory: acceptedHistory,
    });

    if (repaired) {
      results.push(repaired);
      acceptedHistory.push(toRecentHistory(repaired.plan.historySummary));
      continue;
    }

    if (input.allowDeterministicFallback === false) {
      throw new Error(
        `Carousel Structure 2 planning failed after isolated repair for slot ${assignment.slotIndex}: ${formatCarouselStructure2ValidationIssues(
          initialIssues.length > 0
            ? initialIssues
            : [
                {
                  code: "invalid_plan",
                  message: "Structure 2 plan did not pass validation.",
                  slideNumber: null,
                },
              ],
        )}`,
      );
    }

    const fallbackReason = formatCarouselStructure2ValidationIssues(
      initialIssues.length > 0
        ? initialIssues
        : [
            {
              code: "invalid_plan",
              message: "Structure 2 plan did not pass validation.",
              slideNumber: null,
            },
          ],
    );
    const fallbackPlan = buildDeterministicCarouselStructure2StoryPlan({
      analysis: input.analysis,
      assignment,
      recentHistory: acceptedHistory,
    });
    const result = createFallbackResult({
      assignment,
      fallbackReason,
      initialBatchResponse,
      initialIssues,
      model,
      plan: fallbackPlan,
    });
    results.push(result);
    acceptedHistory.push(toRecentHistory(fallbackPlan.historySummary));
  }

  return results;
}

async function attemptIsolatedRepair(params: {
  analysis: WebsiteBusinessAnalysis;
  assignment: CarouselStructure2StoryAssignment;
  initialBatchResponse: string | null;
  initialIssues: CarouselStructure2StoryValidationIssue[];
  model: string;
  rawPlan: unknown;
  recentHistory: CarouselStructure2RecentHistoryInput[];
}) {
  let repairResponse: string | null = null;

  try {
    const completion = await getOpenAIClient().chat.completions.create({
      max_completion_tokens: 1_800,
      messages: buildCarouselStructure2RepairMessages({
        analysis: params.analysis,
        assignment: params.assignment,
        issues: params.initialIssues,
        rawPlan: params.rawPlan,
        recentHistory: params.recentHistory,
      }),
      model: params.model,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: `carousel_structure_2_story_repair_${params.assignment.slotIndex}`,
          schema: buildCarouselStructure2StoryPlanSchema({
            analysis: params.analysis,
            storyFormatId: params.assignment.storyFormatId,
          }),
          strict: true,
        },
      },
      temperature: 0.15,
    });
    repairResponse = completion.choices[0]?.message.content ?? null;

    if (!repairResponse) {
      throw new Error("OpenAI returned no repaired Structure 2 story plan.");
    }

    const repairedPlan = parseCarouselStructure2StoryPlan(
      JSON.parse(repairResponse),
      {
        analysis: params.analysis,
        storyFormatId: params.assignment.storyFormatId,
      },
    );
    const finalIssues = validateCarouselStructure2StoryPlan(repairedPlan, {
      analysis: params.analysis,
      recentHistory: params.recentHistory,
    });

    if (finalIssues.length > 0) {
      const combinedIssues = dedupeCarouselStructure2ValidationIssues([
        ...params.initialIssues,
        ...finalIssues,
      ]);
      params.initialIssues.splice(
        0,
        params.initialIssues.length,
        ...combinedIssues,
      );
      return null;
    }

    return createLlmResult({
      assignment: params.assignment,
      initialBatchResponse: params.initialBatchResponse,
      initialIssues: params.initialIssues,
      model: params.model,
      plan: repairedPlan,
      repairResponse,
      repaired: true,
    });
  } catch (error) {
    const combinedIssues = dedupeCarouselStructure2ValidationIssues([
      ...params.initialIssues,
      createCarouselStructure2InvalidPlanIssue(error),
    ]);
    params.initialIssues.splice(
      0,
      params.initialIssues.length,
      ...combinedIssues,
    );
    return null;
  }
}

function buildDeterministicBatch(
  input: CarouselStructure2StoryBatchInput,
  assignments: readonly CarouselStructure2StoryAssignment[],
  fallbackReason: string,
  model: string | null,
) {
  const history: CarouselStructure2RecentHistoryInput[] = [
    ...(input.recentHistory ?? []),
  ];

  return assignments.map((assignment) => {
    const plan = buildDeterministicCarouselStructure2StoryPlan({
      analysis: input.analysis,
      assignment,
      recentHistory: history,
    });
    history.push(toRecentHistory(plan.historySummary));

    return createFallbackResult({
      assignment,
      fallbackReason,
      initialBatchResponse: null,
      initialIssues: [],
      model,
      plan,
    });
  });
}

function createLlmResult(params: {
  assignment: CarouselStructure2StoryAssignment;
  initialBatchResponse: string | null;
  initialIssues: CarouselStructure2StoryValidationIssue[];
  model: string;
  plan: CarouselStructure2StoryPlan;
  repairResponse: string | null;
  repaired: boolean;
}): CarouselStructure2StoryPlanResult {
  return {
    assignedStoryFormatId: params.assignment.storyFormatId,
    fallbackReason: null,
    model: params.model,
    plan: params.plan,
    plannerVersion: CAROUSEL_STRUCTURE_2_PLANNER_VERSION,
    rawLlmResponse: {
      initialBatch: params.initialBatchResponse,
      repair: params.repairResponse,
    },
    slotIndex: params.assignment.slotIndex,
    source: "llm",
    validationResult: {
      fallbackUsed: false,
      finalIssues: [],
      initialIssues: params.initialIssues,
      ok: true,
      repairAttempted: params.repaired,
      repaired: params.repaired,
    },
  };
}

function createFallbackResult(params: {
  assignment: CarouselStructure2StoryAssignment;
  fallbackReason: string;
  initialBatchResponse: string | null;
  initialIssues: CarouselStructure2StoryValidationIssue[];
  model: string | null;
  plan: CarouselStructure2StoryPlan;
}): CarouselStructure2StoryPlanResult {
  return {
    assignedStoryFormatId: params.assignment.storyFormatId,
    fallbackReason: params.fallbackReason,
    model: params.model,
    plan: params.plan,
    plannerVersion: CAROUSEL_STRUCTURE_2_PLANNER_VERSION,
    rawLlmResponse: {
      initialBatch: params.initialBatchResponse,
      repair: null,
    },
    slotIndex: params.assignment.slotIndex,
    source: "deterministic-fallback",
    validationResult: {
      fallbackUsed: true,
      finalIssues: [],
      initialIssues: params.initialIssues,
      ok: true,
      repairAttempted: params.initialBatchResponse !== null,
      repaired: false,
    },
  };
}

function parseBatchEnvelope(value: unknown) {
  const record = asRecord(value, "Structure 2 story batch");

  if (!Array.isArray(record.items) || record.items.length !== 5) {
    throw new Error("Structure 2 story batch must contain exactly five items.");
  }

  const plans = new Map<number, unknown>();

  for (const [index, itemValue] of record.items.entries()) {
    const item = asRecord(itemValue, `Structure 2 batch item ${index + 1}`);

    if (
      typeof item.slotIndex !== "number" ||
      !Number.isInteger(item.slotIndex) ||
      item.slotIndex < 0 ||
      item.slotIndex > 4 ||
      plans.has(item.slotIndex)
    ) {
      throw new Error(
        "Structure 2 story batch must contain slots 0 through 4 exactly once.",
      );
    }

    plans.set(item.slotIndex, item.plan);
  }

  return plans;
}

function toRecentHistory(
  summary: CarouselStructure2StoryHistorySummary,
): CarouselStructure2RecentHistoryInput {
  return { ...summary };
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function getOpenAIClient() {
  if (openaiClient) return openaiClient;

  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for Structure 2 story planning.");
  }

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}
