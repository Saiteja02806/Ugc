import {
  assertReactionBriefBatch,
  buildReactionBriefGenerationPrompt,
  ReactionBriefError,
  type ReactionAvailabilityPalette,
  type ReactionBrief,
} from "./briefs.ts";
import {
  buildReactionAvailabilityPalette,
  selectReactionBatch,
  type ReactionBatchSelectionResult,
  type ReactionClipShownHistory,
} from "./batch-matcher.ts";
import type { ReactionGenerationContext } from "./content.ts";
import type { ReactionAsset, ReactionBackgroundAsset } from "./matcher.ts";

export type GenerateReactionBriefs = (params: {
  expectedCount: number;
  prompt: string;
}) => Promise<unknown>;

export type ReactionBatchPlan = {
  availability: ReactionAvailabilityPalette;
  briefs: readonly ReactionBrief[];
  selection: ReactionBatchSelectionResult;
};

export async function planReactionBatch(params: {
  backgrounds: readonly ReactionBackgroundAsset[];
  clipHistoryById?: ReadonlyMap<string, ReactionClipShownHistory>;
  clips: readonly ReactionAsset[];
  context: ReactionGenerationContext;
  generateBriefs: GenerateReactionBriefs;
  nowMs?: number;
  requestedCount: number;
  seed: string;
}): Promise<ReactionBatchPlan> {
  const availability = buildReactionAvailabilityPalette({
    backgrounds: params.backgrounds,
    clipHistoryById: params.clipHistoryById,
    clips: params.clips,
  });
  if (availability.availableReactionPalette.length === 0) {
    throw new ReactionBriefError([
      "Reaction planning needs at least one active clip/background pair before calling the generation provider.",
    ]);
  }
  const prompt = buildReactionBriefGenerationPrompt({
    availability,
    context: params.context,
    requestedCount: params.requestedCount,
  });
  const rawBriefs = await params.generateBriefs({
    expectedCount: params.requestedCount,
    prompt,
  });
  const briefs = assertReactionBriefBatch({
    availability,
    expectedCount: params.requestedCount,
    value: rawBriefs,
  });
  const selection = selectReactionBatch({
    backgrounds: params.backgrounds,
    briefs,
    clipHistoryById: params.clipHistoryById,
    clips: params.clips,
    nowMs: params.nowMs,
    seed: params.seed,
  });

  return { availability, briefs, selection };
}
