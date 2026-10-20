type ReactionFactType = "audience" | "capability" | "differentiator" | "outcome" | "pain";

export type ReactionContentGrounding =
  | {
      factId: string;
      factText: string;
      factType: ReactionFactType;
      mode: "business_fact";
    }
  | { mode: "awareness_generic" };

/**
 * Reads only the backend-owned grounding object persisted by the generation
 * worker. A caller-provided fact ID is never accepted as a substitute.
 */
export function getReactionContentGrounding(
  content: Record<string, unknown>,
): ReactionContentGrounding | null {
  const value = content.grounding;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const grounding = value as Record<string, unknown>;
  if (grounding.mode === "awareness_generic") return { mode: "awareness_generic" };
  if (
    grounding.mode !== "business_fact" ||
    typeof grounding.factId !== "string" ||
    typeof grounding.factText !== "string" ||
    !isFactType(grounding.factType)
  ) {
    return null;
  }

  const factId = grounding.factId.trim();
  const factText = normalizeText(grounding.factText).slice(0, 360);
  return factId && factText
    ? { factId, factText, factType: grounding.factType, mode: "business_fact" }
    : null;
}

export function getReactionGroundingIssue(params: {
  content: Record<string, unknown>;
  text: string;
}) {
  const grounding = getReactionContentGrounding(params.content);
  if (!grounding || grounding.mode === "awareness_generic") return null;

  const captionTerms = new Set(extractTerms(params.text));
  const factTerms = extractTerms(grounding.factText);
  const requiredMatches = Math.min(2, factTerms.length);

  if (requiredMatches === 0 || factTerms.filter((term) => captionTerms.has(term)).length < requiredMatches) {
    return "Keep this Reaction Reel connected to its approved business fact by using at least two distinctive words from the original business context.";
  }

  const highRiskIssue = getUnsupportedHighRiskClaimIssue(params.text, grounding.factText);
  if (highRiskIssue) return highRiskIssue;

  return null;
}

// Keep manual edits from reintroducing the same unsupported automation,
// certainty, or bundled-workflow claims that the worker rejects at generation.
// A V1 creative has no grounding object and intentionally remains editable.
function getUnsupportedHighRiskClaimIssue(text: string, factText: string) {
  const normalizedFact = normalizeText(factText).toLocaleLowerCase("en-US");
  const supports = (...phrases: readonly string[]) =>
    phrases.some((phrase) => normalizedFact.includes(phrase));

  if (
    /\b(?:logs?|tracks?|counts?|calculates?|records?|enters?)\s+(?:itself|themselves)\b/iu.test(text) &&
    !supports("logs itself", "tracks itself", "counts itself", "calculates itself", "records itself", "enters itself")
  ) {
    return "This edit claims self-running automation that is not in the approved business fact.";
  }
  if (
    /\b(?:automatically|automatic|autopilot|hands[-\s]?free)\b/iu.test(text) &&
    !supports("automatically", "automatic", "autopilot", "hands free")
  ) {
    return "This edit claims automation that is not in the approved business fact.";
  }
  if (
    /\b(?:actual|exact|accurate|precise|100\s*%|guarantee(?:d|s)?)\b/iu.test(text) &&
    !supports("actual", "exact", "accurate", "precise", "100", "guarantee")
  ) {
    return "This edit claims an accuracy level or guarantee that is not in the approved business fact.";
  }
  if (
    /\b(?:all[-\s]?in[-\s]?one|without\s+(?:\w+\s+){0,4}(?:apps?|tools?))\b/iu.test(text) &&
    !supports(
      "all in one",
      "all-in-one",
      "single app",
      "one app",
      "without switching apps",
      "without multiple apps",
      "without different apps",
      "without tools",
    )
  ) {
    return "This edit claims a bundled workflow that is not in the approved business fact.";
  }
  if (
    /\b(?:instant|instantly)\b/iu.test(text) &&
    !supports("instant", "instantly")
  ) {
    return "This edit claims a speed or immediacy that is not in the approved business fact.";
  }
  return null;
}

function isFactType(value: unknown): value is ReactionFactType {
  return value === "audience" || value === "capability" || value === "differentiator" || value === "outcome" || value === "pain";
}

function extractTerms(value: string) {
  const ignored = new Set([
    "about", "after", "again", "because", "being", "business", "could",
    "every", "first", "from", "have", "into", "just", "more", "only",
    "people", "really", "that", "their", "there", "these", "they", "this",
    "those", "through", "using", "when", "with", "your",
  ]);
  return [...new Set(
    normalizeText(value)
      .toLocaleLowerCase("en-US")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .split(" ")
      .filter((term) => term.length >= 4 && !ignored.has(term)),
  )];
}

function normalizeText(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}
