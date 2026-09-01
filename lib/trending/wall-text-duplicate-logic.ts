import { createHash } from "node:crypto";

export const WALL_TEXT_DUPLICATE_SIGNATURE_VERSION =
  "wall-text-duplicate-signature-v1" as const;
// Related ideas and wording variations are allowed. The hard gate blocks only
// a literal copy after normalizing case, punctuation, and spacing.

export type WallTextDuplicateSignature = {
  contentHash: string;
  normalizedText: string;
  opening: string;
  shingles: string[];
  version: typeof WALL_TEXT_DUPLICATE_SIGNATURE_VERSION;
};

export type WallTextDuplicateMatch = {
  matchedContentHash: string;
  reason: "exact_duplicate";
  similarity: number;
};

export function normalizeWallTextForHistory(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[\u2018\u2019']/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function createWallTextContentHash(normalizedText: string) {
  return createHash("sha256").update(normalizedText, "utf8").digest("hex");
}

export function createWallTextDuplicateSignature(
  value: string,
): WallTextDuplicateSignature {
  const normalizedText = normalizeWallTextForHistory(value);
  const words = normalizedText.split(" ").filter(Boolean);
  return {
    contentHash: createWallTextContentHash(normalizedText),
    normalizedText,
    opening: words.slice(0, 6).join(" "),
    shingles: createWordShingles(words),
    version: WALL_TEXT_DUPLICATE_SIGNATURE_VERSION,
  };
}

export function findWallTextDuplicate(params: {
  candidate: WallTextDuplicateSignature;
  history: readonly WallTextDuplicateSignature[];
}) {
  for (const previous of params.history) {
    if (previous.contentHash === params.candidate.contentHash) {
      return {
        matchedContentHash: previous.contentHash,
        reason: "exact_duplicate",
        similarity: 1,
      } satisfies WallTextDuplicateMatch;
    }
  }

  return null;
}

export function getWallTextSimilarity(
  left: WallTextDuplicateSignature,
  right: WallTextDuplicateSignature,
) {
  if (!left.normalizedText || !right.normalizedText) return 0;
  const shingleSimilarity = jaccard(left.shingles, right.shingles);
  const tokenSimilarity = jaccard(
    left.normalizedText.split(" "),
    right.normalizedText.split(" "),
  );
  const openingSimilarity = jaccard(
    left.opening.split(" "),
    right.opening.split(" "),
  );
  return Math.max(
    shingleSimilarity,
    tokenSimilarity * 0.8 + openingSimilarity * 0.2,
  );
}

function createWordShingles(words: readonly string[]) {
  if (words.length < 3) return [...new Set(words)];
  return [...new Set(words.slice(0, -2).map((word, index) =>
    `${word} ${words[index + 1]} ${words[index + 2]}`,
  ))];
}

function jaccard(left: readonly string[], right: readonly string[]) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (leftSet.size === 0 || rightSet.size === 0) return 0;
  let intersection = 0;
  for (const value of leftSet) {
    if (rightSet.has(value)) intersection += 1;
  }
  return intersection / (leftSet.size + rightSet.size - intersection);
}
