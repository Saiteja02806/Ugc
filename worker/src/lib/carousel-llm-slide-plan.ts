import OpenAI from "openai";

import type { WebsiteBusinessAnalysis } from "../types.js";
import { buildCarouselSlidePlan } from "./carousel-slide-plan.js";
import type {
  CarouselTextMode,
  PlannedCarouselSlide,
} from "./carousel-slide-plan.js";

export const CAROUSEL_CONTENT_PLANNER_VERSION =
  "llm-carousel-planner-v4-optional-headline-repair";

const DEFAULT_MODEL = "gpt-4o-mini";
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
  fallbackReason: string | null;
  model: string | null;
  normalizedPlan: {
    broadSituations: string[];
    concept: string;
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
    | "repeated_punctuation"
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
  goal?: string | null;
  selectedAngle?: string | null;
  slideCount: number;
};

export async function buildCarouselContentPlan(
  input: CarouselContentPlanInput,
): Promise<CarouselContentPlan> {
  const slideCount = clampSlideCount(input.slideCount);
  const model =
    process.env.OPENAI_CAROUSEL_PLANNER_MODEL?.trim() || DEFAULT_MODEL;
  let initialRawResponse: string | null = null;
  let repairRawResponse: string | null = null;
  let initialIssues: CarouselPlanValidationIssue[] = [];

  if (process.env.CAROUSEL_CONTENT_PLANNER_MODE?.trim() === "deterministic") {
    return buildFallbackPlan(
      input,
      "LLM planning was disabled by CAROUSEL_CONTENT_PLANNER_MODE.",
      { initial: null, repair: null },
      [],
      null,
    );
  }

  try {
    const completion = await getOpenAIClient().chat.completions.create({
      max_completion_tokens: 1_800,
      messages: buildPlannerMessages({ ...input, slideCount }),
      model,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "carousel_content_plan",
          schema: buildCarouselContentPlanSchema(slideCount),
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
      );
      initialIssues = validateCarouselContentPlan(
        normalizedPlan,
        input.analysis,
      );
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
        issues: initialIssues,
        rawResponse: initialRawResponse,
        slideCount,
      }),
      model,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "repaired_carousel_content_plan",
          schema: buildCarouselContentPlanSchema(slideCount),
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
      ),
    );
    const finalIssues = validateCarouselContentPlan(
      repairedPlan,
      input.analysis,
    );

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
    return buildFallbackPlan(input, getErrorMessage(error), {
      initial: initialRawResponse,
      repair: repairRawResponse,
    }, initialIssues, model);
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

  if (!Array.isArray(record.slides) || record.slides.length !== slideCount) {
    throw new Error(`Carousel plan must contain exactly ${slideCount} slides.`);
  }

  const seenHeadlines = new Set<string>();
  const slides = record.slides.map((slideValue, index) => {
    const slide = asRecord(slideValue, `slide ${index + 1}`);
    const slideNumber = getInteger(slide.slideNumber, `slide ${index + 1} number`);
    const slideType = getSlideType(slide.slideType, `slide ${index + 1} type`);
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

    if (index === slideCount - 1 && slideType !== "cta") {
      throw new Error("The final carousel slide must be a CTA.");
    }

    if (index < slideCount - 1 && ctaText !== null) {
      throw new Error("Only the final carousel slide may include CTA text.");
    }

    if (index === slideCount - 1 && ctaText === null) {
      throw new Error("The final carousel slide must include CTA text.");
    }

    if (hasProhibitedVisualSubject(imageDirection)) {
      throw new Error(
        `Slide ${index + 1} image direction includes a prohibited human subject.`,
      );
    }

    const textMode = normalizeTextMode({
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
      textMode,
    })
      ? null
      : parsedHeadline
        ? normalizeHeadlineCase(parsedHeadline)
        : null;
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
      headline,
      imageDirection,
      listItems,
      slideNumber,
      slideType,
      subtext: body,
      textMode,
    } satisfies PlannedCarouselSlide;
  });

  return { broadSituations, concept, slides };
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
  if (!params.headline || params.slideType === "hook" || params.slideType === "cta") {
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

  return overlap / headlineTokens.size >= 0.72;
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

export function validateCarouselContentPlan(
  plan: Pick<CarouselContentPlan, "broadSituations" | "concept" | "slides">,
  analysis?: WebsiteBusinessAnalysis,
) {
  const issues: CarouselPlanValidationIssue[] = [];
  const priorSlideCopy: Array<{ slideNumber: number; text: string }> = [];
  const claimsToAvoid = (analysis?.claimsToAvoid ?? [])
    .map(normalizeValidationText)
    .filter(Boolean);

  for (const slide of plan.slides) {
    const texts = [
      slide.headline,
      slide.body,
      slide.ctaText,
      ...(slide.listItems ?? []),
    ].filter((value): value is string => Boolean(value));

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

        return (
          /\b(always|best|guarantee|guaranteed|never|perfect|number one|100 percent)\b/.test(
            normalizedText,
          ) ||
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

    if (
      slide.headline &&
      slide.body &&
      getTokenOverlap(slide.headline, slide.body) >= 0.7
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
  return /\b(boost your productivity|efficiently|effortlessly|game changer|make every day count|next level|one workspace for everything|save time(?: faster)?|seamless(?:ly)?|stay on top|streamline your workflow|unify your (?:planning and reporting|workflow)|unlock efficiency|with ease|work smarter)\b/i.test(
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

function buildPlannerMessages(input: CarouselContentPlanInput & { slideCount: number }) {
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

function buildRepairMessages(params: {
  analysis: WebsiteBusinessAnalysis;
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
        "Every headline is optional; when present it must be 3-8 words, at most 50 characters, and at most two visual lines.",
        "Every body must be one complete, specific sentence of 8-20 words and at most 120 characters.",
        "List modes may use at most four total visual lines.",
        "Remove repeated punctuation, fragments, generic copy, unsupported claims, repeated ideas, headline/body repetition, and grammar errors.",
        "Never use these phrases: boost productivity, efficiently, effortlessly, seamless, streamline your workflow, unify your planning and reporting, unlock efficiency, with ease, next level, one workspace for everything, save time, stay on top, or work smarter.",
        "If a headline repeats its body, set headline to null and use body_only instead of paraphrasing it.",
        "The final slide must use slideType cta and include a non-null ctaText.",
        "Keep one clear story: hook, friction, consequence, solution, useful result or CTA.",
        "Validation failures:",
        JSON.stringify(params.issues),
        "Business analysis:",
        JSON.stringify(params.analysis),
        "Original JSON response:",
        params.rawResponse,
      ].join("\n"),
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
        usableHeadline && body && getTokenOverlap(usableHeadline, body) >= 0.7
          ? null
          : usableHeadline;
      const textMode =
        slide.textMode === "question_list" || slide.textMode === "checklist"
          ? slide.textMode
          : slide.slideType === "cta"
            ? "cta_takeaway"
            : headline
              ? slide.textMode
              : "body_only";

      return {
        ...slide,
        ...getLayoutPreset(slide.slideType, textMode),
        body,
        ctaText:
          slide.slideType === "cta"
            ? repairCtaText(slide.ctaText)
            : slide.ctaText,
        headline,
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
    .replace(/\bunify your (?:planning and reporting|workflow)\b/gi, "connect campaign plans and reports")
    .replace(/\bwith ease\b/gi, "with clear next steps")
    .replace(/\s+/g, " ")
    .trim();

  if (sentence) {
    repaired = repaired.charAt(0).toUpperCase() + repaired.slice(1);

    if (!/[.?!]$/.test(repaired)) {
      repaired = `${repaired}.`;
    }

    if (countWords(repaired) < MIN_REQUIRED_BODY_WORDS) {
      const punctuation = repaired.match(/[.?!]$/)?.[0] ?? ".";
      const suffix =
        punctuation === "?"
          ? "during campaign planning"
          : slideType === "cta"
            ? "with clearer next steps"
            : "for clearer campaign decisions";
      repaired = `${repaired.replace(/[.?!]+$/, "")} ${suffix}${punctuation}`;
    }
  }

  return repaired;
}

function buildCarouselContentPlanSchema(slideCount: number) {
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
    required: ["broadSituations", "concept", "slides"],
    type: "object",
  } as const;
}

function buildFallbackPlan(
  input: CarouselContentPlanInput,
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
  const concept =
    input.selectedAngle?.trim() ||
    analysis.carouselAngles?.[Math.max(0, input.candidateIndex ?? 0)]?.trim() ||
    analysis.mainPromise?.trim() ||
    "A clearer path from everyday friction to the next action";
  const slides = buildValidatedFallbackSlides(
    buildCarouselSlidePlan(input),
    analysis,
  );
  const normalizedPlan = { broadSituations, concept, slides };
  const finalIssues = validateCarouselContentPlan(normalizedPlan, analysis);

  if (finalIssues.length > 0) {
    throw new Error(
      `Deterministic carousel fallback failed validation: ${formatValidationIssues(finalIssues)}`,
    );
  }

  return createContentPlan({
    broadSituations,
    concept,
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
  const headlines = isFitness
    ? [
        "Make meal logging fit real life",
        "Busy meals create logging gaps",
        "Small guesses weaken daily totals",
        "Capture nutrition with less friction",
        "Start with one real meal",
      ]
    : [
        "Make the next step easier",
        "Scattered updates slow decisions",
        "Missing context creates more follow-ups",
        "Keep every decision connected",
        "Start with one active project",
      ];
  const bodies = isFitness
    ? [
        "Busy meals make detailed logging easy to postpone until the day is already over.",
        "Mixed dishes and changing portions turn simple calorie entries into uncertain guesses.",
        "Those small guesses make daily totals harder to trust when patterns start to matter.",
        "Faster meal capture keeps nutrition context together without demanding a rigid routine.",
        "Log one real meal today and use the result to guide your next choice.",
      ]
    : [
        "Scattered updates make simple work harder to plan and easier to delay.",
        "Separate tools hide the next action when deadlines and approvals start moving.",
        "Missing context creates extra follow-ups before anyone can move the work forward.",
        "One clear workflow keeps each decision beside the work it affects.",
        "Choose a current campaign and assign a clear owner to its next action.",
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
          ? sanitizeCtaText(slide.ctaText, isFitness ? "Log one meal" : "Open one project")
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

function sanitizeCtaText(value: string | null, fallback: string) {
  const normalized = value
    ?.replace(/([!?.,])\1+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized || normalized.length > MAX_CTA_LENGTH || hasGenericCopy(normalized)) {
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

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  const shortened = value.slice(0, maxLength - 1).trimEnd();
  const lastSpace = shortened.lastIndexOf(" ");

  return `${shortened.slice(0, lastSpace > 24 ? lastSpace : shortened.length).trimEnd()}.`;
}

function clampSlideCount(value: number) {
  return Math.min(Math.max(Math.trunc(value), 1), 10);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
