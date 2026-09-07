import {
  HOOK_TEXT_FORMAT_IDS,
  type HookTextFormatId,
} from "../trending/trending-hook-copy-contract.ts";

/**
 * The AI drawer needs only the writing-facing parts of the established Global
 * Hook format library. Keep its IDs aligned with the Trending registry, while
 * keeping this user-driven flow independent of Trending selection and history.
 */
export type CreateContentHookFormat = {
  id: HookTextFormatId;
  instruction: string;
  template: string;
};

export const CREATE_CONTENT_HOOK_FORMATS = [
  ["GF_001", "Use playful rhetorical gratitude, never a testimonial.", "I could literally KISS whoever showed me this"],
  ["GF_002", "Contrast a supported audience pain with a solution existing; do not promise an outcome.", "Imagine {current pain} when this exists"],
  ["GF_003", "Use a time or experience only when it is actually supplied; never invent personal history.", "{experience} doing {activity} and I JUST found this"],
  ["GF_004", "Frame a supported capability as surprising; never imply actual illegality or approval.", "How is this even possible?"],
  ["GF_005", "Create safe information-asymmetry tension without accusing a group.", "Don't tell {audience} about this"],
  ["GF_006", "Write one short relatable scenario grounded in the audience, pain, or outcome context.", "POV: {relatable situation}"],
  ["GF_007", "Call out the supported audience with playful emotion, not a promised result.", "{audience} are gonna love me after seeing this"],
  ["GF_008", "Name a supported audience state or identity pain without inventing a personal story.", "Imagine being {painful state}"],
  ["GF_009", "Contrast an old supported behavior with a supported capability; do not add speed claims.", "{old method} ❌ {new method} ✅"],
  ["GF_010", "Combine only separately supported ideas; never turn it into a guaranteed outcome.", "{thing A} + {thing B} = {outcome}"],
  ["GF_011", "Use a result and number only when both are explicitly supported evidence.", "{verified result} in {verified time or number}"],
  ["GF_012", "Use conversational disbelief about one supported capability or problem reframe.", "I'm sorry... THIS can {capability} now??"],
  ["GF_013", "Use casual surprise only when it fits the business tone; keep it grounded in one fact.", "WDYM {surprising supported idea}?"],
  ["GF_014", "Attribute an outcome only when the outcome and source are both supported.", "I owe {verified outcome} to {verified source}"],
  ["GF_015", "Use a rhetorical discovery of one supported capability, solution, or useful idea.", "I just found {supported thing}"],
  ["GF_016", "Compare with a known tool or method only when that exact comparison is supported.", "Is THIS the new {verified tool or method}?!"],
  ["GF_017", "Use playful audience anxiety without claiming danger, replacement, or disruption.", "{audience}, are we cooked?"],
  ["GF_018", "Use a result, time, and avoided effort only when all are explicitly supported.", "Making {verified result} in {verified time} without {supported effort}"],
  ["GF_019", "Use plain-language playful surprise about one verified capability.", "Wait, what? {verified capability}?"],
  ["GF_020", "Voice clear human doubt about one supported old method or workflow pain.", "Why are we still {verified old method}?"],
] as const satisfies readonly (readonly [HookTextFormatId, string, string])[];

const formatsById = new Map(
  CREATE_CONTENT_HOOK_FORMATS.map(([id, instruction, template]) => [
    id,
    { id, instruction, template },
  ]),
);

export function selectCreateContentHookFormats(count: number) {
  const safeCount = Math.max(1, Math.trunc(count));
  const formats = HOOK_TEXT_FORMAT_IDS.map((id) => formatsById.get(id)!);

  return Array.from(
    { length: safeCount },
    (_, index) => formats[index % formats.length]!,
  );
}
