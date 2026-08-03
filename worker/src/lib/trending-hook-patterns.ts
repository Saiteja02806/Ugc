export const TRENDING_HOOK_PATTERN_LIBRARY_VERSION =
  "trending-hook-patterns-v2";

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
  preferredReactions: readonly string[];
};

/**
 * These are structural writing directions, not reusable sentences. Risky
 * families that depend on numbers, personal history, humor, or a visible demo
 * stay out of the initial registry until those facts are explicitly verified.
 */
export const TRENDING_HOOK_PATTERNS = [
  {
    id: "mystery_discovery",
    name: "Mystery discovery",
    instruction:
      "Reveal one surprising business truth while leaving a small, honest information gap.",
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
    preferredReactions: [
      "confidence_approval",
      "focused_attention",
      "shock_surprise",
      "secret_reveal",
    ],
  },
] as const satisfies readonly TrendingHookPatternDefinition[];

export function selectTrendingHookPatterns(params: {
  candidateIndex: number;
  reactionType: string | null;
  count?: number;
}) {
  const count = Math.max(
    1,
    Math.min(
      params.count ?? 2,
      TRENDING_HOOK_PATTERNS.length,
    ),
  );
  const reaction = normalizeReaction(params.reactionType);
  const ranked = TRENDING_HOOK_PATTERNS.map((pattern, registryIndex) => ({
    pattern,
    registryIndex,
    affinity: (pattern.preferredReactions as readonly string[]).includes(
      reaction,
    )
      ? 1
      : 0,
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
  return (
    TRENDING_HOOK_PATTERNS.find(
      (pattern) => pattern.id === patternId,
    ) ?? null
  );
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
