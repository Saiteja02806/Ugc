import {
  LEGACY_WALL_TEXT_CONTENT_LAYOUT_VERSION,
  LEGACY_WALL_TEXT_PATTERNS,
  WALL_TEXT_PATTERNS,
  WALL_TEXT_SEGMENT_ROLES,
  type TrendingWallTextContent,
  type WallTextPattern,
  type WallTextSegment,
  type WallTextSegmentRole,
} from "./wall-text-types.ts";
import type { WebsiteBusinessAnalysis } from "../website-analysis/schema.ts";
import {
  MAX_WALL_TEXT_VIDEO_DURATION_SECONDS,
  MIN_WALL_TEXT_VIDEO_DURATION_SECONDS,
} from "./wall-text-feed-logic.ts";

const MAX_WALL_TEXT_IDEA_COUNT = 50;
export const WALL_TEXT_PREFERRED_MIN_WORDS = 18;
export const WALL_TEXT_PREFERRED_MAX_WORDS = 21;
export const MAX_WALL_TEXT_WORDS = 24;
export const MAX_CURRENT_WALL_TEXT_WORDS = 50;
export const MAX_WALL_TEXT_RENDERED_LINES = 8;
export const PREFERRED_WALL_TEXT_RENDERED_LINES = { maximum: 7, minimum: 5 };
export const MIN_WALL_TEXT_WORDS = 16;
// Five visual lines need at least three words each. This prevents otherwise
// valid short copy from becoming five cramped two-word rows.
export const MIN_SHORT_WALL_TEXT_WORDS = 15;
export const MIN_WALL_TEXT_RENDERED_LINES = 5;
export type WallTextLinePolicy = {
  ideal: number;
  maximum: number;
  minimum: number;
  preferredMaximum: number;
  preferredMinimum: number;
};
export type WallTextWordPolicy = {
  maximum: number;
  minimum: number;
  preferredMaximum: number;
  preferredMinimum: number;
};
const DEFAULT_WALL_TEXT_LINE_POLICY: WallTextLinePolicy = {
  ideal: 6,
  maximum: MAX_WALL_TEXT_RENDERED_LINES,
  minimum: MIN_WALL_TEXT_RENDERED_LINES,
  preferredMaximum: PREFERRED_WALL_TEXT_RENDERED_LINES.maximum,
  preferredMinimum: PREFERRED_WALL_TEXT_RENDERED_LINES.minimum,
};
const WALL_TEXT_PATTERN_LINE_POLICIES: Partial<Record<
  WallTextPattern,
  WallTextLinePolicy
>> = {
  action_benefit: {
    ...DEFAULT_WALL_TEXT_LINE_POLICY,
    ideal: 5,
    preferredMaximum: 5,
    preferredMinimum: 5,
  },
  before_after: DEFAULT_WALL_TEXT_LINE_POLICY,
  belief_reframe: DEFAULT_WALL_TEXT_LINE_POLICY,
  mistake_correction: DEFAULT_WALL_TEXT_LINE_POLICY,
  problem_change_result: DEFAULT_WALL_TEXT_LINE_POLICY,
  situation_discovery: {
    ...DEFAULT_WALL_TEXT_LINE_POLICY,
    ideal: 5,
    preferredMaximum: 5,
    preferredMinimum: 5,
  },
};
const MAX_EXCLAMATION_MARKS = 1;
const SOCIAL_OVERLAY_READING_WORDS_PER_SECOND = 4.3;
const SENTENCE_TRANSITION_SECONDS = 0.12;
const PROMOTIONAL_CLICHES = [
  /\bare you tired of\b/iu,
  /\bbook a call\b/iu,
  /\bcutting[- ]edge\b/iu,
  /\belevate your\b/iu,
  /\bgame[- ]changer\b/iu,
  /\bget started(?: today)?\b/iu,
  /\bjoin the waitlist\b/iu,
  /\blog smarter\b/iu,
  /\bnext[- ]level\b/iu,
  /\breclaim your time\b/iu,
  /\breclaim (?:minutes|hours|time)\b/iu,
  /\brevolutioni[sz]e\b/iu,
  /\bseamless(?:ly)?\b/iu,
  /\bstart tracking(?: today)?\b/iu,
  /\bsupercharge\b/iu,
  /\btake control\b/iu,
  /\btrack \w+(?:\s+\w+)? confidently\b/iu,
  /\btransform your\b/iu,
  /\bunlock your\b/iu,
] as const;
const CTA_PATTERNS = [
  /(?:^|[.!?]\s+)(?:book|check(?:\s+your|\s+the)|click|download|focus(?:\s+on)|follow|get started|join|review(?:\s+your|\s+the)|schedule|see(?:\s+your|\s+the)|sign up|start|track(?:\s+your|\s+the)|try|use)\b/iu,
  /\b(?:available now|link in bio|learn more|shop now)\b/iu,
] as const;
const AWKWARD_GRAMMAR_PATTERNS = [
  /(?:^|[.!?]\s+)(?:assuming|ending|finding|thinking)\b/iu,
  /\b(?:clear|better|useful) (?:context|guidance|insights?),\s*(?:easier|better|simpler)\b/iu,
  /\bchoices? (?:are|become|feel) relevant,?\s*not rigid\b/iu,
  /\bgives choices context to goals\b/iu,
  /\bguidance is not (?:rigid )?rules\b/iu,
  /\bmaintain it\b/iu,
  /\btyping meals\b/iu,
] as const;
const UNSAFE_LINE_END_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "before",
  "but",
  "by",
  "for",
  "from",
  "if",
  "in",
  "into",
  "nor",
  "of",
  "on",
  "or",
  "over",
  "so",
  "than",
  "that",
  "the",
  "to",
  "under",
  "when",
  "while",
  "with",
  "yet",
]);

export type WallTextGenerationCandidate = {
  candidateIndex: number;
  durationSeconds: number;
};

export type GeneratedWallTextIdea = {
  candidateIndex: number;
  fullText: string;
  pattern: WallTextPattern;
  segments: WallTextSegment[];
};

export type WallTextBusinessContext = {
  brandTone: string | null;
  businessName: string | null;
  category: string | null;
  claimsToAvoid: string[];
  differentiators: string[];
  mainProblem: string | null;
  mainPromise: string | null;
  painPoints: string[];
  productSummary: string | null;
  targetAudience: string[];
  valueProps: string[];
};

export function getWallTextMaximumWords() {
  return MAX_WALL_TEXT_WORDS;
}

export function getWallTextLinePolicy(
  pattern: WallTextPattern,
  durationSeconds?: number,
): WallTextLinePolicy {
  if (
    durationSeconds !== undefined &&
    Number.isFinite(durationSeconds) &&
    durationSeconds <= 4.5
  ) {
    return {
      ...(WALL_TEXT_PATTERN_LINE_POLICIES[pattern] ??
        DEFAULT_WALL_TEXT_LINE_POLICY),
      ideal: MIN_WALL_TEXT_RENDERED_LINES,
      preferredMaximum: MIN_WALL_TEXT_RENDERED_LINES,
      preferredMinimum: MIN_WALL_TEXT_RENDERED_LINES,
    };
  }

  return (
    WALL_TEXT_PATTERN_LINE_POLICIES[pattern] ?? DEFAULT_WALL_TEXT_LINE_POLICY
  );
}

export function getWallTextWordPolicy(
  durationSeconds: number,
): WallTextWordPolicy {
  const durationLimitedMaximum = Math.floor(
    (durationSeconds - 0.24) * SOCIAL_OVERLAY_READING_WORDS_PER_SECOND,
  );
  const maximum = Math.min(
    MAX_WALL_TEXT_WORDS,
    Math.max(MIN_SHORT_WALL_TEXT_WORDS, durationLimitedMaximum),
  );
  const minimum =
    maximum >= MIN_WALL_TEXT_WORDS
      ? MIN_WALL_TEXT_WORDS
      : MIN_SHORT_WALL_TEXT_WORDS;
  const preferredMaximum = Math.min(
    WALL_TEXT_PREFERRED_MAX_WORDS,
    maximum,
  );
  const preferredMinimum =
    maximum >= WALL_TEXT_PREFERRED_MIN_WORDS
      ? WALL_TEXT_PREFERRED_MIN_WORDS
      : Math.max(minimum, maximum - 2);

  return {
    maximum,
    minimum,
    preferredMaximum,
    preferredMinimum,
  };
}

export function getWallTextPatternForCandidate(
  candidateIndex: number,
): WallTextPattern {
  return LEGACY_WALL_TEXT_PATTERNS[
    Math.abs(Math.trunc(candidateIndex)) % LEGACY_WALL_TEXT_PATTERNS.length
  ]!;
}

export function buildWallTextBusinessContext(
  business: WebsiteBusinessAnalysis,
): WallTextBusinessContext {
  return {
    brandTone: business.brandTone,
    businessName: business.businessName,
    category: business.category,
    claimsToAvoid: [...business.claimsToAvoid],
    differentiators: [...business.differentiators],
    mainProblem: business.mainProblem,
    mainPromise: business.mainPromise,
    painPoints: [...business.painPoints],
    productSummary: business.productSummary,
    targetAudience: [...business.targetAudience],
    valueProps: [...business.valueProps],
  };
}

export function normalizeWallTextGenerationCandidates(
  candidates: readonly WallTextGenerationCandidate[],
) {
  if (
    candidates.length === 0 ||
    candidates.length > MAX_WALL_TEXT_IDEA_COUNT
  ) {
    throw new Error("Choose between one and fifty Wall-of-text candidates.");
  }

  const normalized = candidates.map((candidate) => ({
    candidateIndex: Math.trunc(candidate.candidateIndex),
    durationSeconds:
      Math.round(Number(candidate.durationSeconds) * 1000) / 1000,
  }));

  if (
    normalized.some(
      (candidate) =>
        candidate.candidateIndex < 0 ||
        !Number.isInteger(candidate.candidateIndex) ||
        !Number.isFinite(candidate.durationSeconds) ||
        candidate.durationSeconds < MIN_WALL_TEXT_VIDEO_DURATION_SECONDS ||
        candidate.durationSeconds > MAX_WALL_TEXT_VIDEO_DURATION_SECONDS,
    ) ||
    new Set(normalized.map((candidate) => candidate.candidateIndex)).size !==
      normalized.length
  ) {
    throw new Error(
      "Wall-of-text candidates need unique indexes and valid clip durations.",
    );
  }

  return normalized;
}

export function validateGeneratedWallTextIdeas(params: {
  candidates: readonly WallTextGenerationCandidate[];
  generated: readonly GeneratedWallTextIdea[];
}) {
  const candidates = normalizeWallTextGenerationCandidates(params.candidates);
  const candidateByIndex = new Map(
    candidates.map((candidate) => [candidate.candidateIndex, candidate]),
  );
  const generatedByIndex = new Map<number, TrendingWallTextContent>();
  const seenCopy = new Set<string>();
  const seenOpenings = new Set<string>();

  for (const idea of params.generated) {
    const candidate = candidateByIndex.get(idea.candidateIndex);

    if (!candidate || generatedByIndex.has(idea.candidateIndex)) {
      throw new Error(
        "The AI returned an invalid Wall-of-text candidate mapping.",
      );
    }

    const content = toWallTextContent(idea);
    validateWallTextContent(content, candidate.durationSeconds);

    if (content.pattern !== getWallTextPatternForCandidate(idea.candidateIndex)) {
      throw new Error(
        "The AI returned a Wall-of-text pattern that does not match the assigned candidate format.",
      );
    }

    const copyKey = toComparisonKey(content.fullText);
    const openingKey = toOpeningKey(copyKey);

    if (
      seenCopy.has(copyKey) ||
      (openingKey !== null && seenOpenings.has(openingKey))
    ) {
      throw new Error("The AI returned repetitive Wall-of-text ideas.");
    }

    seenCopy.add(copyKey);

    if (openingKey !== null) {
      seenOpenings.add(openingKey);
    }

    generatedByIndex.set(idea.candidateIndex, content);
  }

  if (generatedByIndex.size !== candidates.length) {
    throw new Error(
      "The AI did not return one Wall-of-text idea for every candidate.",
    );
  }

  return candidates.map((candidate) => ({
    candidateIndex: candidate.candidateIndex,
    content: generatedByIndex.get(candidate.candidateIndex)!,
  }));
}

export function validateWallTextContent(
  content: TrendingWallTextContent,
  durationSeconds: number,
) {
  const wordCount = countWords(content.fullText);
  if (
    content.layoutVersion === "wall-text-overlay-v6" ||
    content.layoutVersion === "wall-text-overlay-v7"
  ) {
    const blocks = content.finalLayout?.blocks;
    const lines = blocks?.flatMap((block) => block.lines) ?? [];
    const authoritativeText = lines.join(" ");

    if (
      wordCount < MIN_SHORT_WALL_TEXT_WORDS ||
      wordCount > MAX_CURRENT_WALL_TEXT_WORDS
    ) {
      throw new Error(
        `Wall-of-text copy must contain ${MIN_SHORT_WALL_TEXT_WORDS}-${MAX_CURRENT_WALL_TEXT_WORDS} words.`,
      );
    }
    if (
      content.sourceContent?.kind !== "text" ||
      content.finalLayout?.version !==
        (content.layoutVersion === "wall-text-overlay-v7"
          ? "wall-text-final-layout-v3"
          : "wall-text-final-layout-v2") ||
      blocks?.length !== 1 ||
      blocks[0]?.role !== "text" ||
      normalizeText(content.sourceContent.text) !== normalizeText(content.fullText) ||
      normalizeText(authoritativeText) !== normalizeText(content.fullText)
    ) {
      throw new Error("Wall-of-text copy is missing its plain-text authoritative layout.");
    }
    if (
      lines.length < MIN_WALL_TEXT_RENDERED_LINES ||
      lines.length > MAX_WALL_TEXT_RENDERED_LINES
    ) {
      throw new Error(
        `Wall-of-text copy must render in ${MIN_WALL_TEXT_RENDERED_LINES}-${MAX_WALL_TEXT_RENDERED_LINES} lines.`,
      );
    }
    if (PROMOTIONAL_CLICHES.some((pattern) => pattern.test(content.fullText))) {
      throw new Error(
        "The AI returned generic promotional copy instead of Wall-of-text copy.",
      );
    }
    if (CTA_PATTERNS.some((pattern) => pattern.test(content.fullText))) {
      throw new Error("Wall-of-text copy must not contain a call to action.");
    }
    if (!/[.!?]["')]?$/u.test(content.fullText)) {
      throw new Error("Wall-of-text copy must end as a complete sentence.");
    }
    return;
  }
  if (content.layoutVersion === "wall-text-overlay-v5") {
    const maximum = Math.min(50, Math.max(16, Math.round(durationSeconds * 4)));
    const minimum = Math.max(12, maximum - 8);
    const blocks = content.finalLayout?.blocks;

    if (wordCount < minimum || wordCount > maximum) {
      throw new Error(
        `Wall-of-text copy must contain ${minimum}-${maximum} words for a ${durationSeconds.toFixed(1)}-second clip.`,
      );
    }
    if (!content.formatId || !content.sourceContent || !blocks?.length) {
      throw new Error("Wall-of-text copy is missing its authoritative layout.");
    }
    if (PROMOTIONAL_CLICHES.some((pattern) => pattern.test(content.fullText))) {
      throw new Error(
        "The AI returned generic promotional copy instead of Wall-of-text copy.",
      );
    }
    if (CTA_PATTERNS.some((pattern) => pattern.test(content.fullText))) {
      throw new Error("Wall-of-text copy must not contain a call to action.");
    }
    const readingSeconds = estimateWallTextReadingSeconds(
      content.fullText,
      blocks.length,
    );
    if (readingSeconds > durationSeconds + 0.15) {
      throw new Error(
        `Wall-of-text copy needs about ${readingSeconds.toFixed(1)} seconds to read, longer than the ${durationSeconds.toFixed(1)}-second clip.`,
      );
    }
    return;
  }

  const wordPolicy = getWallTextWordPolicy(durationSeconds);
  const lineCount = content.segments.reduce(
    (total, segment) => total + segment.lines.length,
    0,
  );

  if (wordCount < wordPolicy.minimum || wordCount > wordPolicy.maximum) {
    throw new Error(
      `Wall-of-text copy must contain ${wordPolicy.minimum}–${wordPolicy.maximum} words for a ${durationSeconds.toFixed(1)}-second clip.`,
    );
  }

  if (
    lineCount < MIN_WALL_TEXT_RENDERED_LINES ||
    lineCount > MAX_WALL_TEXT_RENDERED_LINES
  ) {
    throw new Error(
      `Wall-of-text copy must render in ${MIN_WALL_TEXT_RENDERED_LINES}–${MAX_WALL_TEXT_RENDERED_LINES} semantic lines.`,
    );
  }

  if (
    [...content.fullText].filter((character) => character === "!").length >
    MAX_EXCLAMATION_MARKS
  ) {
    throw new Error(
      "The AI returned Wall-of-text copy with excessive exclamation marks.",
    );
  }

  if (PROMOTIONAL_CLICHES.some((pattern) => pattern.test(content.fullText))) {
    throw new Error(
      "The AI returned generic promotional copy instead of Wall-of-text copy.",
    );
  }

  if (CTA_PATTERNS.some((pattern) => pattern.test(content.fullText))) {
    throw new Error("Wall-of-text copy must not contain a call to action.");
  }

  const sentenceCount =
    content.fullText.match(/[.!?](?=\s|$)/gu)?.length ?? 0;

  if (sentenceCount < 2 || sentenceCount > 3) {
    throw new Error(
      "Wall-of-text copy must contain two or three short grammatical sentences.",
    );
  }

  if (
    AWKWARD_GRAMMAR_PATTERNS.some((pattern) => pattern.test(content.fullText))
  ) {
    throw new Error(
      "Wall-of-text copy contains an awkward grammatical fragment.",
    );
  }

  validateSegmentRoles(content.segments);
  validateSemanticLines(content.segments);

  const readingSeconds = estimateWallTextReadingSeconds(
    content.fullText,
    content.segments.length,
  );

  if (readingSeconds > durationSeconds + 0.15) {
    throw new Error(
      `Wall-of-text copy needs about ${readingSeconds.toFixed(1)} seconds to read, longer than the ${durationSeconds.toFixed(1)}-second clip.`,
    );
  }
}

export function estimateWallTextReadingSeconds(
  value: string,
  semanticBeatCount = 2,
) {
  const sentenceTransitions = Math.max(0, semanticBeatCount - 1);
  return (
    countWords(value) / SOCIAL_OVERLAY_READING_WORDS_PER_SECOND +
    sentenceTransitions * SENTENCE_TRANSITION_SECONDS
  );
}

export function getWallTextPreviewTitle(value: string) {
  const normalized = normalizeText(value);

  if (normalized.length <= 72) {
    return normalized;
  }

  const shortened = normalized.slice(0, 69).replace(/\s+\S*$/u, "").trim();
  return `${shortened || normalized.slice(0, 69).trim()}…`;
}

function toWallTextContent(
  idea: GeneratedWallTextIdea,
): TrendingWallTextContent {
  const segments = normalizeSegments(idea.segments);
  const reconstructed = segments
    .map((segment) => segment.lines.join(" "))
    .join(" ");
  const fullText = normalizeText(idea.fullText);

  if (toComparisonKey(reconstructed) !== toComparisonKey(fullText)) {
    throw new Error(
      "Wall-of-text fullText must exactly represent the supplied semantic lines.",
    );
  }

  return {
    fullText,
    kind: "wall_text",
    layoutVersion: LEGACY_WALL_TEXT_CONTENT_LAYOUT_VERSION,
    pattern: normalizePattern(idea.pattern),
    segments,
  };
}

function normalizePattern(pattern: WallTextPattern) {
  if (!WALL_TEXT_PATTERNS.includes(pattern)) {
    throw new Error("Wall-of-text copy uses an unsupported message pattern.");
  }

  return pattern;
}

function normalizeSegments(
  segments: readonly WallTextSegment[],
): WallTextSegment[] {
  if (segments.length < 2 || segments.length > 3) {
    throw new Error("Wall-of-text copy must contain 2–3 semantic paragraphs.");
  }

  return segments.map((segment) => {
    if (
      !WALL_TEXT_SEGMENT_ROLES.includes(segment.role) ||
      !Array.isArray(segment.lines) ||
      segment.lines.length < 1 ||
      segment.lines.length > 4
    ) {
      throw new Error("Wall-of-text contains an invalid semantic segment.");
    }

    return {
      lines: segment.lines.map(normalizeText),
      role: segment.role,
    };
  });
}

function validateSegmentRoles(segments: readonly WallTextSegment[]) {
  const expectedRoles: WallTextSegmentRole[] =
    segments.length === 2
      ? ["lead", "closing"]
      : ["lead", "support", "closing"];

  if (
    segments.some((segment, index) => segment.role !== expectedRoles[index])
  ) {
    throw new Error(
      "Wall-of-text segments must follow lead, optional support, and closing order.",
    );
  }
}

function validateSemanticLines(segments: readonly WallTextSegment[]) {
  for (const segment of segments) {
    for (const [index, line] of segment.lines.entries()) {
      if (index < segment.lines.length - 1 && endsWithUnsafeBreakWord(line)) {
        throw new Error(
          "Wall-of-text line breaks cannot follow an article, conjunction, or preposition.",
        );
      }
    }
  }
}

function endsWithUnsafeBreakWord(value: string) {
  const words = value
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/u)
    .filter(Boolean);

  return UNSAFE_LINE_END_WORDS.has(words.at(-1) ?? "");
}

function normalizeText(value: string) {
  const normalized = value.replace(/\s+/gu, " ").trim();

  if (!normalized) {
    throw new Error("Wall-of-text copy cannot be empty.");
  }

  return normalized;
}

function countWords(value: string) {
  return value.split(/\s+/u).filter(Boolean).length;
}

function toComparisonKey(value: string) {
  return value
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function toOpeningKey(copyKey: string) {
  const words = copyKey.split(" ").filter(Boolean);
  return words.length >= 4 ? words.slice(0, 4).join(" ") : null;
}
