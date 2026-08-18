import { createHash } from "node:crypto";

import type {
  TrendingWallTextContent,
  WallTextFormatId,
  WallTextPattern,
} from "./wall-text-types.ts";
import { getBackfillWallTextFormatId } from "./wall-formats.ts";

export const WALL_AUDIO_MATCHING_VERSION = "wall-audio-match-v1" as const;
export const WALL_AUDIO_LOCKED_MATCHING_VERSION =
  "wall-instagram-reel-locked-v1" as const;
export const WALL_AUDIO_DURATION_TOLERANCE_SECONDS = 0.08;
export const WALL_AUDIO_FADE_OUT_SECONDS = 0.2;

export const WALL_AUDIO_MOODS = [
  "curious",
  "uplifting",
  "serious",
  "calm",
  "urgent",
  "playful",
] as const;
export const WALL_AUDIO_MESSAGE_TYPES = [
  "curiosity",
  "problem",
  "warning",
  "transformation",
  "benefit",
  "story",
  "authority",
] as const;
export const WALL_AUDIO_ENERGY_LEVELS = ["low", "medium", "high"] as const;

export type WallAudioMood = (typeof WALL_AUDIO_MOODS)[number];
export type WallAudioMessageType =
  (typeof WALL_AUDIO_MESSAGE_TYPES)[number];
export type WallAudioEnergy = (typeof WALL_AUDIO_ENERGY_LEVELS)[number];
export type WallAudioFitMode = "exact" | "trim" | "loop";
export type WallAudioMatchingVersion =
  | typeof WALL_AUDIO_MATCHING_VERSION
  | typeof WALL_AUDIO_LOCKED_MATCHING_VERSION;

export type WallAudioIntent = {
  energy: WallAudioEnergy;
  messageTypes: WallAudioMessageType[];
  moods: WallAudioMood[];
};

export type WallAudioAsset = {
  audioUrl: string;
  cueStartSeconds: number;
  durationSeconds: number;
  energy: WallAudioEnergy;
  id: string;
  loopable: boolean;
  messageTypes: WallAudioMessageType[];
  moods: WallAudioMood[];
  reviewStatus: "approved";
  status: "active";
};

export type WallAudioSelection = {
  audioAssetDurationSeconds: number;
  audioAssetId: string;
  audioUrl: string;
  cueStartSeconds: number;
  fadeOutSeconds: number;
  fitMode: WallAudioFitMode;
  intent: WallAudioIntent;
  matchScore: number;
  matchingVersion: WallAudioMatchingVersion;
  outputDurationSeconds: number;
};

type ScoredCandidate = {
  asset: WallAudioAsset;
  fitMode: WallAudioFitMode;
  matchScore: number;
};

const LEGACY_INTENT_BY_PATTERN: Record<
  Exclude<WallTextPattern, WallTextFormatId>,
  WallAudioIntent
> = {
  problem_change_result: {
    energy: "medium",
    messageTypes: ["problem", "transformation", "benefit"],
    moods: ["serious", "uplifting"],
  },
  mistake_correction: {
    energy: "medium",
    messageTypes: ["problem", "warning", "benefit"],
    moods: ["serious", "curious"],
  },
  situation_discovery: {
    energy: "low",
    messageTypes: ["story", "curiosity"],
    moods: ["curious", "calm"],
  },
  before_after: {
    energy: "medium",
    messageTypes: ["transformation", "story", "benefit"],
    moods: ["uplifting", "curious"],
  },
  belief_reframe: {
    energy: "medium",
    messageTypes: ["authority", "curiosity", "transformation"],
    moods: ["serious", "curious"],
  },
  action_benefit: {
    energy: "medium",
    messageTypes: ["benefit", "authority", "transformation"],
    moods: ["uplifting", "calm"],
  },
  identity_mirror: {
    energy: "medium",
    messageTypes: ["curiosity", "problem", "authority"],
    moods: ["curious", "serious"],
  },
  recognizable_moment: {
    energy: "low",
    messageTypes: ["story", "curiosity"],
    moods: ["curious", "calm"],
  },
  hidden_truth: {
    energy: "medium",
    messageTypes: ["curiosity", "authority", "transformation"],
    moods: ["serious", "curious"],
  },
  contrarian_reframe: {
    energy: "medium",
    messageTypes: ["warning", "authority", "curiosity"],
    moods: ["serious", "curious"],
  },
  personal_confession: {
    energy: "low",
    messageTypes: ["story", "curiosity"],
    moods: ["calm", "serious"],
  },
  aspiration_redefinition: {
    energy: "medium",
    messageTypes: ["transformation", "benefit", "story"],
    moods: ["uplifting", "calm"],
  },
  pain_beneath_the_pain: {
    energy: "medium",
    messageTypes: ["problem", "curiosity", "warning"],
    moods: ["serious", "curious"],
  },
  niche_insight: {
    energy: "low",
    messageTypes: ["authority", "curiosity", "benefit"],
    moods: ["calm", "curious"],
  },
  list_rules: {
    energy: "medium",
    messageTypes: ["authority", "benefit"],
    moods: ["uplifting", "calm"],
  },
  community_prompt: {
    energy: "medium",
    messageTypes: ["curiosity", "story"],
    moods: ["curious", "uplifting"],
  },
  analogy_reframe: {
    energy: "medium",
    messageTypes: ["authority", "curiosity", "transformation"],
    moods: ["curious", "calm"],
  },
  progression_sequence: {
    energy: "medium",
    messageTypes: ["transformation", "story", "benefit"],
    moods: ["uplifting", "serious"],
  },
};

const CURRENT_INTENT_BY_FORMAT: Record<WallTextFormatId, WallAudioIntent> = {
  hidden_alternative: intent("medium", ["curiosity", "benefit"], ["curious", "uplifting"]),
  manual_automatic: intent("medium", ["transformation", "benefit"], ["curious", "uplifting"]),
  secret_advantage: intent("medium", ["curiosity", "authority"], ["curious", "serious"]),
  outcome_mystery: intent("medium", ["curiosity", "benefit"], ["curious", "uplifting"]),
  authority_reaction: intent("medium", ["authority", "story"], ["serious", "curious"]),
  personal_obsession: intent("low", ["story", "curiosity"], ["calm", "curious"]),
  numbered_curiosity: intent("medium", ["curiosity", "benefit"], ["curious", "uplifting"]),
  rule_checklist: intent("medium", ["authority", "benefit"], ["calm", "uplifting"]),
  hidden_cause: intent("medium", ["problem", "curiosity"], ["serious", "curious"]),
  contrarian_opinion: intent("medium", ["warning", "authority"], ["serious", "curious"]),
  niche_pov: intent("low", ["story", "curiosity"], ["calm", "curious"]),
  community_question: intent("medium", ["curiosity", "story"], ["curious", "uplifting"]),
  transformation_timeframe: intent("medium", ["transformation", "benefit"], ["uplifting", "calm"]),
  method_framework: intent("medium", ["authority", "benefit"], ["calm", "uplifting"]),
  emotional_reframe: intent("medium", ["transformation", "story"], ["calm", "uplifting"]),
  personal_manifesto: intent("low", ["story", "authority"], ["calm", "serious"]),
  relatable_situation: intent("low", ["story", "curiosity"], ["calm", "curious"]),
  desire_identity_stack: intent("medium", ["benefit", "transformation"], ["uplifting", "calm"]),
  old_way_regret: intent("medium", ["problem", "story"], ["serious", "curious"]),
  retrospective_lesson: intent("medium", ["story", "authority"], ["calm", "serious"]),
  self_audit: intent("medium", ["curiosity", "problem"], ["curious", "serious"]),
  warning_alert: intent("high", ["warning", "problem"], ["urgent", "serious"]),
  personal_stance: intent("medium", ["authority", "story"], ["serious", "calm"]),
  future_snapshot: intent("medium", ["transformation", "benefit"], ["uplifting", "calm"]),
  metaphor_reframe: intent("medium", ["curiosity", "transformation"], ["curious", "calm"]),
  swap_upgrade_stack: intent("medium", ["transformation", "benefit"], ["uplifting", "calm"]),
  niche_milestones: intent("medium", ["story", "curiosity"], ["curious", "uplifting"]),
  insider_truths: intent("low", ["authority", "curiosity"], ["calm", "curious"]),
  aspirational_archetype: intent("medium", ["benefit", "transformation"], ["uplifting", "calm"]),
  internal_conflict: intent("medium", ["problem", "story"], ["serious", "curious"]),
};

export function buildWallAudioIntent(
  content: Pick<TrendingWallTextContent, "pattern">,
): WallAudioIntent {
  const intent =
    content.pattern in CURRENT_INTENT_BY_FORMAT
      ? CURRENT_INTENT_BY_FORMAT[content.pattern as WallTextFormatId]
      : LEGACY_INTENT_BY_PATTERN[
          content.pattern as Exclude<WallTextPattern, WallTextFormatId>
        ] ?? CURRENT_INTENT_BY_FORMAT[getBackfillWallTextFormatId(content.pattern)];
  return {
    energy: intent.energy,
    messageTypes: [...intent.messageTypes],
    moods: [...intent.moods],
  };
}

function intent(
  energy: WallAudioEnergy,
  messageTypes: WallAudioMessageType[],
  moods: WallAudioMood[],
): WallAudioIntent {
  return { energy, messageTypes, moods };
}

export function createWallTextContentFingerprint(
  content: Pick<TrendingWallTextContent, "fullText" | "pattern">,
) {
  const normalizedText = content.fullText
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return createHash("sha256")
    .update(`${content.pattern}\n${normalizedText}`, "utf8")
    .digest("hex");
}

export function getWallAudioFitMode(
  asset: Pick<
    WallAudioAsset,
    "cueStartSeconds" | "durationSeconds" | "loopable"
  >,
  videoDurationSeconds: number,
): WallAudioFitMode | null {
  if (!Number.isFinite(videoDurationSeconds) || videoDurationSeconds <= 0) {
    return null;
  }

  const playableDuration = asset.durationSeconds - asset.cueStartSeconds;
  if (!Number.isFinite(playableDuration) || playableDuration <= 0) {
    return null;
  }

  const difference = playableDuration - videoDurationSeconds;
  if (Math.abs(difference) <= WALL_AUDIO_DURATION_TOLERANCE_SECONDS) {
    return "exact";
  }
  if (difference > WALL_AUDIO_DURATION_TOLERANCE_SECONDS) {
    return "trim";
  }
  return asset.loopable ? "loop" : null;
}

export function scoreWallAudioMatch(
  asset: Pick<WallAudioAsset, "energy" | "messageTypes" | "moods">,
  intent: WallAudioIntent,
) {
  const moodScore = overlapRatio(asset.moods, intent.moods);
  const messageScore = overlapRatio(
    asset.messageTypes,
    intent.messageTypes,
  );
  const energyScore = scoreEnergy(asset.energy, intent.energy);
  return roundScore(
    moodScore * 0.45 + messageScore * 0.4 + energyScore * 0.15,
  );
}

export function selectWallAudio(params: {
  assets: readonly WallAudioAsset[];
  excludeAssetIds?: readonly string[];
  intent: WallAudioIntent;
  preferredAssetId?: string | null;
  recentAssetIds?: readonly string[];
  videoDurationSeconds: number;
}): WallAudioSelection | null {
  const excluded = new Set(params.excludeAssetIds ?? []);
  const eligible = params.assets.flatMap((asset): ScoredCandidate[] => {
    if (
      asset.status !== "active" ||
      asset.reviewStatus !== "approved" ||
      excluded.has(asset.id)
    ) {
      return [];
    }
    const fitMode = getWallAudioFitMode(asset, params.videoDurationSeconds);
    if (!fitMode) return [];
    return [
      {
        asset,
        fitMode,
        matchScore: scoreWallAudioMatch(asset, params.intent),
      },
    ];
  });

  if (eligible.length === 0) return null;

  const directFitCandidates = eligible.filter(
    (candidate) => candidate.fitMode !== "loop",
  );
  const candidatePool =
    directFitCandidates.length > 0 ? directFitCandidates : eligible;

  const preferred = params.preferredAssetId
    ? candidatePool.find(
        (candidate) => candidate.asset.id === params.preferredAssetId,
      )
    : null;
  if (preferred) {
    return toSelection(preferred, params.intent, params.videoDurationSeconds);
  }

  const bestSemanticScore = Math.max(
    ...candidatePool.map((candidate) => candidate.matchScore),
  );
  const topSemanticCandidates = candidatePool.filter(
    (candidate) => candidate.matchScore >= bestSemanticScore - 0.08,
  );
  const recentRank = new Map(
    (params.recentAssetIds ?? []).map((assetId, index) => [assetId, index]),
  );
  topSemanticCandidates.sort((left, right) => {
    const semanticDifference = right.matchScore - left.matchScore;
    if (Math.abs(semanticDifference) > 0.08) return semanticDifference;

    const fitDifference = fitPriority(right.fitMode) - fitPriority(left.fitMode);
    if (fitDifference !== 0) return fitDifference;

    const leftRank = recentRank.get(left.asset.id);
    const rightRank = recentRank.get(right.asset.id);
    if (leftRank === undefined && rightRank !== undefined) return -1;
    if (leftRank !== undefined && rightRank === undefined) return 1;
    if (leftRank !== undefined && rightRank !== undefined && leftRank !== rightRank) {
      return rightRank - leftRank;
    }

    if (semanticDifference !== 0) return semanticDifference;
    return left.asset.id.localeCompare(right.asset.id);
  });

  return toSelection(
    topSemanticCandidates[0],
    params.intent,
    params.videoDurationSeconds,
  );
}

export function selectLockedWallAudio(params: {
  asset: Pick<
    WallAudioAsset,
    | "audioUrl"
    | "cueStartSeconds"
    | "durationSeconds"
    | "id"
    | "loopable"
    | "reviewStatus"
    | "status"
  >;
  intent: WallAudioIntent;
  videoDurationSeconds: number;
}): WallAudioSelection | null {
  const fitMode = getWallAudioFitMode(
    params.asset,
    params.videoDurationSeconds,
  );
  if (fitMode !== "exact" && fitMode !== "trim") return null;

  return {
    audioAssetDurationSeconds: params.asset.durationSeconds,
    audioAssetId: params.asset.id,
    audioUrl: params.asset.audioUrl,
    cueStartSeconds: params.asset.cueStartSeconds,
    fadeOutSeconds: Math.min(
      WALL_AUDIO_FADE_OUT_SECONDS,
      params.videoDurationSeconds / 4,
    ),
    fitMode,
    intent: {
      energy: params.intent.energy,
      messageTypes: [...params.intent.messageTypes],
      moods: [...params.intent.moods],
    },
    matchScore: 1,
    matchingVersion: WALL_AUDIO_LOCKED_MATCHING_VERSION,
    outputDurationSeconds: params.videoDurationSeconds,
  };
}

function toSelection(
  candidate: ScoredCandidate,
  intent: WallAudioIntent,
  videoDurationSeconds: number,
): WallAudioSelection {
  return {
    audioAssetDurationSeconds: candidate.asset.durationSeconds,
    audioAssetId: candidate.asset.id,
    audioUrl: candidate.asset.audioUrl,
    cueStartSeconds: candidate.asset.cueStartSeconds,
    fadeOutSeconds: Math.min(
      WALL_AUDIO_FADE_OUT_SECONDS,
      videoDurationSeconds / 4,
    ),
    fitMode: candidate.fitMode,
    intent: {
      energy: intent.energy,
      messageTypes: [...intent.messageTypes],
      moods: [...intent.moods],
    },
    matchScore: candidate.matchScore,
    matchingVersion: WALL_AUDIO_MATCHING_VERSION,
    outputDurationSeconds: videoDurationSeconds,
  };
}

function overlapRatio(left: readonly string[], right: readonly string[]) {
  if (right.length === 0) return 0;
  const leftValues = new Set(left);
  return right.filter((value) => leftValues.has(value)).length / right.length;
}

function scoreEnergy(left: WallAudioEnergy, right: WallAudioEnergy) {
  if (left === right) return 1;
  const leftIndex = WALL_AUDIO_ENERGY_LEVELS.indexOf(left);
  const rightIndex = WALL_AUDIO_ENERGY_LEVELS.indexOf(right);
  return Math.abs(leftIndex - rightIndex) === 1 ? 0.5 : 0;
}

function fitPriority(fitMode: WallAudioFitMode) {
  return fitMode === "exact" ? 3 : fitMode === "trim" ? 2 : 1;
}

function roundScore(value: number) {
  return Math.round(value * 10_000) / 10_000;
}
