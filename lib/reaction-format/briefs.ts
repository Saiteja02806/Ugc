import {
  assertReactionContent,
  ReactionContentError,
  type ReactionGenerationContext,
} from "./content.ts";
import {
  isReactionClipType,
  isReactionEmotion,
  isReactionLanguageFormat,
  isReactionVisualTreatment,
  reactionTypesByEmotion,
  type ReactionClipType,
  type ReactionContent,
  type ReactionSemanticBeats,
} from "./taxonomy.ts";

export const MAX_REACTION_BRIEFS_PER_BATCH = 12;

export type ReactionAvailabilityIntent = {
  freshClipCount: number;
  intent: ReactionClipType;
  reusableClipCount: number;
};

export type ReactionAvailabilityPalette = {
  availableReactionPalette: readonly ReactionAvailabilityIntent[];
  generationRule: string;
  recentlyShownIntents: readonly ReactionClipType[];
};

export type ReactionBrief = {
  content: ReactionContent;
  preferredReactions: readonly ReactionClipType[];
  slotIndex: number;
};

export class ReactionBriefError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(issues[0] ?? "Reaction brief output is invalid.");
    this.name = "ReactionBriefError";
    this.issues = issues;
  }
}

export function buildReactionBriefGenerationPrompt(params: {
  availability: ReactionAvailabilityPalette;
  context: ReactionGenerationContext;
  requestedCount: number;
}) {
  assertRequestedCount(params.requestedCount);

  return [
    "Create a batch of reaction-format briefs from the business context.",
    `Return exactly ${params.requestedCount} briefs with slotIndex values 0 through ${params.requestedCount - 1}.`,
    "A brief is not an asset selection: never return a clip ID, background ID, filename, URL, or storage key.",
    "For each brief, return content and preferredReactions. preferredReactions must contain one to three controlled reaction intents, ordered from strongest to weakest fit.",
    "Keep primary reactions varied when the availability palette offers relevant alternatives.",
    params.availability.generationRule,
    `Available reaction palette (internal): ${JSON.stringify(params.availability.availableReactionPalette)}.`,
    `Recently shown reaction intents (internal): ${params.availability.recentlyShownIntents.join(", ") || "none"}.`,
    "Return JSON only: { briefs: [{ slotIndex, preferredReactions, content }] }.",
    buildBusinessContext(params.context),
  ].join("\n");
}

export function assertReactionBriefBatch(params: {
  availability: ReactionAvailabilityPalette;
  expectedCount: number;
  value: unknown;
}): readonly ReactionBrief[] {
  assertRequestedCount(params.expectedCount);
  const issues: string[] = [];
  const envelope = asRecord(params.value);
  const rawBriefs = envelope?.briefs;
  if (!Array.isArray(rawBriefs) || rawBriefs.length !== params.expectedCount) {
    throw new ReactionBriefError([
      `Reaction brief output must contain exactly ${params.expectedCount} briefs.`,
    ]);
  }

  const briefs: ReactionBrief[] = [];
  const seenSlots = new Set<number>();
  for (const [index, rawBrief] of rawBriefs.entries()) {
    const result = parseBrief(rawBrief, index);
    if (result instanceof ReactionBriefError) {
      issues.push(...result.issues);
      continue;
    }
    if (seenSlots.has(result.slotIndex)) {
      issues.push(`Brief ${index + 1} repeats slotIndex ${result.slotIndex}.`);
      continue;
    }
    seenSlots.add(result.slotIndex);
    briefs.push(result);
  }

  for (let slotIndex = 0; slotIndex < params.expectedCount; slotIndex += 1) {
    if (!seenSlots.has(slotIndex)) {
      issues.push(`Reaction brief output is missing slotIndex ${slotIndex}.`);
    }
  }

  if (issues.length > 0) throw new ReactionBriefError(issues);
  assertBriefsRespectAvailability(briefs, params.availability);
  return briefs.sort((left, right) => left.slotIndex - right.slotIndex);
}

function parseBrief(value: unknown, index: number): ReactionBrief | ReactionBriefError {
  const raw = asRecord(value);
  const issues: string[] = [];
  if (!raw) return new ReactionBriefError([`Brief ${index + 1} must be an object.`]);

  const slotIndex = raw.slotIndex;
  if (
    typeof slotIndex !== "number" ||
    !Number.isInteger(slotIndex) ||
    slotIndex < 0
  ) {
    return new ReactionBriefError([
      `Brief ${index + 1} needs a non-negative integer slotIndex.`,
    ]);
  }

  const preferredReactions = parsePreferredReactions(raw.preferredReactions, index, issues);
  const content = parseContent(raw.content, index, issues);
  if (issues.length > 0 || !content || !preferredReactions) {
    return new ReactionBriefError(issues);
  }

  const allowedForEmotion = reactionTypesByEmotion[content.emotion];
  if (!allowedForEmotion.includes(preferredReactions[0])) {
    return new ReactionBriefError([
      `Brief ${index + 1} primary reaction must fit its selected emotion.`,
    ]);
  }

  return {
    content,
    preferredReactions,
    slotIndex,
  };
}

function parsePreferredReactions(
  value: unknown,
  index: number,
  issues: string[],
): readonly ReactionClipType[] | null {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > 3 ||
    !value.every((item) => typeof item === "string" && isReactionClipType(item)) ||
    new Set(value).size !== value.length
  ) {
    issues.push(`Brief ${index + 1} needs one to three unique controlled preferredReactions.`);
    return null;
  }
  return value;
}

function parseContent(
  value: unknown,
  index: number,
  issues: string[],
): ReactionContent | null {
  const raw = asRecord(value);
  if (!raw) {
    issues.push(`Brief ${index + 1} content must be an object.`);
    return null;
  }
  if (
    typeof raw.caption !== "string" ||
    !Array.isArray(raw.lines) ||
    !raw.lines.every((line) => typeof line === "string") ||
    typeof raw.emotion !== "string" ||
    !isReactionEmotion(raw.emotion) ||
    typeof raw.languageFormat !== "string" ||
    !isReactionLanguageFormat(raw.languageFormat) ||
    typeof raw.visualTreatment !== "string" ||
    !isReactionVisualTreatment(raw.visualTreatment) ||
    !Array.isArray(raw.visualContextTags) ||
    raw.visualContextTags.length < 1 ||
    raw.visualContextTags.length > 3 ||
    !raw.visualContextTags.every((tag) => typeof tag === "string" && tag.trim())
  ) {
    issues.push(`Brief ${index + 1} content uses invalid controlled fields.`);
    return null;
  }

  const semantic = parseSemantic(raw.semantic);
  if (!semantic) {
    issues.push(`Brief ${index + 1} content has invalid semantic beats.`);
    return null;
  }

  const content: ReactionContent = {
    caption: raw.caption,
    emotion: raw.emotion,
    languageFormat: raw.languageFormat,
    lines: raw.lines,
    semantic,
    visualContextTags: raw.visualContextTags,
    visualTreatment: raw.visualTreatment,
  };
  try {
    return assertReactionContent(content);
  } catch (error) {
    const detail = error instanceof ReactionContentError ? error.issues : ["is invalid"];
    issues.push(...detail.map((message) => `Brief ${index + 1} ${message}`));
    return null;
  }
}

function parseSemantic(value: unknown): ReactionSemanticBeats | null {
  const raw = asRecord(value);
  if (!raw || typeof raw.structure !== "string") return null;

  switch (raw.structure) {
    case "situation_payoff":
      return hasStrings(raw, ["situation", "payoff"])
        ? { payoff: raw.payoff, situation: raw.situation, structure: raw.structure }
        : null;
    case "expectation_reality":
      return hasStrings(raw, ["expectation", "reality"])
        ? { expectation: raw.expectation, reality: raw.reality, structure: raw.structure }
        : null;
    case "comparison":
      return hasStrings(raw, ["left", "right"])
        ? { left: raw.left, right: raw.right, structure: raw.structure }
        : null;
    case "action_realization":
      return hasStrings(raw, ["action", "realization"])
        ? { action: raw.action, realization: raw.realization, structure: raw.structure }
        : null;
    case "setup_escalation":
      return hasStrings(raw, ["setup", "escalation"])
        ? { escalation: raw.escalation, setup: raw.setup, structure: raw.structure }
        : null;
    case "role_contrast":
      return hasStrings(raw, ["caption"]) &&
        Array.isArray(raw.roles) &&
        raw.roles.every((role) => typeof role === "string")
        ? { caption: raw.caption, roles: raw.roles, structure: raw.structure }
        : null;
    default:
      return null;
  }
}

function assertBriefsRespectAvailability(
  briefs: readonly ReactionBrief[],
  availability: ReactionAvailabilityPalette,
) {
  const available = new Set(
    availability.availableReactionPalette
      .filter((item) => item.freshClipCount + item.reusableClipCount > 0)
      .map((item) => item.intent),
  );
  const issues: string[] = [];
  for (const brief of briefs) {
    if (!available.has(brief.preferredReactions[0])) {
      issues.push(
        `Brief ${brief.slotIndex + 1} primary reaction intent is not currently available to the catalog.`,
      );
    }
  }
  if (available.size >= briefs.length) {
    const primaryReactions = briefs.map((brief) => brief.preferredReactions[0]);
    if (new Set(primaryReactions).size !== primaryReactions.length) {
      issues.push("Briefs repeat a primary reaction even though the catalog offers enough distinct intents.");
    }
  }
  if (issues.length > 0) throw new ReactionBriefError(issues);
}

function buildBusinessContext(context: ReactionGenerationContext) {
  return [
    `Audience: ${joinOrFallback(context.audience)}.`,
    `Pains: ${joinOrFallback(context.pains)}.`,
    `Common situations: ${joinOrFallback(context.commonSituations)}.`,
    `Desired outcomes: ${joinOrFallback(context.desiredOutcomes)}.`,
    context.productName
      ? `The product is ${context.productName}; use it only as invisible context, not as ad copy.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function assertRequestedCount(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > MAX_REACTION_BRIEFS_PER_BATCH) {
    throw new ReactionBriefError([
      `Reaction batch size must be between 1 and ${MAX_REACTION_BRIEFS_PER_BATCH}.`,
    ]);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function hasStrings(
  value: Record<string, unknown>,
  keys: readonly string[],
): value is Record<string, string> {
  return keys.every((key) => typeof value[key] === "string" && value[key].trim());
}

function joinOrFallback(values: readonly string[]) {
  const normalized = values.map((value) => value.trim()).filter(Boolean);
  return normalized.length > 0 ? normalized.join("; ") : "not supplied";
}
