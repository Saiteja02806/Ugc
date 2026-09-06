import type {
  ReactionContent,
  ReactionSemanticBeats,
} from "./taxonomy.ts";

export const REACTION_COPY_MINIMUM_WORDS = 5;
export const REACTION_COPY_MAXIMUM_WORDS = 20;
export const REACTION_COPY_MAXIMUM_LINES = 3;

const productCopyPattern = /\b(our|we|sign\s*up|start\s+(?:your|a)\s+free|try\s+(?:it|us|this)|buy\s+now|download\s+(?:it|the))\b/iu;
const featureClaimPattern = /\b(?:ai|app|platform|tool)\s+(?:automatically|instantly|guarantees|will)\b/iu;

export class ReactionContentError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(issues[0] ?? "Reaction content is invalid.");
    this.name = "ReactionContentError";
    this.issues = issues;
  }
}

export type ReactionGenerationContext = {
  audience: readonly string[];
  commonSituations: readonly string[];
  desiredOutcomes: readonly string[];
  pains: readonly string[];
  productName?: string | null;
};

export function assertReactionContent(content: ReactionContent) {
  const issues = validateReactionContent(content);

  if (issues.length > 0) {
    throw new ReactionContentError(issues);
  }

  return {
    ...content,
    caption: normalizeText(content.caption),
    lines: content.lines.map(normalizeText),
    visualContextTags: normalizeTags(content.visualContextTags),
  };
}

export function validateReactionContent(
  content: ReactionContent,
): readonly string[] {
  const issues: string[] = [];
  const lines = content.lines.map(normalizeText).filter(Boolean);
  const caption = normalizeText(content.caption);
  const visibleText = lines.join(" ");
  const wordCount = getWordCount(visibleText);

  if (!caption) {
    issues.push("A reaction caption is required.");
  }

  if (lines.length < 1 || lines.length > REACTION_COPY_MAXIMUM_LINES) {
    issues.push(
      `Reaction copy must render in 1–${REACTION_COPY_MAXIMUM_LINES} lines.`,
    );
  }

  if (caption !== visibleText) {
    issues.push("Reaction caption and rendered lines must contain the same words.");
  }

  if (
    wordCount < REACTION_COPY_MINIMUM_WORDS ||
    wordCount > REACTION_COPY_MAXIMUM_WORDS
  ) {
    issues.push(
      `Reaction copy must contain ${REACTION_COPY_MINIMUM_WORDS}–${REACTION_COPY_MAXIMUM_WORDS} words.`,
    );
  }

  if (productCopyPattern.test(visibleText) || featureClaimPattern.test(visibleText)) {
    issues.push("Reaction copy must describe a human moment, not sell a product.");
  }

  validateSemanticBeats(content.semantic, issues);

  if (
    content.visualTreatment === "caption_with_labels" &&
    (content.semantic.structure !== "role_contrast" ||
      content.semantic.roles.length < 2)
  ) {
    issues.push("Caption-with-labels is reserved for role-contrast reactions.");
  }

  if (
    content.semantic.structure === "role_contrast" &&
    content.visualTreatment !== "caption_with_labels"
  ) {
    issues.push("Role-contrast reactions require visible character labels.");
  }

  return issues;
}

export function buildReactionGenerationPrompt(
  context: ReactionGenerationContext,
) {
  return [
    "Create a short reaction-format caption from this business context.",
    "Transform a feature into a human outcome, then a recognizable moment. Do not write advertising copy.",
    "Choose exactly one meme structure: situation_payoff, expectation_reality, comparison, action_realization, setup_escalation, role_contrast.",
    "Choose exactly one languageFormat: pov, when, me_when, me_after, me_realizing, direct_statement, comparison.",
    "Choose exactly one emotion: relief, frustration, surprise, regret, satisfaction, irony, escalation.",
    "Choose exactly one visualTreatment: white_card, outlined_text, caption_with_labels. caption_with_labels may only be used with role_contrast and two role labels.",
    `Caption requirements: ${REACTION_COPY_MINIMUM_WORDS}–${REACTION_COPY_MAXIMUM_WORDS} words, 1–${REACTION_COPY_MAXIMUM_LINES} semantically balanced lines, conversational, no CTA, no product claim.`,
    "Return structured JSON with caption, lines, semantic beats, emotion, languageFormat, visualTreatment, and visualContextTags.",
    `Audience: ${joinOrFallback(context.audience)}.`,
    `Pains: ${joinOrFallback(context.pains)}.`,
    `Common situations: ${joinOrFallback(context.commonSituations)}.`,
    `Desired outcomes: ${joinOrFallback(context.desiredOutcomes)}.`,
    context.productName
      ? `The product is ${context.productName}; mention it only if the caption remains a real-life moment.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function validateSemanticBeats(
  semantic: ReactionSemanticBeats,
  issues: string[],
) {
  const values = Object.entries(semantic)
    .filter(([key]) => key !== "structure" && key !== "roles")
    .map(([, value]) => (typeof value === "string" ? normalizeText(value) : ""));

  if (values.some((value) => !value)) {
    issues.push("Each selected reaction structure needs both of its semantic beats.");
  }

  if (semantic.structure === "role_contrast") {
    const roles = semantic.roles.map(normalizeText).filter(Boolean);
    if (roles.length < 2 || roles.length > 4) {
      issues.push("Role-contrast reactions need two to four short labels.");
    }
  }
}

function getWordCount(value: string) {
  return value.split(/\s+/u).filter(Boolean).length;
}

function joinOrFallback(values: readonly string[]) {
  const normalized = values.map(normalizeText).filter(Boolean);
  return normalized.length > 0 ? normalized.join("; ") : "not supplied";
}

function normalizeTags(values: readonly string[]) {
  return [...new Set(values.map((value) => normalizeText(value).toLowerCase()).filter(Boolean))];
}

function normalizeText(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}
