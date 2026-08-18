import {
  createWallTextDuplicateSignature,
  getWallTextSimilarity,
} from "./wall-text-duplicate-logic.ts";

export type WallTextEditClassification = "none" | "minor" | "major";

export function classifyWallTextEdit(params: {
  editedText: string;
  originalText: string;
}) {
  const original = createWallTextDuplicateSignature(params.originalText);
  const edited = createWallTextDuplicateSignature(params.editedText);
  if (original.contentHash === edited.contentHash) {
    return {
      classification: "none" as const,
      duplicateSignature: edited,
      formatAttribution: "original" as const,
      formatLearningEligible: true,
      similarity: 1,
    };
  }

  const originalWords = countWords(original.normalizedText);
  const editedWords = countWords(edited.normalizedText);
  const wordCountRatio = originalWords > 0 ? editedWords / originalWords : 0;
  const similarity = getWallTextSimilarity(original, edited);
  const isMinor =
    similarity >= 0.8 && wordCountRatio >= 0.8 && wordCountRatio <= 1.2;

  return {
    classification: isMinor ? ("minor" as const) : ("major" as const),
    duplicateSignature: edited,
    formatAttribution: isMinor ? ("minor_edit" as const) : ("major_edit" as const),
    formatLearningEligible: isMinor,
    similarity,
  };
}

function countWords(value: string) {
  return value.split(/\s+/u).filter(Boolean).length;
}
