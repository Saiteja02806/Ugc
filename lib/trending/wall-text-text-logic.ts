import {
  WALL_TEXT_CONTENT_LAYOUT_VERSION,
  type TrendingWallTextContent,
} from "./wall-text-types.ts";

const MAX_WALL_TEXT_IDEA_COUNT = 6;

export type WallTextGenerationCandidate = {
  candidateIndex: number;
  durationSeconds: number;
};

export type GeneratedWallTextIdea = {
  body: string;
  candidateIndex: number;
  closing: string;
  headline: string;
};

export function getWallTextMaximumWords(durationSeconds: number) {
  return Math.min(
    72,
    Math.max(18, Math.floor(normalizeDuration(durationSeconds) * 2.5)),
  );
}

export function normalizeWallTextGenerationCandidates(
  candidates: readonly WallTextGenerationCandidate[],
) {
  if (
    candidates.length === 0 ||
    candidates.length > MAX_WALL_TEXT_IDEA_COUNT
  ) {
    throw new Error("Choose between one and six Wall-of-text candidates.");
  }

  const normalized = candidates.map((candidate) => ({
    candidateIndex: Math.trunc(candidate.candidateIndex),
    durationSeconds: normalizeDuration(candidate.durationSeconds),
  }));

  if (
    normalized.some(
      (candidate) =>
        candidate.candidateIndex < 0 ||
        !Number.isInteger(candidate.candidateIndex),
    ) ||
    new Set(normalized.map((candidate) => candidate.candidateIndex)).size !==
      normalized.length
  ) {
    throw new Error(
      "Wall-of-text candidate indexes must be unique non-negative integers.",
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

  for (const idea of params.generated) {
    const candidate = candidateByIndex.get(idea.candidateIndex);

    if (!candidate || generatedByIndex.has(idea.candidateIndex)) {
      throw new Error(
        "The AI returned an invalid Wall-of-text candidate mapping.",
      );
    }

    const content = toWallTextContent(idea);
    const wordCount = content.blocks.reduce(
      (total, block) => total + countWords(block.text),
      0,
    );

    if (wordCount > getWallTextMaximumWords(candidate.durationSeconds)) {
      throw new Error(
        "The AI returned Wall-of-text copy that is too long to read.",
      );
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

function toWallTextContent(
  idea: GeneratedWallTextIdea,
): TrendingWallTextContent {
  const headline = normalizeBlock(idea.headline, "headline");
  const body = normalizeBlock(idea.body, "body");
  const closing = normalizeBlock(idea.closing, "closing");

  return {
    blocks: [
      { id: "headline", text: headline },
      { id: "body", text: body },
      { id: "closing", text: closing },
    ],
    kind: "wall_text",
    layoutVersion: WALL_TEXT_CONTENT_LAYOUT_VERSION,
  };
}

function normalizeBlock(value: string, label: string) {
  const normalized = value.replace(/\s+/gu, " ").trim();

  if (!normalized) {
    throw new Error(`Wall-of-text ${label} copy cannot be empty.`);
  }

  return normalized;
}

function countWords(value: string) {
  return value.split(/\s+/u).filter(Boolean).length;
}

function normalizeDuration(durationSeconds: number) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error(
      "Wall-of-text candidates require a valid video duration.",
    );
  }

  return Math.round(durationSeconds * 1000) / 1000;
}
