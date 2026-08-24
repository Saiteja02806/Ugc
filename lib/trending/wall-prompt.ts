import type { WallTextBusinessContext } from "./wall-text-text-logic";
import { getWallTextFormat } from "./wall-formats";
import type { WallTextFormatId } from "./wall-text-types";

export const WALL_TEXT_PROMPT_VERSION =
  "wall-text-writer-prompt-v8-spatial-fit" as const;

export type WallTextPromptCandidate = {
  assignedFormatId: WallTextFormatId;
  candidateIndex: number;
  maxWords: number;
  referenceText?: string;
  retryFeedback?: {
    avoidOpening?: string;
    reason: string;
  };
  targetWords: number;
};

const GLOBAL_WALL_RULES = [
  "Write natural continuous Wall-of-Text language, not chopped Hook-style fragments.",
  "Follow the code-assigned format for each candidate.",
  "Use only information supported by the Business Profile.",
  "Do not invent numbers, statistics, studies, research, customer results, product features, guarantees, or medical claims.",
  "Do not decide visual line breaks and do not insert newline characters.",
  "Do not copy wording from the examples; examples demonstrate structure only.",
  "Avoid slogans, calls to action, and advertisement language.",
  "Use no more than one supported product capability in one idea.",
  "Make every candidate a distinct idea with a distinct opening.",
  "For a community prompt, stop immediately after one clear question.",
  "Return one continuous message per candidate: no title, bullets, list object, sections, or visual line breaks.",
  "Before answering, silently self-check grammar, completeness, unsupported claims, calls to action, assigned format, and the absolute safety ceiling inside this same request.",
] as const;

export function buildWallTextGenerationPrompt(params: {
  business: WallTextBusinessContext;
  candidates: readonly WallTextPromptCandidate[];
}) {
  const formatIds = [...new Set(params.candidates.map((candidate) =>
    candidate.assignedFormatId,
  ))];
  const formats = formatIds.map(getWallTextFormat);
  const formatGuide = formats
    .map(
      (format) => [
        `FORMAT ID: ${format.id}`,
        `NAME: ${format.name}`,
        `WHEN TO USE: ${format.whenToUse}`,
        `HOW TO WRITE: ${format.howToWrite}`,
        `STRUCTURE: ${format.structure.join(" -> ")}`,
        `EXAMPLE: ${format.example}`,
      ].join("\n"),
    )
    .join("\n\n");
  const candidates = params.candidates.map((candidate) => ({
    assignedFormatId: candidate.assignedFormatId,
    candidateIndex: candidate.candidateIndex,
    maxWords: candidate.maxWords,
    ...(candidate.referenceText
      ? { referenceTextForThisCandidateOnly: candidate.referenceText }
      : {}),
    ...(candidate.retryFeedback ? { retryFeedback: candidate.retryFeedback } : {}),
    targetWords: candidate.targetWords,
  }));

  return [
    "Create one original Wall-of-Text post for every supplied short-form video candidate.",
    "",
    "BUSINESS PROFILE",
    JSON.stringify(params.business, null, 2),
    "",
    "CANDIDATES: SOFT COPY TARGETS AND ABSOLUTE SAFETY CEILINGS",
    JSON.stringify(candidates, null, 2),
    "",
    "APPROVED WALL FORMATS",
    formatGuide,
    "",
    "GLOBAL RULES",
    ...GLOBAL_WALL_RULES.map((rule, index) => `${index + 1}. ${rule}`),
    "",
    "TASK",
    "For each candidate, use its assignedFormatId and return only candidateIndex plus one complete text string.",
    "Treat targetWords as a soft writing target, not a required minimum. maxWords is only the absolute safety ceiling; the layout engine will decide final acceptance from measured 4-7 line fit.",
    "A referenceTextForThisCandidateOnly belongs only to that candidate. Use it only as structural and emotional inspiration, adapt it to the Business Profile, and do not copy its wording.",
    "Reference text is not evidence. Never repeat its numbers, psychology statements, factual claims, product names, or promises unless the Business Profile independently supports them.",
    "Return exactly one result for every candidate. Do not return formatId, duration, coordinates, or final visual lines.",
  ].join("\n");
}
