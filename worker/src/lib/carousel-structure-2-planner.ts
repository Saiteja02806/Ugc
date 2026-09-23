import OpenAI from "openai";
import { resolveStructure2HookTemplate } from "./carousel-structure-2-hook-templates.js";

import {
  assertCarouselStructure2StoryAssignments,
  buildCarouselStructure2BatchMessages,
  buildCarouselStructure2RepairMessages,
  buildCarouselStructure2StoryTextRepairMessages,
  buildCarouselStructure2StoryBatchSchema,
  buildCarouselStructure2StoryPlanSchema,
  buildCarouselStructure2StoryTextRepairSchema,
  createCarouselStructure2InvalidPlanIssue,
  dedupeCarouselStructure2ValidationIssues,
  formatCarouselStructure2ValidationIssues,
  parseCarouselStructure2StoryBatch,
  parseCarouselStructure2StoryPlan,
  parseCarouselStructure2StoryTextRepair,
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
  "llm-carousel-structure-2-writer-v19-shared-hook-templates";

// The OpenAI strict decoder cannot safely carry the whitespace word-count
// regex. Keep the exact contract in the publisher validator and allow one
// additional, tightly scoped repair only when that validator says the model is
// close on word count or copy uniqueness. This is deliberately not a general
// retry loop: every other defect keeps the single-repair failure behavior.
const MAX_TARGETED_REPAIR_ATTEMPTS = 2;
const TARGETED_COPY_REPAIR_ISSUE_CODES = new Set<
  CarouselStructure2StoryValidationIssue["code"]
>([
  "generic_copy",
  "hook_incomplete",
  "hook_length",
  "hook_template_placeholder",
  "perspective",
  "product_timing",
  "render_fit",
  "story_repetition",
  "unsupported_claim",
  "word_count",
]);

let openaiClient: OpenAI | null = null;

export type CarouselStructure2StoryPlanResult = {
  hookTemplateId?: string | null;
  hookTemplateVersion?: number | null;
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
    hookTemplateResolutionReason?: string | null;
    advisoryIssues: CarouselStructure2StoryValidationIssue[];
    fallbackUsed: boolean;
    finalIssues: CarouselStructure2StoryValidationIssue[];
    initialIssues: CarouselStructure2StoryValidationIssue[];
    ok: boolean;
    repairAttempted: boolean;
    repaired: boolean;
  };
};

export type CarouselStructure2ProviderResponseDiagnostic = {
  completionId: string | null;
  completionTokens: number | null;
  finishReason: string | null;
  promptTokens: number | null;
  refusal: string | null;
  requestId: string | null;
  responseCharacterCount: number;
  totalTokens: number | null;
};

export class CarouselStructure2EmptyProviderResponseError extends Error {
  readonly diagnostic: CarouselStructure2ProviderResponseDiagnostic;

  constructor(diagnostic: CarouselStructure2ProviderResponseDiagnostic) {
    super(
      `OpenAI returned no Structure 2 story batch content (finish_reason=${diagnostic.finishReason ?? "unknown"}, response_chars=${diagnostic.responseCharacterCount}, request_id=${diagnostic.requestId ?? "unknown"}).`,
    );
    this.name = "CarouselStructure2EmptyProviderResponseError";
    this.diagnostic = diagnostic;
  }
}

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
      throw new CarouselStructure2EmptyProviderResponseError(
        summarizeProviderResponse(completion),
      );
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
      parsedPlan,
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
  parsedPlan: CarouselStructure2StoryPlan | null;
  rawPlan: unknown;
  recentHistory: CarouselStructure2RecentHistoryInput[];
  diagnostics: { repair: string | null };
}) {
  let currentIssues = [...params.initialIssues];
  let currentRawPlan = params.rawPlan;
  let currentPlan = params.parsedPlan;
  const repairResponses: string[] = [];

  for (
    let attempt = 1;
    attempt <= MAX_TARGETED_REPAIR_ATTEMPTS;
    attempt += 1
  ) {
    try {
      const targetedIssues = getTargetedCopyRepairIssues(
        currentPlan,
        currentIssues,
      );
      const usesTargetedCopyRepair = targetedIssues !== null;
      const targetedSlideNumbers = usesTargetedCopyRepair
        ? [...new Set(targetedIssues!.map((issue) => issue.slideNumber!))]
        : [];
      const completion = await getOpenAIClient().chat.completions.create({
        max_completion_tokens: 1_800,
        messages: usesTargetedCopyRepair
          ? buildCarouselStructure2StoryTextRepairMessages({
              assignment: params.assignment,
              businessDescription: params.businessDescription,
              issues: targetedIssues!,
              plan: currentPlan!,
              recentHistory: params.recentHistory,
              repairAttempt: attempt,
              repairAttemptLimit: MAX_TARGETED_REPAIR_ATTEMPTS,
            })
          : buildCarouselStructure2RepairMessages({
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
            name: usesTargetedCopyRepair
              ? `carousel_structure_2_story_text_repair_${params.assignment.slotIndex}_${attempt}`
              : `carousel_structure_2_story_repair_${params.assignment.slotIndex}_${attempt}`,
            schema: usesTargetedCopyRepair
              ? buildCarouselStructure2StoryTextRepairSchema(targetedSlideNumbers)
              : buildCarouselStructure2StoryPlanSchema(),
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

      const rawRepair = JSON.parse(repairResponse);
      const repairedPlan = usesTargetedCopyRepair
        ? replaceStoryTexts(
            currentPlan!,
            parseCarouselStructure2StoryTextRepair(
              rawRepair,
              targetedSlideNumbers,
            ),
          )
        : parseCarouselStructure2StoryPlan(rawRepair, {
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

      const canUseTargetedSecondRepair =
        attempt < MAX_TARGETED_REPAIR_ATTEMPTS &&
        hasOnlyTargetedSecondRepairIssues(finalIssues);

      if (!canUseTargetedSecondRepair) {
        // One cover-only escape hatch after normal repairs, never a bypass for
        // claims, grounding, body copy or any other publishing failure.
        if (attempt === MAX_TARGETED_REPAIR_ATTEMPTS &&
          resolveStructure2HookTemplate(params.assignment).template &&
          finalIssues.every((issue) => issue.slideNumber === 1 && issue.code === "render_fit")) {
          const nativeAssignment = { ...params.assignment, hookTemplateId: null, hookTemplateVersion: null };
          const completion = await getOpenAIClient().chat.completions.create({
            model: params.model, temperature: 0.15, max_completion_tokens: 300,
            messages: buildCarouselStructure2StoryTextRepairMessages({
              assignment: nativeAssignment, businessDescription: params.businessDescription,
              issues: finalIssues, plan: repairedPlan, recentHistory: params.recentHistory,
              repairAttempt: 1, repairAttemptLimit: 1,
            }),
            response_format: { type: "json_schema", json_schema: {
              name: `carousel_structure_2_native_cover_${params.assignment.slotIndex}`,
              schema: buildCarouselStructure2StoryTextRepairSchema([1]), strict: true,
            } },
          });
          const response = completion.choices[0]?.message.content;
          if (!response) throw new Error("No native Structure 2 cover repair returned.");
          repairResponses.push(response);
          params.diagnostics.repair = repairResponses.join("\n\n--- Structure 2 repair attempt ---\n\n");
          const nativePlan = replaceStoryTexts(repairedPlan, parseCarouselStructure2StoryTextRepair(JSON.parse(response), [1]));
          const nativeValidation = partitionCarouselStructure2ValidationIssues(validateCarouselStructure2StoryPlan(nativePlan, {
            businessDescription: params.businessDescription, recentHistory: params.recentHistory,
          }));
          if (!nativeValidation.blockingIssues.length) {
            const result = createLlmResult({ assignment: nativeAssignment, plan: nativePlan,
              advisoryIssues: nativeValidation.advisoryIssues, initialBatchResponse: params.initialBatchResponse,
              initialIssues: params.initialIssues, model: params.model, repairResponse: params.diagnostics.repair, repaired: true });
            result.fallbackReason = "hook_template_cover_render_fit";
            result.validationResult.hookTemplateResolutionReason = "cover_render_fit";
            result.validationResult.fallbackUsed = true;
            return result;
          }
          replaceIssues(params.initialIssues, nativeValidation.blockingIssues);
          return null;
        }
        replaceIssues(params.initialIssues, finalIssues);
        return null;
      }

      currentIssues = finalIssues;
      currentRawPlan = rawRepair;
      currentPlan = repairedPlan;
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
    issues.every((issue) => TARGETED_COPY_REPAIR_ISSUE_CODES.has(issue.code))
  );
}

function getTargetedCopyRepairIssues(
  plan: CarouselStructure2StoryPlan | null,
  issues: readonly CarouselStructure2StoryValidationIssue[],
) {
  if (!plan || issues.length === 0) return null;
  if (
    !issues.every(
      (issue) =>
        issue.slideNumber !== null &&
        TARGETED_COPY_REPAIR_ISSUE_CODES.has(issue.code),
    )
  ) {
    return null;
  }
  return [...issues];
}

function replaceStoryTexts(
  plan: CarouselStructure2StoryPlan,
  storyTextBySlide: ReadonlyMap<number, string>,
): CarouselStructure2StoryPlan {
  return {
    ...plan,
    slides: plan.slides.map((slide) =>
      storyTextBySlide.has(slide.slideNumber)
        ? { ...slide, storyText: storyTextBySlide.get(slide.slideNumber)! }
        : slide,
    ),
  };
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
  const { template, reason } = resolveStructure2HookTemplate(params.assignment);
  return {
    hookTemplateId: template?.id ?? null,
    hookTemplateVersion: template?.version ?? null,
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
      hookTemplateResolutionReason: reason,
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

function summarizeProviderResponse(
  completion: OpenAI.Chat.Completions.ChatCompletion,
): CarouselStructure2ProviderResponseDiagnostic {
  const choice = completion.choices[0];
  const response = choice?.message.content ?? "";
  const responseWithRequestId = completion as typeof completion & {
    _request_id?: string;
    request_id?: string;
  };

  return {
    completionId: completion.id ?? null,
    completionTokens: completion.usage?.completion_tokens ?? null,
    finishReason: choice?.finish_reason ?? null,
    promptTokens: completion.usage?.prompt_tokens ?? null,
    refusal: choice?.message.refusal ?? null,
    requestId:
      responseWithRequestId._request_id ??
      responseWithRequestId.request_id ??
      null,
    responseCharacterCount: response.length,
    totalTokens: completion.usage?.total_tokens ?? null,
  };
}
