import type { HookInfluencerSummary } from "@/lib/trending/hook-video-types";

const CATALOG_PREFIX = "catalog:";
const USER_PREFIX = "user:";

export type CatalogAvatarMetadataRow = {
  id: string;
  metadata: unknown;
  name: string;
  thumbnail_url: string | null;
};

export function groupCatalogInfluencers(
  assets: CatalogAvatarMetadataRow[],
): HookInfluencerSummary[] {
  const groups = new Map<
    string,
    { name: string; thumbnailUrl: string | null; videoCount: number }
  >();

  for (const asset of assets) {
    const key = getCatalogInfluencerKey(asset);
    const current = groups.get(key);

    if (current) {
      current.videoCount += 1;
      current.thumbnailUrl ??= asset.thumbnail_url;
      continue;
    }

    groups.set(key, {
      name: getCatalogInfluencerName(asset),
      thumbnailUrl: asset.thumbnail_url,
      videoCount: 1,
    });
  }

  return Array.from(groups.entries()).map(([key, group]) => ({
    id: buildCatalogInfluencerId(key),
    name: group.name,
    sourceKind: "catalog",
    thumbnailUrl: group.thumbnailUrl,
    videoCount: group.videoCount,
  }));
}

export function getCatalogInfluencerKey(asset: CatalogAvatarMetadataRow) {
  const metadata = getRecord(asset.metadata);
  const metadataKey = getNonEmptyString(metadata?.avatar);

  if (metadataKey) {
    return normalizeKey(metadataKey);
  }

  return normalizeKey(getCatalogInfluencerName(asset));
}

export function getCatalogInfluencerName(asset: CatalogAvatarMetadataRow) {
  const [name] = asset.name.split(" - ");

  return name?.trim() || "Influencer";
}

export function buildCatalogInfluencerId(key: string) {
  return `${CATALOG_PREFIX}${normalizeKey(key)}`;
}

export function buildUserInfluencerId(assetId: string) {
  return `${USER_PREFIX}${assetId}`;
}

export function parseHookInfluencerId(value: string) {
  if (value.startsWith(CATALOG_PREFIX)) {
    const key = value.slice(CATALOG_PREFIX.length).trim();

    return key ? ({ key, sourceKind: "catalog" } as const) : null;
  }

  if (value.startsWith(USER_PREFIX)) {
    const assetId = value.slice(USER_PREFIX.length).trim();

    return assetId ? ({ assetId, sourceKind: "user" } as const) : null;
  }

  return null;
}

function normalizeKey(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "influencer"
  );
}

function getRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
