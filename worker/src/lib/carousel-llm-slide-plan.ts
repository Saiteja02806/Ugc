import OpenAI from "openai";

import type { WebsiteBusinessAnalysis } from "../types.js";
import type {
  CarouselPlanningBrief,
  CarouselRecentAcceptedCopy,
} from "./carousel-content-plan.js";
import {
  CAROUSEL_FIXED_FONT_SIZE,
  CAROUSEL_STRUCTURE_1_BODY_MAX_LINES,
  CAROUSEL_STRUCTURE_1_FIXED_TEXT_WIDTH,
  CAROUSEL_STRUCTURE_1_HEADLINE_MAX_LINES,
  CAROUSEL_STRUCTURE_1_LIST_ITEM_MAX_LINES,
  CAROUSEL_STRUCTURE_1_LIST_TOTAL_MAX_LINES,
  inspectCarouselFixedTextFit,
  type CarouselTextMode,
  type PlannedCarouselSlide,
} from "./carousel-slide-plan.js";
import {
  getCarouselContentFormat,
  getCarouselHookFamily,
  isCarouselContentFormatId,
  isCarouselHookFamilyId,
  type CarouselContentFormatDefinition,
  type CarouselContentFormatId,
  type CarouselHookFamilyDefinition,
  type CarouselHookFamilyId,
} from "./carousel-content-grammar.js";
import { CAROUSEL_TEXT_MODEL } from "./carousel-text-model.js";

export const CAROUSEL_CONTENT_PLANNER_VERSION =
  "llm-carousel-planner-v35-plain-white-structure-parity";
export const CAROUSEL_V1_ASSIGNMENT_REQUIRED_ERROR =
  "Carousel V1 requires exactly five slides plus a backend-selected content format and compatible hook family.";

const MAX_BODY_LENGTH = 240;
const MAX_HEADLINE_LENGTH = 100;
const MAX_CTA_LENGTH = 68;
const MAX_IMAGE_DIRECTION_LENGTH = 180;
const MAX_LIST_ITEM_LENGTH = 88;
const TARGET_BODY_MIN_WORDS = 8;
const TARGET_BODY_MAX_WORDS = 40;
const MIN_REQUIRED_BODY_WORDS = 8;
const MAX_ALLOWED_BODY_WORDS = 40;
const MIN_HEADLINE_WORDS = 3;
const MAX_HEADLINE_WORDS = 16;
const VISUAL_SUBJECT_TERMS =
  "(?:human|humans|person|people|face|faces|hand|hands|body|bodies|silhouette|silhouettes|man|men|woman|women|child|children|team|customer|customers|worker|workers)";
const PROHIBITED_VISUAL_SUBJECT_PATTERN =
  /\b(human|humans|person|people|face|faces|hand|hands|body|bodies|silhouette|silhouettes|man|men|woman|women|child|children|team|customer|customers|worker|workers)\b/i;
const NEGATED_VISUAL_SUBJECT_PATTERN = new RegExp(
  `\\b(?:no|without|excluding|free of)\\s+(?:visible\\s+)?${VISUAL_SUBJECT_TERMS}(?:\\s*(?:,|and|or)\\s*(?:visible\\s+)?${VISUAL_SUBJECT_TERMS})*(?:\\s+in\\s+the\\s+background)?`,
  "gi",
);

const SLIDE_TYPES = new Set<PlannedCarouselSlide["slideType"]>([
  "benefit",
  "cta",
  "differentiator",
  "hook",
  "problem",
  "solution",
]);
const TEXT_MODES = new Set<CarouselTextMode>([
  "body_only",
  "checklist",
  "cta_takeaway",
  "headline_body",
  "question_list",
  "single_statement",
]);
const MEANINGFUL_COMPACT_COPY_TOKENS = new Set([
  "3d",
  "ai",
  "ar",
  "hr",
  "pr",
  "ui",
  "ux",
  "vr",
]);

let openaiClient: OpenAI | null = null;

export type CarouselContentPlan = {
  broadSituations: string[];
  concept: string;
  contentStrategy: ResolvedCarouselContentStrategy | null;
  fallbackReason: string | null;
  model: string | null;
  normalizedPlan: {
    broadSituations: string[];
    concept: string;
    contentStrategy: ResolvedCarouselContentStrategy | null;
    slides: PlannedCarouselSlide[];
  };
  plannerVersion: string;
  rawLlmResponse: {
    initial: string | null;
    repair: string | null;
  };
  slides: PlannedCarouselSlide[];
  source: "llm";
  validationResult: CarouselPlanValidationResult;
};

export type CarouselPlanValidationIssue = {
  code:
    | "body_length"
    | "generic_copy"
    | "grammar"
    | "headline_body_repetition"
    | "headline_length"
    | "incomplete_ending"
    | "invalid_plan"
    | "multiple_ideas"
    | "recent_repetition"
    | "render_fit"
    | "repeated_punctuation"
    | "story_structure"
    | "story_repetition"
    | "unsupported_claim";
  message: string;
  slideNumber: number | null;
};

export type CarouselPlanValidationResult = {
  advisoryIssues: CarouselPlanValidationIssue[];
  fallbackUsed: boolean;
  finalIssues: CarouselPlanValidationIssue[];
  initialIssues: CarouselPlanValidationIssue[];
  ok: boolean;
  repairAttempted: boolean;
  repaired: boolean;
};

export type CarouselContentPlanInput = {
  analysis?: WebsiteBusinessAnalysis;
  businessDescription?: string;
  candidateIndex?: number;
  contentFormatId?: string | null;
  creativeSeed?: string;
  emotion?: string;
  goal?: string | null;
  hookFamilyId?: string | null;
  planningBrief?: CarouselPlanningBrief | null;
  recentHistory?: CarouselRecentAcceptedCopy[];
  selectedAngle?: string | null;
  slideCount: number;
};

export type CarouselBatchContentPlanInput = {
  analysis?: WebsiteBusinessAnalysis;
  businessDescription: string;
  items: Array<{
    candidateIndex: number;
    contentFormatId: string;
    creativeSeed: string;
    emotion: string;
    hookFamilyId: string;
    planningBrief: CarouselPlanningBrief | null;
    slotIndex: number;
  }>;
  recentHistory?: CarouselRecentAcceptedCopy[];
};

export type CarouselBatchContentPlanItem = {
  actualContentFormatId: CarouselContentFormatId;
  actualHookFamilyId: CarouselHookFamilyId;
  assignedContentFormatId: CarouselContentFormatId;
  plan: CarouselContentPlan;
  replacementForFormatId: CarouselContentFormatId | null;
  slotIndex: number;
};

export type ResolvedCarouselContentStrategy = {
  angle: string;
  audience: null;
  audienceId: null;
  contentFormatId: CarouselContentFormatId;
  customerGoal: null;
  customerGoalId: null;
  hookFamilyId: CarouselHookFamilyId;
  problem: null;
  problemId: null;
  topic: null;
  topicId: null;
};

type CarouselGrammarGenerationContext = {
  format: CarouselContentFormatDefinition;
  hookFamily: CarouselHookFamilyDefinition;
};

function getGrammarGenerationContext(
  input: CarouselContentPlanInput,
  slideCount: number,
): CarouselGrammarGenerationContext {
  if (
    slideCount !== 5 ||
    !isCarouselContentFormatId(input.contentFormatId) ||
    !isCarouselHookFamilyId(input.hookFamilyId)
  ) {
    throw new Error(CAROUSEL_V1_ASSIGNMENT_REQUIRED_ERROR);
  }

  const format = getCarouselContentFormat(input.contentFormatId);

  if (!format.compatibleHookFamilies.includes(input.hookFamilyId)) {
    throw new Error(
      `${input.hookFamilyId} is not compatible with ${input.contentFormatId}.`,
    );
  }

  return {
    format,
    hookFamily: getCarouselHookFamily(input.hookFamilyId),
  };
}

export async function buildCarouselContentPlan(
  input: CarouselContentPlanInput,
): Promise<CarouselContentPlan> {
  const grammarContext = getGrammarGenerationContext(input, input.slideCount);
  const slideCount = 5;
  const model = CAROUSEL_TEXT_MODEL;
  let initialRawResponse: string | null = null;
  let repairRawResponse: string | null = null;
  let initialIssues: CarouselPlanValidationIssue[] = [];
  let initialAdvisoryIssues: CarouselPlanValidationIssue[] = [];

  try {
    const completion = await getOpenAIClient().chat.completions.create({
      max_completion_tokens: 1_800,
      messages: buildPlannerMessages({ ...input, slideCount }, grammarContext),
      model,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "carousel_content_plan",
          schema: buildCarouselContentPlanSchema(slideCount, grammarContext),
          strict: true,
        },
      },
      temperature: 0.35,
    });
    initialRawResponse = completion.choices[0]?.message.content ?? null;

    if (!initialRawResponse) {
      throw new Error("OpenAI returned no carousel plan content.");
    }

    let normalizedPlan: ReturnType<typeof parseCarouselContentPlanShape> | null = null;

    try {
      normalizedPlan = parseCarouselContentPlanShape(
        JSON.parse(initialRawResponse),
        slideCount,
        grammarContext,
      );
      const validation = evaluateCarouselContentPlanForPublishing({
        analysis: input.analysis,
        plan: normalizedPlan,
        recentHistory: input.recentHistory,
      });
      initialIssues = validation.blockingIssues;
      initialAdvisoryIssues = validation.advisoryIssues;
    } catch (error) {
      initialIssues = [createInvalidPlanIssue(error)];
    }

    if (initialIssues.length === 0 && normalizedPlan) {
      return createContentPlan({
        ...normalizedPlan,
        fallbackReason: null,
        model,
        rawLlmResponse: { initial: initialRawResponse, repair: null },
        source: "llm",
        validationResult: {
          advisoryIssues: initialAdvisoryIssues,
          fallbackUsed: false,
          finalIssues: [],
          initialIssues: [],
          ok: true,
          repairAttempted: false,
          repaired: false,
        },
      });
    }

    const repairCompletion = await getOpenAIClient().chat.completions.create({
      max_completion_tokens: 1_200,
      messages: buildRepairMessages({
        analysis: input.analysis,
        businessDescription: input.businessDescription,
        creativeSeed: input.creativeSeed,
        emotion: input.emotion,
        grammarContext,
        issues: initialIssues,
        planningBrief: input.planningBrief,
        rawResponse: initialRawResponse,
        recentHistory: input.recentHistory,
        slideCount,
      }),
      model,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "repaired_carousel_content_plan",
          schema: buildCarouselContentPlanSchema(slideCount, grammarContext),
          strict: true,
        },
      },
      temperature: 0.15,
    });
    repairRawResponse = repairCompletion.choices[0]?.message.content ?? null;

    if (!repairRawResponse) {
      throw new Error("OpenAI returned no repaired carousel plan content.");
    }

    const repairedPlan = parseCarouselContentPlanShape(
      JSON.parse(repairRawResponse),
      slideCount,
      grammarContext,
    );
    const repairedValidation = evaluateCarouselContentPlanForPublishing({
      analysis: input.analysis,
      plan: repairedPlan,
      recentHistory: input.recentHistory,
    });
    const finalIssues = repairedValidation.blockingIssues;

    if (finalIssues.length > 0) {
      initialIssues = dedupeValidationIssues([...initialIssues, ...finalIssues]);
      throw new Error(formatValidationIssues(finalIssues));
    }

    return createContentPlan({
      ...repairedPlan,
      fallbackReason: null,
      model,
      rawLlmResponse: {
        initial: initialRawResponse,
        repair: repairRawResponse,
      },
      source: "llm",
      validationResult: {
        advisoryIssues: repairedValidation.advisoryIssues,
        fallbackUsed: false,
        finalIssues: [],
        initialIssues,
        ok: true,
        repairAttempted: true,
        repaired: true,
      },
    });
  } catch (error) {
    throw new Error(
      `Carousel Structure 1 planning failed after validation repair: ${getErrorMessage(error)}`,
      { cause: error },
    );
  }
}

export async function buildCarouselContentPlanBatch(
  input: CarouselBatchContentPlanInput,
): Promise<CarouselBatchContentPlanItem[]> {
  if (
    input.items.length !== 5 ||
    new Set(input.items.map((item) => item.slotIndex)).size !== 5 ||
    input.items.some((item) => item.slotIndex < 0 || item.slotIndex > 4)
  ) {
    throw new Error("A Carousel content batch must contain slots 0 through 4 exactly once.");
  }

  const requested = [...input.items]
    .sort((left, right) => left.slotIndex - right.slotIndex)
    .map((item) => {
      const planInput = {
        analysis: input.analysis,
        businessDescription: input.businessDescription,
        candidateIndex: item.candidateIndex,
        contentFormatId: item.contentFormatId,
        creativeSeed: item.creativeSeed,
        emotion: item.emotion,
        hookFamilyId: item.hookFamilyId,
        planningBrief: item.planningBrief,
        recentHistory: input.recentHistory,
        slideCount: 5,
      } satisfies CarouselContentPlanInput;

      return {
        context: getGrammarGenerationContext(planInput, 5),
        item,
        planInput,
      };
    });

  const model = CAROUSEL_TEXT_MODEL;
  let batchRawResponse: string | null = null;

  try {
    const completion = await getOpenAIClient().chat.completions.create({
      max_completion_tokens: 8_500,
      messages: buildBatchPlannerMessages(input, requested),
      model,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "carousel_content_batch",
          schema: buildCarouselContentBatchSchema(requested),
          strict: true,
        },
      },
      temperature: 0.3,
    });
    batchRawResponse = completion.choices[0]?.message.content ?? null;

    if (!batchRawResponse) {
      throw new Error("OpenAI returned no Carousel batch content.");
    }

    const batchRecord = asRecord(JSON.parse(batchRawResponse), "carousel batch");
    if (!Array.isArray(batchRecord.items) || batchRecord.items.length !== 5) {
      throw new Error("Carousel batch response must contain exactly five items.");
    }

    const rawBySlot = new Map<number, Record<string, unknown>>();
    for (const value of batchRecord.items) {
      const record = asRecord(value, "carousel batch item");
      const slotIndex = getInteger(record.slotIndex, "batch slotIndex");
      if (slotIndex < 0 || slotIndex > 4 || rawBySlot.has(slotIndex)) {
        throw new Error("Carousel batch response contains an invalid or duplicate slotIndex.");
      }
      rawBySlot.set(slotIndex, record);
    }

    const completed: CarouselBatchContentPlanItem[] = [];
    const pendingRepairs: Array<{
      issues: CarouselPlanValidationIssue[];
      rawItem: Record<string, unknown>;
      requestedItem: (typeof requested)[number];
      status: "invalid" | "not_applicable";
    }> = [];
    let workingHistory: CarouselRecentAcceptedCopy[] =
      normalizeRecentHistory(input.recentHistory);

    for (const requestedItem of requested) {
      const rawItem = rawBySlot.get(requestedItem.item.slotIndex);
      if (!rawItem) throw new Error(`Carousel batch slot ${requestedItem.item.slotIndex} is missing.`);
      const status = rawItem.status;

      if (status === "not_applicable") {
        pendingRepairs.push({
          issues: [{
            code: "invalid_plan",
            message: getNullableBatchReason(rawItem.notApplicableReason),
            slideNumber: null,
          }],
          rawItem,
          requestedItem,
          status: "not_applicable",
        });
        continue;
      }

      if (status !== "ready") {
        pendingRepairs.push({
          issues: [createInvalidPlanIssue(new Error("Batch item status is invalid."))],
          rawItem,
          requestedItem,
          status: "invalid",
        });
        continue;
      }

      try {
        const parsed = parseCarouselContentPlanShape(rawItem.plan, 5, requestedItem.context);
        const validation = evaluateCarouselContentPlanForPublishing({
          analysis: input.analysis,
          plan: parsed,
          recentHistory: workingHistory,
        });
        if (validation.blockingIssues.length > 0) {
          pendingRepairs.push({
            issues: validation.blockingIssues,
            rawItem,
            requestedItem,
            status: "invalid",
          });
          continue;
        }

        const plan = createContentPlan({
          ...parsed,
          fallbackReason: null,
          model,
          rawLlmResponse: { initial: JSON.stringify(rawItem), repair: null },
          source: "llm",
          validationResult: {
            advisoryIssues: validation.advisoryIssues,
            fallbackUsed: false,
            finalIssues: [],
            initialIssues: [],
            ok: true,
            repairAttempted: false,
            repaired: false,
          },
        });
        completed.push({
          actualContentFormatId: requestedItem.context.format.id,
          actualHookFamilyId: requestedItem.context.hookFamily.id,
          assignedContentFormatId: requestedItem.context.format.id,
          plan,
          replacementForFormatId: null,
          slotIndex: requestedItem.item.slotIndex,
        });
        workingHistory = mergeCarouselRecentContentHistory(
          [summarizeContentPlan(plan)],
          workingHistory,
        );
      } catch (error) {
        pendingRepairs.push({
          issues: [createInvalidPlanIssue(error)],
          rawItem,
          requestedItem,
          status: "invalid",
        });
      }
    }

    for (const pending of pendingRepairs) {
      const replacement =
        pending.status === "not_applicable"
          ? selectCarouselBatchReplacement(
              completed,
              pending.requestedItem.item.slotIndex,
            )
          : null;
      const actualFormatId =
        replacement?.actualContentFormatId ?? pending.requestedItem.context.format.id;
      const actualHookFamilyId =
        replacement?.actualHookFamilyId ?? pending.requestedItem.context.hookFamily.id;
      const repairInput = {
        ...pending.requestedItem.planInput,
        contentFormatId: actualFormatId,
        hookFamilyId: actualHookFamilyId,
        recentHistory: workingHistory,
      } satisfies CarouselContentPlanInput;
      const repairContext = getGrammarGenerationContext(repairInput, 5);
      const repairedPlan = await buildSingleBatchItemRepair({
        context: repairContext,
        input: repairInput,
        issues: pending.issues,
        model,
        rawItem: pending.rawItem,
        replacement: Boolean(replacement),
      });

      completed.push({
        actualContentFormatId: repairContext.format.id,
        actualHookFamilyId: repairContext.hookFamily.id,
        assignedContentFormatId: pending.requestedItem.context.format.id,
        plan: repairedPlan,
        replacementForFormatId: replacement
          ? pending.requestedItem.context.format.id
          : null,
        slotIndex: pending.requestedItem.item.slotIndex,
      });
      workingHistory = mergeCarouselRecentContentHistory(
        [summarizeContentPlan(repairedPlan)],
        workingHistory,
      );
    }

    return completed.sort((left, right) => left.slotIndex - right.slotIndex);
  } catch (error) {
    throw new Error(
      `Carousel Structure 1 batch planning failed after validation repair: ${getErrorMessage(error)}`,
      { cause: error },
    );
  }
}

export function parseCarouselContentPlan(
  value: unknown,
  requestedSlideCount: number,
) {
  const plan = parseCarouselContentPlanShape(value, requestedSlideCount);
  const issues = partitionCarouselContentPlanValidationIssues(
    validateCarouselContentPlan(plan),
  ).blockingIssues;

  if (issues.length > 0) {
    throw new Error(formatValidationIssues(issues));
  }

  return plan;
}

export function parseCarouselContentPlanForAssignment(
  value: unknown,
  input: CarouselContentPlanInput,
) {
  const grammarContext = getGrammarGenerationContext(input, input.slideCount);
  const plan = parseCarouselContentPlanShape(value, 5, grammarContext);
  const validation = evaluateCarouselContentPlanForPublishing({
    analysis: input.analysis,
    plan,
    recentHistory: input.recentHistory,
  });

  if (validation.blockingIssues.length > 0) {
    throw new Error(formatValidationIssues(validation.blockingIssues));
  }

  return { ...validation, plan };
}

function parseCarouselContentPlanShape(
  value: unknown,
  requestedSlideCount: number,
  grammarContext: CarouselGrammarGenerationContext | null = null,
) {
  const slideCount = clampSlideCount(requestedSlideCount);
  const record = asRecord(value, "carousel plan");
  const concept = getRequiredString(record.concept, 120, "concept");
  const broadSituations = getStringList(
    record.broadSituations,
    3,
    8,
    120,
    "broadSituations",
  );
  const contentStrategy = grammarContext
    ? parseContentStrategy(record.contentStrategy, grammarContext)
    : null;

  if (!Array.isArray(record.slides) || record.slides.length !== slideCount) {
    throw new Error(`Carousel plan must contain exactly ${slideCount} slides.`);
  }

  const seenHeadlines = new Set<string>();
  const slides = record.slides.map((slideValue, index) => {
    const slide = asRecord(slideValue, `slide ${index + 1}`);
    const slideNumber = getInteger(slide.slideNumber, `slide ${index + 1} number`);
    const slideType = getSlideType(slide.slideType, `slide ${index + 1} type`);
    const expectedFormatSlide = grammarContext?.format.slides[index] ?? null;
    const formatRole = getOptionalNullableString(
      slide.formatRole,
      80,
      `slide ${index + 1} format role`,
    );
    const requestedTextMode = getTextMode(
      slide.textMode,
      slideType,
      `slide ${index + 1} text mode`,
    );
    const parsedHeadline = getOptionalNullableString(
      slide.headline,
      MAX_HEADLINE_LENGTH,
      `slide ${index + 1} headline`,
    );
    const parsedBody = getOptionalNullableString(
      slide.body ?? slide.subtext,
      MAX_BODY_LENGTH,
      `slide ${index + 1} body`,
    );
    const listItems = getOptionalStringList(
      slide.listItems,
      4,
      MAX_LIST_ITEM_LENGTH,
      `slide ${index + 1} list items`,
    );
    const ctaText = getNullableString(
      slide.ctaText,
      MAX_CTA_LENGTH,
      `slide ${index + 1} CTA`,
    );
    const imageDirection = getRequiredString(
      slide.imageDirection,
      MAX_IMAGE_DIRECTION_LENGTH,
      `slide ${index + 1} image direction`,
    );

    if (slideNumber !== index + 1) {
      throw new Error(`Slide ${index + 1} has an invalid slide number.`);
    }

    if (index === 0 && slideType !== "hook") {
      throw new Error("The first carousel slide must be a hook.");
    }

    if (expectedFormatSlide && formatRole !== expectedFormatSlide.role) {
      throw new Error(
        `Slide ${index + 1} must use format role ${expectedFormatSlide.role}.`,
      );
    }

    if (expectedFormatSlide && slideType !== expectedFormatSlide.slideType) {
      throw new Error(
        `Slide ${index + 1} must use slide type ${expectedFormatSlide.slideType}.`,
      );
    }

    if (
      expectedFormatSlide &&
      !expectedFormatSlide.preferredTextModes.includes(requestedTextMode)
    ) {
      throw new Error(
        `Slide ${index + 1} must use one of the text modes allowed by ${expectedFormatSlide.role}.`,
      );
    }

    if (
      expectedFormatSlide?.listItemCount !== undefined &&
      listItems.length !== expectedFormatSlide.listItemCount
    ) {
      throw new Error(
        `Slide ${index + 1} must contain exactly ${expectedFormatSlide.listItemCount} list items.`,
      );
    }

    if (
      expectedFormatSlide &&
      expectedFormatSlide.listItemCount === undefined &&
      listItems.length > 0
    ) {
      throw new Error(
        `Slide ${index + 1} must keep listItems empty for format role ${expectedFormatSlide.role}.`,
      );
    }

    if (index === slideCount - 1 && slideType !== "cta") {
      throw new Error("The final carousel slide must be a CTA.");
    }

    if (index < slideCount - 1 && ctaText !== null) {
      throw new Error("Only the final carousel slide may include CTA text.");
    }

    if (hasProhibitedVisualSubject(imageDirection)) {
      throw new Error(
        `Slide ${index + 1} image direction includes a prohibited human subject.`,
      );
    }

    const preliminaryTextMode = normalizeTextMode({
      body: parsedBody,
      headline: parsedHeadline,
      listItems,
      slideType,
      textMode: requestedTextMode,
    });
    const headline = parsedHeadline;
    const textMode = normalizeTextMode({
      body: parsedBody,
      headline,
      listItems,
      slideType,
      textMode: preliminaryTextMode,
    });

    if (
      expectedFormatSlide &&
      !expectedFormatSlide.preferredTextModes.includes(textMode)
    ) {
      throw new Error(
        `Slide ${index + 1} normalized to a text mode that is not allowed by ${expectedFormatSlide.role}.`,
      );
    }

    const body = normalizeBodyForTextMode({
      body: parsedBody,
      ctaText,
      headline,
      listItems,
      textMode,
    });

    validateTextContent({
      body,
      headline,
      listItems,
      slideNumber,
      textMode,
    });

    const normalizedHeadline = headline?.toLowerCase();

    if (normalizedHeadline && seenHeadlines.has(normalizedHeadline)) {
      throw new Error("Carousel plan contains duplicate headlines.");
    }

    if (normalizedHeadline) {
      seenHeadlines.add(normalizedHeadline);
    }

    return {
      ...getLayoutPreset(slideType, textMode),
      body,
      ctaText,
      formatRole,
      headline,
      imageDirection,
      listItems,
      slideNumber,
      slideType,
      subtext: body,
      textMode,
    } satisfies PlannedCarouselSlide;
  });

  return { broadSituations, concept, contentStrategy, slides };
}

function parseContentStrategy(
  value: unknown,
  grammarContext: CarouselGrammarGenerationContext,
): ResolvedCarouselContentStrategy {
  const record = asRecord(value, "contentStrategy");
  const contentFormatId = getRequiredString(
    record.contentFormatId,
    80,
    "contentFormatId",
  );
  const hookFamilyId = getRequiredString(
    record.hookFamilyId,
    80,
    "hookFamilyId",
  );
  const angle = getRequiredString(record.angle, 160, "angle");

  if (contentFormatId !== grammarContext.format.id) {
    throw new Error("The AI changed the backend-selected content format.");
  }

  if (hookFamilyId !== grammarContext.hookFamily.id) {
    throw new Error("The AI changed the backend-selected hook family.");
  }

  return {
    angle,
    audience: null,
    audienceId: null,
    contentFormatId: grammarContext.format.id,
    customerGoal: null,
    customerGoalId: null,
    hookFamilyId: grammarContext.hookFamily.id,
    problem: null,
    problemId: null,
    topic: null,
    topicId: null,
  };
}

function hasProhibitedVisualSubject(value: string) {
  const validationText = value
    .replace(/\b(?:clock|watch)(?:\s+with)?\s+hands?\b/gi, "")
    .replace(NEGATED_VISUAL_SUBJECT_PATTERN, "")
    .replace(/\b(?:object-only|people-free|person-free|face-free|human-free)\b/gi, "");

  return PROHIBITED_VISUAL_SUBJECT_PATTERN.test(validationText);
}

function getNormalizedTokens(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(
      (token) => token.length > 2 || MEANINGFUL_COMPACT_COPY_TOKENS.has(token),
    );
}

function normalizeTextMode(params: {
  body: string | null;
  headline: string | null;
  listItems: string[];
  slideType: PlannedCarouselSlide["slideType"];
  textMode: CarouselTextMode;
}) {
  if (params.slideType === "cta") {
    return "cta_takeaway";
  }

  if (
    (params.textMode === "question_list" || params.textMode === "checklist") &&
    params.listItems.length >= 2
  ) {
    return params.textMode;
  }

  if (params.textMode === "single_statement") {
    return "single_statement";
  }

  if (!params.headline && params.body) {
    return "body_only";
  }

  return params.textMode === "body_only" ? "body_only" : "headline_body";
}

function normalizeBodyForTextMode(params: {
  body: string | null;
  ctaText: string | null;
  headline: string | null;
  listItems: string[];
  textMode: CarouselTextMode;
}) {
  if (params.textMode === "cta_takeaway") {
    return params.body ?? params.ctaText;
  }

  if (params.textMode === "single_statement") {
    return params.body ?? params.headline;
  }

  if (params.textMode === "question_list" || params.textMode === "checklist") {
    return params.body;
  }

  return params.body;
}

function validateTextContent(params: {
  body: string | null;
  headline: string | null;
  listItems: string[];
  slideNumber: number;
  textMode: CarouselTextMode;
}) {
  if (params.textMode === "headline_body" && (!params.headline || !params.body)) {
    throw new Error(`Slide ${params.slideNumber} headline_body needs headline and body.`);
  }

  if (
    (params.textMode === "body_only" || params.textMode === "single_statement") &&
    !params.body
  ) {
    throw new Error(`Slide ${params.slideNumber} ${params.textMode} needs body.`);
  }

  if (
    (params.textMode === "question_list" || params.textMode === "checklist") &&
    params.listItems.length < 2
  ) {
    throw new Error(`Slide ${params.slideNumber} ${params.textMode} needs list items.`);
  }

  if (params.textMode === "cta_takeaway" && !params.headline && !params.body) {
    throw new Error(`Slide ${params.slideNumber} cta_takeaway needs headline or body.`);
  }
}

function countWords(value: string) {
  return value.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)?/g)?.length ?? 0;
}

function hasNearbyRepeatedCopy(value: string) {
  const tokens = normalizeValidationText(value).split(/\s+/).filter(Boolean);
  const repeatedConnectors = new Set(["by", "for", "from", "to", "with"]);
  const ignoredContentWords = new Set([
    "and",
    "are",
    "but",
    "can",
    "each",
    "into",
    "that",
    "the",
    "this",
    "your",
  ]);

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    for (
      let nextIndex = index + 1;
      nextIndex < Math.min(tokens.length, index + 11);
      nextIndex += 1
    ) {
      const nextToken = tokens[nextIndex];

      const betweenTokens = tokens.slice(index + 1, nextIndex);

      if (
        token === nextToken &&
        repeatedConnectors.has(token) &&
        !betweenTokens.some((between) =>
          ["and", "but", "or", "while"].includes(between),
        )
      ) {
        return true;
      }

      if (
        token.length >= 4 &&
        nextToken.length >= 4 &&
        !ignoredContentWords.has(token) &&
        getCopyWordRoot(token) === getCopyWordRoot(nextToken)
      ) {
        return true;
      }
    }
  }

  return false;
}

function getCopyWordRoot(value: string) {
  if (value.length >= 5 && value.endsWith("s") && !value.endsWith("ss")) {
    return value.slice(0, -1);
  }

  return value;
}

function isProblemFramedCopy(value: string | null) {
  if (!value) {
    return false;
  }

  const normalized = normalizeValidationText(value);
  const hasProblemSignal =
    /\b(chaos|confusion|delays?|errors?|friction|harder|late night|missed|missing|overwhelmed|scattered|slows?|wastes?)\b/.test(
      normalized,
    );
  const hasSolutionAction =
    /\b(avoid|automate|bring|connect|consolidate|keep|keeps|prevent|reduce|remove|replace|route|stop|use)\b/.test(
      normalized,
    );

  return hasProblemSignal && !hasSolutionAction;
}

function validateStructure1FixedTextFit(
  slide: PlannedCarouselSlide,
): CarouselPlanValidationIssue[] {
  const issues: CarouselPlanValidationIssue[] = [];
  const isBodyOnly =
    slide.textMode === "body_only" || slide.textMode === "single_statement";
  const headline = isBodyOnly ? "" : slide.headline?.trim() ?? "";
  const isList =
    slide.textMode === "question_list" || slide.textMode === "checklist";
  const listLines = isList
    ? [
        slide.body?.trim() ?? "",
        ...(slide.listItems ?? []).map((item, index) =>
          slide.textMode === "checklist"
            ? `- ${item.trim()}`
            : `${index + 1}. ${item.trim()}`,
        ),
      ].filter(Boolean)
    : [];
  const body = isList
    ? ""
    : slide.body?.trim() ||
      slide.subtext?.trim() ||
      slide.ctaText?.trim() ||
      (!headline ? slide.headline?.trim() ?? "" : "");

  const groups: Array<{
    label: string;
    maximumLines: number;
    value: string;
  }> = [
    {
      label: "Headline",
      maximumLines: CAROUSEL_STRUCTURE_1_HEADLINE_MAX_LINES,
      value: headline,
    },
    {
      label: "Body",
      maximumLines: CAROUSEL_STRUCTURE_1_BODY_MAX_LINES,
      value: body,
    },
    ...listLines.map((value, index) => ({
      label: `List line ${index + 1}`,
      maximumLines: CAROUSEL_STRUCTURE_1_LIST_ITEM_MAX_LINES,
      value,
    })),
  ];

  for (const group of groups) {
    const fit = inspectCarouselFixedTextFit({
      maximumLines: group.maximumLines,
      maximumWidth: CAROUSEL_STRUCTURE_1_FIXED_TEXT_WIDTH,
      value: group.value,
    });

    if (!fit.fits) {
      issues.push({
        code: "render_fit",
        message: `${group.label} must fit within ${group.maximumLines} line${group.maximumLines === 1 ? "" : "s"} at the fixed ${CAROUSEL_FIXED_FONT_SIZE}px font size. ${fit.reason ?? ""}`.trim(),
        slideNumber: slide.slideNumber,
      });
    }
  }

  const listLineCount = listLines.reduce(
    (total, value) =>
      total +
      inspectCarouselFixedTextFit({
        maximumLines: CAROUSEL_STRUCTURE_1_LIST_ITEM_MAX_LINES,
        maximumWidth: CAROUSEL_STRUCTURE_1_FIXED_TEXT_WIDTH,
        value,
      }).lines.length,
    0,
  );

  if (listLineCount > CAROUSEL_STRUCTURE_1_LIST_TOTAL_MAX_LINES) {
    issues.push({
      code: "render_fit",
      message: `List copy needs ${listLineCount} lines but the fixed layout allows ${CAROUSEL_STRUCTURE_1_LIST_TOTAL_MAX_LINES}.`,
      slideNumber: slide.slideNumber,
    });
  }

  return issues;
}

export function validateCarouselContentPlan(
  plan: Pick<CarouselContentPlan, "broadSituations" | "concept" | "slides"> &
    Partial<Pick<CarouselContentPlan, "contentStrategy">>,
  analysis?: WebsiteBusinessAnalysis,
) {
  const issues: CarouselPlanValidationIssue[] = [];
  const priorSlideCopy: Array<{ slideNumber: number; text: string }> = [];
  const claimsToAvoid = (analysis?.claimsToAvoid ?? [])
    .map(normalizeValidationText)
    .filter(Boolean);
  const evidenceText = normalizeValidationText(JSON.stringify(analysis ?? {}));
  const compactEvidenceText = evidenceText.replace(/\s+/g, "");
  const compactBusinessName = normalizeValidationText(
    analysis?.businessName ?? "",
  ).replace(/\s+/g, "");
  const planLevelCopy = [
    plan.concept,
    plan.contentStrategy?.angle,
    ...plan.broadSituations,
  ].filter((value): value is string => Boolean(value));

  if (planLevelCopy.some(hasGenericCopy)) {
    issues.push({
      code: "generic_copy",
      message: "The concept or angle is generic instead of specific to saved evidence.",
      slideNumber: null,
    });
  }

  for (const slide of plan.slides) {
    const texts = [
      slide.headline,
      slide.body,
      slide.ctaText,
      ...(slide.listItems ?? []),
    ].filter((value): value is string => Boolean(value));
    const fixedLayoutIssues = validateStructure1FixedTextFit(slide);

    issues.push(...fixedLayoutIssues);

    if (slide.slideType === "solution" && isProblemFramedCopy(slide.body)) {
      issues.push({
        code: "story_structure",
        message: "A consequence or friction slide cannot be labeled as a solution.",
        slideNumber: slide.slideNumber,
      });
    }

    if (slide.headline) {
      const headlineWords = countWords(slide.headline);

      if (
        headlineWords < MIN_HEADLINE_WORDS ||
        headlineWords > MAX_HEADLINE_WORDS ||
        slide.headline.length > MAX_HEADLINE_LENGTH
      ) {
        issues.push({
          code: "headline_length",
          message: `Headline must be ${MIN_HEADLINE_WORDS}-${MAX_HEADLINE_WORDS} words and at most ${MAX_HEADLINE_LENGTH} characters.`,
          slideNumber: slide.slideNumber,
        });
      }
    }

    if (slide.body) {
      const bodyWords = countWords(slide.body);

      if (
        bodyWords < MIN_REQUIRED_BODY_WORDS ||
        bodyWords > MAX_ALLOWED_BODY_WORDS ||
        slide.body.length > MAX_BODY_LENGTH
      ) {
        issues.push({
          code: "body_length",
          message: `Body must be ${MIN_REQUIRED_BODY_WORDS}-${MAX_ALLOWED_BODY_WORDS} words and at most ${MAX_BODY_LENGTH} characters.`,
          slideNumber: slide.slideNumber,
        });
      }

      if (
        !/[.?!]$/.test(slide.body) ||
        /\b(and|or|but|with|for|to|of|the|a|an|in|on|at|by|from)$/i.test(
          slide.body,
        )
      ) {
        issues.push({
          code: "incomplete_ending",
          message: "Body copy must end as a complete sentence.",
          slideNumber: slide.slideNumber,
        });
      }

      const sentenceCount =
        slide.body.match(/[^.?!]+[.?!]+/g)?.filter((sentence) => sentence.trim())
          .length ?? 0;
      const conjunctionCount =
        slide.body.match(/\b(and|but|while|then|whereas|although)\b/gi)?.length ?? 0;

      if (sentenceCount > 1 || conjunctionCount > 2 || /[;:]/.test(slide.body)) {
        issues.push({
          code: "multiple_ideas",
          message: "Each slide body must express one clear idea.",
          slideNumber: slide.slideNumber,
        });
      }

      if (
        /^[a-z]/.test(slide.body) ||
        /\b([a-z][a-z'-]{2,})\s+\1\b/i.test(slide.body) ||
        /\bplanning and reporting\b(?:\s+[a-z'-]+){0,5}\s+creates\b/i.test(
          slide.body,
        ) ||
        hasNearbyRepeatedCopy(slide.body) ||
        /\s+[,.!?]/.test(slide.body)
      ) {
        issues.push({
          code: "grammar",
          message: "Body copy contains a grammar or spacing problem.",
          slideNumber: slide.slideNumber,
        });
      }
    }

    if (slide.ctaText && /[a-z][A-Z]$/.test(slide.ctaText)) {
      issues.push({
        code: "incomplete_ending",
        message: "CTA text appears to end with a cut-off word.",
        slideNumber: slide.slideNumber,
      });
    }

    if (
      (slide.textMode === "question_list" || slide.textMode === "checklist") &&
      (slide.listItems.length + (slide.body ? 1 : 0) > 4)
    ) {
      issues.push({
        code: "body_length",
        message: "List modes may use at most eight visual text lines.",
        slideNumber: slide.slideNumber,
      });
    }

    if (texts.some((text) => /([!?.,])\1+|\.\s*\./.test(text))) {
      issues.push({
        code: "repeated_punctuation",
        message: "Copy contains repeated punctuation.",
        slideNumber: slide.slideNumber,
      });
    }

    if (texts.some(hasGenericCopy)) {
      issues.push({
        code: "generic_copy",
        message: "Copy is generic instead of specific to the supplied evidence.",
        slideNumber: slide.slideNumber,
      });
    }

    if (
      texts.some((text) => {
        const normalizedText = normalizeValidationText(text);
        const quantifiedClaim = normalizedText.match(
          /\b(?:hundreds|thousands|millions|billions) of (?:businesses|creators|customers|people|teams|users)\b/,
        )?.[0];
        const unsupportedOutcome =
          analysis &&
          (normalizedText.match(/\b(?:conversions?|growth|money|profits?|revenue|sales)\b/g) ?? [])
            .some((term) => !new RegExp(`\\b${term}\\b`).test(evidenceText));
        const unsupportedPreciseNumber = hasUnsupportedPreciseNumber(
          text,
          evidenceText,
        );

        return (
          /\b(guarantee|guaranteed|number one|100 percent)\b/.test(
            normalizedText,
          ) ||
          Boolean(quantifiedClaim) ||
          unsupportedOutcome ||
          unsupportedPreciseNumber ||
          claimsToAvoid.some((claim) => claim && normalizedText.includes(claim))
        );
      })
    ) {
      issues.push({
        code: "unsupported_claim",
        message: "Copy contains an unsupported or prohibited claim.",
        slideNumber: slide.slideNumber,
      });
    }

    const ctaNamedProduct = slide.ctaText
      ?.match(
        /^(?:Get|Install|Open|Start|Try|Use)\s+([A-Z][A-Za-z0-9]+)\b/,
      )?.[1];
    const ctaBrandMismatch = Boolean(
      analysis &&
        ctaNamedProduct &&
        !compactBusinessName.includes(
          normalizeValidationText(ctaNamedProduct).replace(/\s+/g, ""),
        ),
    );
    const unrecognizedBrandName = ctaBrandMismatch
      ? ctaNamedProduct
      : analysis
        ? [...texts, slide.imageDirection]
          .flatMap((text) => text.match(/\b[A-Z][a-z]+[A-Z][A-Za-z]*\b/g) ?? [])
          .find(
            (name) =>
              !compactEvidenceText.includes(
                normalizeValidationText(name).replace(/\s+/g, ""),
              ),
            )
        : null;

    if (unrecognizedBrandName) {
      issues.push({
        code: "unsupported_claim",
        message: `Copy names an unsupported product or brand: ${unrecognizedBrandName}.`,
        slideNumber: slide.slideNumber,
      });
    }

    if (
      slide.headline &&
      slide.body &&
      getTokenOverlap(slide.headline, slide.body) >= 0.6
    ) {
      issues.push({
        code: "headline_body_repetition",
        message: "Headline and body repeat the same idea.",
        slideNumber: slide.slideNumber,
      });
    }

    const combinedCopy = texts.join(" ");

    for (const previous of priorSlideCopy) {
      if (getTokenOverlap(combinedCopy, previous.text) >= 0.82) {
        issues.push({
          code: "story_repetition",
          message: `Slide repeats the main copy from slide ${previous.slideNumber}.`,
          slideNumber: slide.slideNumber,
        });
        break;
      }
    }

    priorSlideCopy.push({ slideNumber: slide.slideNumber, text: combinedCopy });
  }

  return dedupeValidationIssues(issues);
}

export function validateCarouselRecentContentRepetition(
  plan: Pick<CarouselContentPlan, "contentStrategy" | "slides">,
  history: readonly CarouselRecentAcceptedCopy[] | undefined,
) {
  const normalizedHistory = normalizeRecentHistory(history);

  if (normalizedHistory.length === 0) {
    return [];
  }

  const hook = [
    plan.slides[0]?.headline,
    plan.slides[0]?.body,
    plan.slides[0]?.listItems?.join(" "),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");
  const fullCopy = plan.slides
    .flatMap((slide) => [
      slide.headline,
      slide.body,
      ...(slide.listItems ?? []),
      slide.ctaText,
    ])
    .filter((value): value is string => Boolean(value))
    .join(" ");
  const issues: CarouselPlanValidationIssue[] = [];

  for (const previous of normalizedHistory) {
    const previousHook = previous.slides[0]
      ? [
          previous.slides[0].headline,
          previous.slides[0].subtext,
          previous.slides[0].ctaText,
        ]
          .filter((value): value is string => Boolean(value))
          .join(" ")
      : "";

    if (hook && previousHook && getTokenOverlap(hook, previousHook) >= 0.75) {
      issues.push({
        code: "recent_repetition",
        message: "The hook is too similar to recent Carousel history.",
        slideNumber: 1,
      });
      break;
    }
  }

  for (const previous of normalizedHistory) {
    const previousFullCopy = previous.slides
      .flatMap((slide) => [slide.headline, slide.subtext, slide.ctaText])
      .filter((value): value is string => Boolean(value))
      .join(" ");

    if (
      fullCopy &&
      previousFullCopy &&
      getTokenOverlap(fullCopy, previousFullCopy) >= 0.72
    ) {
      issues.push({
        code: "recent_repetition",
        message: "The visible copy is too similar to a recent Carousel.",
        slideNumber: null,
      });
      break;
    }
  }

  return issues;
}

export function partitionCarouselContentPlanValidationIssues(
  issues: readonly CarouselPlanValidationIssue[],
) {
  const blockingIssues: CarouselPlanValidationIssue[] = [];
  const advisoryIssues: CarouselPlanValidationIssue[] = [];

  for (const issue of dedupeValidationIssues([...issues])) {
    if (issue.code === "invalid_plan" || issue.code === "render_fit") {
      blockingIssues.push(issue);
    } else {
      advisoryIssues.push(issue);
    }
  }

  return { advisoryIssues, blockingIssues };
}

function evaluateCarouselContentPlanForPublishing(params: {
  analysis?: WebsiteBusinessAnalysis;
  plan: Pick<
    CarouselContentPlan,
    "broadSituations" | "concept" | "contentStrategy" | "slides"
  >;
  recentHistory: readonly CarouselRecentAcceptedCopy[] | undefined;
}) {
  return partitionCarouselContentPlanValidationIssues([
    ...validateCarouselContentPlan(params.plan, params.analysis),
    ...validateCarouselRecentContentRepetition(
      params.plan,
      params.recentHistory,
    ),
  ]);
}

function hasUnsupportedPreciseNumber(value: string, evidenceText: string) {
  const preciseClaims = value.match(
    /\b\d+(?:[.,]\d+)?\s*(?:%|percent|kcal|calories?|grams?|g\b|kilograms?|kg\b|minutes?|hours?|days?|users?|customers?|dollars?|usd\b|inr\b)/gi,
  );

  if (!preciseClaims) {
    return false;
  }

  return preciseClaims.some((claim) => {
    const normalizedClaim = normalizeValidationText(claim);
    return normalizedClaim && !evidenceText.includes(normalizedClaim);
  });
}

function normalizeValidationText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function getTokenOverlap(left: string, right: string) {
  const leftTokens = new Set(getNormalizedTokens(left));
  const rightTokens = new Set(getNormalizedTokens(right));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let overlap = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.min(leftTokens.size, rightTokens.size);
}

function hasGenericCopy(value: string) {
  return /\b((?:achieve|enjoy|experience|gain) (?:better|greater|improved|more)|better (?:efficiency|management|organization|outcomes?|results?)|boost your productivity|effectively|efficiently|effortlessly|enhance your marketing efforts|game changer|improved (?:clarity|organization|outcomes?|results?)|make every day count|next level|one workspace for everything|save time(?: faster)?|seamless(?:ly)?|single platform|stay on top|streamline your workflow|transform your (?:campaign management|workflow)|unified platform|unify your (?:planning and reporting|workflow)|unlock efficiency|with ease|work smarter)\b/i.test(
    value,
  );
}

function dedupeValidationIssues(issues: CarouselPlanValidationIssue[]) {
  const seen = new Set<string>();

  return issues.filter((issue) => {
    const key = `${issue.slideNumber ?? "plan"}:${issue.code}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function formatValidationIssues(issues: CarouselPlanValidationIssue[]) {
  return issues
    .map((issue) =>
      issue.slideNumber
        ? `Slide ${issue.slideNumber}: ${issue.message}`
        : issue.message,
    )
    .join(" ");
}

function createInvalidPlanIssue(error: unknown): CarouselPlanValidationIssue {
  return {
    code: "invalid_plan",
    message: getErrorMessage(error).slice(0, 500),
    slideNumber: null,
  };
}

function buildPlannerMessages(
  input: CarouselContentPlanInput & { slideCount: number },
  grammarContext: CarouselGrammarGenerationContext,
) {
  return buildGrammarPlannerMessages(input, grammarContext);
}

function buildGrammarPlannerMessages(
  input: CarouselContentPlanInput & { slideCount: number },
  grammarContext: CarouselGrammarGenerationContext,
) {
  const candidateNumber = Math.max(0, input.candidateIndex ?? 0) + 1;
  const recentHistory = normalizeRecentHistory(input.recentHistory);
  const formatForPrompt = {
    compatibleHookFamilies: grammarContext.format.compatibleHookFamilies,
    generationRules: grammarContext.format.generationRules,
    id: grammarContext.format.id,
    name: grammarContext.format.name,
    purpose: grammarContext.format.purpose,
    slides: grammarContext.format.slides,
  };
  const hookFamilyForPrompt = {
    avoid: grammarContext.hookFamily.avoid,
    id: grammarContext.hookFamily.id,
    name: grammarContext.hookFamily.name,
    purpose: grammarContext.hookFamily.purpose,
    rules: grammarContext.hookFamily.rules,
    useWhen: grammarContext.hookFamily.useWhen,
  };

  return [
    {
      role: "system" as const,
      content:
        "You are a senior Instagram carousel strategist. Use the broad creative seed, emotion, and optional private creative brief to invent a fresh, coherent angle. The private brief is context only: do not mention its labels or force every part into visible copy. The selected Structure 1 format and hook family are renderer contracts, so keep their IDs and required slide fields. Return only the requested JSON. Do not invent precise claims, metrics, proof, or guarantees. Visual directions must describe only objects, surfaces, rooms, food, devices, documents, or still-life details and must never contain human-related words, even as exclusions.",
    },
    {
      role: "user" as const,
      content: [
        `Create Carousel candidate ${candidateNumber} with exactly five slides.`,
        `Backend-selected contentFormatId: ${grammarContext.format.id}.`,
        `Backend-selected hookFamilyId: ${grammarContext.hookFamily.id}.`,
        `Creative seed: ${input.creativeSeed}.`,
        `Required emotion: ${input.emotion}.`,
        "Private creative brief (context only, never visible labels):",
        JSON.stringify(input.planningBrief),
        "",
        "Selection rules:",
        "- contentFormatId and hookFamilyId must exactly match the backend-selected values.",
        "- Treat creativeSeed as an open starting point, not finished copy or a compulsory plot.",
        "- Let the required emotion shape the voice without naming it mechanically on every slide.",
        "- Use the private creative brief as human specificity and factual direction, not as a fixed storyline or a replacement for the selected format.",
        "- Avoid wording and close paraphrases from recentAcceptedCopy.",
        "- Follow every supplied slide role, slideType, allowed text mode, item count, and instruction exactly.",
        "- Slide 5 must be a useful takeaway. ctaText is optional and, when present, must be soft and concrete.",
        "",
        "Writing rules:",
        "- Use simple, natural language and one main idea per slide.",
        "- Prioritize useful content over promotion. Do not turn the carousel into an advertisement.",
        "- Hook wording must be completely fresh and must follow the selected hook family without copying examples or history.",
        `- Headlines are optional. When present, use ${MIN_HEADLINE_WORDS}-${MAX_HEADLINE_WORDS} words, at most ${MAX_HEADLINE_LENGTH} characters, and no more than four visual lines.`,
        `- Body copy must be one complete sentence of ${TARGET_BODY_MIN_WORDS}-${TARGET_BODY_MAX_WORDS} words, at most ${MAX_BODY_LENGTH} characters, and normally no more than six visual lines.`,
        `- Every visible text group uses fixed ${CAROUSEL_FIXED_FONT_SIZE}px white type directly on the image, with no white text background. Headlines must fit within four lines; body copy within eight; each list item within two; list groups within eight total. The renderer will not shrink or truncate copy.`,
        "- A headline must not repeat its body. If the body works alone, use body_only and set headline to null.",
        "- List slides must use the exact configured number of short listItems and normally set body to null.",
        "- Every slide without a configured listItemCount must return listItems as an empty array.",
        "- Do not repeat the same information across slides.",
        "- Do not use generic phrases such as boost productivity, streamline your workflow, unlock efficiency, save time, work smarter, or next level.",
        "- Do not invent exact calories, protein, grams, percentages, prices, time savings, user counts, or performance figures.",
        "- Never invent brands, customers, testimonials, rankings, or quantified social proof.",
        "- imageDirection must name one concrete object-only scene and useful text-safe space.",
        "- Do not write humans, people, faces, hands, bodies, silhouettes, teams, customers, or workers in imageDirection, even as exclusions.",
        "- formatRole must exactly match the configured role for its slide number.",
        "- ctaText must be null on slides 1-4.",
        "",
        "Minimal business context:",
        JSON.stringify({ businessDescription: input.businessDescription }),
        "",
        "Selected format definition:",
        JSON.stringify(formatForPrompt),
        "",
        "Selected hook-family definition:",
        JSON.stringify(hookFamilyForPrompt),
        "",
        "Last accepted Carousel copies (exact visible text):",
        JSON.stringify(recentHistory),
      ].join("\n"),
    },
  ];
}

function buildBatchPlannerMessages(
  input: CarouselBatchContentPlanInput,
  requested: Array<{
    context: CarouselGrammarGenerationContext;
    item: CarouselBatchContentPlanInput["items"][number];
    planInput: CarouselContentPlanInput;
  }>,
) {
  const assignments = requested.map(({ context, item }) => ({
    creativeSeed: item.creativeSeed,
    emotion: item.emotion,
    privateCreativeBrief: item.planningBrief,
    format: {
      generationRules: context.format.generationRules,
      id: context.format.id,
      name: context.format.name,
      purpose: context.format.purpose,
      slides: context.format.slides,
      version: context.format.version,
    },
    hookFamily: {
      avoid: context.hookFamily.avoid,
      id: context.hookFamily.id,
      name: context.hookFamily.name,
      purpose: context.hookFamily.purpose,
      rules: context.hookFamily.rules,
      useWhen: context.hookFamily.useWhen,
    },
    slotIndex: item.slotIndex,
  }));

  return [
    {
      role: "system" as const,
      content:
        "You are a senior Instagram carousel strategist. Produce one controlled batch of exactly five independent Carousels. Each slot has a broad creative seed, a required emotion, an optional private creative brief, and a selected Structure 1 renderer format and hook family. Private briefs add human specificity but are not visible labels or compulsory scripts. Keep the required IDs and fields, but freely develop the idea and wording. Avoid repetition against exact accepted copy and within this batch. Return only the requested JSON.",
    },
    {
      role: "user" as const,
      content: [
        "Generate all five assigned Carousels as one high-quality batch.",
        "For each slot, return status ready with a complete plan, or status not_applicable with plan null and a specific reason.",
        "Do not mark a format not_applicable merely because another format is easier.",
        "Every ready item must use the exact format and hook-family IDs assigned to that slot.",
        "Develop each creativeSeed differently and let its emotion guide the tone without forcing a fixed story arc.",
        "Use each privateCreativeBrief as flexible background context; the backend-selected format and hook family remain authoritative.",
        "Write fresh hooks and slide copy that do not copy recentAcceptedCopy or another item in this response.",
        "Use simple, specific, natural copy. Prioritize useful information over promotion.",
        `Optional headlines must use ${MIN_HEADLINE_WORDS}-${MAX_HEADLINE_WORDS} words and at most ${MAX_HEADLINE_LENGTH} characters.`,
        `Body copy must be one complete sentence of ${TARGET_BODY_MIN_WORDS}-${TARGET_BODY_MAX_WORDS} words and at most ${MAX_BODY_LENGTH} characters.`,
        "Never invent numbers, product capabilities, proof, customers, brands, health claims, financial claims, or guaranteed outcomes.",
        "Avoid generic copy such as boost productivity, streamline your workflow, save time, work smarter, unlock efficiency, or next level.",
        "Follow every format role, slide type, allowed text mode, and list-item count exactly.",
        "Return listItems as an empty array whenever that slide role has no configured listItemCount.",
        "Slide 1 is the assigned hook. Slide 5 is a useful takeaway/CTA. ctaText must be null on slides 1-4.",
        "imageDirection must describe only concrete object-only scenes and text-safe space. Never mention humans, people, faces, hands, bodies, silhouettes, teams, customers, or workers, even as exclusions.",
        "Minimal business context:",
        JSON.stringify({ businessDescription: input.businessDescription }),
        "Controlled slot assignments:",
        JSON.stringify(assignments),
        "Last accepted Carousel copies (exact visible text):",
        JSON.stringify(normalizeRecentHistory(input.recentHistory)),
      ].join("\n"),
    },
  ];
}

function buildCarouselContentBatchSchema(
  requested: Array<{
    context: CarouselGrammarGenerationContext;
    item: CarouselBatchContentPlanInput["items"][number];
  }>,
) {
  return {
    additionalProperties: false,
    properties: {
      items: {
        items: {
          anyOf: requested.map(({ context, item }) => ({
            additionalProperties: false,
            properties: {
              notApplicableReason: {
                anyOf: [
                  { maxLength: 300, minLength: 1, type: "string" },
                  { type: "null" },
                ],
              },
              plan: {
                anyOf: [
                  buildCarouselContentPlanSchema(5, context),
                  { type: "null" },
                ],
              },
              slotIndex: { enum: [item.slotIndex], type: "integer" },
              status: {
                enum: ["ready", "not_applicable"],
                type: "string",
              },
            },
            required: ["notApplicableReason", "plan", "slotIndex", "status"],
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

async function buildSingleBatchItemRepair(params: {
  context: CarouselGrammarGenerationContext;
  input: CarouselContentPlanInput;
  issues: CarouselPlanValidationIssue[];
  model: string;
  rawItem: Record<string, unknown>;
  replacement: boolean;
}) {
  let repairRawResponse: string | null = null;

  try {
    const baseMessages = buildGrammarPlannerMessages(
      { ...params.input, slideCount: 5 },
      params.context,
    );
    const completion = await getOpenAIClient().chat.completions.create({
      max_completion_tokens: 1_800,
      messages: [
        baseMessages[0]!,
        {
          role: "user" as const,
          content: [
            baseMessages[1]!.content,
            params.replacement
              ? "This is an isolated replacement for a not_applicable batch slot. Generate a new, distinct Carousel with this replacement format. Do not copy another batch Carousel."
              : "This is an isolated repair for one broken item from a five-Carousel batch. Correct only this item.",
            "Validation or applicability issue:",
            JSON.stringify(params.issues),
            "Original batch item:",
            JSON.stringify(params.rawItem),
          ].join("\n"),
        },
      ],
      model: params.model,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "repaired_carousel_batch_item",
          schema: buildCarouselContentPlanSchema(5, params.context),
          strict: true,
        },
      },
      temperature: 0.15,
    });
    repairRawResponse = completion.choices[0]?.message.content ?? null;
    if (!repairRawResponse) throw new Error("OpenAI returned no repaired batch item.");

    const repaired = parseCarouselContentPlanShape(
      JSON.parse(repairRawResponse),
      5,
      params.context,
    );
    const repairedValidation = evaluateCarouselContentPlanForPublishing({
      analysis: params.input.analysis,
      plan: repaired,
      recentHistory: params.input.recentHistory,
    });
    const finalIssues = repairedValidation.blockingIssues;
    if (finalIssues.length > 0) throw new Error(formatValidationIssues(finalIssues));

    return createContentPlan({
      ...repaired,
      fallbackReason: null,
      model: params.model,
      rawLlmResponse: {
        initial: JSON.stringify(params.rawItem),
        repair: repairRawResponse,
      },
      source: "llm",
      validationResult: {
        advisoryIssues: repairedValidation.advisoryIssues,
        fallbackUsed: false,
        finalIssues: [],
        initialIssues: params.issues,
        ok: true,
        repairAttempted: true,
        repaired: true,
      },
    });
  } catch (error) {
    throw new Error(
      `Carousel Structure 1 isolated batch repair failed: ${getErrorMessage(error)}`,
      { cause: error },
    );
  }
}

export function selectCarouselBatchReplacement(
  completed: readonly CarouselBatchContentPlanItem[],
  targetSlotIndex: number,
) {
  const usage = new Map<CarouselContentFormatId, number>();
  for (const item of completed) {
    usage.set(
      item.actualContentFormatId,
      (usage.get(item.actualContentFormatId) ?? 0) + 1,
    );
  }

  return [...completed].sort(
    (left, right) =>
      (usage.get(left.actualContentFormatId) ?? 0) -
        (usage.get(right.actualContentFormatId) ?? 0) ||
      Math.abs(left.slotIndex - targetSlotIndex) -
        Math.abs(right.slotIndex - targetSlotIndex) ||
      left.slotIndex - right.slotIndex,
  )[0] ?? null;
}

function summarizeContentPlan(
  plan: CarouselContentPlan,
): CarouselRecentAcceptedCopy {
  return {
    contentPlanItemId: null,
    formatId: plan.contentStrategy?.contentFormatId ?? null,
    generationId: `current-batch-${plan.concept}`,
    slides: plan.slides.map((slide) => ({
      ctaText: slide.ctaText,
      headline:
        slide.headline ?? slide.body ?? slide.listItems[0] ?? slide.ctaText ?? "",
      slideNumber: slide.slideNumber,
      subtext: slide.subtext,
    })),
    structureId: "structure_1",
  };
}

function getNullableBatchReason(value: unknown) {
  return typeof value === "string" && value.trim()
    ? `Assigned format was not applicable: ${value.trim().slice(0, 300)}`
    : "Assigned format was marked not_applicable without a reason.";
}

function normalizeRecentHistory(
  history: readonly CarouselRecentAcceptedCopy[] | undefined,
) {
  return (history ?? []).slice(0, 10).map((item) => ({
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
  }));
}

export function mergeCarouselRecentContentHistory(
  ...sources: ReadonlyArray<readonly CarouselRecentAcceptedCopy[]>
) {
  const merged: CarouselRecentAcceptedCopy[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    for (const item of normalizeRecentHistory(source)) {
      const key = JSON.stringify(item);

      if (seen.has(key) || item.slides.length === 0) {
        continue;
      }

      seen.add(key);
      merged.push(item);

      if (merged.length === 10) {
        return merged;
      }
    }
  }

  return merged;
}

function buildRepairMessages(params: {
  analysis?: WebsiteBusinessAnalysis;
  businessDescription?: string;
  creativeSeed?: string;
  emotion?: string;
  grammarContext: CarouselGrammarGenerationContext;
  issues: CarouselPlanValidationIssue[];
  planningBrief?: CarouselPlanningBrief | null;
  rawResponse: string;
  recentHistory: readonly CarouselRecentAcceptedCopy[] | undefined;
  slideCount: number;
}) {
  const hasRecentRepetition = params.issues.some(
    (issue) => issue.code === "recent_repetition",
  );
  const recentHistory = normalizeRecentHistory(params.recentHistory);

  return [
    {
      role: "system" as const,
      content:
        "You repair social carousel JSON. Preserve the schema, selected Structure 1 content format, selected hook family, creative seed, required emotion, and private creative-brief intent. The private brief is context only, not visible labels or a fixed script. Correct structural or renderability failures without replacing valid AI copy unnecessarily. Return only repaired JSON and never invent precise claims.",
    },
    {
      role: "user" as const,
      content: [
        `Repair this ${params.slideCount}-slide carousel plan.`,
        `Creative seed: ${params.creativeSeed}.`,
        `Required emotion: ${params.emotion}.`,
        "Private creative brief (context only):",
        JSON.stringify(params.planningBrief),
        "Every headline is optional; when present it must be 3-16 words, at most 100 characters, and at most four visual lines.",
        "Every body must be one complete, specific sentence of 8-40 words and at most 240 characters.",
        "List modes may use at most eight total visual lines, with at most two lines per item.",
        "Remove repeated punctuation, fragments, generic copy, unsupported claims, repeated ideas, headline/body repetition, and grammar errors such as lead to missed leads.",
        "Do not repeat a connector within one short sentence, such as for better management for clearer decisions.",
        "Remove invented quantified proof, guarantees, or precise performance claims.",
        "Never use abstract outcomes such as experience improved clarity, achieve better results, better management, or better organization.",
        "Never use these phrases: boost productivity, effectively, efficiently, effortlessly, enhance your marketing efforts, seamless, streamline your workflow, transform your campaign management, unify your planning and reporting, unlock efficiency, with ease, next level, one workspace for everything, save time, stay on top, or work smarter.",
        "If a headline repeats its body, set headline to null and use body_only instead of paraphrasing it.",
        "The final slide must use slideType cta; ctaText may be null when the takeaway is complete without it.",
        "Every role without a configured listItemCount must return listItems as an empty array.",
        hasRecentRepetition
          ? "Preserve contentFormatId, hookFamilyId, formatRole, slideType, configured text modes, list-item counts, seed, and emotion. Rewrite only enough to avoid close wording repetition."
          : "Preserve contentFormatId, hookFamilyId, formatRole, slideType, configured text modes, list-item counts, seed, and emotion.",
        "Keep one coherent progression that follows the selected format definition.",
        hasRecentRepetition
          ? "The repaired hook and visible copy must not closely paraphrase recentAcceptedCopy."
          : null,
        "A slide describing scattered work, missed steps, delays, or other consequences must use slideType problem, never solution.",
        "Validation failures:",
        JSON.stringify(params.issues),
        "Minimal business context:",
        JSON.stringify({ businessDescription: params.businessDescription }),
        "Selected format definition:",
        JSON.stringify(params.grammarContext.format),
        "Selected hook-family definition:",
        JSON.stringify(params.grammarContext.hookFamily),
        recentHistory.length > 0 ? "Recent Carousel history to avoid:" : null,
        recentHistory.length > 0 ? JSON.stringify(recentHistory) : null,
        "Original JSON response:",
        params.rawResponse,
      ].filter((line): line is string => line !== null).join("\n"),
    },
  ];
}

function buildCarouselContentPlanSchema(
  slideCount: number,
  grammarContext: CarouselGrammarGenerationContext | null,
) {
  const contentStrategySchema = grammarContext
    ? {
        additionalProperties: false,
        properties: {
          angle: { maxLength: 160, minLength: 1, type: "string" },
          contentFormatId: {
            enum: [grammarContext.format.id],
            type: "string",
          },
          hookFamilyId: {
            enum: [grammarContext.hookFamily.id],
            type: "string",
          },
        },
        required: [
          "angle",
          "contentFormatId",
          "hookFamilyId",
        ],
        type: "object",
      }
    : { type: "null" };
  return {
    additionalProperties: false,
    properties: {
      broadSituations: {
        items: { maxLength: 120, minLength: 1, type: "string" },
        maxItems: 8,
        minItems: 3,
        type: "array",
      },
      concept: { maxLength: 120, minLength: 1, type: "string" },
      contentStrategy: contentStrategySchema,
      slides: {
        items: buildCarouselContentSlideSchema(slideCount, grammarContext),
        maxItems: slideCount,
        minItems: slideCount,
        type: "array",
      },
    },
    required: ["broadSituations", "concept", "contentStrategy", "slides"],
    type: "object",
  } as const;
}

function buildCarouselContentSlideSchema(
  slideCount: number,
  grammarContext: CarouselGrammarGenerationContext | null,
) {
  const buildSlideSchema = (
    definition: CarouselContentFormatDefinition["slides"][number] | null,
    index: number | null,
  ) => {
    const configuredListItemCount = definition?.listItemCount;
    const finalSlide = index === slideCount - 1;

    return {
      additionalProperties: false,
      properties: {
        ctaText:
          index !== null && !finalSlide
            ? { type: "null" }
            : {
                anyOf: [
                  {
                    maxLength: MAX_CTA_LENGTH,
                    minLength: 1,
                    type: "string",
                  },
                  { type: "null" },
                ],
              },
        body: {
          anyOf: [
            {
              maxLength: MAX_BODY_LENGTH,
              minLength: 1,
              type: "string",
            },
            { type: "null" },
          ],
        },
        headline: {
          anyOf: [
            {
              maxLength: MAX_HEADLINE_LENGTH,
              minLength: 1,
              type: "string",
            },
            { type: "null" },
          ],
        },
        formatRole: definition
          ? { enum: [definition.role], type: "string" }
          : {
              anyOf: [
                { maxLength: 80, minLength: 1, type: "string" },
                { type: "null" },
              ],
            },
        imageDirection: {
          maxLength: MAX_IMAGE_DIRECTION_LENGTH,
          minLength: 1,
          type: "string",
        },
        listItems: {
          items: {
            maxLength: MAX_LIST_ITEM_LENGTH,
            minLength: 1,
            type: "string",
          },
          maxItems:
            configuredListItemCount ?? (definition ? 0 : 4),
          minItems: configuredListItemCount ?? 0,
          type: "array",
        },
        slideNumber:
          index === null
            ? { maximum: slideCount, minimum: 1, type: "integer" }
            : { enum: [index + 1], type: "integer" },
        slideType: {
          enum: definition
            ? [definition.slideType]
            : [
                "benefit",
                "cta",
                "differentiator",
                "hook",
                "problem",
                "solution",
              ],
          type: "string",
        },
        textMode: {
          enum: definition
            ? definition.preferredTextModes
            : [
                "body_only",
                "checklist",
                "cta_takeaway",
                "headline_body",
                "question_list",
                "single_statement",
              ],
          type: "string",
        },
      },
      required: [
        "body",
        "ctaText",
        "formatRole",
        "headline",
        "imageDirection",
        "listItems",
        "slideNumber",
        "slideType",
        "textMode",
      ],
      type: "object",
    } as const;
  };

  return grammarContext
    ? {
        anyOf: grammarContext.format.slides.map((definition, index) =>
          buildSlideSchema(definition, index),
        ),
      }
    : buildSlideSchema(null, null);
}

function createContentPlan(params: Omit<CarouselContentPlan, "normalizedPlan" | "plannerVersion">) {
  return {
    ...params,
    normalizedPlan: {
      broadSituations: params.broadSituations,
      concept: params.concept,
      contentStrategy: params.contentStrategy,
      slides: params.slides,
    },
    plannerVersion: CAROUSEL_CONTENT_PLANNER_VERSION,
  } satisfies CarouselContentPlan;
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY for carousel content planning.");
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey, maxRetries: 2, timeout: 30_000 });
  }

  return openaiClient;
}

function getLayoutPreset(
  slideType: PlannedCarouselSlide["slideType"],
  textMode: CarouselTextMode,
): Pick<PlannedCarouselSlide, "layoutPreset" | "textPosition"> {
  if (textMode === "question_list" || textMode === "checklist") {
    return { layoutPreset: "interactive-list", textPosition: "center" };
  }

  if (textMode === "body_only" || textMode === "single_statement") {
    return { layoutPreset: "caption-cluster", textPosition: "center" };
  }

  if (slideType === "hook") {
    return { layoutPreset: "top-hook", textPosition: "center" };
  }

  if (slideType === "cta" || slideType === "solution") {
    return { layoutPreset: "middle-statement", textPosition: "center" };
  }

  return { layoutPreset: "bottom-message", textPosition: "center" };
}

function getTextMode(
  value: unknown,
  slideType: PlannedCarouselSlide["slideType"],
  label: string,
) {
  if (typeof value === "string" && TEXT_MODES.has(value as CarouselTextMode)) {
    return value as CarouselTextMode;
  }

  if (value !== undefined) {
    throw new Error(`${label} is invalid.`);
  }

  return slideType === "cta" ? "cta_takeaway" : "headline_body";
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function getRequiredString(value: unknown, maxLength: number, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  const normalized = value.trim().replace(/\s+/g, " ");

  if (normalized.length > maxLength) {
    throw new Error(`${label} exceeds ${maxLength} characters.`);
  }

  return normalized;
}

function getNullableString(value: unknown, maxLength: number, label: string) {
  if (value === null) {
    return null;
  }

  return getRequiredString(value, maxLength, label);
}

function getOptionalNullableString(value: unknown, maxLength: number, label: string) {
  if (value === null || value === undefined) {
    return null;
  }

  return getRequiredString(value, maxLength, label);
}

function getOptionalStringList(
  value: unknown,
  maxItems: number,
  maxLength: number,
  label: string,
) {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error(`${label} must contain 0-${maxItems} items.`);
  }

  return value.map((item, index) =>
    getRequiredString(item, maxLength, `${label}[${index}]`),
  );
}

function getStringList(
  value: unknown,
  minItems: number,
  maxItems: number,
  maxLength: number,
  label: string,
) {
  if (!Array.isArray(value) || value.length < minItems || value.length > maxItems) {
    throw new Error(`${label} must contain ${minItems}-${maxItems} items.`);
  }

  return value.map((item, index) =>
    getRequiredString(item, maxLength, `${label}[${index}]`),
  );
}

function getInteger(value: unknown, label: string) {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer.`);
  }

  return value as number;
}

function getSlideType(value: unknown, label: string) {
  if (typeof value !== "string" || !SLIDE_TYPES.has(value as PlannedCarouselSlide["slideType"])) {
    throw new Error(`${label} is invalid.`);
  }

  return value as PlannedCarouselSlide["slideType"];
}

function clampSlideCount(value: number) {
  return Math.min(Math.max(Math.trunc(value), 1), 10);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
