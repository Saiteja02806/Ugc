export const TRENDING_HOOK_PATTERN_LIBRARY_VERSION =
  "trending-hook-patterns-v3";

export type TrendingHookCampaignPurpose =
  | "product_discovery"
  | "education"
  | "conversion"
  | "retargeting"
  | "app_install";

export type TrendingHookIndustryPackId =
  | "mobile_app"
  | "ecommerce"
  | "saas"
  | "agency_services"
  | "health_wellness"
  | "finance"
  | "education"
  | "food_hospitality"
  | "general";

export type TrendingHookPatternId =
  | "mystery_discovery"
  | "direct_capability"
  | "problem_observation"
  | "skeptical_challenge"
  | "problem_reversal"
  | "workflow_exposed"
  | "outcome_without_friction"
  | "professional_transformation";

export type TrendingHookPatternDefinition = {
  id: TrendingHookPatternId;
  name: string;
  instruction: string;
  preferredPurposes: readonly TrendingHookCampaignPurpose[];
  preferredReactions: readonly string[];
};

export type TrendingHookIndustryContext = {
  avoidAssumptions: string;
  focus: string;
  id: TrendingHookIndustryPackId;
  label: string;
  preferredPatterns: readonly TrendingHookPatternId[];
};

export type HookPerformanceSignals = {
  preferredPatternIds?: readonly TrendingHookPatternId[];
  preferredPurposes?: readonly TrendingHookCampaignPurpose[];
};

/**
 * These are structural writing directions, not reusable sentences. Risky
 * families that depend on numbers, personal history, humor, or a visible demo
 * stay out of the registry until those facts are explicitly verified.
 */
export const TRENDING_HOOK_PATTERNS = [
  {
    id: "mystery_discovery",
    name: "Mystery discovery",
    instruction:
      "Reveal one surprising business truth while leaving a small, honest information gap.",
    preferredPurposes: ["product_discovery", "retargeting"],
    preferredReactions: [
      "shock_surprise",
      "curiosity_discovery",
      "confusion_skepticism",
      "secret_reveal",
    ],
  },
  {
    id: "direct_capability",
    name: "Direct capability",
    instruction:
      "State one concrete product capability in native, non-advertising language.",
    preferredPurposes: ["conversion", "app_install", "product_discovery"],
    preferredReactions: [
      "confidence_approval",
      "focused_attention",
      "curiosity_discovery",
      "amusement_laughter",
    ],
  },
  {
    id: "problem_observation",
    name: "Problem observation",
    instruction:
      "Name one specific audience problem they immediately recognize. Stop after the observation; do not explain the product or add a benefit.",
    preferredPurposes: ["education", "retargeting"],
    preferredReactions: [
      "concern_anxiety",
      "shock_surprise",
      "confusion_skepticism",
    ],
  },
  {
    id: "skeptical_challenge",
    name: "Skeptical challenge",
    instruction:
      "Voice the audience's real doubt as a sharp challenge without making an unsupported promise.",
    preferredPurposes: ["retargeting", "conversion", "education"],
    preferredReactions: [
      "confusion_skepticism",
      "concern_anxiety",
      "focused_attention",
    ],
  },
  {
    id: "problem_reversal",
    name: "Problem reversal",
    instruction:
      "Reframe the assumed cause of the problem using only facts present in the Business Profile.",
    preferredPurposes: ["education", "product_discovery"],
    preferredReactions: [
      "shock_surprise",
      "concern_anxiety",
      "confusion_skepticism",
      "curiosity_discovery",
    ],
  },
  {
    id: "workflow_exposed",
    name: "Workflow exposed",
    instruction:
      "Expose one unnecessarily difficult step or habit in the audience's current workflow.",
    preferredPurposes: ["education", "retargeting"],
    preferredReactions: [
      "concern_anxiety",
      "confusion_skepticism",
      "focused_attention",
      "secret_reveal",
    ],
  },
  {
    id: "outcome_without_friction",
    name: "Outcome without friction",
    instruction:
      "Contrast the desired outcome with one real friction point, without promising a result.",
    preferredPurposes: ["conversion", "product_discovery", "app_install"],
    preferredReactions: [
      "amusement_laughter",
      "confidence_approval",
      "curiosity_discovery",
      "shock_surprise",
    ],
  },
  {
    id: "professional_transformation",
    name: "Professional transformation",
    instruction:
      "Describe a credible before-and-after way of working, not a guaranteed business result.",
    preferredPurposes: ["conversion", "retargeting"],
    preferredReactions: [
      "confidence_approval",
      "focused_attention",
      "shock_surprise",
      "secret_reveal",
    ],
  },
] as const satisfies readonly TrendingHookPatternDefinition[];

const INDUSTRY_PACKS = [
  {
    id: "mobile_app",
    label: "Mobile app",
    signals: ["mobile app", "ios", "android", "app store"],
    focus:
      "Use only the profile's real mobile use case, user friction, and stated capability.",
    avoidAssumptions:
      "Do not invent app-store rankings, downloads, ratings, device features, integrations, or install speed.",
    preferredPatterns: [
      "direct_capability",
      "problem_observation",
      "outcome_without_friction",
    ],
  },
  {
    id: "ecommerce",
    label: "E-commerce",
    signals: ["e-commerce", "ecommerce", "online store", "retail", "dtc"],
    focus:
      "Use only the profile's real shopper situation, product use case, hesitation, and differentiator.",
    avoidAssumptions:
      "Do not invent prices, discounts, reviews, delivery promises, materials, inventory, or product results.",
    preferredPatterns: [
      "mystery_discovery",
      "skeptical_challenge",
      "outcome_without_friction",
    ],
  },
  {
    id: "saas",
    label: "Software",
    signals: ["saas", "software", "platform", "automation", "software tool"],
    focus:
      "Use only the profile's real workflow, business user, friction, and stated software capability.",
    avoidAssumptions:
      "Do not invent integrations, automation steps, supported formats, productivity gains, or technical features.",
    preferredPatterns: [
      "workflow_exposed",
      "direct_capability",
      "professional_transformation",
    ],
  },
  {
    id: "agency_services",
    label: "Agency or services",
    signals: ["agency", "consulting", "consultant", "freelance", "services"],
    focus:
      "Use only the profile's real client problem, service, decision barrier, and differentiator.",
    avoidAssumptions:
      "Do not invent clients, case studies, revenue, delivery time, team experience, or guaranteed outcomes.",
    preferredPatterns: [
      "problem_observation",
      "skeptical_challenge",
      "professional_transformation",
    ],
  },
  {
    id: "health_wellness",
    label: "Health and wellness",
    signals: [
      "health",
      "fitness",
      "nutrition",
      "wellness",
      "beauty",
      "skincare",
      "medical",
    ],
    focus:
      "Use only the profile's real routine, user friction, product role, and non-medical desired outcome.",
    avoidAssumptions:
      "Do not diagnose, promise physical or mental results, invent ingredients, cite studies, or imply medical approval.",
    preferredPatterns: [
      "problem_observation",
      "problem_reversal",
      "outcome_without_friction",
    ],
  },
  {
    id: "finance",
    label: "Finance",
    signals: [
      "finance",
      "fintech",
      "banking",
      "investment",
      "accounting",
      "tax",
      "insurance",
    ],
    focus:
      "Use only the profile's real financial workflow, audience problem, product role, and stated differentiator.",
    avoidAssumptions:
      "Do not invent savings, returns, rates, approvals, tax outcomes, security guarantees, or financial advice.",
    preferredPatterns: [
      "workflow_exposed",
      "skeptical_challenge",
      "problem_observation",
    ],
  },
  {
    id: "education",
    label: "Education",
    signals: ["education", "course", "learning", "school", "tutor", "training"],
    focus:
      "Use only the profile's real learner situation, learning friction, offering, and desired outcome.",
    avoidAssumptions:
      "Do not invent grades, completion time, credentials, student results, curriculum, or teaching methods.",
    preferredPatterns: [
      "problem_reversal",
      "problem_observation",
      "direct_capability",
    ],
  },
  {
    id: "food_hospitality",
    label: "Food and hospitality",
    signals: ["restaurant", "food", "hospitality", "hotel", "travel"],
    focus:
      "Use only the profile's real guest or diner situation, offering, friction, and differentiator.",
    avoidAssumptions:
      "Do not invent menu items, ingredients, locations, prices, availability, reviews, or sensory claims.",
    preferredPatterns: [
      "mystery_discovery",
      "problem_observation",
      "outcome_without_friction",
    ],
  },
] as const satisfies ReadonlyArray<
  TrendingHookIndustryContext & { signals: readonly string[] }
>;

const GENERAL_INDUSTRY_CONTEXT: TrendingHookIndustryContext = {
  avoidAssumptions:
    "Do not infer a feature, setting, customer result, business model, or use case that the profile does not state.",
  focus:
    "Use the profile's primary audience, problem, desired outcome, and differentiator as the only industry context.",
  id: "general",
  label: "General business",
  preferredPatterns: [
    "mystery_discovery",
    "problem_observation",
    "direct_capability",
  ],
};

const CAMPAIGN_PURPOSES = [
  "product_discovery",
  "education",
  "conversion",
  "retargeting",
  "app_install",
] as const satisfies readonly TrendingHookCampaignPurpose[];

const CORE_CAMPAIGN_PURPOSES = [
  "product_discovery",
  "education",
  "conversion",
] as const satisfies readonly TrendingHookCampaignPurpose[];

export function resolveTrendingHookIndustryContext(params: {
  businessModel?: string | null;
  categories?: readonly string[];
  category?: string | null;
  productSummary?: string | null;
}) {
  const context = [
    ...(params.categories ?? []),
    params.category ?? "",
    params.businessModel ?? "",
    params.productSummary ?? "",
  ]
    .join(" ")
    .toLowerCase();
  const match = INDUSTRY_PACKS.find((pack) =>
    pack.signals.some((signal) => context.includes(signal)),
  );

  if (!match) {
    return GENERAL_INDUSTRY_CONTEXT;
  }

  const { signals: _signals, ...industryContext } = match;
  void _signals;
  return industryContext;
}

export function buildTrendingHookCampaignPurposeSequence(params: {
  count: number;
  performanceSignals?: HookPerformanceSignals;
  requestedPurposes?: readonly string[];
}) {
  const count = Math.max(1, Math.trunc(params.count));
  // A purpose chosen in onboarding is authoritative. In particular, do not
  // silently replace an app-install goal because category detection did not
  // happen to recognize a mobile product.
  const requested = uniqueCampaignPurposes(params.requestedPurposes);
  const performancePreferred = uniqueCampaignPurposes(
    params.performanceSignals?.preferredPurposes,
  );
  const authoritativePurposes =
    requested.length > 0 ? requested : [...CORE_CAMPAIGN_PURPOSES];
  const rotation = uniqueCampaignPurposes([
    ...performancePreferred.filter((purpose) =>
      authoritativePurposes.includes(purpose),
    ),
    ...authoritativePurposes,
  ]);

  return Array.from(
    { length: count },
    (_, index) => rotation[index % rotation.length]!,
  );
}

export function getTrendingHookPurposeInstruction(
  purpose: TrendingHookCampaignPurpose,
) {
  switch (purpose) {
    case "product_discovery":
      return "Create first-touch curiosity and recognition. Do not assume the viewer already knows the product.";
    case "education":
      return "Teach one useful problem insight or reframe. Do not turn the opening into a tutorial.";
    case "conversion":
      return "Make the stated product value or differentiator concrete for a decision-ready viewer, without a CTA or promise.";
    case "retargeting":
      return "Address a real profile-grounded doubt or hesitation for a viewer who may already recognize the problem.";
    case "app_install":
      return "Make the profile-grounded mobile use case worth exploring, without asking for an install or inventing app-store facts.";
  }
}

export function selectTrendingHookPatterns(params: {
  campaignPurpose: TrendingHookCampaignPurpose;
  candidateIndex: number;
  count?: number;
  industryContext: TrendingHookIndustryContext;
  performanceSignals?: HookPerformanceSignals;
  reactionType: string | null;
}) {
  const count = Math.max(
    1,
    Math.min(params.count ?? 2, TRENDING_HOOK_PATTERNS.length),
  );
  const reaction = normalizeReaction(params.reactionType);
  const preferredPatternIds = new Set(
    normalizePreferredPatternIds(
      params.performanceSignals?.preferredPatternIds,
    ),
  );
  const ranked = TRENDING_HOOK_PATTERNS.map((pattern, registryIndex) => ({
    pattern,
    registryIndex,
    affinity:
      ((pattern.preferredReactions as readonly string[]).includes(reaction)
        ? 4
        : 0) +
      ((pattern.preferredPurposes as readonly string[]).includes(
        params.campaignPurpose,
      )
        ? 3
        : 0) +
      (params.industryContext.preferredPatterns.includes(pattern.id) ? 2 : 0) +
      (preferredPatternIds.has(pattern.id) ? 1 : 0),
  })).sort(
    (first, second) =>
      second.affinity - first.affinity ||
      circularDistance(
        first.registryIndex,
        params.candidateIndex,
        TRENDING_HOOK_PATTERNS.length,
      ) -
        circularDistance(
          second.registryIndex,
          params.candidateIndex,
          TRENDING_HOOK_PATTERNS.length,
        ) ||
      first.registryIndex - second.registryIndex,
  );

  return ranked.slice(0, count).map(({ pattern }) => pattern);
}

export function getTrendingHookPattern(
  patternId: string,
): TrendingHookPatternDefinition | null {
  return TRENDING_HOOK_PATTERNS.find((pattern) => pattern.id === patternId) ?? null;
}

export function isTrendingHookCampaignPurpose(
  value: unknown,
): value is TrendingHookCampaignPurpose {
  return (
    typeof value === "string" &&
    (CAMPAIGN_PURPOSES as readonly string[]).includes(value)
  );
}

function uniqueCampaignPurposes(values: readonly unknown[] | undefined) {
  return [
    ...new Set(
      (values ?? []).filter(isTrendingHookCampaignPurpose).slice(0, 5),
    ),
  ];
}

function normalizePreferredPatternIds(values: readonly unknown[] | undefined) {
  return [
    ...new Set(
      (values ?? [])
        .filter(
          (value): value is TrendingHookPatternId =>
            typeof value === "string" && Boolean(getTrendingHookPattern(value)),
        )
        .slice(0, 3),
    ),
  ];
}

function normalizeReaction(value: string | null) {
  return value?.trim().toLowerCase() || "unspecified";
}

function circularDistance(
  registryIndex: number,
  candidateIndex: number,
  length: number,
) {
  const start = Math.abs(candidateIndex) % length;
  return (registryIndex - start + length) % length;
}
