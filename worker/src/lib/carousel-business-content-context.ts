import type { WebsiteBusinessAnalysis } from "../types.js";

export type CarouselBusinessContentOption = {
  id: string;
  label: string;
};

export type CarouselBusinessContentContext = {
  audiences: CarouselBusinessContentOption[];
  brand: {
    businessName: string;
    businessModel: "b2b" | "b2c" | "both" | null;
    campaignPurposes: string[];
    claimsToAvoid: string[];
    ctaIdeas: string[];
    differentiators: string[];
    productSummary: string;
    tone: string | null;
  };
  customerGoals: CarouselBusinessContentOption[];
  problems: CarouselBusinessContentOption[];
  topics: CarouselBusinessContentOption[];
};

export function buildCarouselBusinessContentContext(
  analysis: WebsiteBusinessAnalysis,
): CarouselBusinessContentContext {
  const businessName = cleanString(analysis.businessName) || "the business";
  const productSummary =
    cleanString(analysis.productSummary) ||
    cleanString(analysis.mainPromise) ||
    `${businessName} helps its intended audience.`;
  const audiences = buildOptions(
    "audience",
    analysis.targetAudience ?? [],
    [`People who may benefit from ${businessName}`],
    8,
  );
  const problems = buildOptions(
    "problem",
    [analysis.mainProblem, ...(analysis.painPoints ?? [])],
    ["The audience needs a clearer way to make progress"],
    10,
  );
  const customerGoals = buildOptions(
    "goal",
    [analysis.mainPromise, ...(analysis.valueProps ?? [])],
    [`Make progress with ${businessName}`],
    10,
  );
  const topics = buildOptions(
    "topic",
    [
      analysis.category,
      ...(analysis.categories ?? []),
      ...(analysis.visualKeywords ?? []),
      ...(analysis.carouselAngles ?? []),
    ],
    [cleanString(analysis.category) || productSummary],
    12,
  );

  return {
    audiences,
    brand: {
      businessName,
      businessModel: analysis.businessModel ?? null,
      campaignPurposes: cleanStrings(
        (analysis.campaignPurposes ?? []).map(getCampaignPurposeLabel),
        5,
      ),
      claimsToAvoid: cleanStrings(analysis.claimsToAvoid ?? [], 8),
      ctaIdeas: cleanStrings(analysis.ctaIdeas ?? [], 8),
      differentiators: cleanStrings(analysis.differentiators ?? [], 8),
      productSummary,
      tone: cleanString(analysis.brandTone) || null,
    },
    customerGoals,
    problems,
    topics,
  };
}

function getCampaignPurposeLabel(value: string) {
  switch (value) {
    case "app_install":
      return "Encourage app installs";
    case "conversion":
      return "Support conversion";
    case "education":
      return "Educate the audience";
    case "product_discovery":
      return "Help people discover the product";
    case "retargeting":
      return "Reconnect with interested people";
    default:
      return value;
  }
}

export function resolveCarouselBusinessContentOption(
  options: readonly CarouselBusinessContentOption[],
  id: string,
  label: string,
) {
  const option = options.find((candidate) => candidate.id === id);

  if (!option) {
    throw new Error(`Carousel content plan selected an unknown ${label} id.`);
  }

  return option;
}

function buildOptions(
  prefix: string,
  values: readonly (string | null | undefined)[],
  fallbackValues: readonly string[],
  maximum: number,
) {
  const cleaned = cleanStrings(values, maximum);
  const source = cleaned.length > 0 ? cleaned : cleanStrings(fallbackValues, maximum);

  return source.map((label) => ({
    id: `${prefix}_${slugify(label).slice(0, 42) || "option"}_${hashString(label)
      .toString(36)
      .slice(0, 6)}`,
    label,
  }));
}

function cleanStrings(
  values: readonly (string | null | undefined)[],
  maximum: number,
) {
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const value of values) {
    const item = cleanString(value);
    const key = item.toLowerCase();

    if (!item || seen.has(key)) {
      continue;
    }

    seen.add(key);
    cleaned.push(item.slice(0, 240));

    if (cleaned.length >= maximum) {
      break;
    }
  }

  return cleaned;
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function hashString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
