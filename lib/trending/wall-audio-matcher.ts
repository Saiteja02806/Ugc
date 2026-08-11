import { createHash } from "node:crypto";

import type {
  TrendingWallTextContent,
  WallTextPattern,
} from "./wall-text-types.ts";

export const WALL_AUDIO_MATCHING_VERSION = "wall-audio-match-v1" as const;
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
  matchingVersion: typeof WALL_AUDIO_MATCHING_VERSION;
  outputDurationSeconds: number;
};

type ScoredCandidate = {
  asset: WallAudioAsset;
  fitMode: WallAudioFitMode;
  matchScore: number;
};

const INTENT_BY_PATTERN: Record<WallTextPattern, WallAudioIntent> = {
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
};

export function buildWallAudioIntent(
  content: Pick<TrendingWallTextContent, "pattern">,
): WallAudioIntent {
  const intent = INTENT_BY_PATTERN[content.pattern];
  return {
    energy: intent.energy,
    messageTypes: [...intent.messageTypes],
    moods: [...intent.moods],
  };
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
