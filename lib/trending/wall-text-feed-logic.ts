import {
  WALL_TEXT_LAYOUT_VERSION,
  type WallTextPlacementAnalysis,
  type WallTextPlacementZone,
  type TrendingWallTextLayout,
} from "./wall-text-types.ts";

export const DEFAULT_TRENDING_WALL_TEXT_CANDIDATES = 6;
export const MAX_TRENDING_WALL_TEXT_CANDIDATES = 50;
export const MIN_WALL_TEXT_VIDEO_DURATION_SECONDS = 6;
export const MAX_WALL_TEXT_VIDEO_DURATION_SECONDS = 60;

export type WallTextAssetSelectionInput = {
  analysisStatus: string;
  aspectRatio: string;
  assetType: string;
  createdAt: string;
  durationSeconds: number | null;
  formatFamily: string;
  id: string;
  lastUsedAt: string | null;
  placementAnalysis: WallTextPlacementAnalysis | null;
  previewUrl: string | null;
  sourceBatch: string | null;
  sourceFileSha256: string | null;
  status: string;
  thumbnailUrl: string | null;
  usageCount: number;
  visualGroup: string | null;
};

export type TrendingWallTextCandidate = {
  candidateIndex: number;
  durationSeconds: number;
  entry: WallTextAssetSelectionInput;
  layout: TrendingWallTextLayout;
};

export function selectTrendingWallTextCandidates(
  inventory: readonly WallTextAssetSelectionInput[],
  limit = DEFAULT_TRENDING_WALL_TEXT_CANDIDATES,
): TrendingWallTextCandidate[] {
  const normalizedLimit = Math.min(
    Math.max(Math.trunc(limit), 0),
    MAX_TRENDING_WALL_TEXT_CANDIDATES,
  );
  const seenIds = new Set<string>();
  const seenGroups = new Set<string>();
  const eligible = [...inventory]
    .filter(isEligibleWallTextVideo)
    .sort(compareWallTextAssets)
    .filter((asset) => {
      if (seenIds.has(asset.id)) {
        return false;
      }

      seenIds.add(asset.id);
      return true;
    });
  const selected = eligible.filter((asset) => {
    if (seenGroups.has(asset.visualGroup!)) {
      return false;
    }

    seenGroups.add(asset.visualGroup!);
    return true;
  });

  if (selected.length < normalizedLimit) {
    const selectedIds = new Set(selected.map((asset) => asset.id));

    for (const asset of eligible) {
      if (selectedIds.has(asset.id)) {
        continue;
      }

      selected.push(asset);
      selectedIds.add(asset.id);

      if (selected.length >= normalizedLimit) {
        break;
      }
    }
  }

  return selected
    .slice(0, normalizedLimit)
    .map((entry, candidateIndex) => ({
      candidateIndex,
      durationSeconds: roundDuration(entry.durationSeconds!),
      entry,
      layout: createWallTextLayout(entry),
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
    isRenderableWallTextDuration(asset.durationSeconds) &&
    isHttpUrl(asset.previewUrl) &&
    isSha256(asset.sourceFileSha256) &&
    Boolean(asset.sourceBatch?.trim()) &&
    Boolean(asset.visualGroup?.trim()) &&
    asset.placementAnalysis !== null
  );
}

export function isRenderableWallTextDuration(
  durationSeconds: number | null | undefined,
): durationSeconds is number {
  return (
    typeof durationSeconds === "number" &&
    Number.isFinite(durationSeconds) &&
    durationSeconds >= MIN_WALL_TEXT_VIDEO_DURATION_SECONDS &&
    durationSeconds <= MAX_WALL_TEXT_VIDEO_DURATION_SECONDS
  );
}

export function createWallTextLayout(
  asset?: Pick<
    WallTextAssetSelectionInput,
    "id" | "placementAnalysis" | "visualGroup"
  >,
): TrendingWallTextLayout {
  const analyzedZone = asset?.placementAnalysis?.selectedZone;
  const placement = analyzedZone ?? getFallbackPlacement(asset);
  const textBox = getWallTextZoneBox(placement);

  return {
    alignment: "center",
    placement,
    placementSource: analyzedZone
      ? "face-analysis"
      : "visual-group-fallback",
    safeArea: {
      bottom: 460 / 1920,
      left: 140 / 1080,
      right: 140 / 1080,
      top: 280 / 1920,
    },
    textBox,
    version: WALL_TEXT_LAYOUT_VERSION,
  };
}

export function getWallTextZoneBox(
  placement: WallTextPlacementZone,
): TrendingWallTextLayout["textBox"] {
  const height = 480 / 1920;
  const textBoxWidth = 780;
  const width = textBoxWidth / 1080;
  const centerY =
    placement === "upper-middle"
      ? 800
      : placement === "lower-middle"
        ? 1040
        : 900;

  return {
    height,
    width,
    x: (540 - textBoxWidth / 2) / 1080,
    y: (centerY - 480 / 2) / 1920,
  };
}

function getFallbackPlacement(
  asset:
    | Pick<
        WallTextAssetSelectionInput,
        "id" | "placementAnalysis" | "visualGroup"
      >
    | undefined,
): WallTextPlacementZone {
  if (
    asset?.visualGroup === "car_selfie" ||
    asset?.visualGroup === "indoor_closeup"
  ) {
    return "lower-middle";
  }

  if (asset?.visualGroup === "outdoor_static_selfie") {
    return "upper-middle";
  }

  if (asset?.visualGroup === "outdoor_walking_selfie") {
    return "middle";
  }

  return asset && hashString(asset.id) % 3 === 0
    ? "upper-middle"
    : "middle";
}

function hashString(value: string) {
  let hash = 0;

  for (const character of value) {
    hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  }

  return hash;
}

function compareWallTextAssets(
  first: WallTextAssetSelectionInput,
  second: WallTextAssetSelectionInput,
) {
  return (
    first.usageCount - second.usageCount ||
    compareNullableDates(first.lastUsedAt, second.lastUsedAt) ||
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

function isSha256(value: string | null) {
  return Boolean(value && /^[0-9a-f]{64}$/u.test(value));
}

function roundDuration(durationSeconds: number) {
  return Math.round(durationSeconds * 1000) / 1000;
}
