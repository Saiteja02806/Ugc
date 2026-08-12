import type { WallTextBusinessContext } from "./wall-text-text-logic";
import { getEligibleWallTextFormats } from "./wall-formats";

export type WallTextPromptCandidate = {
  candidateIndex: number;
  durationSeconds: number;
};

const GLOBAL_WALL_RULES = [
  "Write natural continuous Wall-of-Text language, not chopped Hook-style fragments.",
  "Choose only from the supplied approved formats.",
  "Use only information supported by the Business Profile.",
  "Do not invent numbers, statistics, studies, research, customer results, product features, guarantees, or medical claims.",
  "Do not decide visual line breaks and do not insert newline characters.",
  "Do not copy wording from the examples; examples demonstrate structure only.",
  "Avoid slogans, calls to action, and advertisement language.",
  "Use no more than one supported product capability in one idea.",
  "Make every candidate a distinct idea with a distinct opening.",
  "For a community prompt, stop immediately after one clear question.",
  "For a list, return one title and three to five independent short items.",
] as const;

export function getWallTextWordBudget(durationSeconds: number) {
  const maximum = clamp(Math.round(durationSeconds * 4), 16, 50);
  return { maximum, minimum: Math.max(12, maximum - 8) };
}

export function buildWallTextGenerationPrompt(params: {
  business: WallTextBusinessContext;
  candidates: readonly WallTextPromptCandidate[];
}) {
  const formats = getEligibleWallTextFormats();
  const formatGuide = formats
    .map(
      (format) => [
        `FORMAT ID: ${format.id}`,
        `NAME: ${format.name}`,
        `WHEN TO USE: ${format.whenToUse}`,
        `HOW TO WRITE: ${format.howToWrite}`,
        `STRUCTURE: ${format.structure.join(" -> ")}`,
        `CONTENT KIND: ${format.contentKind}`,
        `EXAMPLE: ${format.example}`,
      ].join("\n"),
    )
    .join("\n\n");
  const candidates = params.candidates.map((candidate) => ({
    ...candidate,
    wordBudget: getWallTextWordBudget(candidate.durationSeconds),
  }));

  return [
    "Create one original Wall-of-Text post for every supplied short-form video candidate.",
    "",
    "BUSINESS PROFILE",
    JSON.stringify(params.business, null, 2),
    "",
    "VIDEO CANDIDATES AND LENGTH BUDGETS",
    JSON.stringify(candidates, null, 2),
    "",
    "APPROVED WALL FORMATS",
    formatGuide,
    "",
    "GLOBAL RULES",
    ...GLOBAL_WALL_RULES.map((rule, index) => `${index + 1}. ${rule}`),
    "",
    "TASK",
    "For each candidate, choose the approved format that naturally fits its idea and return that candidateIndex, formatId, and structured content.",
    "Prose content is { kind: 'prose', text: 'continuous text' }.",
    "List content is { kind: 'list', title: 'short title', items: ['item', 'item', 'item'] }.",
    "Return exactly one result for every candidate. Do not return final visual lines.",
  ].join("\n");
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
