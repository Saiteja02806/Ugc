import type { WebsiteBusinessAnalysis } from "../types.js";

export type CarouselTextMode =
  | "body_only"
  | "checklist"
  | "cta_takeaway"
  | "headline_body"
  | "question_list"
  | "single_statement";

export type PlannedCarouselSlide = {
  body: string | null;
  ctaText: string | null;
  formatRole?: string | null;
  headline: string | null;
  imageDirection: string;
  layoutPreset:
    | "bottom-message"
    | "caption-cluster"
    | "interactive-list"
    | "middle-statement"
    | "top-hook";
  listItems: string[];
  slideNumber: number;
  slideType: "benefit" | "cta" | "differentiator" | "hook" | "problem" | "solution";
  subtext: string | null;
  textMode: CarouselTextMode;
  textPosition: "bottom" | "center" | "top";
};

type CarouselSlideType = PlannedCarouselSlide["slideType"];

const DEFAULT_FALLBACK_HEADLINES = [
  "The busywork is stealing your best hours",
  "Scattered tools make simple work feel slow",
  "Bring every next step into one clear system",
  "Give the team back time for real work",
  "Ship cleaner campaigns without manual follow-up",
  "Turn the next visitor into a qualified signup",
];

const FITNESS_HEALTH_FALLBACK_HEADLINES = [
  "Consistency breaks when tracking takes too much",
  "Logging meals should not feel like homework",
  "Make food tracking fit real life",
  "Stay consistent without perfect routines",
  "Built around everyday meals",
  "Start with one easier food log",
];

const GENERIC_PHRASE_REWRITES: Array<[RegExp, string]> = [
  [/boost your productivity/gi, "give your team back focused time"],
  [/improve your workflow/gi, "clean up the steps that slow work down"],
  [/streamline your business/gi, "remove the manual steps between idea and launch"],
  [/unlock efficiency/gi, "cut the repeat work your team keeps doing"],
  [
    /take (it|your business|your workflow) to the next level/gi,
    "make the next step easier to act on",
  ],
  [/drive signups/gi, "turn more visitors into qualified signups"],
];

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function cleanList(values: unknown) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.map(cleanText).filter(Boolean);
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  const sliced = value.slice(0, maxLength - 1).trimEnd();
  const lastSpace = sliced.lastIndexOf(" ");
  const shortened = sliced
    .slice(0, lastSpace > 32 ? lastSpace : sliced.length)
    .trimEnd();

  return `${trimDanglingEnding(shortened)}.`;
}

function capitalizeSentence(value: string) {
  const trimmed = value.trim();

  return trimmed ? `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}` : "";
}

function trimDanglingEnding(value: string) {
  return value
    .replace(/\s+(and|or|with|for|to|of|the|a|an|in|on|at|by|from)$/i, "")
    .replace(/\s+(and|or|with)\s+[\w-]{1,16}$/i, "")
    .trim();
}

function pick(values: string[], index: number, fallback: string) {
  if (values.length === 0) {
    return fallback;
  }

  return values[index % values.length] ?? fallback;
}

function improveWeakPhrase(value: string) {
  let improvedValue = value;

  for (const [pattern, replacement] of GENERIC_PHRASE_REWRITES) {
    improvedValue = improvedValue.replace(pattern, replacement);
  }

  value = improvedValue;
  const lowerValue = value.toLowerCase();

  if (lowerValue === "automate your work" || lowerValue === "automate work") {
    return "Automate the work that wastes your day";
  }

  if (lowerValue === "drive signups") {
    return "Turn more visitors into qualified signups";
  }

  if (lowerValue.includes("increase productivity")) {
    return "Give your team hours back every week";
  }

  if (
    lowerValue.includes(
      "centralize and automate work with ai-powered workspace",
    )
  ) {
    return "Centralize every workflow with AI agents";
  }

  if (lowerValue.includes("save time")) {
    return value.replace(/save time/i, "Save the hours lost to busywork");
  }

  return value;
}

function cleanHeadline(value: string) {
  return capitalizeSentence(
    truncateText(improveWeakPhrase(value).replace(/\s+/g, " "), 72),
  );
}

function cleanSupport(value: string | null) {
  if (!value) {
    return null;
  }

  const support = capitalizeSentence(
    truncateText(improveWeakPhrase(value).replace(/\s+/g, " "), 230),
  );

  if (support.split(/\s+/).filter(Boolean).length < 10) {
    return null;
  }

  return support;
}

function cleanSupportOrFallback(value: string | null, fallback: string) {
  return cleanSupport(value) ?? cleanSupport(fallback);
}

function cleanCtaText(value: string) {
  return capitalizeSentence(
    truncateText(improveWeakPhrase(value).replace(/\s+/g, " "), 34),
  );
}

function getAnalysisText(analysis: WebsiteBusinessAnalysis) {
  return [
    analysis.category,
    analysis.productSummary,
    analysis.mainProblem,
    analysis.mainPromise,
    ...(analysis.visualKeywords ?? []),
    ...(analysis.pexelsImageQueries ?? []),
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
}

function isFitnessHealthAnalysis(analysis: WebsiteBusinessAnalysis) {
  return /\b(calorie|calories|fitness|food|health|meal|nutrition|protein|wellness|workout)\b/.test(
    getAnalysisText(analysis),
  );
}

function getFallbackHeadlines(analysis: WebsiteBusinessAnalysis) {
  return isFitnessHealthAnalysis(analysis)
    ? FITNESS_HEALTH_FALLBACK_HEADLINES
    : DEFAULT_FALLBACK_HEADLINES;
}

function getBodyOnlyFallback(primary: string, fallback: string) {
  return cleanSupport(primary) ?? cleanSupport(fallback) ?? fallback;
}

function getSignalTokens(value: string) {
  const stopWords = new Set([
    "a",
    "an",
    "and",
    "are",
    "by",
    "for",
    "from",
    "in",
    "into",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
    "your",
  ]);

  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

function isTooSimilar(value: string, previousValue: string) {
  const valueTokens = new Set(getSignalTokens(value));
  const previousTokens = new Set(getSignalTokens(previousValue));

  if (valueTokens.size === 0 || previousTokens.size === 0) {
    return false;
  }

  let overlap = 0;

  for (const token of valueTokens) {
    if (previousTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap >= Math.max(3, Math.min(valueTokens.size, previousTokens.size) - 1);
}

function getStoryTypes(slideCount: number): CarouselSlideType[] {
  if (slideCount <= 3) {
    const compactStory: CarouselSlideType[] = ["hook", "solution", "cta"];

    return compactStory.slice(0, slideCount);
  }

  if (slideCount === 4) {
    return ["hook", "problem", "solution", "cta"];
  }

  if (slideCount === 5) {
    return ["hook", "problem", "problem", "solution", "cta"];
  }

  return [
    "hook",
    "problem",
    "problem",
    "solution",
    "benefit",
    "cta",
    ...Array.from(
      { length: Math.max(0, slideCount - 6) },
      (_, index): CarouselSlideType =>
        index % 2 === 0 ? "benefit" : "differentiator",
    ),
  ];
}

function getPreset(
  slideType: PlannedCarouselSlide["slideType"],
  index: number,
): Pick<PlannedCarouselSlide, "layoutPreset" | "textPosition"> {
  if (slideType === "hook") {
    return index % 2 === 0
      ? { layoutPreset: "top-hook", textPosition: "top" }
      : { layoutPreset: "middle-statement", textPosition: "center" };
  }

  if (slideType === "solution" || slideType === "cta") {
    return { layoutPreset: "middle-statement", textPosition: "center" };
  }

  return { layoutPreset: "bottom-message", textPosition: "bottom" };
}

export function buildCarouselSlidePlan(params: {
  analysis: WebsiteBusinessAnalysis;
  candidateIndex?: number;
  goal?: string | null;
  selectedAngle?: string | null;
  slideCount: number;
}) {
  const analysis = params.analysis;
  const businessName = cleanText(analysis.businessName) || "this workflow";
  const valueProps = cleanList(analysis.valueProps);
  const painPoints = cleanList(analysis.painPoints);
  const differentiators = cleanList(analysis.differentiators);
  const audience = cleanList(analysis.targetAudience);
  const ctaIdeas = cleanList(analysis.ctaIdeas);
  const carouselAngles = cleanList(analysis.carouselAngles);
  const mainProblem = cleanText(analysis.mainProblem);
  const mainPromise = cleanText(analysis.mainPromise);
  const selectedAngle = cleanText(params.selectedAngle);
  const goal = cleanText(params.goal);
  const candidateIndex = Math.max(0, params.candidateIndex ?? 0);
  const slideCount = Math.min(Math.max(params.slideCount, 1), 10);
  const storyTypes = getStoryTypes(slideCount);
  const usedHeadlines: string[] = [];
  const isFitnessHealth = isFitnessHealthAnalysis(analysis);
  const fallbackHeadlines = getFallbackHeadlines(analysis);
  const hookAudienceFallback = isFitnessHealth
    ? `For people trying to keep ${businessName} consistent while dealing with busy days, mixed portions, and routines that never stay perfect.`
    : `For teams evaluating ${businessName} while too many updates, files, and follow-ups compete for attention during real campaign work.`;
  const hookSupportFallback = isFitnessHealth
    ? "Built for real meals, busy days, and imperfect routines, so tracking can feel useful without demanding a perfect schedule."
    : "Built for teams tired of manual busywork, scattered reporting, and the slow handoffs that make simple launches harder than they should be.";
  const problemSupportFallback = isFitnessHealth
    ? "Small food decisions become harder to track when meals are mixed, portions change, and the day gets too busy to log carefully."
    : "The old process creates extra work because planning, approvals, reminders, and reporting live in different places that do not stay aligned.";
  const solutionSupportFallback = isFitnessHealth
    ? "Use a system that understands mixed dishes, flexible portions, and the way people actually eat during busy days."
    : "Bring the scattered steps into one clearer workflow so the next action is easier to find before the launch slows down.";
  const benefitSupportFallback = isFitnessHealth
    ? "When logging takes less effort, it becomes easier to track regularly and use the information to make better choices."
    : "When every follow-up and report has a clear place, the team can move faster without adding another tool to check.";
  const differentiatorSupportFallback = isFitnessHealth
    ? "Designed around real eating habits, not perfect days, so the routine survives takeout, leftovers, restaurant meals, and rushed weeks."
    : "Designed around the way modern teams work, where campaign context, next steps, and reporting need to stay connected.";
  const ctaSupportFallback = isFitnessHealth
    ? "Start with one easier food log, then keep building a routine that stays useful during the week you actually live."
    : "Start with one cleaner campaign workflow, then keep the next launch organized from planning through reporting.";

  function distinctHeadline(value: string, fallback: string) {
    const cleaned = cleanHeadline(value || fallback);
    const fallbackHeadline = cleanHeadline(fallback);
    const headline = usedHeadlines.some((usedHeadline) =>
      isTooSimilar(cleaned, usedHeadline),
    )
      ? fallbackHeadline
      : cleaned;

    usedHeadlines.push(headline);

    return headline;
  }

  return storyTypes.map((slideType, index) => {
    const sourceIndex = candidateIndex + index;
    const preset = getPreset(slideType, sourceIndex);
    const slideNumber = index + 1;

    if (slideType === "hook") {
      const body = cleanSupportOrFallback(
        pick(audience, candidateIndex, hookAudienceFallback),
        hookSupportFallback,
      );

      return {
        ...preset,
        body,
        ctaText: null,
        headline: distinctHeadline(
          selectedAngle ||
            pick(
              carouselAngles,
              candidateIndex,
              mainPromise || fallbackHeadlines[0],
            ),
          fallbackHeadlines[0],
        ),
        imageDirection:
          "Use a clean premium image with open space for a strong hook.",
        listItems: [],
        slideNumber,
        slideType,
        subtext: body,
        textMode: "headline_body",
      } satisfies PlannedCarouselSlide;
    }

    if (slideType === "problem") {
      const body = getBodyOnlyFallback(
        [
          mainProblem,
          pick(painPoints, sourceIndex + 1, problemSupportFallback),
        ]
          .filter(Boolean)
          .join(". "),
        problemSupportFallback,
      );

      return {
        ...preset,
        body,
        ctaText: null,
        headline: null,
        imageDirection: "Show the everyday friction before the product helps.",
        listItems: [],
        slideNumber,
        slideType,
        subtext: body,
        textMode: "body_only",
      } satisfies PlannedCarouselSlide;
    }

    if (slideType === "solution") {
      const body = cleanSupportOrFallback(
        pick(
          valueProps,
          sourceIndex + 1,
          solutionSupportFallback,
        ),
        solutionSupportFallback,
      );

      return {
        ...preset,
        body,
        ctaText: null,
        headline: distinctHeadline(
          mainPromise || pick(valueProps, sourceIndex, fallbackHeadlines[2]),
          fallbackHeadlines[2],
        ),
        imageDirection: "Show a simpler organized result after using the product.",
        listItems: [],
        slideNumber,
        slideType,
        subtext: body,
        textMode: "headline_body",
      } satisfies PlannedCarouselSlide;
    }

    if (slideType === "benefit") {
      const body = getBodyOnlyFallback(
        pick(valueProps, sourceIndex, fallbackHeadlines[3]),
        benefitSupportFallback,
      );

      return {
        ...preset,
        body,
        ctaText: null,
        headline: null,
        imageDirection:
          "Use a confident visual with room for one benefit statement.",
        listItems: [],
        slideNumber,
        slideType,
        subtext: body,
        textMode: "body_only",
      } satisfies PlannedCarouselSlide;
    }

    if (slideType === "differentiator") {
      const body = cleanSupportOrFallback(
        pick(
          differentiators,
          sourceIndex + 1,
          differentiatorSupportFallback,
        ),
        differentiatorSupportFallback,
      );

      return {
        ...preset,
        body,
        ctaText: null,
        headline: distinctHeadline(
          pick(differentiators, sourceIndex, fallbackHeadlines[4]),
          fallbackHeadlines[4],
        ),
        imageDirection:
          "Show a polished detail that makes the product feel distinct.",
        listItems: [],
        slideNumber,
        slideType,
        subtext: body,
        textMode: "headline_body",
      } satisfies PlannedCarouselSlide;
    }

    const ctaText = cleanCtaText(pick(ctaIdeas, candidateIndex, `Try ${businessName}`));
    const ctaBody = cleanSupportOrFallback(
      goal || mainPromise || pick(valueProps, sourceIndex, ctaSupportFallback),
      ctaSupportFallback,
    );

    return {
      ...preset,
      body: ctaBody,
      ctaText,
      headline: distinctHeadline(
        goal || mainPromise || fallbackHeadlines[5],
        fallbackHeadlines[5],
      ),
      imageDirection:
        "End with a clear product-forward visual and simple next step.",
      listItems: [],
      slideNumber,
      slideType,
      subtext: ctaBody,
      textMode: "cta_takeaway",
    } satisfies PlannedCarouselSlide;
  });
}
