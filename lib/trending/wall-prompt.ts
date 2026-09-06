import {
  MIN_SHORT_WALL_TEXT_WORDS,
  type WallTextBusinessContext,
} from "./wall-text-text-logic";
import { WALL_TEXT_SOFT_WORD_RANGE } from "./wall-text-copy-policy";

export const WALL_TEXT_PROMPT_VERSION =
  "wall-text-writer-prompt-v12-word-range-fixed-font" as const;

export type WallTextPromptCandidate = {
  candidateIndex: number;
  maxWords: number;
  referenceText?: string;
  retryFeedback?: {
    avoidOpening?: string;
    reason: string;
  };
  privateCreativeContext?: {
    contentIdea: string;
    feeling: string;
    planningBrief: {
      audienceContext: string;
      conceptLane?: string;
      creativeSeed: string;
      emotionalTension: string;
      humanMoment: string;
      supportedAngle: string;
    };
  };
  targetWords: number;
};

const GLOBAL_WALL_RULES = [
  "Write natural continuous Wall-of-Text language, not chopped Hook-style fragments.",
  `Write at least ${MIN_SHORT_WALL_TEXT_WORDS} words so the layout can form five readable lines.`,
  "Use only information supported by the Business Profile.",
  "Do not invent numbers, statistics, studies, research, customer results, product features, guarantees, or medical claims.",
  "Do not decide visual line breaks and do not insert newline characters.",
  "Avoid slogans, calls to action, and advertisement language.",
  "Use no more than one supported product capability in one idea.",
  "When privateCreativeContext is present, use its contentIdea, feeling, all five planningBrief fields, and its assigned concept lane when present as private guidance. Do not print field names or treat creativeSeed as finished copy.",
  "Make every candidate a distinct idea with a distinct opening.",
  "Return one continuous message per candidate: no title, bullets, list object, sections, or visual line breaks.",
  "Before answering, silently self-check grammar, completeness, unsupported claims, calls to action, one-idea focus, and the absolute safety ceiling inside this same request.",
] as const;

export function buildWallTextGenerationPrompt(params: {
  business: WallTextBusinessContext;
  candidates: readonly WallTextPromptCandidate[];
}) {
  const candidates = params.candidates.map((candidate) => ({
    candidateIndex: candidate.candidateIndex,
    maxWords: candidate.maxWords,
    ...(candidate.referenceText
      ? { referenceTextForThisCandidateOnly: candidate.referenceText }
      : {}),
    ...(candidate.retryFeedback ? { retryFeedback: candidate.retryFeedback } : {}),
    ...(candidate.privateCreativeContext
      ? { privateCreativeContext: candidate.privateCreativeContext }
      : {}),
    // Old reserved assignments can still store 18. Do not send that scalar
    // back to the writer and accidentally restore the short-copy bias.
    preferredWordRange: WALL_TEXT_SOFT_WORD_RANGE,
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
    "GLOBAL RULES",
    ...GLOBAL_WALL_RULES.map((rule, index) => `${index + 1}. ${rule}`),
    "",
    "TASK",
    "For each candidate, write the strongest complete natural message from the supplied idea and business facts. Do not force it into a named writing format, template, list, or formula.",
    "When privateCreativeContext is present, write from the complete private context, not from contentIdea alone.",
    "Treat preferredWordRange (18-30 words) as a soft writing target, not a required minimum or a hard maximum. Choose the length the idea needs across this range; do not default every message to its shortest end. maxWords is only the absolute safety ceiling; the layout engine will decide final acceptance from measured 5-8 line fit at a fixed 50px font size.",
    "Do not pad a complete thought to fill eight lines or compress a useful thought just to keep five lines. If retry feedback reports layout_fit, simplify or shorten the wording; the font size will not shrink.",
    "A referenceTextForThisCandidateOnly belongs only to that candidate. Use it only as structural and emotional inspiration, adapt it to the Business Profile, and do not copy its wording.",
    "Reference text is not evidence. Never repeat its numbers, psychology statements, factual claims, product names, or promises unless the Business Profile independently supports them.",
    "Return exactly one result for every candidate. Do not return formatId, duration, coordinates, or final visual lines.",
  ].join("\n");
}
