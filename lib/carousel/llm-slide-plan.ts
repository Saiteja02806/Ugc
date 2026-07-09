import "server-only";

import OpenAI from "openai";

import { buildCarouselSlidePlan } from "@/lib/carousel/slide-plan";
import type {
  CarouselTextMode,
  PlannedCarouselSlide,
} from "@/lib/carousel/slide-plan";
import type { WebsiteBusinessAnalysis } from "@/lib/website-analysis/schema";

export const CAROUSEL_CONTENT_PLANNER_VERSION = "llm-carousel-planner-v1";

const DEFAULT_MODEL = "gpt-4o-mini";
const MAX_BODY_LENGTH = 190;
const MAX_HEADLINE_LENGTH = 72;
const MAX_CTA_LENGTH = 34;
const MAX_IMAGE_DIRECTION_LENGTH = 180;
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
  plannerVersion: string;
  slides: PlannedCarouselSlide[];
  source: "deterministic-fallback" | "llm";
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

  if (process.env.CAROUSEL_CONTENT_PLANNER_MODE?.trim() === "deterministic") {
    return buildFallbackPlan(
      input,
      "LLM planning was disabled by CAROUSEL_CONTENT_PLANNER_MODE.",
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
    const rawContent = completion.choices[0]?.message.content;

    if (!rawContent) {
      throw new Error("OpenAI returned no carousel plan content.");
    }

    return {
      ...parseCarouselContentPlan(JSON.parse(rawContent), slideCount),
      fallbackReason: null,
      model,
      plannerVersion: CAROUSEL_CONTENT_PLANNER_VERSION,
      source: "llm",
    };
  } catch (error) {
    return buildFallbackPlan(input, getErrorMessage(error));
  }
}

export function parseCarouselContentPlan(
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
      5,
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
        "- Start with a hook and end with a CTA, but choose the middle story roles based on the concept instead of repeating a fixed template.",
        "- Slide role semantics are strict: problem describes friction, solution explains the supported mechanism or better process, benefit states the resulting outcome, and differentiator states a supported reason this product is distinct.",
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
        "- Headline style must feel like social carousel overlay copy: 2-7 words, punchy, concrete, lowercase or sentence case, never title-case blog headings.",
        "- Good headline examples for a calorie tracker: consistency dies fast, you're just guessing, it's way too slow, tracking should be effortless.",
        "- Avoid abstract headline labels such as tracking fatigue sets in, inaccurate portions lead to frustration, unlock efficiency, or take it to the next level.",
        "- Body copy should be 8-28 words, plain, connected to the previous slide, and strong enough to stand alone when textMode is body_only.",
        "- For question_list and checklist, use 3-5 short listItems and keep body null unless a short setup line is needed.",
        "- Headlines must be punchy and concrete. Avoid generic phrases such as boost productivity, streamline your business, unlock efficiency, or take it to the next level.",
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
              maxItems: 5,
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
): CarouselContentPlan {
  const analysis = input.analysis;
  const broadSituations = [
    ...(analysis.painPoints ?? []),
    ...(analysis.visualKeywords ?? []),
    ...(analysis.pexelsImageQueries ?? []),
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 8);
  const concept =
    input.selectedAngle?.trim() ||
    analysis.carouselAngles?.[Math.max(0, input.candidateIndex ?? 0)]?.trim() ||
    analysis.mainPromise?.trim() ||
    "A clearer path from everyday friction to the next action";

  return {
    broadSituations,
    concept,
    fallbackReason: fallbackReason.slice(0, 500),
    model: null,
    plannerVersion: CAROUSEL_CONTENT_PLANNER_VERSION,
    slides: buildCarouselSlidePlan(input),
    source: "deterministic-fallback",
  };
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

  return truncateText(value.trim().replace(/\s+/g, " "), maxLength);
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
