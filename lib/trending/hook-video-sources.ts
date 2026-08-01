import "server-only";

import {
  getAvatarAssetWithPreference,
  listReadyAvatarAssets,
  listReadyAvatarAssetsWithPreferences,
} from "@/lib/avatars/avatar-storage";
import type { AvatarAssetRow } from "@/lib/avatars/types";
import {
  getMediaAssetForOwner,
  listMediaAssets,
  type MediaAssetRow,
  upsertReadyMediaAsset,
} from "@/lib/media/media-storage";
import type { MediaRatio, MediaSourceType } from "@/lib/media/types";
import {
  buildCatalogInfluencerId,
  buildUserInfluencerId,
  getCatalogInfluencerKey,
  groupCatalogInfluencers,
  parseHookInfluencerId,
} from "@/lib/trending/hook-video-source-logic";
import type {
  HookDemoSummary,
  HookInfluencerSummary,
  HookInfluencerVideoSummary,
  HookVideoBrowseEntry,
  HookVideoSourceKind,
} from "@/lib/trending/hook-video-types";

const demoSourceTypes: MediaSourceType[] = [
  "demo_upload",
  "upload",
  "generated_video",
  "edit_export",
];

export class HookVideoSourceError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "HookVideoSourceError";
  }
}

export type ResolvedHookVideoSource = {
  durationSeconds: number | null;
  height: number | null;
  id: string;
  influencerId: string;
  mimeType: string;
  ratio: MediaRatio;
  sourceKind: HookVideoSourceKind;
  storageKey: string;
  thumbnailUrl: string | null;
  title: string;
  trimEnd: number | null;
  trimStart: number;
  url: string;
  width: number | null;
};

export async function listHookInfluencers(
  userId: string,
): Promise<HookInfluencerSummary[]> {
  const [catalogResult, userResult] = await Promise.allSettled([
    listReadyAvatarAssets(),
    listMediaAssets({
      collection: "influencer",
      sourceTypes: ["influencer_upload"],
      userId,
    }),
  ]);

  if (catalogResult.status === "rejected" && userResult.status === "rejected") {
    throw new Error("No influencer source could be loaded.");
  }

  if (catalogResult.status === "rejected") {
    console.warn("Could not load catalog influencers for Hook videos:", catalogResult.reason);
  }

  if (userResult.status === "rejected") {
    console.warn("Could not load user influencers for Hook videos:", userResult.reason);
  }

  const catalogInfluencers = groupCatalogInfluencers(
    catalogResult.status === "fulfilled" ? catalogResult.value : [],
  );
  const userInfluencers = (
    userResult.status === "fulfilled" ? userResult.value : []
  ).map(
    (asset): HookInfluencerSummary => ({
      id: buildUserInfluencerId(asset.id),
      name: asset.title,
      sourceKind: "user",
      thumbnailUrl: asset.thumbnail_url,
      videoCount: 1,
    }),
  );

  return [...catalogInfluencers, ...userInfluencers];
}

export async function getHookInfluencerForUser(params: {
  influencerId: string;
  sourceKind: HookVideoSourceKind;
  userId: string;
}) {
  const parsed = parseHookInfluencerId(params.influencerId);

  if (parsed?.sourceKind === "user" && params.sourceKind === "user") {
    const asset = await getMediaAssetForOwner({
      assetId: parsed.assetId,
      userId: params.userId,
    });

    if (isUserHookSourceAsset(asset)) {
      return mapUserInfluencer(asset);
    }
  }

  const influencers = await listHookInfluencers(params.userId);
  const influencer = influencers.find(
    (item) =>
      item.id === params.influencerId &&
      item.sourceKind === params.sourceKind,
  );

  if (!influencer) {
    throw new HookVideoSourceError("This influencer was not found.", 404);
  }

  return influencer;
}

export async function listHookVideoBrowseInventory(
  userId: string,
  options?: { mediaAssetIds?: readonly string[] },
): Promise<HookVideoBrowseEntry[]> {
  if (options?.mediaAssetIds) {
    const selectedIds = new Set(options.mediaAssetIds);

    if (selectedIds.size === 0) {
      return [];
    }

    const assets = await listMediaAssets({ userId });

    return assets
      .filter(
        (asset) =>
          selectedIds.has(asset.id) && isUserHookSourceAsset(asset),
      )
      .map(mapUserBrowseEntry);
  }

  const [catalogResult, userResult] = await Promise.allSettled([
    listReadyAvatarAssetsWithPreferences({ userId }),
    listMediaAssets({
      collection: "influencer",
      sourceTypes: ["influencer_upload"],
      userId,
    }),
  ]);

  if (catalogResult.status === "rejected" && userResult.status === "rejected") {
    throw new Error("No influencer video source could be loaded.");
  }

  if (catalogResult.status === "rejected") {
    console.warn(
      "Could not load catalog videos for Surprise me:",
      catalogResult.reason,
    );
  }

  if (userResult.status === "rejected") {
    console.warn(
      "Could not load user videos for Surprise me:",
      userResult.reason,
    );
  }

  const catalogRows =
    catalogResult.status === "fulfilled" ? catalogResult.value : [];
  const catalogInfluencers = groupCatalogInfluencers(
    catalogRows.map(({ asset }) => asset),
  );
  const catalogInfluencersById = new Map(
    catalogInfluencers.map((influencer) => [influencer.id, influencer]),
  );
  const catalogEntries = catalogRows.flatMap(
    ({ asset, preference }): HookVideoBrowseEntry[] => {
      const influencerId = buildCatalogInfluencerId(
        getCatalogInfluencerKey(asset),
      );
      const influencer = catalogInfluencersById.get(influencerId);

      if (!influencer) return [];

      const hasSavedTrim =
        preference?.is_trimmed === true &&
        typeof preference.trim_start === "number" &&
        typeof preference.trim_end === "number";

      return [
        {
          influencer,
          video: {
            durationSeconds: asset.duration_seconds,
            id: asset.id,
            influencerKey: asset.influencer_key,
            influencerId,
            ratio: asset.ratio,
            reactionType: getAvatarMetadataString(
              asset,
              "reactionType",
            ),
            sourceKind: "catalog",
            thumbnailUrl: asset.thumbnail_url,
            title: asset.name,
            trimEnd: hasSavedTrim
              ? preference?.trim_end ?? asset.duration_seconds
              : asset.duration_seconds,
            trimStart: hasSavedTrim ? preference?.trim_start ?? 0 : 0,
            visualGroup: asset.visual_group,
          },
        },
      ];
    },
  );

  const userEntries = (
    userResult.status === "fulfilled" ? userResult.value : []
  ).map(mapUserBrowseEntry);

  return [...catalogEntries, ...userEntries];
}

export async function listHookInfluencerVideos(params: {
  influencerId: string;
  userId: string;
}): Promise<HookInfluencerVideoSummary[]> {
  const parsed = parseHookInfluencerId(params.influencerId);

  if (!parsed) {
    throw new HookVideoSourceError("This influencer was not found.", 404);
  }

  if (parsed.sourceKind === "catalog") {
    const assets = await listReadyAvatarAssetsWithPreferences({
      userId: params.userId,
    });

    return assets
      .filter(
        ({ asset }) => getCatalogInfluencerKey(asset) === parsed.key,
      )
      .map(({ asset, preference }): HookInfluencerVideoSummary => {
        const hasSavedTrim =
          preference?.is_trimmed === true &&
          typeof preference.trim_start === "number" &&
          typeof preference.trim_end === "number";

        return {
          durationSeconds: asset.duration_seconds,
          id: asset.id,
          influencerKey: asset.influencer_key,
          influencerId: params.influencerId,
          ratio: asset.ratio,
          reactionType: getAvatarMetadataString(
            asset,
            "reactionType",
          ),
          sourceKind: "catalog",
          thumbnailUrl: asset.thumbnail_url,
          title: asset.name,
          trimEnd: hasSavedTrim
            ? preference?.trim_end ?? asset.duration_seconds
            : asset.duration_seconds,
          trimStart: hasSavedTrim ? preference?.trim_start ?? 0 : 0,
          visualGroup: asset.visual_group,
        };
      });
  }

  const asset = await getMediaAssetForOwner({
    assetId: parsed.assetId,
    userId: params.userId,
  });

  if (!isUserHookSourceAsset(asset)) {
    throw new HookVideoSourceError("This influencer was not found.", 404);
  }

  return [mapUserInfluencerVideo(asset, params.influencerId)];
}

export async function listHookDemoAssets(
  userId: string,
): Promise<HookDemoSummary[]> {
  const assets = await listMediaAssets({
    collection: "video",
    sourceTypes: demoSourceTypes,
    userId,
  });

  return assets.map((asset) => ({
    durationSeconds: asset.duration_seconds,
    id: asset.id,
    ratio: asset.ratio,
    sourceType: asset.source_type,
    thumbnailUrl: asset.thumbnail_url,
    title: asset.title,
  }));
}

export async function resolveHookVideoSource(params: {
  influencerId: string;
  sourceKind: HookVideoSourceKind;
  userId: string;
  videoId: string;
}): Promise<ResolvedHookVideoSource> {
  const parsed = parseHookInfluencerId(params.influencerId);

  if (!parsed || parsed.sourceKind !== params.sourceKind) {
    throw new HookVideoSourceError("This influencer selection is invalid.");
  }

  if (params.sourceKind === "catalog") {
    let selected;

    try {
      selected = await getAvatarAssetWithPreference({
        avatarAssetId: params.videoId,
        userId: params.userId,
      });
    } catch {
      throw new HookVideoSourceError("This influencer video was not found.", 404);
    }

    if (
      selected.asset.status !== "ready" ||
      getCatalogInfluencerKey(selected.asset) !== parsed.key
    ) {
      throw new HookVideoSourceError("This influencer video was not found.", 404);
    }

    return mapCatalogSource({
      asset: selected.asset,
      influencerId: params.influencerId,
      preference: selected.preference,
    });
  }

  if (parsed.assetId !== params.videoId) {
    throw new HookVideoSourceError(
      "This video does not belong to the selected influencer.",
    );
  }

  const asset = await getMediaAssetForOwner({
    assetId: params.videoId,
    userId: params.userId,
  });

  if (!isUserHookSourceAsset(asset)) {
    throw new HookVideoSourceError("This influencer video was not found.", 404);
  }

  return {
    durationSeconds: asset.duration_seconds,
    height: asset.height,
    id: asset.id,
    influencerId: params.influencerId,
    mimeType: asset.mime_type,
    ratio: asset.ratio,
    sourceKind: "user",
    storageKey: asset.storage_key,
    thumbnailUrl: asset.thumbnail_url,
    title: asset.title,
    trimEnd: asset.duration_seconds,
    trimStart: 0,
    url: asset.url,
    width: asset.width,
  };
}

export async function getHookDemoAsset(params: {
  assetId: string;
  userId: string;
}) {
  const asset = await getMediaAssetForOwner(params);

  if (
    !asset ||
    asset.status !== "ready" ||
    asset.collection !== "video" ||
    !demoSourceTypes.includes(asset.source_type)
  ) {
    throw new HookVideoSourceError("This product demo was not found.", 404);
  }

  return asset;
}

export async function prepareOwnedHookMediaAsset(params: {
  influencerId: string;
  sourceKind: HookVideoSourceKind;
  userId: string;
  videoId: string;
}) {
  const source = await resolveHookVideoSource(params);

  if (source.sourceKind === "user") {
    const asset = await getMediaAssetForOwner({
      assetId: source.id,
      userId: params.userId,
    });

    if (!asset) {
      throw new HookVideoSourceError("This influencer video was not found.", 404);
    }

    return asset;
  }

  return upsertReadyMediaAsset({
    assetId: crypto.randomUUID(),
    collection: "influencer",
    durationSeconds: source.durationSeconds,
    height: source.height,
    metadata: {
      avatarAssetId: source.id,
      catalog: "ugc-pilot",
      hookVideoInfluencerId: source.influencerId,
    },
    mimeType: source.mimeType,
    ratio: source.ratio,
    sourceRecordId: source.id,
    sourceType: "catalog_influencer",
    storageKey: source.storageKey,
    thumbnailUrl: source.thumbnailUrl,
    title: source.title,
    url: source.url,
    userId: params.userId,
    width: source.width,
  });
}

function mapCatalogSource(params: {
  asset: AvatarAssetRow;
  influencerId: string;
  preference: {
    is_trimmed: boolean;
    trim_end: number | null;
    trim_start: number | null;
  } | null;
}): ResolvedHookVideoSource {
  const hasSavedTrim =
    params.preference?.is_trimmed === true &&
    typeof params.preference.trim_start === "number" &&
    typeof params.preference.trim_end === "number";

  return {
    durationSeconds: params.asset.duration_seconds,
    height: params.asset.height,
    id: params.asset.id,
    influencerId: params.influencerId,
    mimeType: getVideoMimeType(params.asset.source_s3_key),
    ratio: params.asset.ratio,
    sourceKind: "catalog",
    storageKey: params.asset.source_s3_key,
    thumbnailUrl: params.asset.thumbnail_url,
    title: params.asset.name,
    trimEnd: hasSavedTrim
      ? params.preference?.trim_end ?? params.asset.duration_seconds
      : params.asset.duration_seconds,
    trimStart: hasSavedTrim ? params.preference?.trim_start ?? 0 : 0,
    url: params.asset.source_video_url,
    width: params.asset.width,
  };
}

function mapUserInfluencerVideo(
  asset: MediaAssetRow,
  influencerId: string,
): HookInfluencerVideoSummary {
  return {
    durationSeconds: asset.duration_seconds,
    id: asset.id,
    influencerKey: null,
    influencerId,
    ratio: asset.ratio,
    reactionType: null,
    sourceKind: "user",
    thumbnailUrl: asset.thumbnail_url,
    title: asset.title,
    trimEnd: asset.duration_seconds,
    trimStart: 0,
    visualGroup: null,
  };
}

function isUserHookSourceAsset(
  asset: MediaAssetRow | null,
): asset is MediaAssetRow {
  return Boolean(
    asset &&
      asset.status === "ready" &&
      (asset.collection === "influencer" || asset.collection === "video") &&
      asset.mime_type.startsWith("video/"),
  );
}

function mapUserInfluencer(asset: MediaAssetRow): HookInfluencerSummary {
  return {
    id: buildUserInfluencerId(asset.id),
    name: asset.title,
    sourceKind: "user",
    thumbnailUrl: asset.thumbnail_url,
    videoCount: 1,
  };
}

function mapUserBrowseEntry(asset: MediaAssetRow): HookVideoBrowseEntry {
  const influencer = mapUserInfluencer(asset);

  return {
    influencer,
    video: mapUserInfluencerVideo(asset, influencer.id),
  };
}

function getVideoMimeType(key: string) {
  const extension = key.split(".").pop()?.toLowerCase();

  if (extension === "webm") return "video/webm";
  if (extension === "mov") return "video/quicktime";
  return "video/mp4";
}

function getAvatarMetadataString(
  asset: AvatarAssetRow,
  key: string,
) {
  const metadata =
    asset.metadata &&
    typeof asset.metadata === "object" &&
    !Array.isArray(asset.metadata)
      ? asset.metadata
      : null;
  const value = metadata?.[key];

  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}
