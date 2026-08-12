import OpenAI from "openai";

import type { WebsiteBusinessAnalysis } from "../types.js";
import {
  buildCarouselBusinessContentContext,
  resolveCarouselBusinessContentOption,
  type CarouselBusinessContentOption,
  type CarouselBusinessContentContext,
} from "./carousel-business-content-context.js";
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
import { buildCarouselSlidePlan } from "./carousel-slide-plan.js";
import type {
  CarouselTextMode,
  PlannedCarouselSlide,
} from "./carousel-slide-plan.js";

export const CAROUSEL_CONTENT_PLANNER_VERSION =
  "llm-carousel-planner-v19-profile-context-fallback-diversity";

const DEFAULT_MODEL = "gpt-4.1-mini";
const MAX_BODY_LENGTH = 120;
const MAX_HEADLINE_LENGTH = 50;
const MAX_CTA_LENGTH = 34;
const MAX_IMAGE_DIRECTION_LENGTH = 180;
const TARGET_BODY_MIN_WORDS = 8;
const TARGET_BODY_MAX_WORDS = 20;
const MIN_REQUIRED_BODY_WORDS = 8;
const MAX_ALLOWED_BODY_WORDS = 20;
const MIN_HEADLINE_WORDS = 3;
const MAX_HEADLINE_WORDS = 8;
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
  source: "deterministic-fallback" | "llm";
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
    | "repeated_punctuation"
    | "story_structure"
    | "story_repetition"
    | "unsupported_claim";
  message: string;
  slideNumber: number | null;
};

export type CarouselPlanValidationResult = {
  finalIssues: CarouselPlanValidationIssue[];
  initialIssues: CarouselPlanValidationIssue[];
  ok: boolean;
  repairAttempted: boolean;
  repaired: boolean;
};

type CarouselContentPlanInput = {
  analysis: WebsiteBusinessAnalysis;
  candidateIndex?: number;
  contentFormatId?: string | null;
  goal?: string | null;
  hookFamilyId?: string | null;
  recentHistory?: CarouselRecentContentSummaryInput[];
  selectedAngle?: string | null;
  slideCount: number;
};

export type CarouselRecentContentSummaryInput = {
  angle?: string | null;
  contentFormatId?: string | null;
  hook?: string | null;
  hookFamilyId?: string | null;
  topic?: string | null;
  topicId?: string | null;
};

export type ResolvedCarouselContentStrategy = {
  angle: string;
  audience: string;
  audienceId: string;
  contentFormatId: CarouselContentFormatId;
  customerGoal: string;
  customerGoalId: string;
  hookFamilyId: CarouselHookFamilyId;
  problem: string;
  problemId: string;
  topic: string;
  topicId: string;
};

type CarouselGrammarGenerationContext = {
  businessContext: CarouselBusinessContentContext;
  format: CarouselContentFormatDefinition;
  hookFamily: CarouselHookFamilyDefinition;
};

function getGrammarGenerationContext(
  input: CarouselContentPlanInput,
  slideCount: number,
): CarouselGrammarGenerationContext | null {
  if (
    slideCount !== 5 ||
    !isCarouselContentFormatId(input.contentFormatId) ||
    !isCarouselHookFamilyId(input.hookFamilyId)
  ) {
    return null;
  }

  const format = getCarouselContentFormat(input.contentFormatId);

  if (!format.compatibleHookFamilies.includes(input.hookFamilyId)) {
    throw new Error(
      `${input.hookFamilyId} is not compatible with ${input.contentFormatId}.`,
    );
  }

  return {
    businessContext: buildCarouselBusinessContentContext(input.analysis),
    format,
    hookFamily: getCarouselHookFamily(input.hookFamilyId),
  };
}

export async function buildCarouselContentPlan(
  input: CarouselContentPlanInput,
): Promise<CarouselContentPlan> {
  const slideCount = clampSlideCount(input.slideCount);
  const grammarContext = getGrammarGenerationContext(input, slideCount);
  const model =
    process.env.OPENAI_CAROUSEL_PLANNER_MODEL?.trim() || DEFAULT_MODEL;
  let initialRawResponse: string | null = null;
  let repairRawResponse: string | null = null;
  let initialIssues: CarouselPlanValidationIssue[] = [];

  if (process.env.CAROUSEL_CONTENT_PLANNER_MODE?.trim() === "deterministic") {
    return buildFallbackPlan(
      input,
      grammarContext,
      "LLM planning was disabled by CAROUSEL_CONTENT_PLANNER_MODE.",
      { initial: null, repair: null },
      [],
      null,
    );
  }

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
      initialIssues = [
        ...validateCarouselContentPlan(normalizedPlan, input.analysis),
        ...validateCarouselRecentContentRepetition(
          normalizedPlan,
          input.recentHistory,
          grammarContext?.businessContext.topics,
        ),
      ];
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
        grammarContext,
        issues: initialIssues,
        rawResponse: initialRawResponse,
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

    const repairedPlan = normalizeRepairedCarouselCopy(
      parseCarouselContentPlanShape(
        JSON.parse(repairRawResponse),
        slideCount,
        grammarContext,
      ),
    );
    const finalIssues = [
      ...validateCarouselContentPlan(repairedPlan, input.analysis),
      ...validateCarouselRecentContentRepetition(
        repairedPlan,
        input.recentHistory,
        grammarContext?.businessContext.topics,
      ),
    ];

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
        finalIssues: [],
        initialIssues,
        ok: true,
        repairAttempted: true,
        repaired: true,
      },
    });
  } catch (error) {
    return buildFallbackPlan(
      input,
      grammarContext,
      getErrorMessage(error),
      {
        initial: initialRawResponse,
        repair: repairRawResponse,
      },
      initialIssues,
      model,
    );
  }
}

export function parseCarouselContentPlan(
  value: unknown,
  requestedSlideCount: number,
) {
  const plan = parseCarouselContentPlanShape(value, requestedSlideCount);
  const issues = validateCarouselContentPlan(plan);

  if (issues.length > 0) {
    throw new Error(formatValidationIssues(issues));
  }

  return plan;
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
      72,
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
    const headline = shouldDropHeadline({
      body: parsedBody,
      headline: parsedHeadline,
      slideType,
      textMode: preliminaryTextMode,
    })
      ? null
      : parsedHeadline
        ? normalizeHeadlineCase(parsedHeadline)
        : null;
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
  const audienceId = getRequiredString(record.audienceId, 100, "audienceId");
  const problemId = getRequiredString(record.problemId, 100, "problemId");
  const customerGoalId = getRequiredString(
    record.customerGoalId,
    100,
    "customerGoalId",
  );
  const topicId = getRequiredString(record.topicId, 100, "topicId");
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

  const audience = resolveCarouselBusinessContentOption(
    grammarContext.businessContext.audiences,
    audienceId,
    "audience",
  );
  const problem = resolveCarouselBusinessContentOption(
    grammarContext.businessContext.problems,
    problemId,
    "problem",
  );
  const customerGoal = resolveCarouselBusinessContentOption(
    grammarContext.businessContext.customerGoals,
    customerGoalId,
    "customer goal",
  );
  const topic = resolveCarouselBusinessContentOption(
    grammarContext.businessContext.topics,
    topicId,
    "topic",
  );

  return {
    angle,
    audience: audience.label,
    audienceId,
    contentFormatId: grammarContext.format.id,
    customerGoal: customerGoal.label,
    customerGoalId,
    hookFamilyId: grammarContext.hookFamily.id,
    problem: problem.label,
    problemId,
    topic: topic.label,
    topicId,
  };
}

function hasProhibitedVisualSubject(value: string) {
  const validationText = value
    .replace(/\b(?:clock|watch)(?:\s+with)?\s+hands?\b/gi, "")
    .replace(NEGATED_VISUAL_SUBJECT_PATTERN, "")
    .replace(/\b(?:object-only|people-free|person-free|face-free|human-free)\b/gi, "");

  return PROHIBITED_VISUAL_SUBJECT_PATTERN.test(validationText);
}

function normalizeHeadlineCase(value: string) {
  const words = value.split(/\s+/).filter(Boolean);
  const alphaWords = words.filter((word) => /[a-z]/i.test(word));

  if (alphaWords.length < 3) {
    return value;
  }

  const titleCaseWords = alphaWords.filter((word) => /^[A-Z][a-z]/.test(word));

  if (titleCaseWords.length / alphaWords.length < 0.65) {
    return value;
  }

  return value
    .toLowerCase()
    .replace(/\bai\b/g, "AI")
    .replace(/\bugc\b/g, "UGC")
    .replace(/\bsaas\b/g, "SaaS");
}

function getNormalizedTokens(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function shouldDropHeadline(params: {
  body: string | null;
  headline: string | null;
  slideType: PlannedCarouselSlide["slideType"];
  textMode: CarouselTextMode;
}) {
  if (!params.headline) {
    return false;
  }

  if (params.textMode === "body_only" || params.textMode === "single_statement") {
    return true;
  }

  if (!params.body) {
    return false;
  }

  const headlineTokens = new Set(getNormalizedTokens(params.headline));
  const bodyTokens = new Set(getNormalizedTokens(params.body));

  if (headlineTokens.size === 0 || bodyTokens.size === 0) {
    return false;
  }

  let overlap = 0;

  for (const token of headlineTokens) {
    if (bodyTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / headlineTokens.size >= 0.6;
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

export function validateCarouselContentPlan(
  plan: Pick<CarouselContentPlan, "broadSituations" | "concept" | "slides">,
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

  for (const slide of plan.slides) {
    const texts = [
      slide.headline,
      slide.body,
      slide.ctaText,
      ...(slide.listItems ?? []),
    ].filter((value): value is string => Boolean(value));

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
        message: "List modes may use at most four visual text lines.",
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
          /\b(always|best|guarantee|guaranteed|never|perfect|number one|100 percent)\b/.test(
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
  history: readonly CarouselRecentContentSummaryInput[] | undefined,
  topicOptions: readonly CarouselBusinessContentOption[] | undefined,
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
  const angle = plan.contentStrategy?.angle ?? "";
  const topic = plan.contentStrategy?.topic ?? "";
  const topicId = plan.contentStrategy?.topicId ?? "";
  const issues: CarouselPlanValidationIssue[] = [];

  for (const previous of normalizedHistory) {
    if (hook && previous.hook && getTokenOverlap(hook, previous.hook) >= 0.75) {
      issues.push({
        code: "recent_repetition",
        message: "The hook is too similar to recent Carousel history.",
        slideNumber: 1,
      });
      break;
    }
  }

  for (const previous of normalizedHistory) {
    if (
      angle &&
      previous.angle &&
      getTokenOverlap(angle, previous.angle) >= 0.72
    ) {
      issues.push({
        code: "recent_repetition",
        message: "The content angle is too similar to recent Carousel history.",
        slideNumber: null,
      });
      break;
    }
  }

  const repeatedTopic = normalizedHistory.some((previous) =>
    isSameRecentTopic({
      currentTopic: topic,
      currentTopicId: topicId,
      previousTopic: previous.topic,
      previousTopicId: previous.topicId,
    }),
  );
  const hasUnusedTopicOption = (topicOptions ?? []).some(
    (option) =>
      !normalizedHistory.some((previous) =>
        isSameRecentTopic({
          currentTopic: option.label,
          currentTopicId: option.id,
          previousTopic: previous.topic,
          previousTopicId: previous.topicId,
        }),
      ),
  );

  if (repeatedTopic && hasUnusedTopicOption) {
    issues.push({
      code: "recent_repetition",
      message:
        "The selected topic repeats recent Carousel history even though another saved topic is available.",
      slideNumber: null,
    });
  }

  return issues;
}

function isSameRecentTopic(params: {
  currentTopic: string | null | undefined;
  currentTopicId: string | null | undefined;
  previousTopic: string | null | undefined;
  previousTopicId: string | null | undefined;
}) {
  if (
    params.currentTopicId &&
    params.previousTopicId &&
    params.currentTopicId === params.previousTopicId
  ) {
    return true;
  }

  const currentTopic = normalizeValidationText(params.currentTopic ?? "");
  const previousTopic = normalizeValidationText(params.previousTopic ?? "");

  return Boolean(
    currentTopic &&
      previousTopic &&
      (currentTopic === previousTopic ||
        getTokenOverlap(currentTopic, previousTopic) >= 0.85),
  );
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
  return /\b((?:achieve|enjoy|experience|gain) (?:better|greater|improved|more)|better (?:management|organization|outcomes?|results?)|boost your productivity|effectively|efficiently|effortlessly|enhance your marketing efforts|game changer|improved (?:clarity|organization|outcomes?|results?)|make every day count|next level|one workspace for everything|save time(?: faster)?|seamless(?:ly)?|stay on top|streamline your workflow|transform your campaign management|unify your (?:planning and reporting|workflow)|unlock efficiency|with ease|work smarter)\b/i.test(
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
  grammarContext: CarouselGrammarGenerationContext | null,
) {
  if (grammarContext) {
    return buildGrammarPlannerMessages(input, grammarContext);
  }

  const analysis = input.analysis;
  const candidateNumber = Math.max(0, input.candidateIndex ?? 0) + 1;

  return [
    {
      role: "system" as const,
      content:
        "You are a senior performance creative strategist planning social carousels. Build a specific story from the supplied business evidence. Return only the requested JSON. Never invent product claims. Visual directions must describe only objects, surfaces, rooms, food, devices, documents, or still life details. Do not write human-related words, even as exclusions.",
    },
    {
      role: "user" as const,
      content: [
        `Create carousel candidate ${candidateNumber} with exactly ${input.slideCount} slides.`,
        `Required businessName: ${analysis.businessName?.trim() || "unnamed business"}.`,
        input.selectedAngle?.trim()
          ? `Preferred angle: ${input.selectedAngle.trim()}`
          : "Choose a distinct angle grounded in the analysis.",
        input.goal?.trim() ? `Generation goal: ${input.goal.trim()}` : null,
        "",
        "Planning rules:",
        "- For a 5-slide carousel, use this story shape: Slide 1 - Hook, Slide 2 - Problem, Slide 3 - Consequence, Slide 4 - Solution, Slide 5 - Result or CTA.",
        "- For other slide counts, keep the same arc: hook, friction, consequence, solution, useful result.",
        "- Slide role semantics are strict: problem describes friction or consequence, solution explains the supported mechanism or better process, benefit states the resulting outcome, and differentiator states a supported reason this product is distinct.",
        "- Never place problem copy under a solution, benefit, or differentiator slide type.",
        "- Choose the best textMode for each slide: headline_body, body_only, single_statement, question_list, checklist, or cta_takeaway.",
        "- Do not force every slide to have a headline. Middle slides can use body_only or single_statement when the body is stronger than a label.",
        "- Use question_list or checklist when the slide should feel interactive or scannable.",
        "- At least one middle slide should avoid headline_body when the concept naturally supports it.",
        "- If a headline repeats the body, set headline to null and use body_only.",
        "- broadSituations must contain 3-8 wider real-life moments, emotions, or problems that fit this business.",
        "- For a calorie tracker, examples include dinner fatigue, portion confusion, late-night snacks, grocery decisions, and forgetting to log.",
        "- For SaaS, examples include deadline overload, scattered reports, notification clutter, dashboard confusion, and after-hours work.",
        "- Keep every slide focused on one idea. Do not repeat headlines or paraphrase the same claim.",
        `- Headlines are optional. When present, use ${MIN_HEADLINE_WORDS}-${MAX_HEADLINE_WORDS} words, at most ${MAX_HEADLINE_LENGTH} characters, and no more than two visual lines.`,
        "- Headlines can be omitted when the slide works better without one.",
        "- Headline style must feel like social carousel overlay copy: punchy, concrete, lowercase or sentence case, never title-case blog headings.",
        "- Good headline examples for a calorie tracker: meal tracking should not feel like homework, every meal becomes a search, small mistakes change the result.",
        "- Avoid abstract headline labels such as tracking fatigue sets in, inaccurate portions lead to frustration, unlock efficiency, or take it to the next level.",
        `- Body copy should normally be ${TARGET_BODY_MIN_WORDS}-${TARGET_BODY_MAX_WORDS} words, plain, connected to the previous slide, and strong enough to stand alone when textMode is body_only.`,
        `- Body copy must be one complete sentence, at most ${MAX_BODY_LENGTH} characters, and normally no more than three visual lines.`,
        "- Body copy must explain the idea properly. Do not write empty support such as Save time or Save time faster.",
        "- Body copy must not simply repeat the headline, and it must not become a large paragraph.",
        "- For question_list and checklist, use 2-4 short listItems and keep body null unless the total stays within four visual lines.",
        "- Headlines must be punchy and concrete. Avoid generic phrases such as boost productivity, streamline your business, unlock efficiency, or take it to the next level.",
        "- Do not use repeated punctuation, fragments, incomplete endings, repeated words, or headline/body repetition.",
        "- Keep one idea per slide. Do not combine multiple claims with semicolons or several sentences.",
        "- The CTA slide should explain the result the customer receives and may end with a concrete next action.",
        "- The CTA headline must name a concrete next action or outcome; do not use generic copy such as unify your workflow.",
        "- Use only claims supported by the analysis and respect claimsToAvoid.",
        "- Never invent quantified social proof such as millions of users, customers, or businesses.",
        "- Use businessName exactly when naming the product. Never invent or substitute another product or brand in copy or imageDirection.",
        "- imageDirection must name a concrete object-only scene and useful text-safe space.",
        "- imageDirection must describe only objects, surfaces, room context, food, devices, documents, or still life details.",
        "- Do not write words like humans, people, faces, hands, bodies, silhouettes, teams, customers, or workers in imageDirection, even as exclusions.",
        "- ctaText must be null except on the final slide.",
        "",
        "Business analysis:",
        JSON.stringify(analysis),
      ]
        .filter((line): line is string => line !== null)
        .join("\n"),
    },
  ];
}

function buildGrammarPlannerMessages(
  input: CarouselContentPlanInput & { slideCount: number },
  grammarContext: CarouselGrammarGenerationContext,
) {
  const analysis = input.analysis;
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
        "You are a senior Instagram carousel strategist. The backend has already selected the content format and hook family. You must not change them. Choose one supplied audience, problem, customer goal, and topic by their exact IDs, create one fresh angle, and write exactly five renderer-safe slides. Return only the requested JSON. Never invent product, nutrition, health, financial, performance, or numerical claims. Visual directions must describe only objects, surfaces, rooms, food, devices, documents, or still-life details and must never contain human-related words, even as exclusions.",
    },
    {
      role: "user" as const,
      content: [
        `Create Carousel candidate ${candidateNumber} with exactly five slides.`,
        `Required businessName: ${analysis.businessName?.trim() || "unnamed business"}.`,
        `Backend-selected contentFormatId: ${grammarContext.format.id}.`,
        `Backend-selected hookFamilyId: ${grammarContext.hookFamily.id}.`,
        "",
        "Selection rules:",
        "- Select exactly one audienceId, problemId, customerGoalId, and topicId from businessContext.",
        "- Return those exact IDs. Do not create or paraphrase IDs.",
        "- Align the topic and angle with the saved business model and campaign purposes when they are present.",
        "- contentFormatId and hookFamilyId must exactly match the backend-selected values.",
        "- Create a fresh, specific angle that connects the selected audience, problem, goal, and topic.",
        "- Avoid hooks, topics, and angles from recentHistory; do not merely reword them.",
        "- Follow every supplied slide role, slideType, allowed text mode, item count, and instruction exactly.",
        "- Slide 5 must be a useful takeaway. ctaText is optional and, when present, must be soft and concrete.",
        "",
        "Writing rules:",
        "- Use simple, natural language and one main idea per slide.",
        "- Prioritize useful content over promotion. Do not turn the carousel into an advertisement.",
        "- Hook wording must be completely fresh and must follow the selected hook family without copying examples or history.",
        `- Headlines are optional. When present, use ${MIN_HEADLINE_WORDS}-${MAX_HEADLINE_WORDS} words, at most ${MAX_HEADLINE_LENGTH} characters, and no more than two visual lines.`,
        `- Body copy must be one complete sentence of ${TARGET_BODY_MIN_WORDS}-${TARGET_BODY_MAX_WORDS} words, at most ${MAX_BODY_LENGTH} characters, and normally no more than three visual lines.`,
        "- A headline must not repeat its body. If the body works alone, use body_only and set headline to null.",
        "- List slides must use the exact configured number of short listItems and normally set body to null.",
        "- Do not repeat the same information across slides.",
        "- Do not use generic phrases such as boost productivity, streamline your workflow, unlock efficiency, save time, work smarter, or next level.",
        "- Do not invent exact calories, protein, grams, percentages, prices, time savings, user counts, or performance figures. A precise figure is allowed only when the exact figure appears in the supplied business analysis.",
        "- Use only claims supported by the business analysis and respect claimsToAvoid.",
        "- Never invent brands, customers, testimonials, rankings, or quantified social proof.",
        "- imageDirection must name one concrete object-only scene and useful text-safe space.",
        "- Do not write humans, people, faces, hands, bodies, silhouettes, teams, customers, or workers in imageDirection, even as exclusions.",
        "- formatRole must exactly match the configured role for its slide number.",
        "- ctaText must be null on slides 1-4.",
        "",
        "Business context derived from the existing saved onboarding profile:",
        JSON.stringify(grammarContext.businessContext),
        "",
        "Selected format definition:",
        JSON.stringify(formatForPrompt),
        "",
        "Selected hook-family definition:",
        JSON.stringify(hookFamilyForPrompt),
        "",
        "Recent compact history:",
        JSON.stringify(recentHistory),
        "",
        "Full normalized business analysis for evidence checking:",
        JSON.stringify(analysis),
      ].join("\n"),
    },
  ];
}

function normalizeRecentHistory(
  history: readonly CarouselRecentContentSummaryInput[] | undefined,
) {
  return (history ?? []).slice(0, 10).map((item) => ({
    angle: cleanOptionalHistoryText(item.angle),
    contentFormatId: isCarouselContentFormatId(item.contentFormatId)
      ? item.contentFormatId
      : null,
    hook: cleanOptionalHistoryText(item.hook),
    hookFamilyId: isCarouselHookFamilyId(item.hookFamilyId)
      ? item.hookFamilyId
      : null,
    topic: cleanOptionalHistoryText(item.topic),
    topicId: cleanOptionalHistoryText(item.topicId),
  }));
}

export function mergeCarouselRecentContentHistory(
  ...sources: ReadonlyArray<readonly CarouselRecentContentSummaryInput[]>
) {
  const merged: CarouselRecentContentSummaryInput[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    for (const item of normalizeRecentHistory(source)) {
      const key = JSON.stringify(item);

      if (
        seen.has(key) ||
        !(
          item.angle ||
          item.contentFormatId ||
          item.hook ||
          item.hookFamilyId ||
          item.topic ||
          item.topicId
        )
      ) {
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

function cleanOptionalHistoryText(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 180)
    : null;
}

function buildRepairMessages(params: {
  analysis: WebsiteBusinessAnalysis;
  grammarContext: CarouselGrammarGenerationContext | null;
  issues: CarouselPlanValidationIssue[];
  rawResponse: string;
  slideCount: number;
}) {
  return [
    {
      role: "system" as const,
      content:
        "You repair social carousel JSON. Preserve the supported story and schema, but rewrite weak copy. Return only repaired JSON and never invent claims.",
    },
    {
      role: "user" as const,
      content: [
        `Repair this ${params.slideCount}-slide carousel plan.`,
        `Required businessName: ${params.analysis.businessName?.trim() || "unnamed business"}.`,
        "Every headline is optional; when present it must be 3-8 words, at most 50 characters, and at most two visual lines.",
        "Every body must be one complete, specific sentence of 8-20 words and at most 120 characters.",
        "List modes may use at most four total visual lines.",
        "Remove repeated punctuation, fragments, generic copy, unsupported claims, repeated ideas, headline/body repetition, and grammar errors such as lead to missed leads.",
        "Do not repeat a connector within one short sentence, such as for better management for clearer decisions.",
        "Remove quantified social proof unless it appears verbatim in the analysis, and remove growth, money, revenue, profit, sales, or conversion claims not supported by the analysis.",
        "Use businessName exactly when naming the product. Never invent or substitute another product or brand in copy or imageDirection.",
        "Never use abstract outcomes such as experience improved clarity, achieve better results, better management, or better organization.",
        "Never use these phrases: boost productivity, effectively, efficiently, effortlessly, enhance your marketing efforts, seamless, streamline your workflow, transform your campaign management, unify your planning and reporting, unlock efficiency, with ease, next level, one workspace for everything, save time, stay on top, or work smarter.",
        "If a headline repeats its body, set headline to null and use body_only instead of paraphrasing it.",
        params.grammarContext
          ? "The final slide must use slideType cta; ctaText may be null when the takeaway is complete without it."
          : "The final slide must use slideType cta and include a non-null ctaText.",
        params.grammarContext
          ? "Preserve the exact contentStrategy IDs, contentFormatId, hookFamilyId, formatRole, slideType, configured text modes, and list-item counts. The final ctaText may be null when the takeaway is complete without it."
          : null,
        params.grammarContext
          ? "Keep one coherent progression that follows the selected format definition."
          : "Keep one clear story: hook, friction, consequence, solution, useful result or CTA.",
        "A slide describing scattered work, missed steps, delays, or other consequences must use slideType problem, never solution.",
        "Validation failures:",
        JSON.stringify(params.issues),
        "Business analysis:",
        JSON.stringify(params.analysis),
        params.grammarContext ? "Business context derived from the existing saved onboarding profile:" : null,
        params.grammarContext
          ? JSON.stringify(params.grammarContext.businessContext)
          : null,
        params.grammarContext ? "Selected format definition:" : null,
        params.grammarContext
          ? JSON.stringify(params.grammarContext.format)
          : null,
        params.grammarContext ? "Selected hook-family definition:" : null,
        params.grammarContext
          ? JSON.stringify(params.grammarContext.hookFamily)
          : null,
        "Original JSON response:",
        params.rawResponse,
      ].filter((line): line is string => line !== null).join("\n"),
    },
  ];
}

export function normalizeRepairedCarouselCopy<
  T extends ReturnType<typeof parseCarouselContentPlanShape>,
>(
  plan: T,
) {
  return {
    ...plan,
    slides: plan.slides.map((slide) => {
      const body = slide.body
        ? repairCopyText(slide.body, true, slide.slideType)
        : null;
      const repairedHeadline = slide.headline
        ? repairCopyText(slide.headline, false)
        : null;
      const usableHeadline =
        repairedHeadline &&
        countWords(repairedHeadline) >= MIN_HEADLINE_WORDS &&
        countWords(repairedHeadline) <= MAX_HEADLINE_WORDS &&
        repairedHeadline.length <= MAX_HEADLINE_LENGTH
          ? repairedHeadline
          : null;
      const headline =
        usableHeadline && body && getTokenOverlap(usableHeadline, body) >= 0.6
          ? null
          : usableHeadline;
      const slideType =
        !slide.formatRole &&
        slide.slideType === "solution" &&
        isProblemFramedCopy(body)
          ? "problem"
          : slide.slideType;
      const textMode =
        slide.textMode === "question_list" || slide.textMode === "checklist"
          ? slide.textMode
          : slideType === "cta"
            ? "cta_takeaway"
            : headline
              ? slide.textMode
              : "body_only";

      return {
        ...slide,
        ...getLayoutPreset(slideType, textMode),
        body,
        ctaText:
          slideType === "cta" && (!slide.formatRole || slide.ctaText !== null)
            ? repairCtaText(slide.ctaText)
            : slide.ctaText,
        headline,
        slideType,
        subtext: body,
        textMode,
      };
    }),
  };
}

function repairCtaText(value: string | null) {
  const repaired = value
    ?.replace(/([!?.,])\1+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  if (
    !repaired ||
    /[a-z][A-Z]$/.test(repaired) ||
    /\b(and|for|to|with)$/i.test(repaired)
  ) {
    return "Start this campaign";
  }

  return repaired;
}

function repairCopyText(
  value: string,
  sentence: boolean,
  slideType?: PlannedCarouselSlide["slideType"],
) {
  let repaired = value
    .replace(/([!?.,])\1+/g, "$1")
    .replace(/\bboost (?:your )?productivity\b/gi, "reduce repeat campaign work")
    .replace(/\bstreamline your workflow\b/gi, "keep campaign work connected")
    .replace(/\bunlock efficiency\b/gi, "remove repeated manual steps")
    .replace(/\btake (?:it|your business|your workflow) to the next level\b/gi, "make the next action clearer")
    .replace(/\bwork smarter\b/gi, "reduce repeated work")
    .replace(/\bone workspace for everything\b/gi, "campaign work in one place")
    .replace(/\bseamless(?:ly)?\b/gi, "connected")
    .replace(/\befficiently\b/gi, "with fewer handoffs")
    .replace(/\beffectively\b/gi, "in one workflow")
    .replace(/\benhance your marketing efforts\b/gi, "connect planning and reporting")
    .replace(/\bunify your (?:planning and reporting|workflow)\b/gi, "connect campaign plans and reports")
    .replace(/\bwith ease\b/gi, "with clear next steps")
    .replace(/\blead to (?:missed|lost) leads\b/gi, "cause missed follow-ups")
    .replace(/\bleads to (?:missed|lost) leads\b/gi, "causes missed follow-ups")
    .replace(
      /\b(planning and reporting\b(?:\s+[a-z'-]+){0,5})\s+creates\b/gi,
      "$1 create",
    )
    .replace(
      /\bfor better management(?: for clearer campaign decisions)?\b/gi,
      "to keep campaign handoffs connected",
    )
    .replace(
      /\bfor better organization\b/gi,
      "to keep planning and reporting connected",
    )
    .replace(
      /\btransform your campaign management\b/gi,
      "organize your next campaign handoff",
    )
    .replace(
      /\b(?:hinder|impact|limit|slow) growth\b/gi,
      "create gaps in campaign follow-ups",
    )
    .replace(
      /\bexperience improved clarity and organization\b/gi,
      "keep planning and reporting in one workflow",
    )
    .replace(/\s+/g, " ")
    .trim();

  if (sentence) {
    repaired = repaired.charAt(0).toUpperCase() + repaired.slice(1);

    if (!/[.?!]$/.test(repaired)) {
      repaired = `${repaired}.`;
    }

    if (countWords(repaired) < MIN_REQUIRED_BODY_WORDS) {
      const punctuation = repaired.match(/[.?!]$/)?.[0] ?? ".";
      const stem = repaired.replace(/[.?!]+$/, "");
      const suffix =
        punctuation === "?"
          ? "during campaign planning"
          : slideType === "cta"
            ? /\bwith\b/i.test(stem)
              ? "and make the next step clear"
              : "with clearer next steps"
            : slideType === "solution"
              ? "inside one organized workspace"
              : slideType === "hook"
                ? "when deadlines start moving"
                : "during active campaign work";
      repaired = `${stem} ${suffix}${punctuation}`;
    }
  }

  return repaired;
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
          audienceId: {
            enum: grammarContext.businessContext.audiences.map((item) => item.id),
            type: "string",
          },
          contentFormatId: {
            enum: [grammarContext.format.id],
            type: "string",
          },
          customerGoalId: {
            enum: grammarContext.businessContext.customerGoals.map(
              (item) => item.id,
            ),
            type: "string",
          },
          hookFamilyId: {
            enum: [grammarContext.hookFamily.id],
            type: "string",
          },
          problemId: {
            enum: grammarContext.businessContext.problems.map((item) => item.id),
            type: "string",
          },
          topicId: {
            enum: grammarContext.businessContext.topics.map((item) => item.id),
            type: "string",
          },
        },
        required: [
          "angle",
          "audienceId",
          "contentFormatId",
          "customerGoalId",
          "hookFamilyId",
          "problemId",
          "topicId",
        ],
        type: "object",
      }
    : { type: "null" };
  const allowedFormatRoles = grammarContext
    ? grammarContext.format.slides.map((slide) => slide.role)
    : [];

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
        items: {
          additionalProperties: false,
          properties: {
            ctaText: {
              anyOf: [
                { maxLength: MAX_CTA_LENGTH, minLength: 1, type: "string" },
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
            formatRole: grammarContext
              ? { enum: allowedFormatRoles, type: "string" }
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
              items: { maxLength: 72, minLength: 1, type: "string" },
              maxItems: 4,
              type: "array",
            },
            slideNumber: { maximum: slideCount, minimum: 1, type: "integer" },
            slideType: {
              enum: [
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
              enum: [
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
        },
        maxItems: slideCount,
        minItems: slideCount,
        type: "array",
      },
    },
    required: ["broadSituations", "concept", "contentStrategy", "slides"],
    type: "object",
  } as const;
}

function buildFallbackPlan(
  input: CarouselContentPlanInput,
  grammarContext: CarouselGrammarGenerationContext | null,
  fallbackReason: string,
  rawLlmResponse: CarouselContentPlan["rawLlmResponse"],
  initialIssues: CarouselPlanValidationIssue[] = [],
  model: string | null = null,
): CarouselContentPlan {
  const analysis = input.analysis;
  const broadSituations = [
    ...(analysis.painPoints ?? []),
    ...(analysis.visualKeywords ?? []),
    ...(analysis.pexelsImageQueries ?? []),
    "daily friction",
    "unclear next steps",
    "busy routines",
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 8);
  const baseConcept =
    input.selectedAngle?.trim() ||
    analysis.carouselAngles?.[Math.max(0, input.candidateIndex ?? 0)]?.trim() ||
    analysis.mainPromise?.trim() ||
    "A clearer path from everyday friction to the next action";
  const contentStrategy = grammarContext
    ? buildFallbackContentStrategy(grammarContext, input, baseConcept)
    : null;
  const concept = contentStrategy?.angle ?? baseConcept;
  const legacyFallbackSlides = buildValidatedFallbackSlides(
    buildCarouselSlidePlan(input),
    analysis,
  );
  const slides = grammarContext
    ? applyGrammarToFallbackSlides(
        legacyFallbackSlides,
        grammarContext,
        contentStrategy!,
      )
    : legacyFallbackSlides;
  const normalizedPlan = { broadSituations, concept, contentStrategy, slides };
  const finalIssues = validateCarouselContentPlan(normalizedPlan, analysis);

  if (finalIssues.length > 0) {
    throw new Error(
      `Deterministic carousel fallback failed validation: ${formatValidationIssues(finalIssues)}`,
    );
  }

  return createContentPlan({
    broadSituations,
    concept,
    contentStrategy,
    fallbackReason: fallbackReason.slice(0, 500),
    model,
    rawLlmResponse,
    slides,
    source: "deterministic-fallback",
    validationResult: {
      finalIssues: [],
      initialIssues,
      ok: true,
      repairAttempted: Boolean(rawLlmResponse.initial),
      repaired: true,
    },
  });
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

function buildValidatedFallbackSlides(
  slides: PlannedCarouselSlide[],
  analysis: WebsiteBusinessAnalysis,
) {
  const analysisText = [
    analysis.category,
    analysis.productSummary,
    analysis.mainProblem,
    analysis.mainPromise,
    ...(analysis.visualKeywords ?? []),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
  const isFitness =
    /\b(calorie|fitness|food|health|meal|nutrition|protein|wellness|workout)\b/.test(
      analysisText,
    );
  const businessName = analysis.businessName?.trim() ?? "";
  const headlines = isFitness
    ? [
        "Make meal logging fit real life",
        "Busy meals create logging gaps",
        "Small estimates blur daily totals",
        "Capture nutrition with less friction",
        "Use today’s meal as your cue",
      ]
    : [
        "Make the next step easier",
        "Scattered updates slow decisions",
        "Missing context creates follow-ups",
        "Keep every decision connected",
        "Choose one next owner",
      ];
  const bodies = isFitness
    ? [
        "Busy meals make detailed logging easy to postpone until the day is already over.",
        "Mixed dishes and changing portions turn simple calorie entries into uncertain estimates.",
        "Portion changes make the weekly picture less reliable.",
        "A faster capture flow keeps meal context together without demanding a rigid routine.",
        "Log dinner now and let the saved entry guide your next choice.",
      ]
    : [
        "Scattered updates make simple work harder to plan and easier to delay.",
        "Separate tools hide the next action when deadlines and approvals start moving.",
        "Incomplete briefs force extra questions before anyone can move the project forward.",
        "One clear workflow keeps decisions beside the tasks they affect.",
        "Assign a current campaign to a single owner before the handoff stalls.",
      ];

  return slides.map((slide, index) => {
    const templateIndex = Math.min(index, bodies.length - 1);
    const body = bodies[templateIndex];
    const shouldHaveHeadline =
      slide.slideType === "hook" ||
      slide.slideType === "solution" ||
      slide.slideType === "cta" ||
      slide.textMode === "headline_body";
    const headline = shouldHaveHeadline ? headlines[templateIndex] : null;

    return {
      ...slide,
      body,
      ctaText:
        slide.slideType === "cta"
          ? sanitizeCtaText(
              slide.ctaText,
              isFitness ? "Log one meal" : "Open one project",
              businessName,
            )
          : null,
      headline,
      listItems: [],
      subtext: body,
      textMode:
        slide.slideType === "cta"
          ? "cta_takeaway"
          : headline
            ? "headline_body"
            : "body_only",
    } satisfies PlannedCarouselSlide;
  });
}

function sanitizeCtaText(
  value: string | null,
  fallback: string,
  businessName: string,
) {
  const normalized = value
    ?.replace(/([!?.,])\1+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  const namedProduct = normalized
    ?.match(/^(?:Get|Install|Open|Start|Try|Use)\s+([A-Z][A-Za-z0-9]+)\b/)?.[1];
  const namedProductMismatch = Boolean(
    namedProduct &&
      !normalizeValidationText(businessName)
        .replace(/\s+/g, "")
        .includes(normalizeValidationText(namedProduct).replace(/\s+/g, "")),
  );

  if (
    !normalized ||
    normalized.length > MAX_CTA_LENGTH ||
    namedProductMismatch ||
    /\b(?:hundreds|thousands|millions|billions) of (?:businesses|creators|customers|people|teams|users)\b/i.test(
      normalized,
    ) ||
    hasGenericCopy(normalized)
  ) {
    return fallback;
  }

  return normalized;
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
    return { layoutPreset: "interactive-list", textPosition: "top" };
  }

  if (textMode === "body_only" || textMode === "single_statement") {
    return { layoutPreset: "caption-cluster", textPosition: "center" };
  }

  if (slideType === "hook") {
    return { layoutPreset: "top-hook", textPosition: "top" };
  }

  if (slideType === "cta" || slideType === "solution") {
    return { layoutPreset: "middle-statement", textPosition: "center" };
  }

  return { layoutPreset: "bottom-message", textPosition: "bottom" };
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

function buildFallbackContentStrategy(
  grammarContext: CarouselGrammarGenerationContext,
  input: CarouselContentPlanInput,
  baseConcept: string,
): ResolvedCarouselContentStrategy {
  const candidateIndex = Math.max(0, input.candidateIndex ?? 0);
  const audience = selectFallbackOption(
    grammarContext.businessContext.audiences,
    candidateIndex,
  );
  const problem = selectFallbackOption(
    grammarContext.businessContext.problems,
    candidateIndex,
  );
  const customerGoal = selectFallbackOption(
    grammarContext.businessContext.customerGoals,
    candidateIndex,
  );
  const recentHistory = normalizeRecentHistory(input.recentHistory);
  const unusedTopics = grammarContext.businessContext.topics.filter(
    (option) =>
      !recentHistory.some((previous) =>
        isSameRecentTopic({
          currentTopic: option.label,
          currentTopicId: option.id,
          previousTopic: previous.topic,
          previousTopicId: previous.topicId,
        }),
      ),
  );
  const topic = selectFallbackOption(
    unusedTopics.length > 0
      ? unusedTopics
      : grammarContext.businessContext.topics,
    candidateIndex,
  );
  const angle = buildFallbackAngle({
    baseConcept,
    customerGoal: customerGoal.label,
    problem: problem.label,
    topic: topic.label,
  });

  return {
    angle,
    audience: audience.label,
    audienceId: audience.id,
    contentFormatId: grammarContext.format.id,
    customerGoal: customerGoal.label,
    customerGoalId: customerGoal.id,
    hookFamilyId: grammarContext.hookFamily.id,
    problem: problem.label,
    problemId: problem.id,
    topic: topic.label,
    topicId: topic.id,
  };
}

function selectFallbackOption(
  options: readonly CarouselBusinessContentOption[],
  candidateIndex: number,
) {
  return options[candidateIndex % options.length]!;
}

function buildFallbackAngle(params: {
  baseConcept: string;
  customerGoal: string;
  problem: string;
  topic: string;
}) {
  const specificAngle = `${params.topic}: ${params.problem} toward ${params.customerGoal}`
    .replace(/\s+/g, " ")
    .trim();

  return (specificAngle || params.baseConcept).slice(0, 160);
}

function applyGrammarToFallbackSlides(
  slides: PlannedCarouselSlide[],
  grammarContext: CarouselGrammarGenerationContext,
  contentStrategy: ResolvedCarouselContentStrategy,
) {
  const listSource = buildFallbackListItemPool(grammarContext.businessContext);

  return slides.map((slide, index) => {
    const definition = grammarContext.format.slides[index]!;
    const requestedTextMode = definition.preferredTextModes.includes(slide.textMode)
      ? slide.textMode
      : definition.preferredTextModes[0]!;
    const listItems = definition.listItemCount
      ? Array.from({ length: definition.listItemCount }, (_, itemIndex) => {
          const priorItemCount = grammarContext.format.slides
            .slice(0, index)
            .reduce(
              (total, priorDefinition) =>
                total + (priorDefinition.listItemCount ?? 0),
              0,
            );
          return listSource[priorItemCount + itemIndex]!.slice(0, 72);
        })
      : [];
    const textMode = definition.listItemCount
      ? requestedTextMode
      : requestedTextMode === "single_statement"
        ? "single_statement"
        : requestedTextMode === "body_only"
          ? "body_only"
          : requestedTextMode;
    const headline =
      textMode === "body_only" || textMode === "single_statement"
        ? null
        : index === 0
          ? buildFallbackHookHeadline(contentStrategy, grammarContext.hookFamily.id)
          : slide.headline;
    const body = definition.listItemCount ? null : slide.body;

    return {
      ...slide,
      ...getLayoutPreset(definition.slideType, textMode),
      body,
      ctaText: definition.slideType === "cta" ? slide.ctaText : null,
      formatRole: definition.role,
      headline,
      listItems,
      slideType: definition.slideType,
      subtext: body,
      textMode,
    } satisfies PlannedCarouselSlide;
  });
}

function buildFallbackListItemPool(
  businessContext: CarouselBusinessContentContext,
) {
  const evidenceLabels = [
    ...businessContext.topics,
    ...businessContext.customerGoals,
    ...businessContext.problems,
  ].map((option) => option.label);
  const genericReferences = [
    "A reusable reference checklist",
    "A practical review prompt",
    "A simple comparison note",
    "A saved example to revisit",
    "A clear next-step reminder",
    "A progress check-in",
    "A useful question for later",
    "A decision note for review",
  ];
  const seen = new Set<string>();

  return [...evidenceLabels, ...genericReferences].filter((label) => {
    const key = normalizeValidationText(label);

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildFallbackHookHeadline(
  contentStrategy: ResolvedCarouselContentStrategy,
  hookFamilyId: CarouselHookFamilyId,
) {
  const topic = contentStrategy.topic
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .join(" ");
  const candidate =
    hookFamilyId === "question" || hookFamilyId === "comparison"
      ? `What makes ${topic} work better?`
      : hookFamilyId === "beginner"
        ? `Start with these ${topic} basics`
        : hookFamilyId === "mistake"
          ? `Avoid these common ${topic} mistakes`
          : hookFamilyId === "surprise" || hookFamilyId === "contrarian"
            ? `${topic} has a less obvious pattern`
            : `A practical guide to ${topic}`;

  return candidate.split(/\s+/).slice(0, MAX_HEADLINE_WORDS).join(" ").slice(0, MAX_HEADLINE_LENGTH);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
