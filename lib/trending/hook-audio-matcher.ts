import { createHash } from "node:crypto";

export const HOOK_AUDIO_MATCHING_VERSION = "hook-audio-match-v1" as const;

export const HOOK_AUDIO_MOODS = [
  "curious",
  "uplifting",
  "serious",
  "calm",
  "urgent",
  "playful",
] as const;
export const HOOK_AUDIO_TYPES = [
  "curiosity",
  "problem",
  "warning",
  "transformation",
  "benefit",
  "story",
  "authority",
] as const;
export const HOOK_AUDIO_ENERGIES = ["low", "medium", "high"] as const;

export type HookAudioMood = (typeof HOOK_AUDIO_MOODS)[number];
export type HookAudioType = (typeof HOOK_AUDIO_TYPES)[number];
export type HookAudioEnergy = (typeof HOOK_AUDIO_ENERGIES)[number];

export type HookAudioIntent = {
  energy: HookAudioEnergy;
  hookType: HookAudioType;
  mood: HookAudioMood;
};

export type HookAudioAsset = {
  audioUrl: string;
  durationSeconds: number;
  energy: HookAudioEnergy;
  hookTypes: HookAudioType[];
  id: string;
  impactAtSeconds: number | null;
  loopable: false;
  moods: HookAudioMood[];
};

export type HookAudioSelection = {
  audioAssetDurationSeconds: number;
  audioAssetId: string;
  audioUrl: string;
  durationSeconds: number;
  intent: HookAudioIntent;
  matchScore: number;
  matchingVersion: typeof HOOK_AUDIO_MATCHING_VERSION;
  selectionSource: "dynamic" | "format_preferred";
};

const DEFAULT_HOOK_AUDIO_INTENT_BY_FORMAT: Record<string, HookAudioIntent> = {
  GF_001: { energy: "high", hookType: "story", mood: "playful" },
  GF_002: { energy: "medium", hookType: "problem", mood: "serious" },
  GF_003: { energy: "high", hookType: "story", mood: "urgent" },
  GF_004: { energy: "high", hookType: "warning", mood: "urgent" },
  GF_005: { energy: "medium", hookType: "curiosity", mood: "curious" },
  GF_006: { energy: "medium", hookType: "story", mood: "curious" },
  GF_007: { energy: "high", hookType: "story", mood: "playful" },
  GF_008: { energy: "medium", hookType: "problem", mood: "serious" },
  GF_009: { energy: "medium", hookType: "transformation", mood: "uplifting" },
  GF_010: { energy: "medium", hookType: "benefit", mood: "uplifting" },
  GF_011: { energy: "high", hookType: "transformation", mood: "urgent" },
  GF_012: { energy: "high", hookType: "curiosity", mood: "urgent" },
  GF_013: { energy: "high", hookType: "curiosity", mood: "playful" },
  GF_014: { energy: "medium", hookType: "story", mood: "uplifting" },
  GF_015: { energy: "medium", hookType: "curiosity", mood: "curious" },
  GF_016: { energy: "high", hookType: "warning", mood: "urgent" },
  GF_017: { energy: "high", hookType: "warning", mood: "playful" },
  GF_018: { energy: "high", hookType: "transformation", mood: "urgent" },
  GF_019: { energy: "medium", hookType: "curiosity", mood: "playful" },
  GF_020: { energy: "medium", hookType: "problem", mood: "serious" },
};

export function parseHookAudioIntent(value: unknown): HookAudioIntent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const intent = value as Record<string, unknown>;
  const keys = Object.keys(intent).sort();
  if (
    keys.length !== 3 ||
    keys[0] !== "energy" ||
    keys[1] !== "hookType" ||
    keys[2] !== "mood" ||
    !isHookAudioMood(intent.mood) ||
    !isHookAudioType(intent.hookType) ||
    !isHookAudioEnergy(intent.energy)
  ) {
    return null;
  }

  return {
    energy: intent.energy,
    hookType: intent.hookType,
    mood: intent.mood,
  };
}

export function getDefaultHookAudioIntent(
  hookTextFormatId: string | null | undefined,
): HookAudioIntent {
  return {
    ...(DEFAULT_HOOK_AUDIO_INTENT_BY_FORMAT[hookTextFormatId ?? ""] ?? {
      energy: "medium",
      hookType: "curiosity",
      mood: "curious",
    }),
  };
}

export function createHookAudioContentFingerprint(params: {
  hookTextFormatId: string | null;
  hookVideoId: string;
  intent: HookAudioIntent;
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        hookTextFormatId: params.hookTextFormatId,
        hookVideoId: params.hookVideoId,
        intent: params.intent,
      }),
      "utf8",
    )
    .digest("hex");
}

export function scoreHookAudioMatch(
  asset: Pick<HookAudioAsset, "energy" | "hookTypes" | "moods">,
  intent: HookAudioIntent,
) {
  const moodScore = asset.moods.includes(intent.mood) ? 1 : 0;
  const hookTypeScore = asset.hookTypes.includes(intent.hookType) ? 1 : 0;
  const energyScore = scoreEnergy(asset.energy, intent.energy);
  return roundScore(
    moodScore * 0.45 + hookTypeScore * 0.4 + energyScore * 0.15,
  );
}

export function selectHookAudio(params: {
  assets: readonly HookAudioAsset[];
  intent: HookAudioIntent;
  preferredAssetIds?: readonly string[];
  videoDurationSeconds: number;
}): HookAudioSelection | null {
  if (
    !Number.isFinite(params.videoDurationSeconds) ||
    params.videoDurationSeconds <= 0
  ) {
    return null;
  }

  const eligible = params.assets.filter(
    (asset) =>
      asset.loopable === false &&
      asset.durationSeconds >= params.videoDurationSeconds,
  );
  if (eligible.length === 0) return null;

  const preferred = params.preferredAssetIds
    ?.map((assetId) => eligible.find((asset) => asset.id === assetId))
    .find((asset): asset is HookAudioAsset => Boolean(asset));
  const selected =
    preferred ??
    [...eligible].sort((left, right) => {
      const scoreDifference =
        scoreHookAudioMatch(right, params.intent) -
        scoreHookAudioMatch(left, params.intent);
      if (scoreDifference !== 0) return scoreDifference;

      const durationDifference = left.durationSeconds - right.durationSeconds;
      if (durationDifference !== 0) return durationDifference;
      return left.id.localeCompare(right.id);
    })[0];

  return {
    audioAssetDurationSeconds: selected.durationSeconds,
    audioAssetId: selected.id,
    audioUrl: selected.audioUrl,
    durationSeconds: selected.durationSeconds,
    intent: { ...params.intent },
    matchScore: scoreHookAudioMatch(selected, params.intent),
    matchingVersion: HOOK_AUDIO_MATCHING_VERSION,
    selectionSource: preferred ? "format_preferred" : "dynamic",
  };
}

function scoreEnergy(left: HookAudioEnergy, right: HookAudioEnergy) {
  if (left === right) return 1;
  const leftIndex = HOOK_AUDIO_ENERGIES.indexOf(left);
  const rightIndex = HOOK_AUDIO_ENERGIES.indexOf(right);
  return Math.abs(leftIndex - rightIndex) === 1 ? 0.5 : 0;
}

function roundScore(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

function isHookAudioMood(value: unknown): value is HookAudioMood {
  return (HOOK_AUDIO_MOODS as readonly unknown[]).includes(value);
}

function isHookAudioType(value: unknown): value is HookAudioType {
  return (HOOK_AUDIO_TYPES as readonly unknown[]).includes(value);
}

function isHookAudioEnergy(value: unknown): value is HookAudioEnergy {
  return (HOOK_AUDIO_ENERGIES as readonly unknown[]).includes(value);
}
