import type {
  WallTextFormatId,
  WallTextPattern,
  WallTextSourceContent,
} from "./wall-text-types";

export type WallTextFormat = {
  constraints?: { maxItems?: number; minItems?: number };
  contentKind: WallTextSourceContent["kind"];
  eligibility?: { requiresFirstPersonEvidence?: boolean };
  example: string;
  howToWrite: string;
  id: WallTextFormatId;
  name: string;
  structure: string[];
  whenToUse: string;
};

export const WALL_TEXT_FORMATS: readonly WallTextFormat[] = [
  {
    id: "identity_mirror",
    name: "Identity Mirror",
    whenToUse: "When the audience should immediately recognize themselves.",
    howToWrite: "Name a familiar identity or behavior, then reveal what it says about their real need.",
    structure: ["recognizable identity", "specific behavior", "meaning"],
    example: "You are not inconsistent. You are trying to follow a routine that was never designed around your actual day.",
    contentKind: "prose",
  },
  {
    id: "recognizable_moment",
    name: "Recognizable Moment",
    whenToUse: "When one everyday situation communicates the idea clearly.",
    howToWrite: "Open inside a small recognizable moment, add a concrete detail, and land on the realization.",
    structure: ["moment", "detail", "realization"],
    example: "You planned the meal, bought the ingredients, and still ordered something else. The plan failed the day before the cooking started.",
    contentKind: "prose",
  },
  {
    id: "hidden_truth",
    name: "Hidden Truth",
    whenToUse: "When the useful insight is something people commonly overlook.",
    howToWrite: "State what appears true, expose the less obvious reason, and finish with the clearer understanding.",
    structure: ["surface belief", "hidden reason", "truth"],
    example: "The hardest part is rarely knowing what to do. It is making the right choice easy enough to repeat on an ordinary day.",
    contentKind: "prose",
  },
  {
    id: "contrarian_reframe",
    name: "Contrarian Reframe",
    whenToUse: "When a familiar belief needs a grounded correction.",
    howToWrite: "Start with the common belief, correct it naturally, and explain what people usually miss.",
    structure: ["common belief", "correction", "explanation"],
    example: "More discipline is not always the answer. A plan that fits real life can matter more than one that only works on perfect days.",
    contentKind: "prose",
  },
  {
    id: "personal_confession",
    name: "Personal Confession",
    whenToUse: "Only when the supplied context supports a real first-person narrator.",
    howToWrite: "State a genuine first-person desire or realization, challenge the obvious reading, and explain the real meaning.",
    structure: ["confession", "misreading", "real reason"],
    example: "I wanted a simpler routine, not because I cared less, but because I wanted something I could still follow when life became busy.",
    contentKind: "prose",
    eligibility: { requiresFirstPersonEvidence: true },
  },
  {
    id: "aspiration_redefinition",
    name: "Aspiration Redefinition",
    whenToUse: "When the audience's desired outcome needs a more useful definition.",
    howToWrite: "Name the aspiration, contrast it with the shallow version, and redefine what success really looks like.",
    structure: ["aspiration", "not this", "deeper definition"],
    example: "Feeling in control is not having a perfect plan. It is knowing the plan can change without making you start over.",
    contentKind: "prose",
  },
  {
    id: "pain_beneath_the_pain",
    name: "Pain Beneath the Pain",
    whenToUse: "When the visible problem is caused by a deeper frustration.",
    howToWrite: "Name the surface pain, uncover the deeper cost, and show why that deeper issue matters.",
    structure: ["surface pain", "deeper pain", "meaning"],
    example: "Repeated typing is annoying. The deeper frustration is doing all that work and still not feeling sure what the information means.",
    contentKind: "prose",
  },
  {
    id: "niche_insight",
    name: "Niche Insight",
    whenToUse: "When the business context supports one useful specialist observation.",
    howToWrite: "Share one precise observation in plain language and explain its practical meaning without inventing evidence.",
    structure: ["specific observation", "explanation", "implication"],
    example: "A useful meal record is not only a list of foods. Context around the choice can make the pattern easier to understand later.",
    contentKind: "prose",
  },
  {
    id: "list_rules",
    name: "List or Rules",
    whenToUse: "When the idea is naturally made of independent tips, rules, signs, or reminders.",
    howToWrite: "Write one clear title and three to five short standalone items. Never turn an item into a paragraph.",
    structure: ["title", "item", "item", "item", "optional items"],
    example: "Ways to make a routine easier: remove one unnecessary step; keep the next action visible; plan for busy days.",
    contentKind: "list",
    constraints: { minItems: 3, maxItems: 5 },
  },
  {
    id: "community_prompt",
    name: "Community Prompt",
    whenToUse: "When one relevant question will naturally invite a useful response.",
    howToWrite: "Give only enough context to make one question interesting. Stop immediately after the question.",
    structure: ["optional callout", "short setup", "one question"],
    example: "What is one healthy habit that became easier only after you stopped trying to do it perfectly?",
    contentKind: "prose",
  },
  {
    id: "analogy_reframe",
    name: "Analogy Reframe",
    whenToUse: "When a familiar comparison makes the idea easier to understand.",
    howToWrite: "Use one clear analogy, map only the relevant parts, and finish with the lesson.",
    structure: ["analogy", "mapping", "lesson"],
    example: "A routine is like a path. Every unnecessary step is another place to turn around, so the easier path is often the one people keep using.",
    contentKind: "prose",
  },
  {
    id: "progression_sequence",
    name: "Progression Sequence",
    whenToUse: "When repeated statements or observations build toward one conclusion.",
    howToWrite: "Use a short related sequence, let the repetition build momentum, and end with the realization.",
    structure: ["statement", "statement", "statement", "conclusion"],
    example: "Start when it feels awkward. Continue when progress feels quiet. Adjust when the plan stops fitting. Consistency can change shape without disappearing.",
    contentKind: "prose",
  },
] as const;

const formatById = new Map(WALL_TEXT_FORMATS.map((format) => [format.id, format]));

const LEGACY_WALL_TEXT_FORMAT_MAP = {
  action_benefit: "niche_insight",
  before_after: "progression_sequence",
  belief_reframe: "contrarian_reframe",
  mistake_correction: "contrarian_reframe",
  problem_change_result: "pain_beneath_the_pain",
  situation_discovery: "recognizable_moment",
} as const satisfies Record<
  Exclude<WallTextPattern, WallTextFormatId>,
  WallTextFormatId
>;

export function getWallTextFormat(formatId: WallTextFormatId) {
  const format = formatById.get(formatId);
  if (!format) throw new Error("Wall-of-text uses an unapproved format.");
  return format;
}

export function getEligibleWallTextFormats() {
  // No reliable first-person narrator field exists in the current Business Profile.
  return WALL_TEXT_FORMATS.filter(
    (format) => !format.eligibility?.requiresFirstPersonEvidence,
  );
}

export function getEligibleWallTextFormatIds(): [
  WallTextFormatId,
  ...WallTextFormatId[],
] {
  const ids = getEligibleWallTextFormats().map((format) => format.id);

  if (ids.length === 0) {
    throw new Error("No Wall-of-text formats are eligible for generation.");
  }

  return ids as [WallTextFormatId, ...WallTextFormatId[]];
}

export function getBackfillWallTextFormatId(
  pattern: WallTextPattern,
): WallTextFormatId {
  return pattern in LEGACY_WALL_TEXT_FORMAT_MAP
    ? LEGACY_WALL_TEXT_FORMAT_MAP[
        pattern as keyof typeof LEGACY_WALL_TEXT_FORMAT_MAP
      ]
    : (pattern as WallTextFormatId);
}
