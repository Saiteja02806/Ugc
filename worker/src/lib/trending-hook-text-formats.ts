import type {
  TrendingHookCampaignPurpose,
} from "./trending-hook-patterns.js";

export const HOOK_TEXT_FORMAT_LIBRARY_VERSION =
  "global-hook-text-formats-v1";

export const HOOK_TEXT_FORMAT_IDS = [
  "GF_001",
  "GF_002",
  "GF_003",
  "GF_004",
  "GF_005",
  "GF_006",
  "GF_007",
  "GF_008",
  "GF_009",
  "GF_010",
  "GF_011",
  "GF_012",
  "GF_013",
  "GF_014",
  "GF_015",
  "GF_016",
  "GF_017",
  "GF_018",
  "GF_019",
  "GF_020",
] as const;

export type HookTextFormatId =
  (typeof HOOK_TEXT_FORMAT_IDS)[number];
export type HookTextFormatTier = "tier_a" | "tier_b" | "tier_c";
export type HookTextEvidenceRequirement =
  | "audience"
  | "business_signal"
  | "capability"
  | "comparison"
  | "outcome"
  | "pain"
  | "person_or_source"
  | "time_or_number"
  | "two_distinct_ideas";

export const HOOK_REACTION_TYPES = [
  "shock_surprise",
  "curiosity_discovery",
  "secret_reveal",
  "confidence_approval",
  "amusement_laughter",
  "concern_anxiety",
  "confusion_skepticism",
  "focused_attention",
] as const;

export type HookReactionType = (typeof HOOK_REACTION_TYPES)[number];
export type HookTextSelectionStrategy =
  | "legacy_rotation"
  | "reaction_mapped";

export type HookTextVariantDefinition = {
  id: string;
  instruction: string;
  template: string;
};

export type HookTextFormatDefinition = {
  allowedTones: readonly string[];
  canonicalTemplate: string;
  family: string;
  id: HookTextFormatId;
  initialConfidence: HookTextFormatTier;
  instruction: string;
  name: string;
  preferredPurposes: readonly TrendingHookCampaignPurpose[];
  preferredReactions: readonly string[];
  psychology: readonly string[];
  requiredEvidence: readonly HookTextEvidenceRequirement[];
  restrictedForSensitiveBusinesses: boolean;
  rhetoricalFirstPersonAllowed: boolean;
  variants: readonly HookTextVariantDefinition[];
};

export type HookTextFormatPerformanceSignal = {
  formatId: HookTextFormatId;
  lastGeneratedAt?: string | null;
  publishedResultCount: number;
  selectionWeight: number;
  temporaryBoost: number;
  timesGenerated: number;
};

export type HookTextPerformanceSignals = {
  formatSignals?: readonly HookTextFormatPerformanceSignal[];
  preferredPurposes?: readonly TrendingHookCampaignPurpose[];
};

export type HookTextEligibilityContext = {
  businessContext: {
    businessName?: string | null;
    categories?: readonly string[];
    category?: string | null;
    desiredOutcome?: string | null;
    differentiator?: string | null;
    differentiators?: readonly string[];
    mainProblem?: string | null;
    painPoints?: readonly string[];
    primaryAudience?: string | null;
    productSummary?: string | null;
    targetAudience?: readonly string[];
    valueProps?: readonly string[];
  };
  evidence: readonly { key: string; text: string }[];
};

const REACTIONS = {
  approval: ["confidence_approval", "amusement_laughter"],
  concern: ["concern_anxiety", "confusion_skepticism"],
  curiosity: ["curiosity_discovery", "secret_reveal"],
  focus: ["focused_attention", "confidence_approval"],
  shock: ["shock_surprise", "amusement_laughter"],
} as const;

/**
 * Official Global Hook Format Library V1.
 *
 * These are reusable writing structures, not finished claims. The selector
 * chooses one parent format before the AI writes. The writer may choose one of
 * that format's surface variants, but it may not switch to another format.
 */
export const HOOK_TEXT_FORMATS = [
  {
    allowedTones: ["casual", "shock"],
    canonicalTemplate:
      "I could {KISS/MARRY} the {PERSON} who showed me THIS",
    family: "extreme_gratitude",
    id: "GF_001",
    initialConfidence: "tier_a",
    instruction:
      "Use an emotional gratitude reaction. This is rhetorical emotion, not a testimonial or claim that an event happened.",
    name: "Extreme gratitude",
    preferredPurposes: ["product_discovery", "retargeting"],
    preferredReactions: [...REACTIONS.shock, ...REACTIONS.approval],
    psychology: ["gratitude", "surprise", "curiosity"],
    requiredEvidence: [],
    restrictedForSensitiveBusinesses: false,
    rhetoricalFirstPersonAllowed: true,
    variants: [
      {
        id: "GF_001_A",
        instruction: "Use KISS as a playful reaction.",
        template: "I could literally KISS whoever showed me this",
      },
      {
        id: "GF_001_B",
        instruction: "Use MARRY as a playful reaction.",
        template: "I could MARRY whoever showed me this",
      },
    ],
  },
  {
    allowedTones: ["casual", "shock"],
    canonicalTemplate: "Imagine {PAIN} when THIS exists",
    family: "pain_vs_hidden_solution",
    id: "GF_002",
    initialConfidence: "tier_a",
    instruction:
      "Contrast one supplied audience pain with the existence of a hidden solution. Do not add an outcome or explain the solution.",
    name: "Pain vs hidden solution",
    preferredPurposes: ["product_discovery", "conversion"],
    preferredReactions: [...REACTIONS.concern, ...REACTIONS.shock],
    psychology: ["pain", "curiosity", "fomo"],
    requiredEvidence: ["pain"],
    restrictedForSensitiveBusinesses: false,
    rhetoricalFirstPersonAllowed: false,
    variants: [
      {
        id: "GF_002_A",
        instruction: "Use the direct Imagine structure.",
        template: "Imagine {current_pain} when this exists",
      },
      {
        id: "GF_002_B",
        instruction: "Use a still-doing-the-pain variation.",
        template: "Imagine still {current_pain} when this exists",
      },
    ],
  },
  {
    allowedTones: ["casual", "shock"],
    canonicalTemplate:
      "{TIME/EXPERIENCE} doing {THING} and I JUST found this",
    family: "delayed_discovery",
    id: "GF_003",
    initialConfidence: "tier_a",
    instruction:
      "Express sunk-cost surprise using only a time or experience statement explicitly supplied in evidence. Never invent personal history.",
    name: "Delayed discovery",
    preferredPurposes: ["product_discovery", "retargeting"],
    preferredReactions: [...REACTIONS.shock, ...REACTIONS.curiosity],
    psychology: ["regret", "curiosity", "discovery"],
    requiredEvidence: ["time_or_number"],
    restrictedForSensitiveBusinesses: false,
    rhetoricalFirstPersonAllowed: true,
    variants: [
      {
        id: "GF_003_A",
        instruction: "Use the supplied experience followed by JUST found this.",
        template: "{experience} doing {activity} and I JUST found this",
      },
      {
        id: "GF_003_B",
        instruction: "Use the supplied time as a wasted-time discovery.",
        template: "{time} doing this and I only just found THIS",
      },
    ],
  },
  {
    allowedTones: ["shock"],
    canonicalTemplate: "How is this {LEGAL/POSSIBLE}?",
    family: "forbidden_advantage",
    id: "GF_004",
    initialConfidence: "tier_a",
    instruction:
      "Frame a supplied capability as surprising or almost forbidden. Never imply actual illegality or regulatory approval.",
    name: "Forbidden advantage",
    preferredPurposes: ["product_discovery", "retargeting"],
    preferredReactions: [...REACTIONS.shock, ...REACTIONS.curiosity],
    psychology: ["forbidden_information", "shock", "curiosity"],
    requiredEvidence: [],
    restrictedForSensitiveBusinesses: true,
    rhetoricalFirstPersonAllowed: false,
    variants: [
      {
        id: "GF_004_A",
        instruction: "Ask how the supplied capability is possible.",
        template: "How is this even possible?",
      },
      {
        id: "GF_004_B",
        instruction: "Use feels-illegal only as obvious hyperbole.",
        template: "This feels illegal to know",
      },
    ],
  },
  {
    allowedTones: ["casual", "shock"],
    canonicalTemplate: "{GROUP} doesn't want you to know about this",
    family: "secret_gatekeeping",
    id: "GF_005",
    initialConfidence: "tier_a",
    instruction:
      "Create information-asymmetry tension. Prefer the safe Don't tell audience variant unless evidence explicitly supports a named group or competitor.",
    name: "Secret or gatekeeping",
    preferredPurposes: ["product_discovery", "retargeting"],
    preferredReactions: [...REACTIONS.curiosity, ...REACTIONS.shock],
    psychology: ["secrecy", "information_asymmetry", "curiosity"],
    requiredEvidence: ["audience"],
    restrictedForSensitiveBusinesses: false,
    rhetoricalFirstPersonAllowed: false,
    variants: [
      {
        id: "GF_005_A",
        instruction: "Address the supplied audience without accusing anyone.",
        template: "Don't tell {audience} about this",
      },
      {
        id: "GF_005_B",
        instruction: "Use gatekeeping only when a supplied group supports it.",
        template: "I finally understand why {group} gatekeeps this",
      },
    ],
  },
  {
    allowedTones: ["casual", "story"],
    canonicalTemplate: "POV: {RELATABLE SITUATION}",
    family: "pov_mini_story",
    id: "GF_006",
    initialConfidence: "tier_a",
    instruction:
      "Write one short, relatable scenario using only supplied audience, pain, or outcome evidence.",
    name: "POV mini-story",
    preferredPurposes: ["product_discovery", "education"],
    preferredReactions: [...REACTIONS.curiosity, ...REACTIONS.approval],
    psychology: ["self_identification", "story", "curiosity"],
    requiredEvidence: [],
    restrictedForSensitiveBusinesses: false,
    rhetoricalFirstPersonAllowed: false,
    variants: [
      {
        id: "GF_006_A",
        instruction: "Use a supplied pain scenario.",
        template: "POV: {pain_scenario}",
      },
      {
        id: "GF_006_B",
        instruction: "Use a supplied discovery or outcome scenario.",
        template: "POV: {discovery_or_outcome_scenario}",
      },
    ],
  },
  {
    allowedTones: ["casual", "playful"],
    canonicalTemplate:
      "{AUDIENCE} are gonna {LOVE/KISS} me after seeing this",
    family: "audience_callout",
    id: "GF_007",
    initialConfidence: "tier_b",
    instruction:
      "Call out the supplied audience directly and use a playful emotional reaction, not a promised result.",
    name: "Audience callout",
    preferredPurposes: ["product_discovery", "retargeting"],
    preferredReactions: [...REACTIONS.approval, ...REACTIONS.shock],
    psychology: ["identity", "recognition", "gratitude"],
    requiredEvidence: ["audience"],
    restrictedForSensitiveBusinesses: false,
    rhetoricalFirstPersonAllowed: true,
    variants: [
      {
        id: "GF_007_A",
        instruction: "Use love as the emotional reaction.",
        template: "{audience} are gonna love me after seeing this",
      },
      {
        id: "GF_007_B",
        instruction: "Use KISS only for an appropriately casual audience.",
        template: "{audience} are gonna KISS me after seeing this",
      },
    ],
  },
  {
    allowedTones: ["casual", "serious"],
    canonicalTemplate: "{PAINFUL IDENTITY/STATE} + discovery",
    family: "identity_pain",
    id: "GF_008",
    initialConfidence: "tier_b",
    instruction:
      "Name a supplied audience state or identity pain without inventing the speaker's own situation or adding an outcome claim.",
    name: "Identity pain",
    preferredPurposes: ["education", "retargeting"],
    preferredReactions: [...REACTIONS.concern, ...REACTIONS.focus],
    psychology: ["identity", "pain", "recognition"],
    requiredEvidence: ["pain"],
    restrictedForSensitiveBusinesses: false,
    rhetoricalFirstPersonAllowed: false,
    variants: [
      {
        id: "GF_008_A",
        instruction: "State the supplied painful identity directly.",
        template: "{painful_identity_or_state}",
      },
      {
        id: "GF_008_B",
        instruction: "Use Imagine plus the supplied state.",
        template: "Imagine being {painful_state}",
      },
    ],
  },
  {
    allowedTones: ["clear", "casual"],
    canonicalTemplate: "{OLD METHOD} ❌ {NEW METHOD} ✅",
    family: "old_way_vs_new_way",
    id: "GF_009",
    initialConfidence: "tier_b",
    instruction:
      "Contrast one supplied pain or old behavior with one supplied capability or differentiator. Do not add speed or result claims.",
    name: "Old way vs new way",
    preferredPurposes: ["conversion", "education", "app_install"],
    preferredReactions: [...REACTIONS.focus, ...REACTIONS.approval],
    psychology: ["contrast", "simplicity", "transformation"],
    requiredEvidence: ["two_distinct_ideas"],
    restrictedForSensitiveBusinesses: false,
    rhetoricalFirstPersonAllowed: false,
    variants: [
      {
        id: "GF_009_A",
        instruction: "Use the visual cross/check structure.",
        template: "{old_method} ❌ {new_method} ✅",
      },
      {
        id: "GF_009_B",
        instruction: "Use a natural sentence contrast.",
        template: "Still {old_method} when {new_method} exists?",
      },
    ],
  },
  {
    allowedTones: ["clear", "playful"],
    canonicalTemplate: "{THING A} + {THING B} = {OUTCOME}",
    family: "combination_equation",
    id: "GF_010",
    initialConfidence: "tier_b",
    instruction:
      "Combine two separately supplied ideas and a supplied outcome. Never turn the equation into a financial or guaranteed result.",
    name: "Combination or equation",
    preferredPurposes: ["product_discovery", "conversion"],
    preferredReactions: [...REACTIONS.approval, ...REACTIONS.curiosity],
    psychology: ["combination", "simplicity", "curiosity"],
    requiredEvidence: ["two_distinct_ideas", "outcome"],
    restrictedForSensitiveBusinesses: false,
    rhetoricalFirstPersonAllowed: false,
    variants: [
      {
        id: "GF_010_A",
        instruction: "Use the compact equation structure.",
        template: "{thing_a} + {thing_b} = {outcome}",
      },
    ],
  },
  {
    allowedTones: ["clear", "shock"],
    canonicalTemplate: "{RESULT} in {TIME/NUMBER}",
    family: "specific_transformation",
    id: "GF_011",
    initialConfidence: "tier_a",
    instruction:
      "Use only a result and number or duration explicitly present in supplied evidence. Do not infer or improve the number.",
    name: "Specific transformation",
    preferredPurposes: ["conversion", "retargeting"],
    preferredReactions: [...REACTIONS.shock, ...REACTIONS.approval],
    psychology: ["specificity", "transformation", "proof"],
    requiredEvidence: ["outcome", "time_or_number"],
    restrictedForSensitiveBusinesses: false,
    rhetoricalFirstPersonAllowed: false,
    variants: [
      {
        id: "GF_011_A",
        instruction: "Use the supplied result and supplied duration or number.",
        template: "{verified_result} in {verified_time_or_number}",
      },
      {
        id: "GF_011_B",
        instruction: "Use a supplied before and after with supplied timing.",
        template: "{verified_before} to {verified_after} in {verified_time}",
      },
    ],
  },
  {
    allowedTones: ["casual", "shock"],
    canonicalTemplate: "I'm sorry... THIS can {THING} now??",
    family: "conversational_disbelief",
    id: "GF_012",
    initialConfidence: "tier_b",
    instruction:
      "Use I'm sorry as rhetorical disbelief before one supplied capability or problem reframe.",
    name: "Conversational disbelief",
    preferredPurposes: ["product_discovery", "retargeting"],
    preferredReactions: [...REACTIONS.shock, ...REACTIONS.concern],
    psychology: ["disbelief", "conversation", "curiosity"],
    requiredEvidence: [],
    restrictedForSensitiveBusinesses: false,
    rhetoricalFirstPersonAllowed: true,
    variants: [
      {
        id: "GF_012_A",
        instruction: "Use THIS can plus a supplied capability.",
        template: "I'm sorry... THIS can {capability} now??",
      },
      {
        id: "GF_012_B",
        instruction: "Use THIS is how plus a supplied process or outcome.",
        template: "I'm sorry... THIS is how {supplied_idea} works now??",
      },
    ],
  },
  {
    allowedTones: ["casual", "playful"],
    canonicalTemplate: "WDYM {SURPRISING THING/OUTCOME}?",
    family: "wdym_surprise",
    id: "GF_013",
    initialConfidence: "tier_c",
    instruction:
      "Use WDYM as casual surprise for a supplied audience, pain, capability, or outcome. Avoid it for formal audiences.",
    name: "WDYM surprise",
    preferredPurposes: ["product_discovery", "retargeting"],
    preferredReactions: [...REACTIONS.shock, ...REACTIONS.approval],
    psychology: ["slang", "surprise", "curiosity"],
    requiredEvidence: [],
    restrictedForSensitiveBusinesses: false,
    rhetoricalFirstPersonAllowed: false,
    variants: [
      {
        id: "GF_013_A",
        instruction: "Use one supplied surprising reality.",
        template: "WDYM {surprising_supplied_idea}?",
      },
    ],
  },
  {
    allowedTones: ["casual", "story"],
    canonicalTemplate:
      "I owe {OUTCOME} to {PERSON/THING} that showed me this",
    family: "credit_owe_outcome",
    id: "GF_014",
    initialConfidence: "tier_b",
    instruction:
      "Attribute only an explicitly supplied outcome to an explicitly supplied person or thing. Never invent a testimonial or personal result.",
    name: "Credit or owe outcome",
    preferredPurposes: ["conversion", "retargeting"],
    preferredReactions: [...REACTIONS.approval, ...REACTIONS.shock],
    psychology: ["attribution", "gratitude", "outcome"],
    requiredEvidence: ["outcome", "person_or_source"],
    restrictedForSensitiveBusinesses: false,
    rhetoricalFirstPersonAllowed: true,
    variants: [
      {
        id: "GF_014_A",
        instruction: "Use only the supplied outcome and supplied source.",
        template: "I owe {verified_outcome} to {verified_source}",
      },
    ],
  },
  {
    allowedTones: ["casual", "story"],
    canonicalTemplate: "I/FINALLY/JUST found {THING}",
    family: "discovery_opener",
    id: "GF_015",
    initialConfidence: "tier_a",
    instruction:
      "Open with a rhetorical discovery of one supplied capability, solution, or useful idea. Do not add a result or personal history.",
    name: "Discovery opener",
    preferredPurposes: ["product_discovery", "education"],
    preferredReactions: [...REACTIONS.curiosity, ...REACTIONS.shock],
    psychology: ["discovery", "novelty", "curiosity"],
    requiredEvidence: [],
    restrictedForSensitiveBusinesses: false,
    rhetoricalFirstPersonAllowed: true,
    variants: [
      {
        id: "GF_015_A",
        instruction: "Use I just found plus one supplied idea.",
        template: "I just found {supplied_thing}",
      },
      {
        id: "GF_015_B",
        instruction: "Use FINALLY found plus one supplied idea.",
        template: "FINALLY found {supplied_thing}",
      },
    ],
  },
  {
    allowedTones: ["casual", "shock"],
    canonicalTemplate: "Is THIS the new {KNOWN TOOL/METHOD}?!",
    family: "replacement_discovery",
    id: "GF_016",
    initialConfidence: "tier_b",
    instruction:
      "Compare with a known tool or method only when that comparison is explicitly supplied in evidence. Never infer a competitor.",
    name: "Replacement discovery",
    preferredPurposes: ["product_discovery", "conversion"],
    preferredReactions: [...REACTIONS.shock, ...REACTIONS.concern],
    psychology: ["comparison", "disruption", "curiosity"],
    requiredEvidence: ["comparison"],
    restrictedForSensitiveBusinesses: false,
    rhetoricalFirstPersonAllowed: false,
    variants: [
      {
        id: "GF_016_A",
        instruction: "Use only the supplied known tool or method.",
        template: "Is THIS the new {verified_tool_or_method}?!",
      },
      {
        id: "GF_016_B",
        instruction: "Use I'm sorry only with the supplied comparison.",
        template: "I'm sorry... is THIS the new {verified_tool_or_method}?!",
      },
    ],
  },
  {
    allowedTones: ["casual", "playful"],
    canonicalTemplate: "{AUDIENCE}, are we cooked?",
    family: "audience_threat",
    id: "GF_017",
    initialConfidence: "tier_c",
    instruction:
      "Use playful audience anxiety without claiming replacement, job loss, danger, or a guaranteed disruption.",
    name: "Audience threat",
    preferredPurposes: ["product_discovery", "retargeting"],
    preferredReactions: [...REACTIONS.concern, ...REACTIONS.shock],
    psychology: ["identity", "threat", "curiosity"],
    requiredEvidence: ["audience"],
    restrictedForSensitiveBusinesses: false,
    rhetoricalFirstPersonAllowed: true,
    variants: [
      {
        id: "GF_017_A",
        instruction: "Use the supplied audience and the exact playful question.",
        template: "{audience}, are we cooked?",
      },
    ],
  },
  {
    allowedTones: ["casual", "challenge"],
    canonicalTemplate:
      "Making {DESIRED RESULT} in {TIME} without {EFFORT}",
    family: "speed_challenge",
    id: "GF_018",
    initialConfidence: "tier_b",
    instruction:
      "Use only a desired result, time, and avoided effort explicitly supplied in evidence. Never invent speed or a challenge result.",
    name: "Speed challenge",
    preferredPurposes: ["conversion", "product_discovery"],
    preferredReactions: [...REACTIONS.approval, ...REACTIONS.shock],
    psychology: ["challenge", "speed", "contrast"],
    requiredEvidence: ["outcome", "pain", "time_or_number"],
    restrictedForSensitiveBusinesses: false,
    rhetoricalFirstPersonAllowed: false,
    variants: [
      {
        id: "GF_018_A",
        instruction: "Use the complete supplied challenge structure.",
        template:
          "Making {verified_result} in {verified_time} without {supplied_effort}",
      },
    ],
  },
  {
    allowedTones: ["casual", "clear", "playful"],
    canonicalTemplate: "Wait, what? {SURPRISING CAPABILITY}?",
    family: "clear_playful_surprise",
    id: "GF_019",
    initialConfidence: "tier_b",
    instruction:
      "Express a clear, playful surprise about one supplied capability. Use the full words 'Wait, what?' and never use abbreviations, slang, or a generic compliment.",
    name: "Clear playful surprise",
    preferredPurposes: ["product_discovery", "app_install"],
    preferredReactions: ["amusement_laughter"],
    psychology: ["playful_surprise", "clarity", "curiosity"],
    requiredEvidence: ["capability"],
    restrictedForSensitiveBusinesses: false,
    rhetoricalFirstPersonAllowed: false,
    variants: [
      {
        id: "GF_019_A",
        instruction:
          "Use the complete, plain-language surprise before one verified capability.",
        template: "Wait, what? {verified_capability}?",
      },
    ],
  },
  {
    allowedTones: ["casual", "clear", "serious"],
    canonicalTemplate: "Why are we still {OLD METHOD}?",
    family: "skeptical_challenge",
    id: "GF_020",
    initialConfidence: "tier_b",
    instruction:
      "Voice a clear, human doubt about one supplied old method or workflow pain. Do not add a threat, slang, a result claim, or a second idea.",
    name: "Skeptical challenge",
    preferredPurposes: ["education", "retargeting", "conversion"],
    preferredReactions: ["confusion_skepticism"],
    psychology: ["skepticism", "recognition", "curiosity"],
    requiredEvidence: ["pain"],
    restrictedForSensitiveBusinesses: false,
    rhetoricalFirstPersonAllowed: false,
    variants: [
      {
        id: "GF_020_A",
        instruction:
          "Ask why the supplied old method or workflow pain is still accepted.",
        template: "Why are we still {verified_old_method}?",
      },
    ],
  },
] as const satisfies readonly HookTextFormatDefinition[];

export function getHookTextFormat(
  value: string,
): HookTextFormatDefinition | null {
  return (
    HOOK_TEXT_FORMATS.find((format) => format.id === value) ?? null
  );
}

export function getHookTextVariant(
  format: HookTextFormatDefinition,
  value: string,
) {
  return format.variants.find((variant) => variant.id === value) ?? null;
}

/**
 * Historical formats remain readable because generated suggestions store their
 * format ids. They are intentionally excluded only from new generation.
 */
const RETIRED_HOOK_TEXT_FORMAT_IDS = new Set<HookTextFormatId>([
  "GF_013",
  "GF_017",
]);

/**
 * These formats are selected only by the reaction map. The legacy composition
 * workflow must not start choosing them through its broad rotation.
 */
const REACTION_MAPPED_ONLY_FORMAT_IDS = new Set<HookTextFormatId>([
  "GF_019",
  "GF_020",
]);

export const HOOK_REACTION_FORMAT_RULES = {
  amusement_laughter: {
    formatId: "GF_019",
    requiredEvidence: ["capability"],
  },
  concern_anxiety: {
    formatId: "GF_002",
    requiredEvidence: ["pain"],
  },
  confidence_approval: {
    formatId: "GF_006",
    requiredEvidence: ["business_signal"],
  },
  confusion_skepticism: {
    formatId: "GF_020",
    requiredEvidence: ["pain"],
  },
  curiosity_discovery: {
    formatId: "GF_015",
    requiredEvidence: ["capability"],
  },
  focused_attention: {
    formatId: "GF_009",
    requiredEvidence: ["two_distinct_ideas"],
  },
  secret_reveal: {
    formatId: "GF_005",
    requiredEvidence: ["audience"],
  },
  shock_surprise: {
    formatId: "GF_012",
    requiredEvidence: ["capability"],
  },
} as const satisfies Record<
  HookReactionType,
  {
    formatId: HookTextFormatId;
    requiredEvidence: readonly HookTextEvidenceRequirement[];
  }
>;

export function getHookReactionFormatRule(value: string | null) {
  const reaction = normalizeReaction(value);

  return isHookReactionType(reaction)
    ? HOOK_REACTION_FORMAT_RULES[reaction]
    : null;
}

export function selectHookTextFormats(params: {
  campaignPurpose: TrendingHookCampaignPurpose;
  candidateIndex: number;
  count?: number;
  eligibility: HookTextEligibilityContext;
  excludedFormatIds?: ReadonlySet<HookTextFormatId>;
  performanceSignals?: HookTextPerformanceSignals;
  reactionType: string | null;
  selectionStrategy?: HookTextSelectionStrategy;
}) {
  if (params.selectionStrategy === "reaction_mapped") {
    const rule = getHookReactionFormatRule(params.reactionType);
    if (!rule) {
      return getNameGroundedDiscoveryFormat(params.eligibility);
    }

    const format = getHookTextFormat(rule.formatId);

    if (!format) {
      return [];
    }

    if (
      !isHookTextFormatEligible(
        format,
        params.eligibility,
        rule.requiredEvidence,
      )
    ) {
      // A completed business profile always has a verified name. When that
      // is the only supplied business fact, use the name-grounded discovery
      // format rather than dropping a reviewed Hook video before generation.
      // The copy contract still prohibits invented product claims.
      return getNameGroundedDiscoveryFormat(params.eligibility);
    }

    return [format];
  }

  const allEligible = HOOK_TEXT_FORMATS.filter((format) =>
    !RETIRED_HOOK_TEXT_FORMAT_IDS.has(format.id) &&
    !REACTION_MAPPED_ONLY_FORMAT_IDS.has(format.id) &&
    isHookTextFormatEligible(format, params.eligibility),
  );
  const notRepeated = allEligible.filter(
    (format) => !params.excludedFormatIds?.has(format.id),
  );
  const eligible = notRepeated.length > 0 ? notRepeated : allEligible;

  if (eligible.length === 0) {
    throw new Error(
      "No Global Hook text format is eligible for the supplied business evidence.",
    );
  }

  const count = Math.max(1, Math.min(params.count ?? 1, eligible.length));
  const signalByFormat = new Map(
    (params.performanceSignals?.formatSignals ?? []).map((signal) => [
      signal.formatId,
      signal,
    ]),
  );
  const minimumUsage = Math.min(
    ...eligible.map(
      (format) => signalByFormat.get(format.id)?.timesGenerated ?? 0,
    ),
  );
  const now = Date.now();
  const reaction = normalizeReaction(params.reactionType);
  const ranked = eligible
    .map((format, registryIndex) => {
      const signal = signalByFormat.get(format.id);
      const timesGenerated = signal?.timesGenerated ?? 0;
      const selectionWeight = clamp(signal?.selectionWeight ?? 1, 0.8, 1.3);
      const temporaryBoost = clamp(signal?.temporaryBoost ?? 0, 0, 0.12);
      const lastGeneratedAt = signal?.lastGeneratedAt
        ? Date.parse(signal.lastGeneratedAt)
        : Number.NaN;
      const recentlyUsed =
        Number.isFinite(lastGeneratedAt) &&
        now - lastGeneratedAt < 1000 * 60 * 60 * 24 * 3;
      const usagePenalty = Math.max(0, timesGenerated - minimumUsage) * 0.35;
      const tierPrior =
        format.initialConfidence === "tier_a"
          ? 0.05
          : format.initialConfidence === "tier_c"
            ? -0.05
            : 0;
      const purposeAffinity = (
        format.preferredPurposes as readonly TrendingHookCampaignPurpose[]
      ).includes(params.campaignPurpose)
        ? 0.04
        : 0;
      const reactionAffinity = (
        format.preferredReactions as readonly string[]
      ).includes(reaction)
        ? 0.05
        : 0;
      const cooldownPenalty = recentlyUsed ? 0.12 : 0;

      const effectiveWeight = clamp(
        selectionWeight +
          temporaryBoost +
          tierPrior +
          purposeAffinity +
          reactionAffinity -
          usagePenalty -
          cooldownPenalty,
        0.05,
        2,
      );
      const draw = deterministicUnitInterval(
        [
          params.campaignPurpose,
          params.candidateIndex,
          reaction,
          format.id,
        ].join(":"),
      );

      return {
        format,
        registryIndex,
        weightedPriority: -Math.log(draw) / effectiveWeight,
      };
    })
    .sort(
      (left, right) =>
        left.weightedPriority - right.weightedPriority ||
        circularDistance(
          left.registryIndex,
          params.candidateIndex,
          HOOK_TEXT_FORMATS.length,
        ) -
          circularDistance(
            right.registryIndex,
            params.candidateIndex,
            HOOK_TEXT_FORMATS.length,
          ) ||
        left.registryIndex - right.registryIndex,
    );

  return ranked.slice(0, count).map(({ format }) => format);
}

function getNameGroundedDiscoveryFormat(eligibility: HookTextEligibilityContext) {
  if (!eligibility.businessContext.businessName?.trim()) {
    return [];
  }

  const brandDiscoveryFormat = getHookTextFormat("GF_015");
  return brandDiscoveryFormat ? [brandDiscoveryFormat] : [];
}

export function isHookTextFormatEligible(
  format: HookTextFormatDefinition,
  context: HookTextEligibilityContext,
  additionalRequiredEvidence: readonly HookTextEvidenceRequirement[] = [],
) {
  const evidenceText = context.evidence.map((item) => item.text).join(" ");
  const businessText = [
    ...(context.businessContext.categories ?? []),
    context.businessContext.category ?? "",
  ]
    .join(" ")
    .toLowerCase();
  const isSensitive =
    /\b(?:bank|banking|finance|financial|health|healthcare|insurance|investment|legal|medical|medicine|tax|therapy)\b/iu.test(
      businessText,
    );
  const hasAudience = Boolean(
    context.businessContext.primaryAudience?.trim() ||
      context.businessContext.targetAudience?.some((item) => item.trim()),
  );
  const hasPain = Boolean(
    context.businessContext.mainProblem?.trim() ||
      context.businessContext.painPoints?.some((item) => item.trim()),
  );
  const hasOutcome = Boolean(
    context.businessContext.desiredOutcome?.trim() ||
      context.businessContext.valueProps?.some((item) => item.trim()),
  );
  const hasCapability = Boolean(
    context.businessContext.differentiator?.trim() ||
      context.businessContext.differentiators?.some((item) => item.trim()) ||
      context.businessContext.valueProps?.some((item) => item.trim()) ||
      context.businessContext.productSummary?.trim() ||
      context.businessContext.desiredOutcome?.trim(),
  );
  const hasBusinessSignal =
    hasAudience || hasPain || hasOutcome || hasCapability;
  const distinctIdeaCount = new Set(
    [
      context.businessContext.mainProblem,
      context.businessContext.desiredOutcome,
      context.businessContext.differentiator,
      ...(context.businessContext.painPoints ?? []),
      ...(context.businessContext.valueProps ?? []),
      ...(context.businessContext.differentiators ?? []),
    ]
      .filter((value): value is string => Boolean(value?.trim()))
      .map((value) => value.trim().toLowerCase()),
  ).size;
  const hasTimeOrNumber =
    /(?:[$€£¥]\s*\d|\d[\d,.]*\s*%?|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|thirty|forty|fifty|sixty|hundred|thousand|million)\s+(?:seconds?|minutes?|hours?|days?|weeks?|months?|years?)\b)/iu.test(
      evidenceText,
    );
  const hasComparison =
    /\b(?:alternative|compared|competitor|instead|manual|replace|replacement|versus|vs)\b/iu.test(
      evidenceText,
    );
  const hasPersonOrSource = context.evidence.some(
    (item) =>
      /(?:person|source|testimonial|founder|friend|coach|teacher|professor|creator)/iu.test(
        `${item.key} ${item.text}`,
      ),
  );

  if (format.restrictedForSensitiveBusinesses && isSensitive) {
    return false;
  }

  return [...new Set([
    ...format.requiredEvidence,
    ...additionalRequiredEvidence,
  ])].every((requirement) => {
    switch (requirement) {
      case "audience":
        return hasAudience;
      case "business_signal":
        return hasBusinessSignal;
      case "capability":
        return hasCapability;
      case "comparison":
        return hasComparison;
      case "outcome":
        return hasOutcome;
      case "pain":
        return hasPain;
      case "person_or_source":
        return hasPersonOrSource;
      case "time_or_number":
        return hasTimeOrNumber;
      case "two_distinct_ideas":
        return distinctIdeaCount >= 2;
    }
  });
}

function normalizeReaction(value: string | null) {
  return value?.trim().toLowerCase() || "unspecified";
}

function isHookReactionType(value: string): value is HookReactionType {
  return (HOOK_REACTION_TYPES as readonly string[]).includes(value);
}

function circularDistance(
  registryIndex: number,
  candidateIndex: number,
  length: number,
) {
  const start = Math.abs(candidateIndex) % length;
  return (registryIndex - start + length) % length;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Stable pseudo-random value for weighted rotation. It makes a weight a chance
 * rather than a winner-takes-all rank while keeping retries idempotent.
 */
function deterministicUnitInterval(value: string) {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }

  // Finalize the FNV state so adjacent format IDs do not retain correlated
  // low bits. Without this avalanche, a small weight change can behave like a
  // much larger boost when every seed shares the same business/candidate
  // prefix.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;

  return ((hash >>> 0) + 1) / 4294967297;
}
