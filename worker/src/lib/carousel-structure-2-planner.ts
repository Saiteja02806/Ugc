import OpenAI from "openai";

import {
  assertCarouselStructure2StoryAssignments,
  buildCarouselStructure2BatchMessages,
  buildCarouselStructure2RepairMessages,
  buildCarouselStructure2StoryBatchSchema,
  buildCarouselStructure2StoryPlanSchema,
  createCarouselStructure2InvalidPlanIssue,
  dedupeCarouselStructure2ValidationIssues,
  formatCarouselStructure2ValidationIssues,
  parseCarouselStructure2StoryBatch,
  parseCarouselStructure2StoryPlan,
  partitionCarouselStructure2ValidationIssues,
  validateCarouselStructure2StoryPlan,
  type CarouselStructure2RecentHistoryInput,
  type CarouselStructure2StoryAssignment,
  type CarouselStructure2StoryPlan,
  type CarouselStructure2StoryValidationIssue,
} from "./carousel-structure-2-story-plan.js";
import type { CarouselStructure2FormatId } from "./carousel-structure-2-formats.js";
import { CAROUSEL_TEXT_MODEL } from "./carousel-text-model.js";
import { CONTENT_PLAN_OPENAI_MAX_RETRIES, CONTENT_PLAN_OPENAI_TIMEOUT_MS } from "./content-plan-provider-retry.js";

export const CAROUSEL_STRUCTURE_2_PLANNER_VERSION =
  "llm-carousel-structure-2-writer-v14-bounded-copy-repair";

// The OpenAI strict decoder cannot safely carry the whitespace word-count
// regex. Keep the exact contract in the publisher validator and allow one
// additional, tightly scoped repair only when that validator says the model is
// close on word count or copy uniqueness. This is deliberately not a general
// retry loop: every other defect keeps the single-repair failure behavior.
const MAX_TARGETED_REPAIR_ATTEMPTS = 2;
const SECOND_REPAIRABLE_ISSUE_CODES = new Set<
  CarouselStructure2StoryValidationIssue["code"]
>(["recent_repetition", "story_repetition", "word_count"]);

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
  source: "llm";
  validationResult: {
    advisoryIssues: CarouselStructure2StoryValidationIssue[];
    fallbackUsed: boolean;
    finalIssues: CarouselStructure2StoryValidationIssue[];
    initialIssues: CarouselStructure2StoryValidationIssue[];
    ok: boolean;
    repairAttempted: boolean;
    repaired: boolean;
  };
};

export type CarouselStructure2StoryBatchInput = {
  assignments: CarouselStructure2StoryAssignment[];
  businessDescription: string;
  recentHistory?: CarouselStructure2RecentHistoryInput[];
  onPlanFailure?: (failure: CarouselStructure2PlanFailure) => Promise<void>;
};

export type CarouselStructure2PlanFailure = {
  slotIndex: number;
  message: string;
  rawLlmResponse: { initialBatch: string | null; repair: string | null };
  issues: CarouselStructure2StoryValidationIssue[];
};

export async function buildCarouselStructure2StoryPlanBatch(
  input: CarouselStructure2StoryBatchInput,
): Promise<CarouselStructure2StoryPlanResult[]> {
  assertCarouselStructure2StoryAssignments(input.assignments);
  const assignments = [...input.assignments].sort(
    (left, right) => left.slotIndex - right.slotIndex,
  );
  const model = CAROUSEL_TEXT_MODEL;

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

    rawPlans = parseCarouselStructure2StoryBatch(
      JSON.parse(initialBatchResponse),
      assignments,
    );
  } catch (error) {
    // Provider outages and empty responses contain no candidate copy to repair.
    // Do not amplify one failed request into five more provider requests.
    if (!initialBatchResponse) throw error;
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
    let advisoryIssues: CarouselStructure2StoryValidationIssue[] = [];
    let parsedPlan: CarouselStructure2StoryPlan | null = null;

    if (!batchFailure) {
      try {
        parsedPlan = parseCarouselStructure2StoryPlan(rawPlan, {
          businessDescription: input.businessDescription,
          storyFormatId: assignment.storyFormatId,
        });
        const validation = partitionCarouselStructure2ValidationIssues(
          validateCarouselStructure2StoryPlan(parsedPlan, {
            businessDescription: input.businessDescription,
            recentHistory: acceptedHistory,
          }),
        );
        initialIssues = validation.blockingIssues;
        advisoryIssues = validation.advisoryIssues;
      } catch (error) {
        initialIssues = [createCarouselStructure2InvalidPlanIssue(error)];
      }
    }

    if (parsedPlan && initialIssues.length === 0) {
      const result = createLlmResult({
        advisoryIssues,
        assignment,
        initialBatchResponse,
        initialIssues: [],
        model,
        plan: parsedPlan,
        repairResponse: null,
        repaired: false,
      });
      results.push(result);
      acceptedHistory.push(toRecentHistory(parsedPlan, assignment.slotIndex));
      continue;
    }

    const diagnostics = { repair: null as string | null };
    const repaired = await attemptIsolatedRepair({
      assignment,
      businessDescription: input.businessDescription,
      initialBatchResponse,
      initialIssues,
      model,
      rawPlan,
      recentHistory: acceptedHistory,
      diagnostics,
    });

    if (repaired) {
      results.push(repaired);
      acceptedHistory.push(
        toRecentHistory(repaired.plan, assignment.slotIndex),
      );
      continue;
    }

    const failure = new Error(
      `Carousel Structure 2 planning failed after isolated LLM repair for slot ${assignment.slotIndex}: ${formatCarouselStructure2ValidationIssues(
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
    if (!input.onPlanFailure) throw failure;
    // A failed candidate must not discard accepted siblings or prevent later
    // slots from being validated. The runtime persists this failure separately.
    await input.onPlanFailure({
      slotIndex: assignment.slotIndex,
      message: failure.message,
      rawLlmResponse: { initialBatch: initialBatchResponse, repair: diagnostics.repair },
      issues: initialIssues,
    });
  }

  return results;
}

async function attemptIsolatedRepair(params: {
  assignment: CarouselStructure2StoryAssignment;
  businessDescription: string;
  initialBatchResponse: string | null;
  initialIssues: CarouselStructure2StoryValidationIssue[];
  model: string;
  rawPlan: unknown;
  recentHistory: CarouselStructure2RecentHistoryInput[];
  diagnostics: { repair: string | null };
}) {
  let currentIssues = [...params.initialIssues];
  let currentRawPlan = params.rawPlan;
  const repairResponses: string[] = [];

  for (
    let attempt = 1;
    attempt <= MAX_TARGETED_REPAIR_ATTEMPTS;
    attempt += 1
  ) {
    try {
      const completion = await getOpenAIClient().chat.completions.create({
        max_completion_tokens: 1_800,
        messages: buildCarouselStructure2RepairMessages({
          assignment: params.assignment,
          businessDescription: params.businessDescription,
          issues: currentIssues,
          rawPlan: currentRawPlan,
          recentHistory: params.recentHistory,
          repairAttempt: attempt,
          repairAttemptLimit: MAX_TARGETED_REPAIR_ATTEMPTS,
        }),
        model: params.model,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: `carousel_structure_2_story_repair_${params.assignment.slotIndex}_${attempt}`,
            schema: buildCarouselStructure2StoryPlanSchema(),
            strict: true,
          },
        },
        temperature: 0.15,
      });
      const repairResponse = completion.choices[0]?.message.content ?? null;

      if (!repairResponse) {
        throw new Error("OpenAI returned no repaired Structure 2 story plan.");
      }

      repairResponses.push(repairResponse);
      params.diagnostics.repair = repairResponses.join(
        "\n\n--- Structure 2 repair attempt ---\n\n",
      );

      const rawRepairedPlan = JSON.parse(repairResponse);
      const repairedPlan = parseCarouselStructure2StoryPlan(rawRepairedPlan, {
        businessDescription: params.businessDescription,
        storyFormatId: params.assignment.storyFormatId,
      });
      const validation = partitionCarouselStructure2ValidationIssues(
        validateCarouselStructure2StoryPlan(repairedPlan, {
          businessDescription: params.businessDescription,
          recentHistory: params.recentHistory,
        }),
      );
      const finalIssues = validation.blockingIssues;

      if (finalIssues.length === 0) {
        return createLlmResult({
          advisoryIssues: validation.advisoryIssues,
          assignment: params.assignment,
          initialBatchResponse: params.initialBatchResponse,
          initialIssues: params.initialIssues,
          model: params.model,
          plan: repairedPlan,
          repairResponse: params.diagnostics.repair,
          repaired: true,
        });
      }

      const combinedIssues = dedupeCarouselStructure2ValidationIssues([
        ...currentIssues,
        ...finalIssues,
      ]);
      const canUseTargetedSecondRepair =
        attempt < MAX_TARGETED_REPAIR_ATTEMPTS &&
        hasOnlyTargetedSecondRepairIssues(combinedIssues);

      if (!canUseTargetedSecondRepair) {
        replaceIssues(params.initialIssues, combinedIssues);
        return null;
      }

      currentIssues = combinedIssues;
      currentRawPlan = rawRepairedPlan;
    } catch (error) {
      replaceIssues(
        params.initialIssues,
        dedupeCarouselStructure2ValidationIssues([
          ...currentIssues,
          createCarouselStructure2InvalidPlanIssue(error),
        ]),
      );
      return null;
    }
  }

  return null;
}

function hasOnlyTargetedSecondRepairIssues(
  issues: readonly CarouselStructure2StoryValidationIssue[],
) {
  return (
    issues.length > 0 &&
    issues.every((issue) => SECOND_REPAIRABLE_ISSUE_CODES.has(issue.code))
  );
}

function replaceIssues(
  target: CarouselStructure2StoryValidationIssue[],
  issues: readonly CarouselStructure2StoryValidationIssue[],
) {
  target.splice(0, target.length, ...issues);
}

function createLlmResult(params: {
  advisoryIssues: CarouselStructure2StoryValidationIssue[];
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
      advisoryIssues: params.advisoryIssues,
      fallbackUsed: false,
      finalIssues: [],
      initialIssues: params.initialIssues,
      ok: true,
      repairAttempted: params.repaired,
      repaired: params.repaired,
    },
  };
}

function toRecentHistory(
  plan: CarouselStructure2StoryPlan,
  slotIndex: number,
): CarouselStructure2RecentHistoryInput {
  return {
    contentPlanItemId: null,
    formatId: plan.strategy.storyFormatId,
    generationId: `current-structure-2-slot-${slotIndex}`,
    slides: plan.slides.map((slide) => ({
      ctaText: slide.ctaText,
      headline: slide.storyText,
      slideNumber: slide.slideNumber,
      subtext: null,
    })),
    structureId: "structure_2",
  };
}

function getOpenAIClient() {
  if (openaiClient) return openaiClient;

  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for Structure 2 story planning.");
  }

  openaiClient = new OpenAI({
    apiKey,
    maxRetries: CONTENT_PLAN_OPENAI_MAX_RETRIES,
    timeout: CONTENT_PLAN_OPENAI_TIMEOUT_MS,
  });
  return openaiClient;
}
