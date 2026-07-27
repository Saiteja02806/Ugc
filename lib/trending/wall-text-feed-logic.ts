import {
  WALL_TEXT_LAYOUT_VERSION,
  type TrendingWallTextLayout,
} from "./wall-text-types.ts";

export const MAX_TRENDING_WALL_TEXT_CANDIDATES = 6;
export const MIN_WALL_TEXT_VIDEO_DURATION_SECONDS = 6;

export type WallTextAssetSelectionInput = {
  analysisStatus: string;
  aspectRatio: string;
  assetType: string;
  createdAt: string;
  durationSeconds: number | null;
  formatFamily: string;
  id: string;
  lastUsedAt: string | null;
  motionLevel: string | null;
  previewUrl: string | null;
  readabilityScore: number | null;
  recommendedPosition: string | null;
  status: string;
  textCapacity: string | null;
  thumbnailUrl: string | null;
  usageCount: number;
};

export type TrendingWallTextCandidate = {
  candidateIndex: number;
  durationSeconds: number;
  entry: WallTextAssetSelectionInput;
  layout: TrendingWallTextLayout;
};

export function selectTrendingWallTextCandidates(
  inventory: readonly WallTextAssetSelectionInput[],
  limit = MAX_TRENDING_WALL_TEXT_CANDIDATES,
): TrendingWallTextCandidate[] {
  const normalizedLimit = Math.min(
    Math.max(Math.trunc(limit), 0),
    MAX_TRENDING_WALL_TEXT_CANDIDATES,
  );
  const seen = new Set<string>();

  return [...inventory]
    .filter(isEligibleWallTextVideo)
    .sort(compareWallTextAssets)
    .filter((asset) => {
      if (seen.has(asset.id)) {
        return false;
      }

      seen.add(asset.id);
      return true;
    })
    .slice(0, normalizedLimit)
    .map((entry, candidateIndex) => ({
      candidateIndex,
      durationSeconds: roundDuration(entry.durationSeconds!),
      entry,
      layout: createWallTextLayout(entry.recommendedPosition),
    }));
}

export function isEligibleWallTextVideo(
  asset: WallTextAssetSelectionInput,
): boolean {
  return (
    asset.assetType === "video" &&
    asset.formatFamily === "wall_text_overlay" &&
    asset.aspectRatio === "9:16" &&
    asset.status === "active" &&
    asset.analysisStatus === "succeeded" &&
    asset.durationSeconds !== null &&
    Number.isFinite(asset.durationSeconds) &&
    asset.durationSeconds >= MIN_WALL_TEXT_VIDEO_DURATION_SECONDS &&
    isHttpUrl(asset.previewUrl) &&
    asset.motionLevel !== "high" &&
    asset.textCapacity !== "low"
  );
}

export function createWallTextLayout(
  recommendedPosition: string | null,
): TrendingWallTextLayout {
  const placement = normalizePlacement(recommendedPosition);

  return {
    alignment: "left",
    placement,
    safeArea:
      placement === "top"
        ? { bottom: 0.34, left: 0.08, right: 0.08, top: 0.12 }
        : placement === "bottom"
          ? { bottom: 0.16, left: 0.08, right: 0.08, top: 0.3 }
          : { bottom: 0.2, left: 0.08, right: 0.08, top: 0.18 },
    version: WALL_TEXT_LAYOUT_VERSION,
  };
}

function compareWallTextAssets(
  first: WallTextAssetSelectionInput,
  second: WallTextAssetSelectionInput,
) {
  return (
    first.usageCount - second.usageCount ||
    compareNullableDates(first.lastUsedAt, second.lastUsedAt) ||
    (second.readabilityScore ?? -1) - (first.readabilityScore ?? -1) ||
    Date.parse(second.createdAt) - Date.parse(first.createdAt) ||
    first.id.localeCompare(second.id)
  );
}

function compareNullableDates(first: string | null, second: string | null) {
  if (first === second) {
    return 0;
  }

  if (first === null) {
    return -1;
  }

  if (second === null) {
    return 1;
  }

  return Date.parse(first) - Date.parse(second);
}

function normalizePlacement(
  value: string | null,
): TrendingWallTextLayout["placement"] {
  const normalized = value?.trim().toLowerCase() ?? "";

  if (normalized.includes("top")) {
    return "top";
  }

  if (normalized.includes("bottom")) {
    return "bottom";
  }

  return "center";
}

function isHttpUrl(value: string | null) {
  if (!value) {
    return false;
  }

  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function roundDuration(durationSeconds: number) {
  return Math.round(durationSeconds * 1000) / 1000;
}
